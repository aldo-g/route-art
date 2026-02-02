// lib/strava.ts
import polyline from '@mapbox/polyline';
import { Feature, FeatureCollection, LineString, MultiLineString } from 'geojson';

export interface StravaTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete: {
        id: number;
        firstname: string;
        lastname: string;
    };
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
    map: {
        summary_polyline: string;
        polyline?: string;
    };
}

export interface StravaActivityDetail extends StravaActivity {
    map: {
        summary_polyline: string;
        polyline: string;
    };
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

export function activitiesToGeoJSON(
    activities: Array<{ polyline: string; name: string; date: string }>,
    customName?: string
): FeatureCollection {
    const features = activities.map(({ polyline: encoded, name, date }) =>
        polylineToGeoJSON(encoded, { name, date })
    );

    // If multiple activities, use MultiLineString to keep them as separate segments
    // This prevents drawing lines between unconnected activities
    if (features.length > 1) {
        const lineCoordinates = features.map(
            (f) => f.geometry.coordinates
        );
        const dates = activities.map((a) => a.date).sort();
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
                    },
                    geometry: {
                        type: 'MultiLineString',
                        coordinates: lineCoordinates,
                    },
                } as Feature<MultiLineString>,
            ],
        };
    }

    return {
        type: 'FeatureCollection',
        features,
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
    const scope = 'read,activity:read';

    return `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
}
