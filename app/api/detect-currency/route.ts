import { NextRequest, NextResponse } from 'next/server';
import { getCurrencyForCountry } from '@/config/currency';

export async function GET(request: NextRequest) {
    // Vercel provides the user's country via this header
    const country = request.headers.get('x-vercel-ip-country')
        // Cloudflare
        || request.headers.get('cf-ipcountry')
        || null;

    const currency = getCurrencyForCountry(country);

    return NextResponse.json({
        countryCode: country,
        currency: currency.code,
        symbol: currency.symbol,
        rate: currency.rate,
        zeroDecimal: currency.zeroDecimal,
    });
}
