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
    options?: { maxDistance?: number; limit?: number; onProgress?: (status: string) => void }
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
        throw new Error('Failed to fetch landmarks');
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Failed to start stream reader');
    }

    const textDecoder = new TextDecoder();
    let buffer = '';
    let finalLandmarks: Landmark[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += textDecoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const data = JSON.parse(line);
                if (data.error) throw new Error(data.error);
                if (data.status && options?.onProgress) {
                    options.onProgress(data.status);
                }
                if (data.landmarks) {
                    finalLandmarks = data.landmarks;
                }
            } catch (e) {
                console.error('Error parsing stream chunk:', e);
            }
        }
    }

    return finalLandmarks;
};
