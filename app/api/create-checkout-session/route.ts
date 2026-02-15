import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PRINT_SIZES, PrintSize } from '@/config/products';
import { createOrder } from '@/lib/orders';

function getStripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-01-28.clover',
    });
}

export async function POST(request: NextRequest) {
    try {
        const stripe = getStripe();
        const { routeId, size, imageUrl, routeName } = await request.json();

        if (!routeId || !size || !routeName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const sizeConfig = PRINT_SIZES[size as PrintSize];
        if (!sizeConfig) {
            return NextResponse.json({ error: 'Invalid size' }, { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `${routeName} — ${sizeConfig.label} Print`,
                            description: `Museum-quality archival matte paper (200gsm), giclée printed. ${sizeConfig.dimensions}`,
                            images: imageUrl ? [imageUrl] : [],
                        },
                        unit_amount: sizeConfig.price,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/checkout/cancel`,
            metadata: {
                routeId,
                size,
                imageUrl: imageUrl || '',
                routeName,
            },
        });

        // Record order
        createOrder({
            stripe_session_id: session.id,
            route_id: routeId,
            route_name: routeName,
            size,
            image_url: imageUrl || '',
            price: sizeConfig.price,
            status: 'pending',
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        console.error('Stripe checkout error:', err);
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
