// app/api/strava/activities/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
            { error: 'Missing authorization token' },
            { status: 401 }
        );
    }

    const accessToken = authHeader.slice(7);
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const perPage = searchParams.get('per_page') || '30';

    try {
        const response = await fetch(
            `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                return NextResponse.json(
                    { error: 'Token expired or invalid' },
                    { status: 401 }
                );
            }
            const errorData = await response.json();
            console.error('Strava activities fetch failed:', errorData);
            return NextResponse.json(
                { error: 'Failed to fetch activities' },
                { status: response.status }
            );
        }

        const activities = await response.json();
        return NextResponse.json(activities);
    } catch (err) {
        console.error('Strava activities error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch activities' },
            { status: 500 }
        );
    }
}
