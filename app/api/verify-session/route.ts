import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabase } from '@/lib/supabase';

function getStripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-01-28.clover',
    });
}

export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get('session_id');

    if (!sessionId) {
        return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const shipping = session.collected_information?.shipping_details;

            await getSupabase()
                .from('orders')
                .update({
                    status: 'paid',
                    customer_email: session.customer_details?.email || null,
                    shipping_name: shipping?.name || null,
                    shipping_address: shipping?.address || null,
                })
                .eq('stripe_session_id', session.id);
        }

        return NextResponse.json({
            status: session.payment_status,
            customerEmail: session.customer_details?.email || null,
        });
    } catch (err) {
        console.error('Session verification error:', err);
        return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 });
    }
}
