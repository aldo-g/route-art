// app/api/strava/activity/[id]/streams/route.ts
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
        name: 'strava-activity-streams',
        requests: 30,
        window: '1 m',
        identifier: () => accessToken,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
        // The altitude stream is the full per-point series Strava derives its own
        // elevation totals from. splits_metric only carries net change per kilometre,
        // which cancels out any climb and descent inside a split.
        const response = await fetch(
            `https://www.strava.com/api/v3/activities/${id}/streams?keys=altitude&key_by_type=true`,
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
            console.error('Strava streams fetch failed:', errorData);
            return NextResponse.json(
                { error: 'Failed to fetch activity streams' },
                { status: response.status }
            );
        }

        const streams = await response.json();
        return NextResponse.json(streams);
    } catch (err) {
        console.error('Strava streams error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch activity streams' },
            { status: 500 }
        );
    }
}
