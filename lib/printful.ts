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
