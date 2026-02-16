import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PRODUCTS, getVariant, PrintSize, ProductType } from '@/config/products';
import { CURRENCIES, CurrencyConfig, convertPrice } from '@/config/currency';
import { savePoster } from '@/lib/savePoster';
import { getSupabase } from '@/lib/supabase';

function getStripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-01-28.clover',
    });
}

interface CheckoutItem {
    routeId: string;
    routeName: string;
    productType: ProductType;
    size: PrintSize;
    quantity: number;
    imageBase64: string;
    config?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
    try {
        const stripe = getStripe();
        const body = await request.json();

        const items: CheckoutItem[] = body.items;
        const currencyCode = (body.currency || 'eur').toLowerCase();
        const currency: CurrencyConfig = Object.values(CURRENCIES).find(c => c.code === currencyCode) || CURRENCIES.EUR;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No items provided' }, { status: 400 });
        }

        // Upload all posters in parallel
        const uploadResults = await Promise.all(
            items.map(async (item) => {
                const productType = item.productType || 'poster';
                const product = PRODUCTS[productType];
                const variant = getVariant(productType, item.size);
                if (!variant) throw new Error(`Invalid product/size: ${productType}/${item.size}`);

                let posterId: string | undefined;
                let posterImageUrl: string | undefined;

                if (item.imageBase64) {
                    const base64Data = item.imageBase64.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');
                    const imageBlob = new Blob([buffer], { type: 'image/png' });

                    const result = await savePoster({
                        imageBlob,
                        routeName: item.routeName,
                        config: item.config || {},
                    });

                    posterId = result.posterId;
                    posterImageUrl = result.imageUrl;
                }

                return { item, product, variant, posterId, posterImageUrl };
            })
        );

        // Build Stripe line items with converted currency
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = uploadResults.map(
            ({ item, product, variant, posterImageUrl }) => ({
                price_data: {
                    currency: currency.code,
                    product_data: {
                        name: `${item.routeName} — ${product.label} (${item.size})`,
                        description: `${product.description} ${variant.dimensions}`,
                        images: posterImageUrl ? [posterImageUrl] : [],
                    },
                    unit_amount: convertPrice(variant.price, currency),
                },
                quantity: item.quantity || 1,
            })
        );

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
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
                item_count: String(items.length),
                currency: currency.code,
            },
        });

        // Insert one order row per item
        const orderRows = uploadResults
            .filter(({ posterId }) => posterId)
            .map(({ item, variant, posterId }) => ({
                poster_id: posterId,
                stripe_session_id: session.id,
                product_type: item.productType || 'poster',
                size: item.size,
                quantity: item.quantity || 1,
                price: convertPrice(variant.price, currency),
                currency: currency.code,
                status: 'pending',
            }));

        if (orderRows.length > 0) {
            await getSupabase().from('orders').insert(orderRows);
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
