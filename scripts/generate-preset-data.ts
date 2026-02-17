/**
 * Pre-generate terrain, water, and landmark data for all preset routes.
 *
 * This eliminates Mapbox/Overpass API calls when users load iconic routes,
 * making them load instantly.
 *
 * Usage:
 *   npm run generate-presets
 *
 * Reads MAPBOX_TOKEN from .env file.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@mapbox/togeojson';
import * as d3 from 'd3';
import * as turf from '@turf/turf';
import { PNG } from 'pngjs';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { Feature, LineString, MultiLineString, FeatureCollection } from 'geojson';

// Load env vars from .env
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (!process.env[key]) process.env[key] = value;
        }
    }
}

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
    console.error('MAPBOX_TOKEN not found in environment or .env');
    process.exit(1);
}

const ROOT = process.cwd();
const GRID_W = 800;
const GRID_H = 800;

// ─── Tile math (shared with API routes) ───

function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
    );
    return { x, y };
}

function tileToLngLat(x: number, y: number, zoom: number): { lng: number; lat: number } {
    const n = Math.pow(2, zoom);
    const lng = (x / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const lat = (latRad * 180) / Math.PI;
    return { lng, lat };
}

function tilePixelToLngLat(
    tileX: number, tileY: number, pixelX: number, pixelY: number, extent: number, zoom: number
): [number, number] {
    const n = Math.pow(2, zoom);
    const lng = ((tileX + pixelX / extent) / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + pixelY / extent)) / n)));
    const lat = (latRad * 180) / Math.PI;
    return [lng, lat];
}

function decodeElevation(r: number, g: number, b: number): number {
    return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

interface Bbox {
    minLng: number; minLat: number; maxLng: number; maxLat: number;
}

// ─── Compute canonical viewBbox (replicates ArtCanvas projection logic) ───

function computeCanonicalBbox(feature: Feature<LineString | MultiLineString>, width: number, height: number): Bbox {
    const posterPadding = Math.min(width, height) * 0.04;
    const titleAreaHeight = Math.min(width, height) * 0.08;
    const padding = 20 + posterPadding;

    const projection = d3.geoMercator()
        .fitExtent([[padding, padding], [width - padding, height - padding - titleAreaHeight]], feature);

    const topLeft = projection.invert!([0, 0])!;
    const bottomRight = projection.invert!([width, height])!;

    return {
        minLng: topLeft[0],
        maxLat: topLeft[1],
        maxLng: bottomRight[0],
        minLat: bottomRight[1],
    };
}

// ─── Terrain fetching (replicates app/api/terrain/route.ts) ───

function chooseTerrainZoom(bbox: Bbox): number {
    const maxSpan = Math.max(bbox.maxLng - bbox.minLng, bbox.maxLat - bbox.minLat);
    if (maxSpan > 1) return 10;
    if (maxSpan > 0.5) return 11;
    if (maxSpan > 0.2) return 12;
    if (maxSpan > 0.1) return 13;
    return 14;
}

async function fetchTerrain(bbox: Bbox): Promise<{ elevations: number[]; width: number; height: number }> {
    const zoom = chooseTerrainZoom(bbox);
    const minTile = lngLatToTile(bbox.minLng, bbox.maxLat, zoom);
    const maxTile = lngLatToTile(bbox.maxLng, bbox.minLat, zoom);

    const tiles: { x: number; y: number; data: Buffer; tileSize: number }[] = [];

    for (let ty = minTile.y; ty <= maxTile.y; ty++) {
        for (let tx = minTile.x; tx <= maxTile.x; tx++) {
            const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tx}/${ty}@2x.pngraw?access_token=${MAPBOX_TOKEN}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`  Failed to fetch terrain tile ${zoom}/${tx}/${ty}: ${response.status}`);
                continue;
            }
            const arrayBuffer = await response.arrayBuffer();
            const png = PNG.sync.read(Buffer.from(arrayBuffer));
            tiles.push({ x: tx, y: ty, data: png.data, tileSize: png.width });
        }
    }

    if (tiles.length === 0) throw new Error('No terrain tiles fetched');

    const elevations: number[] = new Array(GRID_W * GRID_H);

    for (let py = 0; py < GRID_H; py++) {
        const lat = bbox.maxLat - (py / (GRID_H - 1)) * (bbox.maxLat - bbox.minLat);
        for (let px = 0; px < GRID_W; px++) {
            const lng = bbox.minLng + (px / (GRID_W - 1)) * (bbox.maxLng - bbox.minLng);
            const tileCoord = lngLatToTile(lng, lat, zoom);
            const tile = tiles.find(t => t.x === tileCoord.x && t.y === tileCoord.y);

            if (!tile) { elevations[py * GRID_W + px] = 0; continue; }

            const tileBoundsTopLeft = tileToLngLat(tile.x, tile.y, zoom);
            const tileBoundsBottomRight = tileToLngLat(tile.x + 1, tile.y + 1, zoom);
            const tileRelX = (lng - tileBoundsTopLeft.lng) / (tileBoundsBottomRight.lng - tileBoundsTopLeft.lng);
            const tileRelY = (lat - tileBoundsTopLeft.lat) / (tileBoundsBottomRight.lat - tileBoundsTopLeft.lat);
            const tilePixelX = Math.min(Math.floor(tileRelX * tile.tileSize), tile.tileSize - 1);
            const tilePixelY = Math.min(Math.floor(tileRelY * tile.tileSize), tile.tileSize - 1);

            const idx = (tilePixelY * tile.tileSize + tilePixelX) * 4;
            elevations[py * GRID_W + px] = decodeElevation(tile.data[idx], tile.data[idx + 1], tile.data[idx + 2]);
        }
    }

    // Round to integers (sufficient for contour rendering)
    for (let i = 0; i < elevations.length; i++) {
        elevations[i] = Math.round(elevations[i]);
    }

    return { elevations, width: GRID_W, height: GRID_H };
}

// ─── Water fetching (replicates app/api/water/route.ts) ───

function chooseWaterZoom(bbox: Bbox): number {
    const maxSpan = Math.max(bbox.maxLng - bbox.minLng, bbox.maxLat - bbox.minLat);
    if (maxSpan > 2) return 8;
    if (maxSpan > 1) return 9;
    if (maxSpan > 0.5) return 10;
    if (maxSpan > 0.2) return 11;
    return 12;
}

async function fetchWater(bbox: Bbox): Promise<GeoJSON.FeatureCollection> {
    const zoom = chooseWaterZoom(bbox);
    const minTile = lngLatToTile(bbox.minLng, bbox.maxLat, zoom);
    const maxTile = lngLatToTile(bbox.maxLng, bbox.minLat, zoom);

    const waterFeatures: Array<{ type: 'Polygon'; coordinates: number[][][] }> = [];

    for (let ty = minTile.y; ty <= maxTile.y; ty++) {
        for (let tx = minTile.x; tx <= maxTile.x; tx++) {
            const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${zoom}/${tx}/${ty}.vector.pbf?access_token=${MAPBOX_TOKEN}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`  Failed to fetch water tile ${zoom}/${tx}/${ty}: ${response.status}`);
                continue;
            }
            const arrayBuffer = await response.arrayBuffer();
            const pbf = new Pbf(new Uint8Array(arrayBuffer));
            const tile = new VectorTile(pbf);
            const waterLayer = tile.layers['water'];
            if (!waterLayer) continue;

            for (let i = 0; i < waterLayer.length; i++) {
                const feature = waterLayer.feature(i);
                const geom = feature.loadGeometry();
                const extent = feature.extent;

                if (feature.type === 3) {
                    const polygons: number[][][] = [];
                    for (const ring of geom) {
                        const coords: number[][] = [];
                        for (const point of ring) {
                            const [lng, lat] = tilePixelToLngLat(tx, ty, point.x, point.y, extent, zoom);
                            coords.push([lng, lat]);
                        }
                        if (coords.length > 0 &&
                            (coords[0][0] !== coords[coords.length - 1][0] ||
                             coords[0][1] !== coords[coords.length - 1][1])) {
                            coords.push([...coords[0]]);
                        }
                        polygons.push(coords);
                    }
                    if (polygons.length > 0) {
                        waterFeatures.push({ type: 'Polygon', coordinates: polygons });
                    }
                }
            }
        }
    }

    return {
        type: 'FeatureCollection',
        features: waterFeatures.map(geom => ({
            type: 'Feature' as const,
            properties: {},
            geometry: geom,
        })),
    };
}

// ─── Landmarks fetching (replicates app/api/landmarks/route.ts) ───

interface Landmark {
    id: number;
    type: string;
    name: string | null;
    lat: number;
    lng: number;
    elevation?: number;
    distanceToRoute?: number;
}

async function fetchLandmarks(bbox: Bbox, route: Feature<LineString | MultiLineString>): Promise<Landmark[]> {
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
        body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error(`Overpass API error: ${response.status}`);

    const data = await response.json();

    let landmarks: Landmark[] = (data.elements || [])
        .map((el: any) => ({
            id: el.id,
            type: el.tags.natural || (el.tags.waterway === 'waterfall' ? 'waterfall' : 'peak'),
            name: el.tags.name || null,
            lat: el.lat,
            lng: el.lon,
            elevation: el.tags.ele ? parseFloat(el.tags.ele) : undefined,
        }))
        .filter((l: Landmark) => l.name);

    // Calculate distance to route
    const getDistanceToRoute = (point: ReturnType<typeof turf.point>, routeFeature: Feature<LineString | MultiLineString>): number => {
        if (routeFeature.geometry.type === 'MultiLineString') {
            const distances = routeFeature.geometry.coordinates.map(coords => {
                const line = turf.lineString(coords);
                return turf.pointToLineDistance(point, line, { units: 'kilometers' });
            });
            return Math.min(...distances);
        }
        return turf.pointToLineDistance(point, routeFeature as Feature<LineString>, { units: 'kilometers' });
    };

    landmarks = landmarks
        .map(landmark => {
            const point = turf.point([landmark.lng, landmark.lat]);
            const distance = getDistanceToRoute(point, route);
            return { ...landmark, distanceToRoute: distance };
        })
        .filter(l => l.distanceToRoute !== undefined && l.distanceToRoute <= 15)
        .sort((a, b) => {
            const distDiff = (a.distanceToRoute || 0) - (b.distanceToRoute || 0);
            if (Math.abs(distDiff) > 0.5) return distDiff;
            if (a.elevation && b.elevation) return b.elevation - a.elevation;
            if (a.elevation) return -1;
            if (b.elevation) return 1;
            return 0;
        })
        .slice(0, 50);

    return landmarks;
}

// ─── GPX parsing ───

function parseGPX(gpxPath: string): FeatureCollection {
    const gpxText = readFileSync(gpxPath, 'utf-8');
    const xml = new DOMParser().parseFromString(gpxText, 'text/xml');
    return toGeoJSON.gpx(xml) as FeatureCollection;
}

function extractRouteFeature(geojson: FeatureCollection): Feature<LineString | MultiLineString> {
    const track = geojson.features.find(
        f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'
    );
    if (!track) throw new Error('No LineString/MultiLineString found in GPX');
    return track as Feature<LineString | MultiLineString>;
}

// ─── Main ───

async function main() {
    const presetsPath = resolve(ROOT, 'public/data/presets.json');
    const presetsData = JSON.parse(readFileSync(presetsPath, 'utf-8'));
    const presets = presetsData.presets;

    console.log(`Processing ${presets.length} presets...\n`);

    for (const preset of presets) {
        console.log(`━━━ ${preset.name} (${preset.id}) ━━━`);

        const outDir = resolve(ROOT, `public/presets/data/${preset.id}`);
        mkdirSync(outDir, { recursive: true });

        // Parse GPX
        const gpxPath = resolve(ROOT, `public${preset.source.path}`);
        console.log('  Parsing GPX...');
        const geojson = parseGPX(gpxPath);
        const feature = extractRouteFeature(geojson);

        // Compute canonical bbox
        const bbox = computeCanonicalBbox(feature, GRID_W, GRID_H);
        console.log(`  Bbox: [${bbox.minLng.toFixed(4)}, ${bbox.minLat.toFixed(4)}] → [${bbox.maxLng.toFixed(4)}, ${bbox.maxLat.toFixed(4)}]`);

        // Fetch terrain
        console.log('  Fetching terrain...');
        try {
            const terrain = await fetchTerrain(bbox);
            const terrainOut = { elevations: terrain.elevations, width: terrain.width, height: terrain.height, bbox };
            writeFileSync(resolve(outDir, 'terrain.json'), JSON.stringify(terrainOut));
            const sizeMB = (Buffer.byteLength(JSON.stringify(terrainOut)) / 1024 / 1024).toFixed(1);
            console.log(`  ✓ Terrain: ${sizeMB} MB`);
        } catch (err) {
            console.error(`  ✗ Terrain failed:`, err);
        }

        // Fetch water
        console.log('  Fetching water...');
        try {
            const water = await fetchWater(bbox);
            writeFileSync(resolve(outDir, 'water.json'), JSON.stringify(water));
            const sizeKB = (Buffer.byteLength(JSON.stringify(water)) / 1024).toFixed(0);
            console.log(`  ✓ Water: ${sizeKB} KB (${water.features.length} features)`);
        } catch (err) {
            console.error(`  ✗ Water failed:`, err);
        }

        // Fetch landmarks
        console.log('  Fetching landmarks...');
        try {
            const landmarks = await fetchLandmarks(bbox, feature);
            writeFileSync(resolve(outDir, 'landmarks.json'), JSON.stringify(landmarks));
            console.log(`  ✓ Landmarks: ${landmarks.length} found`);
        } catch (err) {
            console.error(`  ✗ Landmarks failed:`, err);
        }

        console.log('');

        // Delay between presets to avoid rate limiting
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('Done! Preset data files written to public/presets/data/');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
