import * as toGeoJSON from '@mapbox/togeojson';
import { setRouteData } from '@/lib/storage';

export interface PosterPreset {
    id: string;
    name: string;
    location: string;
    countryCode: string;

    source: {
        type: "gpx";
        path: string;
    };

    map: {
        center: [number, number];
        zoom: number;
        bearing: number;
        pitch: number;
        padding: number;
    };

    style: {
        theme: "light" | "dark";
        showWater: boolean;
        contourContrast: number;
        reliefShading: number;
        routeContrast: number;
    };

    layout: {
        orientation: "portrait" | "landscape";
        showFlag: boolean;
        showStats: boolean;
    };

    stats: {
        distanceKm: number;
        elevationGain: number;
        elevationLoss: number;
    };

    preview: {
        thumbnail: string;
        hero: string;
    };
}

interface PresetsData {
    presets: PosterPreset[];
}

let cachedPresets: PosterPreset[] | null = null;

export async function getAllPresets(): Promise<PosterPreset[]> {
    if (cachedPresets) return cachedPresets;

    const res = await fetch('/data/presets.json');
    const data: PresetsData = await res.json();
    cachedPresets = data.presets;
    return cachedPresets;
}

export async function getPresetById(id: string): Promise<PosterPreset | undefined> {
    const presets = await getAllPresets();
    return presets.find((p) => p.id === id);
}

/**
 * Load a preset into sessionStorage + IndexedDB, ready for the /view page to pick up.
 * Returns the parsed GeoJSON so the caller can navigate after storing.
 */
export async function loadPresetRoute(presetId: string): Promise<boolean> {
    const preset = await getPresetById(presetId);
    if (!preset) return false;

    // Fetch and parse GPX
    const gpxRes = await fetch(preset.source.path);
    if (!gpxRes.ok) return false;

    const gpxText = await gpxRes.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(gpxText, 'text/xml');
    const geojson = toGeoJSON.gpx(xml);

    // Store GeoJSON in IndexedDB (same as UploadZone flow)
    await setRouteData('routeArtData', geojson);

    // Store file name
    sessionStorage.setItem('routeArtFileName', `${preset.name}.gpx`);

    // Apply style settings
    sessionStorage.setItem('routeArtDarkMode', preset.style.theme === 'dark' ? 'true' : 'false');
    sessionStorage.setItem('routeArtShowWater', preset.style.showWater ? 'true' : 'false');
    sessionStorage.setItem('routeArtContourIntensity', preset.style.contourContrast.toString());
    sessionStorage.setItem('routeArtShowShading', preset.style.reliefShading > 0 ? 'true' : 'false');
    sessionStorage.setItem('routeArtShadingIntensity', preset.style.reliefShading.toString());
    sessionStorage.setItem('routeArtRouteHighlightIntensity', preset.style.routeContrast.toString());

    // Apply layout settings
    sessionStorage.setItem('routeArtIsPortrait', preset.layout.orientation === 'portrait' ? 'true' : 'false');

    // Apply stats overrides
    const statsOverrides = {
        routeName: preset.name,
        location: preset.location,
        distance: preset.stats.distanceKm.toString(),
        elevationGain: preset.stats.elevationGain.toString(),
        elevationLoss: preset.stats.elevationLoss.toString(),
    };
    sessionStorage.setItem('routeArtStatsOverrides', JSON.stringify(statsOverrides));

    // Store preset metadata for the view page
    sessionStorage.setItem('routeArtPresetId', preset.id);
    sessionStorage.setItem('routeArtCountryCode', preset.countryCode);

    return true;
}
