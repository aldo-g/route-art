// lib/landmarks.ts

import { Feature, LineString, MultiLineString } from 'geojson';

export interface Landmark {
    id: number;
    type: 'peak' | 'saddle' | 'volcano' | 'cliff' | 'ridge' | 'valley' | 'waterfall' | 'spring' | 'cave' | 'custom';
    name: string | null;
    lat: number;
    lng: number;
    elevation?: number;
    distanceToRoute?: number;
    isCustom?: boolean;
}

export const fetchLandmarks = async (
    bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number },
    route?: Feature<LineString | MultiLineString>,
    options?: { maxDistance?: number; limit?: number }
): Promise<Landmark[]> => {
    const response = await fetch('/api/landmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            bbox,
            route,
            maxDistance: options?.maxDistance ?? 2,
            limit: options?.limit ?? 15
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch landmarks');
    }

    const data = await response.json();
    return data.landmarks;
};
