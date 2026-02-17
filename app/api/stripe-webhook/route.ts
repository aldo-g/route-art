import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabase } from '@/lib/supabase';
import { createPrintfulOrder, PrintfulRecipient } from '@/lib/printful';
import { PRODUCTS, ProductType, PrintSize } from '@/config/products';

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
        const supabase = getSupabase();

        const shipping = session.collected_information?.shipping_details;

        // 1. Mark orders as paid
        const { error } = await supabase
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

        // 2. Submit order to Printful for fulfillment
        try {
            // Fetch order rows for this session
            const { data: orderRows } = await supabase
                .from('orders')
                .select('*')
                .eq('stripe_session_id', session.id);

            if (!orderRows || orderRows.length === 0) {
                console.error('No order rows found for Printful submission');
                return NextResponse.json({ received: true });
            }

            // Fetch poster image URLs
            const posterIds = [...new Set(orderRows.map(o => o.poster_id).filter(Boolean))];
            const { data: posters } = posterIds.length > 0
                ? await supabase.from('posters').select('id, image_url').in('id', posterIds)
                : { data: [] };

            const posterMap = new Map((posters || []).map(p => [p.id, p.image_url as string]));

            // Build Printful order items
            const printfulItems = orderRows
                .map(order => {
                    const productType = (order.product_type || 'poster') as ProductType;
                    const size = order.size as PrintSize;
                    const variant = PRODUCTS[productType]?.sizes[size];
                    const imageUrl = posterMap.get(order.poster_id);

                    if (!variant?.printfulVariantId || !imageUrl) {
                        console.warn(`Skipping order ${order.id}: missing variant or image`);
                        return null;
                    }

                    return {
                        variantId: variant.printfulVariantId,
                        quantity: order.quantity || 1,
                        imageUrl,
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            if (printfulItems.length === 0) {
                console.error('No valid items for Printful order');
                await supabase
                    .from('orders')
                    .update({ printful_status: 'failed' })
                    .eq('stripe_session_id', session.id);
                return NextResponse.json({ received: true });
            }

            // Build recipient from Stripe shipping details
            const addr = shipping?.address;
            const recipient: PrintfulRecipient = {
                name: shipping?.name || 'Customer',
                email: session.customer_details?.email || undefined,
                address1: addr?.line1 || '',
                address2: addr?.line2 || undefined,
                city: addr?.city || '',
                state_code: addr?.state || undefined,
                country_code: addr?.country || 'DE',
                zip: addr?.postal_code || '',
            };

            // Create Printful order (as draft — review before confirming)
            const result = await createPrintfulOrder({
                externalId: session.id,
                recipient,
                items: printfulItems,
            });

            if (result) {
                await supabase
                    .from('orders')
                    .update({
                        printful_order_id: String(result.printfulOrderId),
                        printful_status: 'submitted',
                    })
                    .eq('stripe_session_id', session.id);

                console.log(`Printful order ${result.printfulOrderId} created for session ${session.id}`);
            } else {
                await supabase
                    .from('orders')
                    .update({ printful_status: 'failed' })
                    .eq('stripe_session_id', session.id);

                console.error(`Printful order creation failed for session ${session.id}`);
            }
        } catch (err) {
            console.error('Printful fulfillment error:', err);
            // Don't return 500 — Stripe would retry the webhook
            await getSupabase()
                .from('orders')
                .update({ printful_status: 'failed' })
                .eq('stripe_session_id', session.id);
        }
    }

    return NextResponse.json({ received: true });
}
