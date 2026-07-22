
// lib/geo.ts
import { FeatureCollection, Feature, LineString, MultiLineString, Position } from 'geojson';
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
    feature: Feature<LineString | MultiLineString>;
    stats: RouteStats;
    convexHull?: Feature;
    name?: string;
}

export const processRoute = (geoJson: FeatureCollection | Feature<LineString | MultiLineString>): ProcessedRoute | null => {
    let feature: Feature<LineString | MultiLineString> | null = null;

    // Find the first LineString or MultiLineString feature
    if (geoJson.type === 'FeatureCollection') {
        const features = (geoJson as FeatureCollection).features;
        const track = features.find(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString');

        if (track) {
            feature = track as Feature<LineString | MultiLineString>;
        }
    } else if (geoJson.type === 'Feature' && (geoJson.geometry.type === 'LineString' || geoJson.geometry.type === 'MultiLineString')) {
        feature = geoJson as Feature<LineString | MultiLineString>;
    }

    if (!feature) return null;

    // Calculate Stats
    const distance = turf.length(feature, { units: 'kilometers' });
    const center = turf.center(feature).geometry.coordinates as [number, number];
    const bbox = turf.bbox(feature) as [number, number, number, number];

    // Calculate elevation stats from coordinates (GPX stores elevation as 3rd coordinate)
    let elevationGain = 0;
    let elevationLoss = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    // For MultiLineString, calculate elevation per segment to avoid false elevation changes between segments
    const coordArrays: Position[][] = feature.geometry.type === 'MultiLineString'
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates];

    for (const coords of coordArrays) {
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
    }

    // Handle case where no elevation data exists
    if (minElevation === Infinity) minElevation = 0;
    if (maxElevation === -Infinity) maxElevation = 0;

    // Extract route name from properties if available
    const name = feature.properties?.name as string | undefined;

    // Convex Hull for framing
    const hull = turf.convex(feature);

    return {
        feature,
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
