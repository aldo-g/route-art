import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PRINT_SIZES, PrintSize } from '@/config/products';
import { savePoster } from '@/lib/savePoster';
import { getSupabase } from '@/lib/supabase';

function getStripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-01-28.clover',
    });
}

export async function POST(request: NextRequest) {
    try {
        const stripe = getStripe();
        const { routeId, size, imageBase64, routeName, config } = await request.json();

        if (!routeId || !size || !routeName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const sizeConfig = PRINT_SIZES[size as PrintSize];
        if (!sizeConfig) {
            return NextResponse.json({ error: 'Invalid size' }, { status: 400 });
        }

        // Upload poster to Supabase storage
        let posterId: string | undefined;
        let posterImageUrl: string | undefined;

        if (imageBase64) {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const imageBlob = new Blob([buffer], { type: 'image/png' });

            const result = await savePoster({
                imageBlob,
                routeName,
                config: config || {},
            });

            posterId = result.posterId;
            posterImageUrl = result.imageUrl;
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
                            images: posterImageUrl ? [posterImageUrl] : [],
                        },
                        unit_amount: sizeConfig.price,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            shipping_address_collection: {
                allowed_countries: [
                    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
                    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
                    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
                    'GB', 'CH', 'NO', 'IS',
                    'US', 'CA', 'AU', 'NZ', 'JP',
                ],
            },
            success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/checkout/cancel`,
            metadata: {
                poster_id: posterId || '',
                size,
                routeName,
            },
        });

        // Record order in Supabase
        if (posterId) {
            await getSupabase().from('orders').insert({
                poster_id: posterId,
                stripe_session_id: session.id,
                size,
                price: sizeConfig.price,
                status: 'pending',
            });
        }

        return NextResponse.json({ url: session.url });
    } catch (err) {
        console.error('Stripe checkout error:', err);
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
