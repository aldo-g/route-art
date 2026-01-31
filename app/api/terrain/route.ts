// app/api/terrain/route.ts
import { NextRequest, NextResponse } from 'next/server';

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

interface TileRequest {
    bbox: {
        minLng: number;
        minLat: number;
        maxLng: number;
        maxLat: number;
    };
    width: number;
    height: number;
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

// Convert tile coordinates back to lng/lat (top-left corner of tile)
function tileToLngLat(x: number, y: number, zoom: number): { lng: number; lat: number } {
    const n = Math.pow(2, zoom);
    const lng = (x / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const lat = (latRad * 180) / Math.PI;
    return { lng, lat };
}

// Decode RGB values to elevation (Mapbox Terrain-RGB encoding)
function decodeElevation(r: number, g: number, b: number): number {
    return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

// Choose appropriate zoom level based on bbox size
function chooseZoomLevel(bbox: TileRequest['bbox']): number {
    const lngSpan = bbox.maxLng - bbox.minLng;
    const latSpan = bbox.maxLat - bbox.minLat;
    const maxSpan = Math.max(lngSpan, latSpan);

    // Higher zoom = more detail. We want enough tiles to cover the area with good resolution
    // but not so many that it's slow. Aim for 1-4 tiles typically.
    if (maxSpan > 1) return 10;
    if (maxSpan > 0.5) return 11;
    if (maxSpan > 0.2) return 12;
    if (maxSpan > 0.1) return 13;
    if (maxSpan > 0.05) return 14;
    return 14; // Max out at zoom 14 for reasonable performance
}

export async function POST(request: NextRequest) {
    if (!MAPBOX_TOKEN) {
        return NextResponse.json({ error: 'Mapbox token not configured' }, { status: 500 });
    }

    try {
        const { bbox, width, height }: TileRequest = await request.json();

        const zoom = chooseZoomLevel(bbox);

        // Get tile coordinates for corners
        const minTile = lngLatToTile(bbox.minLng, bbox.maxLat, zoom); // top-left
        const maxTile = lngLatToTile(bbox.maxLng, bbox.minLat, zoom); // bottom-right

        // Fetch all tiles needed to cover the bbox
        const tiles: { x: number; y: number; data: Buffer; tileSize: number }[] = [];

        for (let ty = minTile.y; ty <= maxTile.y; ty++) {
            for (let tx = minTile.x; tx <= maxTile.x; tx++) {
                const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tx}/${ty}@2x.pngraw?access_token=${MAPBOX_TOKEN}`;

                const response = await fetch(url);
                if (!response.ok) {
                    console.error(`Failed to fetch tile ${zoom}/${tx}/${ty}: ${response.status}`);
                    continue;
                }

                const arrayBuffer = await response.arrayBuffer();
                const { PNG } = await import('pngjs');
                const png = PNG.sync.read(Buffer.from(arrayBuffer));

                tiles.push({
                    x: tx,
                    y: ty,
                    data: png.data,
                    tileSize: png.width // Should be 512 for @2x tiles
                });
            }
        }

        if (tiles.length === 0) {
            return NextResponse.json({ error: 'Failed to fetch terrain tiles' }, { status: 500 });
        }

        // Create elevation grid at requested resolution
        const elevations: number[] = new Array(width * height);

        for (let py = 0; py < height; py++) {
            // Map pixel y to latitude (top to bottom = maxLat to minLat)
            const lat = bbox.maxLat - (py / (height - 1)) * (bbox.maxLat - bbox.minLat);

            for (let px = 0; px < width; px++) {
                // Map pixel x to longitude
                const lng = bbox.minLng + (px / (width - 1)) * (bbox.maxLng - bbox.minLng);

                // Find which tile contains this point
                const tileCoord = lngLatToTile(lng, lat, zoom);
                const tile = tiles.find(t => t.x === tileCoord.x && t.y === tileCoord.y);

                if (!tile) {
                    elevations[py * width + px] = 0;
                    continue;
                }

                // Get the tile's bounds
                const tileBoundsTopLeft = tileToLngLat(tile.x, tile.y, zoom);
                const tileBoundsBottomRight = tileToLngLat(tile.x + 1, tile.y + 1, zoom);

                // Calculate position within tile (0-1)
                const tileRelX = (lng - tileBoundsTopLeft.lng) / (tileBoundsBottomRight.lng - tileBoundsTopLeft.lng);
                const tileRelY = (lat - tileBoundsTopLeft.lat) / (tileBoundsBottomRight.lat - tileBoundsTopLeft.lat);

                // Convert to pixel coordinates within tile
                const tilePixelX = Math.min(Math.floor(tileRelX * tile.tileSize), tile.tileSize - 1);
                const tilePixelY = Math.min(Math.floor(tileRelY * tile.tileSize), tile.tileSize - 1);

                // Get RGB values (RGBA format, 4 bytes per pixel)
                const idx = (tilePixelY * tile.tileSize + tilePixelX) * 4;
                const r = tile.data[idx];
                const g = tile.data[idx + 1];
                const b = tile.data[idx + 2];

                elevations[py * width + px] = decodeElevation(r, g, b);
            }
        }

        return NextResponse.json({
            elevations,
            width,
            height,
            zoom,
            tilesUsed: tiles.length
        });

    } catch (error) {
        console.error('Terrain API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch terrain' },
            { status: 500 }
        );
    }
}
