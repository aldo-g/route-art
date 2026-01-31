
// lib/terrain.ts
import { createNoise2D } from 'simplex-noise';

export const generateTerrain = (width: number, height: number, seed: string | number = 'seed') => {
    const noise2D = createNoise2D(() => {
        // Simple seeded random
        let s = typeof seed === 'string' ? seed.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : seed;
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
    });

    const values = new Float64Array(width * height);
    const scale = 0.005;

    for (let j = 0; j < height; ++j) {
        for (let i = 0; i < width; ++i) {
            let value = 0;
            value += noise2D(i * scale, j * scale) * 1.0;
            value += noise2D(i * scale * 2, j * scale * 2) * 0.5;
            value += noise2D(i * scale * 4, j * scale * 4) * 0.25;
            values[j * width + i] = value;
        }
    }

    return values;
};

export interface TerrainResponse {
    elevations: number[];
    width: number;
    height: number;
    zoom: number;
    tilesUsed: number;
}

export const fetchMapboxTerrain = async (
    bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number },
    width: number,
    height: number
): Promise<TerrainResponse> => {
    const response = await fetch('/api/terrain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, width, height })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch terrain data');
    }

    return response.json();
};

export interface ElevationPoint {
    latitude: number;
    longitude: number;
    elevation: number;
}

export const fetchElevationGrid = async (coords: { lat: number; lng: number }[]): Promise<number[]> => {
    // OpenTopoData has a 100 point limit for public instance
    const BATCH_SIZE = 100;
    const results: number[] = [];

    const fetchBatch = async (batch: { lat: number; lng: number }[]) => {
        const locations = batch.map(c => `${c.lat},${c.lng}`).join('|');
        // mapzen dataset provides ~30m resolution globally
        const url = `https://api.opentopodata.org/v1/mapzen?locations=${locations}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error("Topography API rate limit reached.");
                }
                throw new Error(`Topography API error: ${response.statusText}`);
            }

            const data = await response.json() as { results: { elevation: number | null }[] };
            return data.results.map(r => r.elevation ?? 0);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error("Topography request timed out.");
            }
            if (error.message === 'Failed to fetch') {
                throw new Error("Connection failed. Topography service unreachable.");
            }
            throw error;
        }
    };

    try {
        for (let i = 0; i < coords.length; i += BATCH_SIZE) {
            const batch = coords.slice(i, i + BATCH_SIZE);
            const batchResults = await fetchBatch(batch);
            results.push(...batchResults);
            // Small delay to respect rate limits if needed
            if (i + BATCH_SIZE < coords.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        return results;
    } catch (error) {
        console.error("Failed to fetch elevation data:", error);
        throw error;
    }
};
