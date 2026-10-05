// lib/strava.ts
import polyline from '@mapbox/polyline';
import { Feature, FeatureCollection, LineString, MultiLineString } from 'geojson';

export interface StravaTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    /** Scopes Strava actually granted. Absent on tokens issued before we tracked it. */
    scope?: string;
    athlete: {
        id: number;
        firstname: string;
        lastname: string;
    };
}

/**
 * Whether a token can see private / followers-only activities.
 * Strava puts private activities behind activity:read_all, and its consent screen
 * has a separate checkbox for it — so a user can grant only activity:read even
 * when we request read_all. Tokens issued before we recorded scope have none,
 * and those predate the read_all request, so treat them as public-only.
 */
export function hasPrivateActivityAccess(tokens: StravaTokens): boolean {
    return tokens.scope?.split(',').includes('activity:read_all') ?? false;
}

export interface StravaActivity {
    id: number;
    name: string;
    type: string;
    sport_type: string;
    start_date: string;
    start_date_local: string;
    distance: number; // meters
    moving_time: number; // seconds
    elapsed_time: number; // seconds
    total_elevation_gain: number; // meters
    elev_high?: number; // meters - highest point
    elev_low?: number; // meters - lowest point
    map: {
        summary_polyline: string;
        polyline?: string;
    };
}

export interface StravaSplit {
    elevation_difference: number; // meters - can be negative for descent
    distance: number;
    elapsed_time: number;
    moving_time: number;
}

export interface StravaActivityDetail extends StravaActivity {
    map: {
        summary_polyline: string;
        polyline: string;
    };
    splits_metric?: StravaSplit[]; // Lap/km splits with elevation data
}

export interface StravaAltitudeStream {
    altitude?: { data: number[] };
}

/**
 * Elevation gain and loss from the per-point altitude stream.
 *
 * Raw GPS/barometric altitude jitters by a metre or so between points, so summing
 * every change inflates both totals. We only count a move once it has travelled
 * more than THRESHOLD from the last confirmed turning point, which is the standard
 * hysteresis approach and matches Strava's own figures closely.
 */
const ELEVATION_THRESHOLD_M = 3;

export function calculateElevationFromStream(
    altitudes: number[] | undefined
): { gain: number; loss: number } | null {
    if (!altitudes || altitudes.length < 2) return null;

    let gain = 0;
    let loss = 0;
    // Last confirmed turning point, and which way we are currently moving.
    let pivot = altitudes[0];
    let direction: 'up' | 'down' | null = null;

    for (let i = 1; i < altitudes.length; i++) {
        const current = altitudes[i];
        if (!Number.isFinite(current)) continue;
        const delta = current - pivot;

        if (direction === 'up') {
            if (delta > 0) {
                // Still climbing: extend this run.
                gain += delta;
                pivot = current;
            } else if (-delta > ELEVATION_THRESHOLD_M) {
                // Turned over into a real descent.
                loss += -delta;
                pivot = current;
                direction = 'down';
            }
        } else if (direction === 'down') {
            if (delta < 0) {
                loss += -delta;
                pivot = current;
            } else if (delta > ELEVATION_THRESHOLD_M) {
                gain += delta;
                pivot = current;
                direction = 'up';
            }
        } else if (Math.abs(delta) > ELEVATION_THRESHOLD_M) {
            // First move large enough to establish a direction.
            if (delta > 0) {
                gain += delta;
                direction = 'up';
            } else {
                loss += -delta;
                direction = 'down';
            }
            pivot = current;
        }
    }

    return { gain: Math.round(gain), loss: Math.round(loss) };
}

/**
 * Fallback elevation loss from splits_metric.
 *
 * Each split covers a whole kilometre and reports only its NET elevation change,
 * so climbs and descents within one split cancel out. This under-reports loss on
 * rolling terrain — prefer calculateElevationFromStream when the stream is available.
 */
export function calculateElevationLoss(splits: StravaSplit[] | undefined): number {
    if (!splits || splits.length === 0) return 0;
    return splits.reduce((total, split) => {
        // Only sum negative elevation differences (descent)
        return total + (split.elevation_difference < 0 ? Math.abs(split.elevation_difference) : 0);
    }, 0);
}

export function decodePolyline(encoded: string): [number, number][] {
    // @mapbox/polyline returns [lat, lng] but GeoJSON uses [lng, lat]
    const decoded = polyline.decode(encoded);
    return decoded.map(([lat, lng]) => [lng, lat]);
}

export function polylineToGeoJSON(
    encoded: string,
    properties?: Record<string, unknown>
): Feature<LineString> {
    const coordinates = decodePolyline(encoded);
    return {
        type: 'Feature',
        properties: properties || {},
        geometry: {
            type: 'LineString',
            coordinates,
        },
    };
}

export interface ActivityData {
    polyline: string;
    name: string;
    date: string;
    distance?: number; // meters
    totalElevationGain?: number; // meters
    totalElevationLoss?: number; // meters
}

export function activitiesToGeoJSON(
    activities: ActivityData[],
    customName?: string
): FeatureCollection {
    const features = activities.map(({ polyline: encoded, name, date }) =>
        polylineToGeoJSON(encoded, { name, date })
    );

    // Calculate totals for Strava stats
    const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
    const totalElevationGain = activities.reduce((sum, a) => sum + (a.totalElevationGain || 0), 0);
    const totalElevationLoss = activities.reduce((sum, a) => sum + (a.totalElevationLoss || 0), 0);
    const dates = activities.map((a) => a.date).sort();
    const dateStart = dates[0];
    const dateEnd = dates.length > 1 ? dates[dates.length - 1] : undefined;

    // If multiple activities, use MultiLineString to keep them as separate segments
    // This prevents drawing lines between unconnected activities
    if (features.length > 1) {
        const lineCoordinates = features.map(
            (f) => f.geometry.coordinates
        );
        const dateRange = dates.length > 1
            ? `${dates[0]} - ${dates[dates.length - 1]}`
            : dates[0];

        // Use custom name if provided, otherwise fall back to combined names
        const name = customName?.trim() || activities.map((a) => a.name).join(' + ');

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: {
                        name,
                        dateRange,
                        stravaDistance: totalDistance,
                        stravaElevationGain: totalElevationGain,
                        stravaElevationLoss: totalElevationLoss || undefined,
                        stravaDateStart: dateStart,
                        stravaDateEnd: dateEnd,
                    },
                    geometry: {
                        type: 'MultiLineString',
                        coordinates: lineCoordinates,
                    },
                } as Feature<MultiLineString>,
            ],
        };
    }

    // Single activity - add Strava stats to the feature properties
    const singleFeature = features[0];
    singleFeature.properties = {
        ...singleFeature.properties,
        stravaDistance: totalDistance,
        stravaElevationGain: totalElevationGain,
        stravaElevationLoss: totalElevationLoss || undefined,
        stravaDateStart: dateStart,
    };

    return {
        type: 'FeatureCollection',
        features: [singleFeature],
    };
}

export function formatDistance(meters: number): string {
    const km = meters / 1000;
    return km >= 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

export function formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function getStravaAuthUrl(): string {
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/strava/auth`;
    // activity:read_all is required to see private and followers-only activities;
    // plain activity:read returns public ones only.
    const scope = 'read,activity:read_all';

    return `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
}
