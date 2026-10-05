import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import {
    confirmPrintfulOrder,
    isAutoConfirmEnabled,
    listPrintfulDraftOrders,
} from '@/lib/printful';

/**
 * Daily Printful draft sweep.
 *
 * Safety net for the Stripe webhook: any paid order whose Printful order is
 * still a `draft` (confirmation failed, Printful was down, auto-confirm was
 * temporarily off) gets confirmed here. Runs daily via Vercel Cron
 * (see vercel.json) and can be triggered manually with the same secret.
 *
 * The source of truth is Printful's own draft list, not our DB status, so a
 * webhook race that mislabels a draft as 'submitted' cannot hide it.
 *
 * Drafts with no matching paid order in our DB (created by hand in the
 * Printful dashboard, test orders, etc.) are reported but never confirmed.
 *
 * Response is 200 when nothing is left unconfirmed, 500 otherwise — Vercel
 * marks the cron run as failed, which is the alert channel for the owner.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Only sweep drafts older than this; very fresh ones may still be mid-webhook.
const MIN_AGE_MS = 15 * 60 * 1000;

function isAuthorized(request: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error('printful-drafts cron: CRON_SECRET is not set');
        return false;
    }
    return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const drafts = await listPrintfulDraftOrders();
    if (drafts === null) {
        return NextResponse.json(
            { error: 'Could not list Printful draft orders' },
            { status: 500 }
        );
    }

    const supabase = getSupabase();
    const now = Date.now();

    const confirmed: number[] = [];
    const failed: { id: number; externalId: string | null }[] = [];
    const skippedUnknown: { id: number; externalId: string | null }[] = [];
    const skippedUnpaid: { id: number; externalId: string | null }[] = [];
    const skippedTooNew: number[] = [];

    for (const draft of drafts) {
        if (now - draft.created * 1000 < MIN_AGE_MS) {
            skippedTooNew.push(draft.id);
            continue;
        }

        // Only confirm drafts that correspond to a paid order in our DB.
        const { data: rows, error } = draft.externalId
            ? await supabase
                .from('orders')
                .select('id, status')
                .eq('stripe_session_id', draft.externalId)
            : await supabase
                .from('orders')
                .select('id, status')
                .eq('printful_order_id', String(draft.id));

        if (error) {
            console.error(`printful-drafts cron: DB lookup failed for draft ${draft.id}`, error);
            failed.push({ id: draft.id, externalId: draft.externalId });
            continue;
        }

        if (!rows || rows.length === 0) {
            skippedUnknown.push({ id: draft.id, externalId: draft.externalId });
            continue;
        }

        if (!rows.every(r => r.status === 'paid')) {
            skippedUnpaid.push({ id: draft.id, externalId: draft.externalId });
            continue;
        }

        const result = await confirmPrintfulOrder(draft.id);
        if (!result || result.status === 'draft') {
            failed.push({ id: draft.id, externalId: draft.externalId });
            await supabase
                .from('orders')
                .update({ printful_status: 'draft', printful_order_id: String(draft.id) })
                .in('id', rows.map(r => r.id));
            continue;
        }

        confirmed.push(draft.id);
        await supabase
            .from('orders')
            .update({ printful_status: 'submitted', printful_order_id: String(draft.id) })
            .in('id', rows.map(r => r.id));
        console.log(`printful-drafts cron: confirmed Printful order ${draft.id} (${draft.externalId ?? 'no external id'})`);
    }

    const needsAttention = failed.length > 0 || skippedUnpaid.length > 0;

    const summary = {
        autoConfirmEnabled: isAutoConfirmEnabled(),
        draftsFound: drafts.length,
        confirmed,
        failed,
        skippedUnpaid,
        skippedUnknown,
        skippedTooNew,
    };

    if (needsAttention) {
        console.error('printful-drafts cron: drafts need manual attention', JSON.stringify(summary));
        return NextResponse.json(summary, { status: 500 });
    }

    console.log('printful-drafts cron: ok', JSON.stringify(summary));
    return NextResponse.json(summary);
}
