const PRINTFUL_API = 'https://api.printful.com';

function getHeaders() {
    return {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json',
    };
}

export interface ShippingItem {
    variant_id: string;
    quantity: number;
}

export interface ShippingRateResult {
    id: string;
    name: string;          // e.g. "STANDARD", "EXPRESS"
    rate: string;           // price as string e.g. "4.99"
    currency: string;       // e.g. "USD"
    minDeliveryDays: number;
    maxDeliveryDays: number;
}

/**
 * Get shipping rates from Printful for a set of items to a destination country.
 * Printful returns rates in USD — caller should convert to target currency.
 */
export async function getShippingRates(
    countryCode: string,
    items: ShippingItem[],
    stateCode?: string
): Promise<ShippingRateResult[]> {
    const recipient: Record<string, string> = { country_code: countryCode };
    if (stateCode) recipient.state_code = stateCode;

    const body = {
        recipient,
        items: items.map(item => ({
            variant_id: item.variant_id,
            quantity: item.quantity,
        })),
    };

    const res = await fetch(`${PRINTFUL_API}/shipping/rates`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Printful shipping rates error:', err);
        return [];
    }

    const data = await res.json();
    const results: ShippingRateResult[] = (data.result || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: r.name as string,
        rate: r.rate as string,
        currency: r.currency as string,
        minDeliveryDays: r.minDeliveryDays as number ?? r.min_delivery_days as number ?? 5,
        maxDeliveryDays: r.maxDeliveryDays as number ?? r.max_delivery_days as number ?? 14,
    }));

    return results;
}

// --- Order Creation ---

export interface PrintfulRecipient {
    name: string;
    email?: string;
    address1: string;
    address2?: string;
    city: string;
    state_code?: string;
    country_code: string;
    zip: string;
}

export interface PrintfulOrderItem {
    variantId: string;   // from config/products.ts printfulVariantId
    quantity: number;
    imageUrl: string;    // public Supabase Storage URL
}

export interface PrintfulOrderResult {
    printfulOrderId: number;
    status: string;
}

/**
 * Whether orders should be confirmed (submitted for fulfillment) automatically.
 *
 * Default: ON. A paid Stripe order that sits as a Printful draft is never
 * printed, so we confirm as soon as the order is created. Set
 * PRINTFUL_AUTO_CONFIRM=false to create drafts only (e.g. local dev with a
 * live Printful key, or when you deliberately want to review every order by
 * hand in the Printful dashboard).
 */
export function isAutoConfirmEnabled(): boolean {
    const raw = process.env.PRINTFUL_AUTO_CONFIRM;
    if (raw === undefined || raw === '') return true;
    return !['false', '0', 'no', 'off'].includes(raw.trim().toLowerCase());
}

/**
 * Create an order in Printful.
 *
 * The order is created as a draft and then — when auto-confirm is enabled —
 * confirmed in a second call. Two calls (rather than POST /orders?confirm=1)
 * so that if confirmation fails (billing issue, Printful outage) we still have
 * a draft we can retry from the daily sweep instead of losing the order.
 */
export async function createPrintfulOrder(params: {
    externalId: string;
    recipient: PrintfulRecipient;
    items: PrintfulOrderItem[];
    confirm?: boolean;
}): Promise<PrintfulOrderResult | null> {
    const body = {
        external_id: params.externalId,
        recipient: params.recipient,
        items: params.items.map(item => ({
            variant_id: parseInt(item.variantId, 10),
            quantity: item.quantity,
            files: [
                {
                    type: 'default',
                    url: item.imageUrl,
                },
            ],
        })),
    };

    let created: PrintfulOrderResult;
    try {
        const res = await fetch(`${PRINTFUL_API}/orders`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('Printful create order error:', data);
            return null;
        }

        created = {
            printfulOrderId: data.result.id,
            status: data.result.status,
        };
    } catch (err) {
        console.error('Printful create order failed:', err);
        return null;
    }

    const shouldConfirm = params.confirm ?? isAutoConfirmEnabled();
    if (!shouldConfirm || created.status !== 'draft') {
        return created;
    }

    const confirmed = await confirmPrintfulOrder(created.printfulOrderId);
    // If confirmation failed we still return the draft so the caller can
    // record the Printful order ID; the daily sweep will retry confirmation.
    return confirmed ?? created;
}

/**
 * Confirm (submit for fulfillment) an existing Printful order.
 * Moves the order from `draft` to `pending`. Returns null on failure.
 */
export async function confirmPrintfulOrder(
    printfulOrderId: number | string
): Promise<PrintfulOrderResult | null> {
    try {
        const res = await fetch(`${PRINTFUL_API}/orders/${printfulOrderId}/confirm`, {
            method: 'POST',
            headers: getHeaders(),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error(`Printful confirm order ${printfulOrderId} error:`, data);
            return null;
        }

        return {
            printfulOrderId: data.result.id,
            status: data.result.status,
        };
    } catch (err) {
        console.error(`Printful confirm order ${printfulOrderId} failed:`, err);
        return null;
    }
}

export interface PrintfulDraftOrder {
    id: number;
    externalId: string | null;
    status: string;
    created: number; // unix seconds
}

/**
 * List every order currently sitting in `draft` in the Printful store.
 * Used by the daily sweep to catch orders that were never confirmed.
 */
export async function listPrintfulDraftOrders(): Promise<PrintfulDraftOrder[] | null> {
    const drafts: PrintfulDraftOrder[] = [];
    const limit = 100;
    let offset = 0;

    try {
        // Printful caps `limit` at 100; page until we've seen `paging.total`.
        for (;;) {
            const res = await fetch(
                `${PRINTFUL_API}/orders?status=draft&limit=${limit}&offset=${offset}`,
                { headers: getHeaders() }
            );
            const data = await res.json();

            if (!res.ok) {
                console.error('Printful list draft orders error:', data);
                return null;
            }

            const page = (data.result || []) as Record<string, unknown>[];
            for (const o of page) {
                drafts.push({
                    id: o.id as number,
                    externalId: (o.external_id as string | null) ?? null,
                    status: o.status as string,
                    created: o.created as number,
                });
            }

            const total = (data.paging?.total as number | undefined) ?? page.length;
            offset += page.length;
            if (page.length === 0 || offset >= total) break;
        }
    } catch (err) {
        console.error('Printful list draft orders failed:', err);
        return null;
    }

    return drafts;
}
