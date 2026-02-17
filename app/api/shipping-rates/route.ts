import { NextRequest, NextResponse } from 'next/server';
import { getShippingRates, ShippingItem } from '@/lib/printful';
import { PRODUCTS, ProductType, PrintSize } from '@/config/products';

interface ShippingRateRequest {
    countryCode: string;
    stateCode?: string;
    items: Array<{
        productType: ProductType;
        size: PrintSize;
        quantity: number;
    }>;
}

export async function POST(request: NextRequest) {
    try {
        const body: ShippingRateRequest = await request.json();
        const { countryCode, stateCode, items } = body;

        if (!countryCode || !items?.length) {
            return NextResponse.json({ error: 'Missing country or items' }, { status: 400 });
        }

        // Map cart items to Printful variant IDs
        const printfulItems: ShippingItem[] = [];
        for (const item of items) {
            const variant = PRODUCTS[item.productType]?.sizes[item.size];
            if (!variant?.printfulVariantId) continue;
            printfulItems.push({
                variant_id: variant.printfulVariantId,
                quantity: item.quantity,
            });
        }

        if (printfulItems.length === 0) {
            return NextResponse.json({ error: 'No valid items' }, { status: 400 });
        }

        const rates = await getShippingRates(countryCode, printfulItems, stateCode);

        return NextResponse.json({ rates });
    } catch (err) {
        console.error('Shipping rates error:', err);
        return NextResponse.json({ error: 'Failed to get shipping rates' }, { status: 500 });
    }
}
