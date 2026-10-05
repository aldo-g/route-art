import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PRODUCTS, getVariant, PrintSize, ProductType } from '@/config/products';
import { CURRENCIES, CurrencyConfig, convertPrice } from '@/config/currency';
import { getShippingRates, ShippingItem } from '@/lib/printful';
import { shippingQuoteToEurCents, fallbackShipping } from '@/config/shipping';
import { getSupabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { POSTER_BUCKET, printFilePath, UUID_RE } from '@/lib/poster-storage';
import { PRODUCT_TAX_CODE, SHIPPING_TAX_CODE, getTaxBehavior, isAutomaticTaxEnabled } from '@/config/tax';

function getStripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-01-28.clover',
    });
}

interface CheckoutItem {
    /** Poster row whose print file was uploaded when the item was added to the cart. */
    posterId: string;
    productType: ProductType;
    size: PrintSize;
    quantity: number;
}

const MAX_ITEMS = 10;
const MAX_QUANTITY = 20;

interface PosterRow {
    id: string;
    route_name: string;
    image_url: string;
    preview_url: string | null;
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
        const taxBehavior = getTaxBehavior(currency.code);

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No items provided' }, { status: 400 });
        }
        if (items.length > MAX_ITEMS) {
            return NextResponse.json({ error: `At most ${MAX_ITEMS} items per order` }, { status: 400 });
        }

        // Validate every item before touching storage or Stripe
        for (const item of items) {
            if (typeof item.posterId !== 'string' || !UUID_RE.test(item.posterId)) {
                return NextResponse.json({ error: 'Invalid poster reference' }, { status: 400 });
            }
            const productType = item.productType || 'poster';
            if (!PRODUCTS[productType]?.sizes[item.size]) {
                return NextResponse.json({ error: `Invalid product/size: ${productType}/${item.size}` }, { status: 400 });
            }
            const qty = item.quantity ?? 1;
            if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
                return NextResponse.json({ error: `Quantity must be between 1 and ${MAX_QUANTITY}` }, { status: 400 });
            }
        }

        // Print files were uploaded straight to storage when the items were added to the
        // cart. Confirm each poster row exists and its print file actually landed before
        // taking payment, so we never sell a print we cannot send to Printful.
        const supabase = getSupabase();
        const posterIds = [...new Set(items.map(i => i.posterId))];
        const { data: posterRows, error: posterError } = await supabase
            .from('posters')
            .select('id, route_name, image_url, preview_url')
            .in('id', posterIds);
        if (posterError) throw posterError;

        const posterMap = new Map((posterRows || []).map((p: PosterRow) => [p.id, p]));
        const bucket = supabase.storage.from(POSTER_BUCKET);
        for (const id of posterIds) {
            if (!posterMap.has(id)) {
                return NextResponse.json({ error: 'Poster not found. Please re-add it to your cart.' }, { status: 400 });
            }
            const { data: exists, error: existsError } = await bucket.exists(printFilePath(id));
            if (existsError || !exists) {
                return NextResponse.json(
                    { error: 'The print file for one of your posters is missing. Please re-add it to your cart.' },
                    { status: 400 }
                );
            }
        }

        const uploadResults = items.map((item) => {
            const productType = item.productType || 'poster';
            const product = PRODUCTS[productType];
            const variant = getVariant(productType, item.size)!;
            const poster = posterMap.get(item.posterId)!;
            return {
                item,
                product,
                variant,
                posterId: poster.id,
                routeName: poster.route_name,
                // Stripe fetches this to show in Checkout; the preview is small, the print file is not.
                posterImageUrl: poster.preview_url || poster.image_url,
            };
        });

        // Build Stripe line items with converted currency
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = uploadResults.map(
            ({ item, product, variant, routeName, posterImageUrl }) => ({
                price_data: {
                    currency: currency.code,
                    tax_behavior: taxBehavior,
                    product_data: {
                        tax_code: PRODUCT_TAX_CODE,
                        name: `${routeName} — ${product.label} (${variant.label})`,
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

        // Convert Printful quotes (whatever currency they report) → EUR cents → user's currency
        const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = shippingRates
            .filter(r => r.id === 'STANDARD') // only show standard shipping
            .flatMap(rate => {
                const eurCents = shippingQuoteToEurCents(rate);
                if (eurCents === null) {
                    console.error('Unusable Printful shipping quote:', rate);
                    return [];
                }
                const targetAmount = convertPrice(eurCents, currency);

                return [{
                    shipping_rate_data: {
                        type: 'fixed_amount' as const,
                        fixed_amount: {
                            amount: targetAmount,
                            currency: currency.code,
                        },
                        tax_behavior: taxBehavior,
                        tax_code: SHIPPING_TAX_CODE,
                        display_name: 'Standard Shipping',
                        delivery_estimate: {
                            minimum: { unit: 'business_day' as const, value: rate.minDeliveryDays },
                            maximum: { unit: 'business_day' as const, value: rate.maxDeliveryDays },
                        },
                    },
                }];
            });

        // Fallback if Printful couldn't quote: region-aware estimate from config/shipping
        if (shippingOptions.length === 0) {
            const itemCount = printfulShippingItems.reduce((sum, i) => sum + i.quantity, 0);
            const fallback = fallbackShipping(countryCode, itemCount);
            console.warn('Printful shipping quote unavailable, using fallback', { countryCode, itemCount, fallback });
            shippingOptions.push({
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                        amount: convertPrice(fallback.eurCents, currency),
                        currency: currency.code,
                    },
                    tax_behavior: taxBehavior,
                    tax_code: SHIPPING_TAX_CODE,
                    display_name: 'Standard Shipping',
                    delivery_estimate: {
                        minimum: { unit: 'business_day', value: fallback.minDays },
                        maximum: { unit: 'business_day', value: fallback.maxDays },
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
            automatic_tax: { enabled: isAutomaticTaxEnabled() },
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
                tax_behavior: taxBehavior,
            },
        });

        // Insert one order row per item
        const orderRows = uploadResults
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

        const { error: orderError } = await supabase.from('orders').insert(orderRows);
        if (orderError) throw orderError;

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
