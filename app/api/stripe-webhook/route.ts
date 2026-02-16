import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabase } from '@/lib/supabase';

function getStripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-01-28.clover',
    });
}

export async function POST(request: NextRequest) {
    const stripe = getStripe();
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        const shipping = session.collected_information?.shipping_details;

        const { error } = await getSupabase()
            .from('orders')
            .update({
                status: 'paid',
                customer_email: session.customer_details?.email || null,
                shipping_name: shipping?.name || null,
                shipping_address: shipping?.address || null,
            })
            .eq('stripe_session_id', session.id);

        if (error) {
            console.error('Failed to update order status:', error);
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }

        console.log(`Order for session ${session.id} marked as paid`);
    }

    return NextResponse.json({ received: true });
}
