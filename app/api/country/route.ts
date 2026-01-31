// app/api/country/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface CountryRequest {
    lat: number;
    lng: number;
}

export interface CountryResponse {
    countryCode: string | null;
    countryName: string | null;
}

export async function POST(request: NextRequest) {
    try {
        const { lat, lng }: CountryRequest = await request.json();

        // Use Nominatim reverse geocoding (free, no API key required)
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3`,
            {
                headers: {
                    'User-Agent': 'RouteArt/1.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.status}`);
        }

        const data = await response.json();

        return NextResponse.json({
            countryCode: data.address?.country_code?.toUpperCase() || null,
            countryName: data.address?.country || null
        });

    } catch (error) {
        console.error('Country API error:', error);
        return NextResponse.json(
            { countryCode: null, countryName: null },
            { status: 200 } // Return 200 with null values so app continues
        );
    }
}
