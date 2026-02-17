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
 * Create a draft order in Printful.
 * Orders are NOT auto-confirmed — review in Printful dashboard before confirming.
 * Set `confirm: true` in the body when ready for auto-fulfillment.
 */
export async function createPrintfulOrder(params: {
    externalId: string;
    recipient: PrintfulRecipient;
    items: PrintfulOrderItem[];
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

        return {
            printfulOrderId: data.result.id,
            status: data.result.status,
        };
    } catch (err) {
        console.error('Printful create order failed:', err);
        return null;
    }
}
