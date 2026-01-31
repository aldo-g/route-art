// app/api/landmarks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as turf from '@turf/turf';
import { Feature, LineString } from 'geojson';

interface LandmarkRequest {
    bbox: {
        minLng: number;
        minLat: number;
        maxLng: number;
        maxLat: number;
    };
    route?: Feature<LineString>;
    maxDistance?: number; // km from route
    limit?: number;
}

export interface Landmark {
    id: number;
    type: 'peak' | 'saddle' | 'volcano' | 'cliff' | 'ridge' | 'valley' | 'waterfall' | 'spring' | 'cave';
    name: string | null;
    lat: number;
    lng: number;
    elevation?: number;
    distanceToRoute?: number;
}

export async function POST(request: NextRequest) {
    try {
        const { bbox, route, maxDistance = 2, limit = 15 }: LandmarkRequest = await request.json();

        // Overpass QL query - focus on peaks and notable features
        const query = `
            [out:json][timeout:25];
            (
                node["natural"="peak"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
                node["natural"="volcano"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
                node["waterway"="waterfall"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
                node["natural"="saddle"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
            );
            out body;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) {
            throw new Error(`Overpass API error: ${response.status}`);
        }

        const data = await response.json();

        let landmarks: Landmark[] = data.elements
            .map((el: any) => ({
                id: el.id,
                type: el.tags.natural || (el.tags.waterway === 'waterfall' ? 'waterfall' : 'peak'),
                name: el.tags.name || null,
                lat: el.lat,
                lng: el.lon,
                elevation: el.tags.ele ? parseFloat(el.tags.ele) : undefined
            }))
            .filter((l: Landmark) => l.name); // Only named landmarks

        // Filter by distance to route if route provided
        if (route) {
            landmarks = landmarks
                .map(landmark => {
                    const point = turf.point([landmark.lng, landmark.lat]);
                    const distance = turf.pointToLineDistance(point, route, { units: 'kilometers' });
                    return { ...landmark, distanceToRoute: distance };
                })
                .filter(l => l.distanceToRoute !== undefined && l.distanceToRoute <= maxDistance)
                .sort((a, b) => {
                    // Prioritize: closer to route, then higher elevation
                    const distDiff = (a.distanceToRoute || 0) - (b.distanceToRoute || 0);
                    if (Math.abs(distDiff) > 0.5) return distDiff; // If distance differs by >500m, use distance
                    // Otherwise sort by elevation
                    if (a.elevation && b.elevation) return b.elevation - a.elevation;
                    if (a.elevation) return -1;
                    if (b.elevation) return 1;
                    return 0;
                });
        } else {
            // No route, just sort by elevation
            landmarks.sort((a, b) => {
                if (a.elevation && b.elevation) return b.elevation - a.elevation;
                if (a.elevation) return -1;
                if (b.elevation) return 1;
                return 0;
            });
        }

        // Limit results
        landmarks = landmarks.slice(0, limit);

        return NextResponse.json({ landmarks });

    } catch (error) {
        console.error('Landmarks API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch landmarks', landmarks: [] },
            { status: 500 }
        );
    }
}
