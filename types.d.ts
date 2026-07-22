
declare module '@mapbox/togeojson' {
    import type { GeoJSON } from 'geojson';
    export function gpx(doc: Document): GeoJSON;
    export function kml(doc: Document): GeoJSON;
}
