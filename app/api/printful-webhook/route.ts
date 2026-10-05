import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Printful Webhook Handler
 *
 * Listens for Printful order status events and updates the printful_status
 * column in the orders table. Configure this URL in Printful dashboard:
 *   Settings → Stores → Webhooks → https://contourmapstudio.com/api/printful-webhook
 *
 * Printful webhook payload shape (v1):
 *   { type: string, created: number, retries: number, store: number, data: { order: { ... } } }
 *
 * We match orders via external_id (our Stripe session ID).
 */

// Map Printful event types to our printful_status values
const STATUS_MAP: Record<string, string> = {
    'order_created': 'submitted',
    'order_updated': 'in_production',
    'order_failed': 'failed',
    'order_canceled': 'canceled',
    'package_shipped': 'shipped',
    'package_returned': 'returned',
    'order_put_hold': 'on_hold',
    'order_remove_hold': 'in_production',
    'order_refunded': 'refunded',
};

export async function POST(request: NextRequest) {
    const rateLimitResponse = await checkRateLimit(request, {
        name: 'printful-webhook',
        requests: 60,
        window: '1 m',
    });
    if (rateLimitResponse) return rateLimitResponse;

    // Verify the webhook comes from Printful by checking the secret header
    const webhookSecret = process.env.PRINTFUL_WEBHOOK_SECRET;
    if (webhookSecret) {
        const providedSecret = request.headers.get('x-printful-secret');
        if (providedSecret !== webhookSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = body.type as string | undefined;
    if (!eventType) {
        return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    const newStatus = STATUS_MAP[eventType];
    if (!newStatus) {
        // Event type we don't care about (product_synced, stock_updated, etc.)
        return NextResponse.json({ received: true });
    }

    // Extract order data — Printful nests it under data.order
    const data = body.data as Record<string, unknown> | undefined;
    const order = data?.order as Record<string, unknown> | undefined;

    if (!order) {
        console.error(`Printful webhook ${eventType}: missing order data`);
        return NextResponse.json({ error: 'Missing order data' }, { status: 400 });
    }

    const externalId = order.external_id as string | undefined;
    const printfulOrderId = order.id as number | undefined;

    if (!externalId && !printfulOrderId) {
        console.error(`Printful webhook ${eventType}: no external_id or order id`);
        return NextResponse.json({ error: 'Cannot identify order' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Build the update payload
    const update: Record<string, string> = { printful_status: newStatus };
    if (printfulOrderId) {
        update.printful_order_id = String(printfulOrderId);
    }

    // Match by external_id (Stripe session ID) first, fall back to printful_order_id
    let query;
    if (externalId) {
        query = supabase
            .from('orders')
            .update(update)
            .eq('stripe_session_id', externalId);
    } else {
        query = supabase
            .from('orders')
            .update(update)
            .eq('printful_order_id', String(printfulOrderId));
    }

    const { error } = await query;

    if (error) {
        console.error(`Printful webhook ${eventType} DB update failed:`, error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    console.log(`Printful webhook: ${eventType} → ${newStatus} for ${externalId || printfulOrderId}`);
    return NextResponse.json({ received: true });
}
