import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PRODUCTS, getVariant, PrintSize, ProductType } from '@/config/products';
import { CURRENCIES, CurrencyConfig, convertPrice } from '@/config/currency';
import { getShippingRates, ShippingItem } from '@/lib/printful';
import { savePoster } from '@/lib/savePoster';
import { getSupabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';

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
    const rateLimitResponse = await checkRateLimit(request, {
        name: 'create-checkout-session',
        requests: 10,
        window: '1 m',
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const stripe = getStripe();
        const body = await request.json();

        const items: CheckoutItem[] = body.items;
        const countryCode: string = body.countryCode || 'DE'; // fallback to Germany for shipping estimate
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

        // Fetch shipping rates from Printful
        const printfulShippingItems: ShippingItem[] = items
            .map(item => {
                const v = PRODUCTS[item.productType || 'poster']?.sizes[item.size];
                return v?.printfulVariantId ? { variant_id: v.printfulVariantId, quantity: item.quantity || 1 } : null;
            })
            .filter((x): x is ShippingItem => x !== null);

        const shippingRates = await getShippingRates(countryCode, printfulShippingItems);

        // Convert Printful shipping rates (in AUD) to Stripe shipping_options in user's currency
        // AUD rate relative to EUR: use CURRENCIES.AUD.rate to convert AUD → EUR → target currency
        const audRate = CURRENCIES.AUD?.rate || 1.65;
        const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = shippingRates
            .filter(r => r.id === 'STANDARD') // only show standard shipping
            .map(rate => {
                const rateAud = parseFloat(rate.rate);
                // Convert AUD → EUR cents, then EUR cents → target currency
                const eurCents = Math.round((rateAud / audRate) * 100);
                const targetAmount = convertPrice(eurCents, currency);
                const deliveryEstimate = rate.minDeliveryDays === rate.maxDeliveryDays
                    ? `${rate.minDeliveryDays} business days`
                    : `${rate.minDeliveryDays}–${rate.maxDeliveryDays} business days`;

                return {
                    shipping_rate_data: {
                        type: 'fixed_amount' as const,
                        fixed_amount: {
                            amount: targetAmount,
                            currency: currency.code,
                        },
                        display_name: 'Standard Shipping',
                        delivery_estimate: {
                            minimum: { unit: 'business_day' as const, value: rate.minDeliveryDays },
                            maximum: { unit: 'business_day' as const, value: rate.maxDeliveryDays },
                        },
                    },
                };
            });

        // Fallback if Printful didn't return rates
        if (shippingOptions.length === 0) {
            shippingOptions.push({
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                        amount: convertPrice(500, currency), // €5 fallback
                        currency: currency.code,
                    },
                    display_name: 'Standard Shipping',
                    delivery_estimate: {
                        minimum: { unit: 'business_day', value: 5 },
                        maximum: { unit: 'business_day', value: 14 },
                    },
                },
            });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            shipping_options: shippingOptions,
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
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Checkout session error:', message, err);
        return NextResponse.json(
            { error: `Failed to create checkout session: ${message}` },
            { status: 500 }
        );
    }
}
