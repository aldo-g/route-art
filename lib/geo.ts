
// lib/geo.ts
import { FeatureCollection, Feature, LineString } from 'geojson';
import * as turf from '@turf/turf';

export interface RouteStats {
    distance: number; // in kilometers
    center: [number, number];
    bbox: [number, number, number, number]; // minX, minY, maxX, maxY
    elevationGain: number; // total ascent in meters
    elevationLoss: number; // total descent in meters
    minElevation: number;
    maxElevation: number;
}

export interface ProcessedRoute {
    feature: Feature<LineString>;
    stats: RouteStats;
    convexHull?: Feature;
    name?: string;
}

export const processRoute = (geoJson: FeatureCollection | Feature<LineString>): ProcessedRoute | null => {
    let lineString: Feature<LineString> | null = null;

    // Flatten FeatureCollection to find the first LineString
    // Strava/GPX usually results in a FeatureCollection
    if (geoJson.type === 'FeatureCollection') {
        const features = (geoJson as FeatureCollection).features;
        const track = features.find(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString');

        if (track) {
            if (track.geometry.type === 'MultiLineString') {
                // Convert MultiLineString to LineString if connected, or just take the longest segment?
                // For simplicity, let's take the first coordinate array if it's MultiLineString, or flatten.
                // Turf can help flattened.
                // But usually GPX tracks are LineStrings.
                // If MultiLineString, we can try to merge.
                // For now, let's assume LineString or conversion.
                const flattened = turf.flatten(track as any);
                if (flattened.features.length > 0) {
                    lineString = flattened.features[0] as unknown as Feature<LineString>;
                }
            } else {
                lineString = track as Feature<LineString>;
            }
        }
    } else if (geoJson.type === 'Feature' && geoJson.geometry.type === 'LineString') {
        lineString = geoJson as Feature<LineString>;
    }

    if (!lineString) return null;

    // Calculate Stats
    const distance = turf.length(lineString, { units: 'kilometers' });
    const center = turf.center(lineString).geometry.coordinates as [number, number];
    const bbox = turf.bbox(lineString) as [number, number, number, number];

    // Calculate elevation stats from coordinates (GPX stores elevation as 3rd coordinate)
    const coords = lineString.geometry.coordinates;
    let elevationGain = 0;
    let elevationLoss = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    for (let i = 0; i < coords.length; i++) {
        const elevation = coords[i][2]; // 3rd element is elevation if present
        if (typeof elevation === 'number' && !isNaN(elevation)) {
            minElevation = Math.min(minElevation, elevation);
            maxElevation = Math.max(maxElevation, elevation);

            if (i > 0) {
                const prevElevation = coords[i - 1][2];
                if (typeof prevElevation === 'number' && !isNaN(prevElevation)) {
                    const diff = elevation - prevElevation;
                    if (diff > 0) {
                        elevationGain += diff;
                    } else {
                        elevationLoss += Math.abs(diff);
                    }
                }
            }
        }
    }

    // Handle case where no elevation data exists
    if (minElevation === Infinity) minElevation = 0;
    if (maxElevation === -Infinity) maxElevation = 0;

    // Extract route name from properties if available
    const name = lineString.properties?.name as string | undefined;

    // Convex Hull for framing
    const hull = turf.convex(lineString);

    return {
        feature: lineString,
        stats: {
            distance,
            center,
            bbox,
            elevationGain,
            elevationLoss,
            minElevation,
            maxElevation
        },
        convexHull: hull || undefined,
        name
    };
};
