// app/api/water/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

interface WaterRequest {
    bbox: {
        minLng: number;
        minLat: number;
        maxLng: number;
        maxLat: number;
    };
}

// Convert lat/lng to tile coordinates at a given zoom level
function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
    );
    return { x, y };
}

// Convert tile pixel coordinates to lng/lat
function tilePixelToLngLat(
    tileX: number,
    tileY: number,
    pixelX: number,
    pixelY: number,
    extent: number,
    zoom: number
): [number, number] {
    const n = Math.pow(2, zoom);
    const lng = ((tileX + pixelX / extent) / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + pixelY / extent)) / n)));
    const lat = (latRad * 180) / Math.PI;
    return [lng, lat];
}

// Choose appropriate zoom level based on bbox size
function chooseZoomLevel(bbox: WaterRequest['bbox']): number {
    const lngSpan = bbox.maxLng - bbox.minLng;
    const latSpan = bbox.maxLat - bbox.minLat;
    const maxSpan = Math.max(lngSpan, latSpan);

    // Use lower zoom for water features to reduce data volume
    if (maxSpan > 2) return 8;
    if (maxSpan > 1) return 9;
    if (maxSpan > 0.5) return 10;
    if (maxSpan > 0.2) return 11;
    if (maxSpan > 0.1) return 12;
    return 12;
}

export async function POST(request: NextRequest) {
    if (!MAPBOX_TOKEN) {
        return NextResponse.json({ error: 'Mapbox token not configured' }, { status: 500 });
    }

    try {
        const { bbox }: WaterRequest = await request.json();
        const zoom = chooseZoomLevel(bbox);

        // Get tile coordinates for corners
        const minTile = lngLatToTile(bbox.minLng, bbox.maxLat, zoom); // top-left
        const maxTile = lngLatToTile(bbox.maxLng, bbox.minLat, zoom); // bottom-right

        const waterFeatures: Array<{
            type: 'Polygon' | 'MultiPolygon';
            coordinates: number[][][] | number[][][][];
        }> = [];

        // Fetch all tiles needed to cover the bbox
        for (let ty = minTile.y; ty <= maxTile.y; ty++) {
            for (let tx = minTile.x; tx <= maxTile.x; tx++) {
                const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${zoom}/${tx}/${ty}.vector.pbf?access_token=${MAPBOX_TOKEN}`;

                const response = await fetch(url);
                if (!response.ok) {
                    console.error(`Failed to fetch water tile ${zoom}/${tx}/${ty}: ${response.status}`);
                    continue;
                }

                const arrayBuffer = await response.arrayBuffer();
                const pbf = new Pbf(new Uint8Array(arrayBuffer));
                const tile = new VectorTile(pbf);

                // Extract water layer
                const waterLayer = tile.layers['water'];
                if (!waterLayer) continue;

                for (let i = 0; i < waterLayer.length; i++) {
                    const feature = waterLayer.feature(i);
                    const geom = feature.loadGeometry();
                    const extent = feature.extent;

                    // Convert tile coordinates to lng/lat
                    if (feature.type === 3) { // Polygon
                        const polygons: number[][][] = [];

                        for (const ring of geom) {
                            const coords: number[][] = [];
                            for (const point of ring) {
                                const [lng, lat] = tilePixelToLngLat(tx, ty, point.x, point.y, extent, zoom);
                                coords.push([lng, lat]);
                            }
                            // Close the ring if not already closed
                            if (coords.length > 0 &&
                                (coords[0][0] !== coords[coords.length - 1][0] ||
                                 coords[0][1] !== coords[coords.length - 1][1])) {
                                coords.push([...coords[0]]);
                            }
                            polygons.push(coords);
                        }

                        if (polygons.length > 0) {
                            waterFeatures.push({
                                type: 'Polygon',
                                coordinates: polygons
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            type: 'FeatureCollection',
            features: waterFeatures.map(geom => ({
                type: 'Feature',
                properties: {},
                geometry: geom
            }))
        });

    } catch (error) {
        console.error('Water API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch water data' },
            { status: 500 }
        );
    }
}
