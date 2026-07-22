// app/api/strava/activity/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
            { error: 'Missing authorization token' },
            { status: 401 }
        );
    }

    const accessToken = authHeader.slice(7);

    const rateLimitResponse = await checkRateLimit(request, {
        name: 'strava-activity',
        requests: 30,
        window: '1 m',
        identifier: () => accessToken,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const response = await fetch(
            `https://www.strava.com/api/v3/activities/${id}?include_all_efforts=false`,
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
            console.error('Strava activity fetch failed:', errorData);
            return NextResponse.json(
                { error: 'Failed to fetch activity' },
                { status: response.status }
            );
        }

        const activity = await response.json();
        return NextResponse.json(activity);
    } catch (err) {
        console.error('Strava activity error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch activity' },
            { status: 500 }
        );
    }
}
