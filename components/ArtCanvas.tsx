
// components/ArtCanvas.tsx
'use client';

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { processRoute, ProcessedRoute } from '@/lib/geo';
import { generateTerrain, fetchMapboxTerrain } from '@/lib/terrain';
import { fetchLandmarks, Landmark } from '@/lib/landmarks';
import jsPDF from 'jspdf';
import { Loader2 } from 'lucide-react';

export interface StatsOverrides {
    routeName?: string;
    location?: string;
    distance?: string;
    elevationGain?: string;
    elevationLoss?: string;
    dateStart?: string;
    dateEnd?: string;
}

export interface RouteDefaults {
    routeName: string;
    distance: number;
    elevationGain: number;
    elevationLoss: number;
    dateStart?: string;
    dateEnd?: string;
}

export interface ImageOverride {
    url?: string;
    enabled: boolean;
}

interface ArtCanvasProps {
    geoJson: any; // Raw GeoJSON from parser
    fileName?: string;
    selectedLandmarkIds?: Set<number>;
    customLandmarks?: Landmark[];
    statsOverrides?: StatsOverrides;
    imageOverride?: ImageOverride;
    isPlacingLandmark?: boolean;
    isDarkMode?: boolean;
    showWater?: boolean;
    showMarkers?: boolean;
    showShading?: boolean;
    shadingIntensity?: number;
    onLandmarksLoaded?: (landmarks: Landmark[]) => void;
    onVisibleLandmarksCalculated?: (visibleIds: number[]) => void;
    onInBoundsLandmarksCalculated?: (inBoundsIds: number[]) => void;
    onDefaultsCalculated?: (defaults: RouteDefaults) => void;
    onCountryCodeDetected?: (countryCode: string | null) => void;
    onMapClick?: (lat: number, lng: number) => void;
    onLoadingStatusChange?: (status: string | null) => void;
}

export interface ArtCanvasHandle {
    exportSVG: (fileName: string) => Promise<void>;
    exportPDF: (fileName: string) => Promise<void>;
    exportPNG: (fileName: string) => Promise<void>;
}

const ArtCanvas = forwardRef<ArtCanvasHandle, ArtCanvasProps>(({ geoJson, fileName, selectedLandmarkIds, customLandmarks, statsOverrides, imageOverride, isPlacingLandmark, isDarkMode = false, showWater = true, showMarkers = true, showShading = false, shadingIntensity = 0.5, onLandmarksLoaded, onVisibleLandmarksCalculated, onInBoundsLandmarksCalculated, onDefaultsCalculated, onCountryCodeDetected, onMapClick, onLoadingStatusChange }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const projectionRef = useRef<d3.GeoProjection | null>(null);
    const [processed, setProcessed] = useState<ProcessedRoute | null>(null);
    const [elevationData, setElevationData] = useState<number[] | null>(null);
    const [isLoadingElevation, setIsLoadingElevation] = useState(false);
    const [elevationError, setElevationError] = useState<string | null>(null);
    const [gridSize] = useState({ w: 200, h: 200 });
    const [viewBbox, setViewBbox] = useState<{ minLng: number; minLat: number; maxLng: number; maxLat: number } | null>(null);
    const [allLandmarks, setAllLandmarks] = useState<Landmark[]>([]);
    const [countryCode, setCountryCode] = useState<string | null>(null);
    const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
    const [waterData, setWaterData] = useState<GeoJSON.FeatureCollection | null>(null);

    // Track container size changes with ResizeObserver
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                // Round to avoid sub-pixel jitter which can trigger unnecessary renders
                const roundedWidth = Math.floor(width);
                const roundedHeight = Math.floor(height);

                if (roundedWidth > 0 && roundedHeight > 0) {
                    setContainerSize(prev => {
                        if (prev?.width === roundedWidth && prev?.height === roundedHeight) return prev;
                        return { width: roundedWidth, height: roundedHeight };
                    });
                }
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Combine API landmarks with custom landmarks, then filter based on selection
    const combinedLandmarks = [...allLandmarks, ...(customLandmarks || [])];
    const landmarks = selectedLandmarkIds
        ? combinedLandmarks.filter(l => selectedLandmarkIds.has(l.id))
        : combinedLandmarks;

    useEffect(() => {
        if (geoJson) {
            const result = processRoute(geoJson);
            setProcessed(result);
            setElevationData(null);
            setElevationError(null);
        }
    }, [geoJson]);

    useEffect(() => {
        if (!processed || !containerSize) return;

        const { width, height } = containerSize;

        // Match poster padding from render effect
        const posterPadding = Math.min(width, height) * 0.04;
        const titleAreaHeight = Math.min(width, height) * 0.08; // Reserve space at bottom for title
        const padding = 20 + posterPadding;
        const projection = d3.geoMercator()
            .fitExtent([[padding, padding], [width - padding, height - padding - titleAreaHeight]], processed.feature);

        const topLeft = (projection.invert as (coords: [number, number]) => [number, number] | null)([0, 0]);
        const bottomRight = (projection.invert as (coords: [number, number]) => [number, number] | null)([width, height]);

        if (topLeft && bottomRight) {
            const nextBbox = {
                minLng: topLeft[0],
                maxLat: topLeft[1],
                maxLng: bottomRight[0],
                minLat: bottomRight[1]
            };

            setViewBbox(prev => {
                if (!prev) return nextBbox;
                if (prev.minLng === nextBbox.minLng &&
                    prev.maxLat === nextBbox.maxLat &&
                    prev.maxLng === nextBbox.maxLng &&
                    prev.minLat === nextBbox.minLat) {
                    return prev;
                }
                return nextBbox;
            });
        }
    }, [processed, containerSize]);

    // Generate hillshade relief image
    const hillshadeImage = React.useMemo(() => {
        if (!elevationData || !showShading) return null;

        const { w, h } = gridSize;

        // --- 1. Aggressive Smoothing (5x5 Gaussian-ish) ---
        const smoothData = new Float32Array(elevationData.length);
        const radius = 2; // 5x5 window

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                let weightSum = 0;
                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const nx = x + kx;
                        const ny = y + ky;
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            // Weight based on distance (pseudo-gaussian)
                            const weight = 1 / (1 + Math.sqrt(kx * kx + ky * ky));
                            sum += elevationData[ny * w + nx] * weight;
                            weightSum += weight;
                        }
                    }
                }
                smoothData[y * w + x] = sum / weightSum;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;

        // Lighting parameters
        const primaryAz = (315 * Math.PI) / 180;
        const secondaryAz = (45 * Math.PI) / 180;
        const zenRad = (45 * Math.PI) / 180;

        // Light vectors
        const l1x = Math.cos(primaryAz) * Math.sin(zenRad);
        const l1y = Math.sin(primaryAz) * Math.sin(zenRad);
        const l1z = Math.cos(zenRad);

        const l2x = Math.cos(secondaryAz) * Math.sin(zenRad);
        const l2y = Math.sin(secondaryAz) * Math.sin(zenRad);
        const l2z = Math.cos(zenRad);

        // Subtly adjust intensity based on the slider
        const zFactor = 0.005 + (shadingIntensity * 0.04);
        const contrast = 1.2 + (shadingIntensity * 0.5);

        // Find max/min elevation for hypsometric hints
        let maxE = -Infinity, minE = Infinity;
        for (let i = 0; i < smoothData.length; i++) {
            if (smoothData[i] > maxE) maxE = smoothData[i];
            if (smoothData[i] < minE) minE = smoothData[i];
        }
        const eRange = maxE - minE || 1;

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const z0 = smoothData[(y - 1) * w + (x - 1)];
                const z1 = smoothData[(y - 1) * w + x];
                const z2 = smoothData[(y - 1) * w + (x + 1)];
                const z3 = smoothData[y * w + (x - 1)];
                const z5 = smoothData[y * w + (x + 1)];
                const z6 = smoothData[(y + 1) * w + (x - 1)];
                const z7 = smoothData[(y + 1) * w + x];
                const z8 = smoothData[(y + 1) * w + (x + 1)];

                const dzdx = ((z2 + 2 * z5 + z8) - (z0 + 2 * z3 + z6)) / 8;
                const dzdy = ((z6 + 2 * z7 + z8) - (z0 + 2 * z1 + z2)) / 8;

                // Surface normal
                const nx = -dzdx * zFactor;
                const ny = -dzdy * zFactor;
                const nz = 1.0;

                const mag = Math.sqrt(nx * nx + ny * ny + nz * nz);
                const snx = nx / mag;
                const sny = ny / mag;
                const snz = nz / mag;

                // 1. Multidirection shading (primary + subtle secondary)
                const dot1 = snx * l1x + sny * l1y + snz * l1z;
                const dot2 = snx * l2x + sny * l2y + snz * l2z;
                const combinedShade = (dot1 * 0.7) + (dot2 * 0.3);

                // 2. Slopeshade (darken steep areas)
                const gradientMag = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
                const slopeFactor = Math.min(1.0, (gradientMag * zFactor * 5));

                // --- NEW: Flatland Thresholding ---
                const deadzone = 0.002;
                const slopeTransparency = Math.min(1.0, Math.max(0, (gradientMag - deadzone) / deadzone));

                const neutral = Math.cos(zenRad);
                const diff = (combinedShade - neutral) * contrast;

                // 3. Hypsometric hint (Soft Fog)
                const elevation = smoothData[y * w + x];
                const elevationFactor = (elevation - minE) / eRange;
                const depthFactor = 0.6 + (1 - elevationFactor) * 0.4;

                const idx = (y * w + x) * 4;

                // 4. Micro-noise
                const noise = (Math.random() - 0.5) * 4;

                if (diff < 0) {
                    // Shadows + Slopeshade (Indigo Ink: 30, 27, 75)
                    const shadowAlpha = Math.abs(diff) * 160 * shadingIntensity * depthFactor;
                    const slopeAlpha = slopeFactor * 120 * shadingIntensity;
                    const finalAlpha = Math.max(shadowAlpha, slopeAlpha) * slopeTransparency;

                    data[idx] = 30;
                    data[idx + 1] = 27;
                    data[idx + 2] = 75;
                    data[idx + 3] = Math.min(220, finalAlpha + noise);
                } else {
                    // Highlights (Cream Ink: 254, 243, 199)
                    const highlightAlpha = diff * 100 * shadingIntensity * (0.6 + elevationFactor * 0.6) * slopeTransparency;

                    data[idx] = 254;
                    data[idx + 1] = 243;
                    data[idx + 2] = 199;
                    data[idx + 3] = Math.min(160, highlightAlpha + noise);
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL();
    }, [elevationData, showShading, gridSize, shadingIntensity]);

    useEffect(() => {
        if (!viewBbox) return;

        // Generate a cache key based on bbox and grid size
        const cacheKey = `terrain_${viewBbox.minLng.toFixed(4)}_${viewBbox.minLat.toFixed(4)}_${viewBbox.maxLng.toFixed(4)}_${viewBbox.maxLat.toFixed(4)}_${gridSize.w}_${gridSize.h}`;

        // Check sessionStorage for cached terrain data
        const cachedTerrain = sessionStorage.getItem(cacheKey);
        if (cachedTerrain) {
            try {
                const parsed = JSON.parse(cachedTerrain);
                setElevationData(parsed.elevations);
                return;
            } catch {
                console.error("Failed to parse cached terrain data");
            }
        }

        const fetchRealTerrain = async () => {
            setIsLoadingElevation(true);
            onLoadingStatusChange?.("Drawing contours...");
            setElevationError(null);
            try {
                const result = await fetchMapboxTerrain(viewBbox, gridSize.w, gridSize.h);
                setElevationData(result.elevations);
                // Cache the result
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({ elevations: result.elevations }));
                } catch {
                    console.warn("Failed to cache terrain data (storage limit)");
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Connection to topographic API failed.";
                console.error("Falling back to procedural terrain", err);
                setElevationError(errorMessage);
            } finally {
                setIsLoadingElevation(false);
                onLoadingStatusChange?.(null);
            }
        };

        fetchRealTerrain();

    }, [viewBbox, gridSize]);

    // Fetch landmarks separately when we have both viewBbox and processed route
    useEffect(() => {
        if (!viewBbox || !processed) return;

        // Generate a cache key based on bbox
        const cacheKey = `landmarks_${viewBbox.minLng.toFixed(4)}_${viewBbox.minLat.toFixed(4)}_${viewBbox.maxLng.toFixed(4)}_${viewBbox.maxLat.toFixed(4)}`;

        // Check sessionStorage for cached landmarks
        const cachedLandmarks = sessionStorage.getItem(cacheKey);
        if (cachedLandmarks) {
            try {
                const parsed = JSON.parse(cachedLandmarks);
                setAllLandmarks(parsed);
                onLandmarksLoaded?.(parsed);
                return;
            } catch {
                console.error("Failed to parse cached landmarks");
            }
        }

        const fetchLandmarkData = async () => {
            onLoadingStatusChange?.("Fetching landmarks...");
            try {
                const result = await fetchLandmarks(viewBbox, processed.feature, {
                    maxDistance: 15, // 15km from route for better coverage on larger maps
                    limit: 50,
                    onProgress: (status) => {
                        onLoadingStatusChange?.(`LANDMARKS: ${status}`);
                    }
                });
                setAllLandmarks(result);
                onLandmarksLoaded?.(result);
                // Cache the result
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(result));
                } catch {
                    console.warn("Failed to cache landmarks (storage limit)");
                }
            } catch (err) {
                console.error("Failed to fetch landmarks", err);
            } finally {
                onLoadingStatusChange?.(null);
            }
        };

        fetchLandmarkData();
    }, [viewBbox, processed, onLandmarksLoaded]);

    // Fetch country from route center coordinates
    useEffect(() => {
        if (!processed) return;

        const center = processed.stats.center;
        const cacheKey = `country_${center[0].toFixed(2)}_${center[1].toFixed(2)}`;

        // Check sessionStorage for cached country
        const cachedCountry = sessionStorage.getItem(cacheKey);
        if (cachedCountry) {
            setCountryCode(cachedCountry);
            onCountryCodeDetected?.(cachedCountry);
            return;
        }

        const fetchCountry = async () => {
            try {
                const response = await fetch('/api/country', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat: center[1], lng: center[0] })
                });
                const data = await response.json();
                if (data.countryCode) {
                    setCountryCode(data.countryCode);
                    sessionStorage.setItem(cacheKey, data.countryCode);
                    onCountryCodeDetected?.(data.countryCode);
                } else {
                    onCountryCodeDetected?.(null);
                }
            } catch (err) {
                console.error("Failed to fetch country", err);
                onCountryCodeDetected?.(null);
            }
        };

        fetchCountry();
    }, [processed, onCountryCodeDetected]);

    // Fetch water bodies when viewBbox changes
    useEffect(() => {
        if (!viewBbox || !showWater) {
            setWaterData(null);
            return;
        }

        // Generate a cache key based on bbox
        const cacheKey = `water_${viewBbox.minLng.toFixed(4)}_${viewBbox.minLat.toFixed(4)}_${viewBbox.maxLng.toFixed(4)}_${viewBbox.maxLat.toFixed(4)}`;

        // Check sessionStorage for cached water data
        const cachedWater = sessionStorage.getItem(cacheKey);
        if (cachedWater) {
            try {
                const parsed = JSON.parse(cachedWater);
                setWaterData(parsed);
                return;
            } catch {
                console.error("Failed to parse cached water data");
            }
        }

        const fetchWaterData = async () => {
            try {
                const response = await fetch('/api/water', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bbox: viewBbox })
                });
                if (!response.ok) {
                    console.error("Failed to fetch water data");
                    return;
                }
                const data = await response.json();
                setWaterData(data);
                // Cache the result
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(data));
                } catch {
                    console.warn("Failed to cache water data (storage limit)");
                }
            } catch (err) {
                console.error("Failed to fetch water data", err);
            }
        };

        fetchWaterData();
    }, [viewBbox, showWater]);

    useImperativeHandle(ref, () => ({
        exportSVG: async (fileName: string) => {
            if (!svgRef.current || !containerSize) return;

            const svgElement = svgRef.current;
            // Use containerSize (the actual rendered content dimensions) instead of getBoundingClientRect
            const { width, height } = containerSize;

            const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
            svgClone.setAttribute('width', width.toString());
            svgClone.setAttribute('height', height.toString());
            svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

            // Convert external images to data URLs for portability
            const images = svgClone.querySelectorAll('image');
            for (const img of images) {
                const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                    try {
                        const response = await fetch(href);
                        const blob = await response.blob();
                        const dataUrl = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        img.setAttribute('href', dataUrl);
                        img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
                    } catch (e) {
                        console.warn('Failed to convert image to data URL:', href, e);
                    }
                }
            }

            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgClone);
            const svgData = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;

            // Use octet-stream to force download instead of browser preview
            const blob = new Blob([svgData], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);

            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `${fileName.replace(/\.[^/.]+$/, "")}.svg`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        },
        exportPDF: async (fileName: string) => {
            if (!svgRef.current || !processed || !containerSize) return;

            const svgElement = svgRef.current;
            // Use containerSize (the actual rendered content dimensions) instead of getBoundingClientRect
            const { width, height } = containerSize;

            const orientation = width > height ? 'l' : 'p';
            const pdf = new jsPDF(orientation, 'px', [width, height]);

            // Clone the SVG and set explicit dimensions for proper rendering
            const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
            svgClone.setAttribute('width', width.toString());
            svgClone.setAttribute('height', height.toString());
            svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);

            // Convert external images to data URLs to avoid CORS issues when rendering to canvas
            const images = svgClone.querySelectorAll('image');
            for (const img of images) {
                const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                    try {
                        const response = await fetch(href);
                        const blob = await response.blob();
                        const dataUrl = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        img.setAttribute('href', dataUrl);
                        img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
                    } catch (e) {
                        console.warn('Failed to convert image to data URL:', href, e);
                    }
                }
            }

            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width * 2;
                canvas.height = height * 2;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
                    pdf.save(`${fileName.replace(/\.[^/.]+$/, "")}.pdf`);
                }
                URL.revokeObjectURL(svgUrl);
            };
            img.src = svgUrl;
        },
        exportPNG: async (fileName: string) => {
            if (!svgRef.current || !containerSize) return;

            const svgElement = svgRef.current;
            // Use containerSize (the actual rendered content dimensions) instead of getBoundingClientRect
            // which may include extra space from CSS layout
            const { width, height } = containerSize;

            // Clone the SVG and set explicit dimensions for proper rendering
            const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
            svgClone.setAttribute('width', width.toString());
            svgClone.setAttribute('height', height.toString());
            svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);

            // Convert external images to data URLs to avoid CORS issues when rendering to canvas
            const images = svgClone.querySelectorAll('image');
            for (const img of images) {
                const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                    try {
                        const response = await fetch(href);
                        const blob = await response.blob();
                        const dataUrl = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        img.setAttribute('href', dataUrl);
                        img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
                    } catch (e) {
                        console.warn('Failed to convert image to data URL:', href, e);
                    }
                }
            }

            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.onload = () => {
                // Use 2x resolution for high quality
                const scale = 2;
                const canvas = document.createElement('canvas');
                canvas.width = width * scale;
                canvas.height = height * scale;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            const downloadLink = document.createElement('a');
                            downloadLink.href = url;
                            downloadLink.download = `${fileName.replace(/\.[^/.]+$/, "")}.png`;
                            document.body.appendChild(downloadLink);
                            downloadLink.click();
                            document.body.removeChild(downloadLink);
                            URL.revokeObjectURL(url);
                        }
                    }, 'image/png');
                }
                URL.revokeObjectURL(svgUrl);
            };
            img.src = svgUrl;
        }
    }));

    useEffect(() => {
        if (!processed || !svgRef.current || !containerSize) return;

        const svg = d3.select(svgRef.current);
        const { width, height } = containerSize;

        // Color scheme based on dark mode
        const colors = isDarkMode ? {
            background: '#0a0a0a',
            contourStroke: '#2a2a2a',
            borderStroke: '#2a2a2a',
            routeStroke: '#f5f5f5',
            routeOutline: '#0a0a0a',
            markerFill: '#f5f5f5',
            markerStroke: '#0a0a0a',
            labelFill: '#f5f5f5',
            labelStroke: '#0a0a0a',
            titleFill: '#f5f5f5',
            statsFill: '#a3a3a3',
            waterFill: '#1a1a1a',
            waterStroke: '#252525',
        } : {
            background: '#ffffff',
            contourStroke: '#e5e5e5',
            borderStroke: '#e5e5e5',
            routeStroke: '#171717',
            routeOutline: 'white',
            markerFill: '#171717',
            markerStroke: 'white',
            labelFill: '#171717',
            labelStroke: 'white',
            titleFill: '#171717',
            statsFill: '#525252',
            waterFill: '#f5f5f5',
            waterStroke: '#e5e5e5',
        };

        // Clear previous
        svg.selectAll("*").remove();

        // Add background rect for dark mode
        svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", colors.background);

        // 1. Setup Projection
        // Poster padding for framing - creates a clean border around the artwork
        const posterPadding = Math.min(width, height) * 0.04; // 4% of smaller dimension
        const titleAreaHeight = Math.min(width, height) * 0.08; // Reserve space at bottom for title
        const padding = 20 + posterPadding;
        const projection = d3.geoMercator()
            .fitExtent([[padding, padding], [width - padding, height - padding - titleAreaHeight]], processed.feature);

        // Store projection for click handling
        projectionRef.current = projection;

        // Create clipping path for contours - stops before title area (title sits in clean white space)
        const clipId = `poster-clip-${Date.now()}`;
        svg.append("defs")
            .append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("x", posterPadding)
            .attr("y", posterPadding)
            .attr("width", width - posterPadding * 2)
            .attr("height", height - posterPadding * 2 - titleAreaHeight)
            .attr("rx", 2)
            .attr("ry", 2);

        // Add Hillshade layer if available
        if (hillshadeImage && showShading) {
            const topLeft = projection([viewBbox?.minLng || 0, viewBbox?.maxLat || 0]);
            const bottomRight = projection([viewBbox?.maxLng || 0, viewBbox?.minLat || 0]);

            if (topLeft && bottomRight) {
                const imgW = bottomRight[0] - topLeft[0];
                const imgH = bottomRight[1] - topLeft[1];

                svg.append("image")
                    .attr("xlink:href", hillshadeImage)
                    .attr("x", topLeft[0])
                    .attr("y", topLeft[1])
                    .attr("width", imgW)
                    .attr("height", imgH)
                    .attr("preserveAspectRatio", "none")
                    .attr("clip-path", `url(#${clipId})`)
                    .style("opacity", 1.0)
                    .style("image-rendering", "auto")
                    .attr("class", "hillshade-layer");
            }
        }

        // Draw visible border around contour map area
        svg.append("rect")
            .attr("x", posterPadding)
            .attr("y", posterPadding)
            .attr("width", width - posterPadding * 2)
            .attr("height", height - posterPadding * 2 - titleAreaHeight)
            .attr("rx", 2)
            .attr("ry", 2)
            .attr("fill", "none")
            .attr("stroke", colors.borderStroke)
            .attr("stroke-width", 1);

        const pathGenerator = d3.geoPath().projection(projection);

        // 2. Generate Background Terrain (Contours)
        let terrainValues: number[] | Float64Array;
        let usedGridSize = [gridSize.w, gridSize.h];

        if (elevationData) {
            terrainValues = elevationData;
        } else {
            const res = 4;
            const terrWidth = Math.ceil(width / res);
            const terrHeight = Math.ceil(height / res);
            terrainValues = Array.from(generateTerrain(terrWidth, terrHeight, processed.stats.center[0] + processed.stats.center[1]));
            usedGridSize = [terrWidth, terrHeight];
        }

        const contours = d3.contours()
            .size([usedGridSize[0], usedGridSize[1]])
            .thresholds(30)
            (Array.from(terrainValues));

        const contourGroup = svg.append("g")
            .attr("class", "contours")
            .attr("clip-path", `url(#${clipId})`);

        // Mapping function for grid coordinates to projection
        const gridToProjection = d3.geoTransform({
            point: function (x, y) {
                if (!viewBbox) return;
                const lng = viewBbox.minLng + (x / (usedGridSize[0] - 1)) * (viewBbox.maxLng - viewBbox.minLng);
                const lat = viewBbox.maxLat - (y / (usedGridSize[1] - 1)) * (viewBbox.maxLat - viewBbox.minLat);
                const p = projection([lng, lat]);
                if (p) this.stream.point(p[0], p[1]);
            }
        });

        contourGroup.selectAll("path")
            .data(contours)
            .enter().append("path")
            .attr("d", d3.geoPath(gridToProjection))
            .attr("fill", "none")
            .attr("stroke", colors.contourStroke)
            .attr("stroke-width", 1);

        // Render water bodies (lakes, rivers, oceans) on top of contours
        if (showWater && waterData && waterData.features && waterData.features.length > 0) {
            svg.append("g")
                .attr("class", "water")
                .attr("clip-path", `url(#${clipId})`)
                .selectAll("path")
                .data(waterData.features)
                .enter().append("path")
                .attr("d", (d: GeoJSON.Feature) => pathGenerator(d) || '')
                .attr("fill", colors.waterFill)
                .attr("stroke", colors.waterStroke)
                .attr("stroke-width", 0.5)
                .attr("stroke-linejoin", "round")
                .attr("stroke-linecap", "round");
        }

        // 3. Render Route
        const routeGroup = svg.append("g").attr("class", "route");

        routeGroup.append("path")
            .datum(processed.feature)
            .attr("d", pathGenerator)
            .attr("fill", "none")
            .attr("stroke", colors.routeOutline)
            .attr("stroke-width", 6)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round");

        routeGroup.append("path")
            .datum(processed.feature)
            .attr("d", pathGenerator)
            .attr("fill", "none")
            .attr("stroke", colors.routeStroke)
            .attr("stroke-width", 2)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round");

        // Add start and finish dots
        // Handle both LineString and MultiLineString geometries
        const geometry = processed.feature.geometry;
        const coordArrays: [number, number][][] = geometry.type === 'MultiLineString'
            ? geometry.coordinates as [number, number][][]
            : [geometry.coordinates as [number, number][]];

        // Get overall start (first point of first segment) and end (last point of last segment)
        const firstSegment = coordArrays[0];
        const lastSegment = coordArrays[coordArrays.length - 1];

        if (showMarkers && firstSegment && firstSegment.length >= 1 && lastSegment && lastSegment.length >= 1) {
            const startCoord = projection(firstSegment[0]);
            const endCoord = projection(lastSegment[lastSegment.length - 1]);

            if (startCoord) {
                routeGroup.append("circle")
                    .attr("cx", startCoord[0])
                    .attr("cy", startCoord[1])
                    .attr("r", 5)
                    .attr("fill", colors.routeOutline)
                    .attr("stroke", "none");
                routeGroup.append("circle")
                    .attr("cx", startCoord[0])
                    .attr("cy", startCoord[1])
                    .attr("r", 3)
                    .attr("fill", colors.routeStroke)
                    .attr("stroke", "none");
            }

            if (endCoord) {
                routeGroup.append("circle")
                    .attr("cx", endCoord[0])
                    .attr("cy", endCoord[1])
                    .attr("r", 5)
                    .attr("fill", colors.routeOutline)
                    .attr("stroke", "none");
                routeGroup.append("circle")
                    .attr("cx", endCoord[0])
                    .attr("cy", endCoord[1])
                    .attr("r", 3)
                    .attr("fill", colors.routeStroke)
                    .attr("stroke", "none");
            }
        }

        // 4. Render Landmarks (spacing only applies for initial auto-selection)
        if (landmarks.length > 0) {
            const landmarkGroup = svg.append("g")
                .attr("class", "landmarks")
                .attr("clip-path", `url(#${clipId})`);

            // Get projected route coordinates for determining label side
            // Handle both LineString and MultiLineString
            const allCoords: [number, number][] = geometry.type === 'MultiLineString'
                ? (geometry.coordinates as [number, number][][]).flat()
                : geometry.coordinates as [number, number][];
            const routeCoords = allCoords.map(
                coord => projection(coord)
            ).filter((c): c is [number, number] => c !== null);

            // Find closest point on route to determine which side landmark is on
            const findClosestRoutePoint = (x: number, y: number) => {
                let minDist = Infinity;
                let closestIdx = 0;
                for (let i = 0; i < routeCoords.length; i++) {
                    const dist = Math.pow(x - routeCoords[i][0], 2) + Math.pow(y - routeCoords[i][1], 2);
                    if (dist < minDist) {
                        minDist = dist;
                        closestIdx = i;
                    }
                }
                return closestIdx;
            };

            // Determine if landmark is to the left or right of route direction
            const isLeftOfRoute = (x: number, y: number) => {
                const closestIdx = findClosestRoutePoint(x, y);
                // Get route segment direction (use next point if available, else previous)
                const p1 = routeCoords[Math.max(0, closestIdx - 1)];
                const p2 = routeCoords[Math.min(routeCoords.length - 1, closestIdx + 1)];

                // Cross product to determine side
                // (p2 - p1) × (landmark - p1)
                const cross = (p2[0] - p1[0]) * (y - p1[1]) - (p2[1] - p1[1]) * (x - p1[0]);
                return cross > 0;
            };

            // Track placed marker positions for spacing (only used for initial auto-selection)
            const placedMarkers: { x: number; y: number }[] = [];
            const minMarkerSpacing = 80; // Minimum pixels between markers
            const visibleLandmarkIds: number[] = [];

            // Only enforce spacing when calculating initial selection (no user selection yet)
            const shouldEnforceSpacing = !selectedLandmarkIds;

            const isTooClose = (x: number, y: number) => {
                if (!shouldEnforceSpacing) return false; // User selection overrides spacing rules
                for (const placed of placedMarkers) {
                    const distance = Math.sqrt(
                        Math.pow(x - placed.x, 2) + Math.pow(y - placed.y, 2)
                    );
                    if (distance < minMarkerSpacing) {
                        return true;
                    }
                }
                return false;
            };

            // Define clip bounds for filtering landmarks
            const clipBounds = {
                minX: posterPadding,
                minY: posterPadding,
                maxX: width - posterPadding,
                maxY: height - posterPadding - titleAreaHeight
            };

            // Track all landmarks that are within map bounds (for edit panel)
            const inBoundsLandmarkIds: number[] = [];

            landmarks.forEach(landmark => {
                const coords = projection([landmark.lng, landmark.lat]);
                if (!coords) return;

                const [x, y] = coords;

                // Skip if outside the clipped map area
                if (x < clipBounds.minX || x > clipBounds.maxX || y < clipBounds.minY || y > clipBounds.maxY) {
                    return;
                }

                // Track that this landmark is in bounds
                inBoundsLandmarkIds.push(landmark.id);

                // Skip if no name
                if (!landmark.name) return;

                // Check if too close to an already placed marker (only for initial auto-selection)
                if (isTooClose(x, y)) {
                    return;
                }

                // Record this marker's position and ID
                placedMarkers.push({ x, y });
                visibleLandmarkIds.push(landmark.id);

                // Label text
                const labelName = landmark.name;
                const labelElevation = landmark.elevation ? `(${Math.round(landmark.elevation)}m)` : '';

                // Determine label position based on which side of route
                let labelOnLeft = isLeftOfRoute(x, y);
                const lineHeight = 11;
                const charWidth = 5.5;
                const labelOffset = 8;
                const edgePadding = 5;

                // Estimate the width of the longest line (name + elevation)
                const fullLabelText = labelElevation ? `${labelName} ${labelElevation}` : labelName;
                const estimatedLabelWidth = fullLabelText.length * charWidth;

                // Calculate available space on each side
                const spaceOnLeft = x - labelOffset - clipBounds.minX - edgePadding;
                const spaceOnRight = clipBounds.maxX - x - labelOffset - edgePadding;

                // If label would overflow on the preferred side, flip to the other side if there's more room
                if (labelOnLeft && estimatedLabelWidth > spaceOnLeft && spaceOnRight > spaceOnLeft) {
                    labelOnLeft = false;
                } else if (!labelOnLeft && estimatedLabelWidth > spaceOnRight && spaceOnLeft > spaceOnRight) {
                    labelOnLeft = true;
                }

                const textAnchor = labelOnLeft ? "end" : "start";
                const labelBaseX = labelOnLeft ? x - labelOffset : x + labelOffset;
                const labelBaseY = y + 3;

                // Calculate available space to the edge (after potential flip)
                const availableWidth = labelOnLeft
                    ? x - labelOffset - clipBounds.minX - edgePadding
                    : clipBounds.maxX - x - labelOffset - edgePadding;

                // Split name into words and wrap if needed
                const words = labelName.split(' ');
                const lines: string[] = [];
                let currentLine = '';

                words.forEach((word) => {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    const testWidth = testLine.length * charWidth;

                    if (testWidth > availableWidth && currentLine) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                });
                if (currentLine) {
                    lines.push(currentLine);
                }

                // Add elevation to last line if it fits, otherwise new line
                if (labelElevation) {
                    const lastLine = lines[lines.length - 1];
                    const combinedWidth = (lastLine.length + 1 + labelElevation.length) * charWidth;
                    if (combinedWidth <= availableWidth) {
                        lines[lines.length - 1] = `${lastLine} ${labelElevation}`;
                    } else {
                        lines.push(labelElevation);
                    }
                }

                // Draw marker based on type
                if (landmark.type === 'peak' || landmark.type === 'volcano') {
                    // Triangle marker for peaks
                    const size = 5;
                    landmarkGroup.append("path")
                        .attr("d", `M${x},${y - size} L${x - size * 0.7},${y + size * 0.5} L${x + size * 0.7},${y + size * 0.5} Z`)
                        .attr("fill", colors.markerFill)
                        .attr("stroke", colors.markerStroke)
                        .attr("stroke-width", 1.5);
                } else {
                    // Circle marker for other landmarks
                    landmarkGroup.append("circle")
                        .attr("cx", x)
                        .attr("cy", y)
                        .attr("r", 2.5)
                        .attr("fill", colors.markerFill)
                        .attr("stroke", colors.markerStroke)
                        .attr("stroke-width", 1.5);
                }

                // Render each line of text
                lines.forEach((line, lineIdx) => {
                    const lineY = labelBaseY + (lineIdx * lineHeight);

                    // Background for readability
                    landmarkGroup.append("text")
                        .attr("x", labelBaseX)
                        .attr("y", lineY)
                        .attr("text-anchor", textAnchor)
                        .attr("font-family", "system-ui, sans-serif")
                        .attr("font-size", "9px")
                        .attr("font-weight", "500")
                        .attr("fill", colors.labelStroke)
                        .attr("stroke", colors.labelStroke)
                        .attr("stroke-width", 3)
                        .attr("paint-order", "stroke")
                        .text(line);

                    // Text on top
                    landmarkGroup.append("text")
                        .attr("x", labelBaseX)
                        .attr("y", lineY)
                        .attr("text-anchor", textAnchor)
                        .attr("font-family", "system-ui, sans-serif")
                        .attr("font-size", "9px")
                        .attr("font-weight", "500")
                        .attr("fill", colors.labelFill)
                        .text(line);
                });
            });

            // Report which landmarks are actually visible (for initial selection)
            onVisibleLandmarksCalculated?.(visibleLandmarkIds);
            // Report which landmarks are in bounds (for edit panel filtering)
            onInBoundsLandmarksCalculated?.(inBoundsLandmarkIds);
        }

        // 5. Render Stats (in the reserved bottom area)
        const scaleFactor = Math.min(width, height) / 600;
        const titleFontSize = 18 * scaleFactor;
        const detailFontSize = 12 * scaleFactor;

        // Default values from route data
        const defaultRouteName = processed.name || fileName?.replace(/\.[^/.]+$/, "") || "Route";

        // Check for Strava stats in GeoJSON properties (more accurate than calculated)
        const stravaDistance = processed.feature.properties?.stravaDistance as number | undefined;
        const stravaElevationGain = processed.feature.properties?.stravaElevationGain as number | undefined;
        const stravaElevationLoss = processed.feature.properties?.stravaElevationLoss as number | undefined;
        const stravaDateStart = processed.feature.properties?.stravaDateStart as string | undefined;
        const stravaDateEnd = processed.feature.properties?.stravaDateEnd as string | undefined;

        // Use Strava stats if available, otherwise fall back to calculated values
        const defaultDistance = stravaDistance ? stravaDistance / 1000 : processed.stats.distance; // Strava is in meters
        const defaultElevationGain = stravaElevationGain ?? processed.stats.elevationGain;
        const defaultElevationLoss = stravaElevationLoss ?? processed.stats.elevationLoss;

        // Report defaults to parent for editing (including Strava dates if available)
        onDefaultsCalculated?.({
            routeName: defaultRouteName,
            distance: defaultDistance,
            elevationGain: defaultElevationGain,
            elevationLoss: defaultElevationLoss,
            dateStart: stravaDateStart,
            dateEnd: stravaDateEnd,
        });

        // Apply overrides if provided
        const routeName = statsOverrides?.routeName ?? defaultRouteName;
        const displayDistance = statsOverrides?.distance ?? defaultDistance.toFixed(1);
        const displayElevationGain = statsOverrides?.elevationGain ?? (defaultElevationGain > 0 ? Math.round(defaultElevationGain).toString() : '');
        const displayElevationLoss = statsOverrides?.elevationLoss ?? (defaultElevationLoss > 0 ? Math.round(defaultElevationLoss).toString() : '');

        // Format date for display
        const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        };

        let dateText = '';
        if (statsOverrides?.dateStart) {
            if (statsOverrides?.dateEnd) {
                dateText = `${formatDate(statsOverrides.dateStart)} – ${formatDate(statsOverrides.dateEnd)}`;
            } else {
                dateText = formatDate(statsOverrides.dateStart);
            }
        }

        // Format stats components
        const distanceText = `${displayDistance} km`;
        const ascentText = displayElevationGain ? `↑${displayElevationGain}m` : '';
        const descentText = displayElevationLoss ? `↓${displayElevationLoss}m` : '';

        // Determine image URL (custom override, default flag, or none)
        const imageEnabled = imageOverride?.enabled !== false;
        const imageUrl = imageEnabled
            ? (imageOverride?.url || (countryCode ? `https://flagcdn.com/${countryCode.toLowerCase()}.svg` : null))
            : null;

        // Stats area
        const statBarTop = height - posterPadding - titleAreaHeight;
        const locationText = statsOverrides?.location || '';
        const hasLocation = !!locationText;

        // Stats group
        const statBarGroup = svg.append("g").attr("class", "stat-bar");

        // Calculate dimensions
        const locationFontSize = 10 * scaleFactor;
        const lineGap = 4 * scaleFactor;
        const charWidthTitle = titleFontSize * 0.65; // Approximate character width for uppercase
        const charWidthDetail = detailFontSize * 0.55;

        // Calculate flag/image dimensions - make it prominent
        // Use 3:2 aspect ratio for flags (most common), custom images use xMidYMid meet to preserve ratio
        const flagHeight = imageUrl ? titleAreaHeight * 0.85 : 0;
        const flagWidth = imageUrl ? flagHeight * 1.5 : 0; // 3:2 aspect ratio for flags
        const flagGap = imageUrl ? 16 * scaleFactor : 0;

        // Estimate widths
        const titleWidth = routeName.length * charWidthTitle;
        const locationWidth = hasLocation ? locationText.length * charWidthDetail * 0.9 : 0;
        const leftContentWidth = Math.max(titleWidth, locationWidth);

        // Available width for stats (right side)
        const availableStatsWidth = width - posterPadding * 2 - leftContentWidth - flagWidth - flagGap - 20 * scaleFactor;

        // Build stats text, potentially splitting into two lines if needed
        const metricsText = [distanceText, ascentText, descentText].filter(Boolean).join('  ·  ');
        const fullStatsText = dateText
            ? `${metricsText}  ·  ${dateText}`
            : metricsText;
        const fullStatsWidth = fullStatsText.length * charWidthDetail;

        // Check if we need to split stats into two lines
        // Line 1 (top, aligned with title): metrics (distance, elevation)
        // Line 2 (bottom, aligned with location): date
        let statsTopLine = '';  // Metrics - aligned with title
        let statsBottomLine = '';  // Date - aligned with location

        if (fullStatsWidth <= availableStatsWidth && !hasLocation) {
            // Everything fits on one line and no location means single line layout
            statsTopLine = fullStatsText;
        } else if (hasLocation || dateText) {
            // Two-line layout: metrics on top, date on bottom
            statsTopLine = metricsText;
            statsBottomLine = dateText;
        } else {
            // No date and no location, but metrics don't fit - split metrics
            if (metricsText.length * charWidthDetail <= availableStatsWidth) {
                statsTopLine = metricsText;
            } else {
                statsTopLine = distanceText;
                statsBottomLine = [ascentText, descentText].filter(Boolean).join('  ·  ');
            }
        }

        // Calculate vertical positions - now potentially 2 lines on each side
        const hasBottomStats = !!statsBottomLine;
        const leftHasTwoLines = hasLocation;
        const rightHasTwoLines = hasBottomStats;
        const hasTwoLines = leftHasTwoLines || rightHasTwoLines;

        // Calculate the total height of the text block
        // For two lines: title height + gap + second line height (use larger of location/detail font)
        const secondLineFontSize = Math.max(locationFontSize, detailFontSize);
        const totalTextHeight = hasTwoLines
            ? titleFontSize + lineGap + secondLineFontSize
            : titleFontSize;

        // Center the text block vertically in the title area
        // titleY is the TOP of the first line (using hanging baseline)
        const titleY = statBarTop + (titleAreaHeight - totalTextHeight) / 2;
        // secondLineY is the TOP of the second line
        const secondLineY = titleY + titleFontSize + lineGap;

        // Stats X position (right side, before flag)
        const statsX = width - posterPadding - flagWidth - flagGap;

        // Route name (left side, top)
        statBarGroup.append("text")
            .attr("x", posterPadding)
            .attr("y", titleY)
            .attr("dominant-baseline", "hanging")
            .attr("font-family", "Inter, system-ui, sans-serif")
            .attr("font-size", `${titleFontSize}px`)
            .attr("font-weight", "500")
            .attr("letter-spacing", "0.03em")
            .attr("fill", colors.titleFill)
            .text(routeName.toUpperCase());

        // Location (left side, below title)
        if (hasLocation) {
            statBarGroup.append("text")
                .attr("x", posterPadding)
                .attr("y", secondLineY)
                .attr("dominant-baseline", "hanging")
                .attr("font-family", "system-ui, sans-serif")
                .attr("font-size", `${locationFontSize}px`)
                .attr("font-weight", "400")
                .attr("fill", colors.statsFill)
                .text(locationText);
        }

        // Stats top line (right side, top-aligned with title)
        if (statsTopLine) {
            statBarGroup.append("text")
                .attr("x", statsX)
                .attr("y", titleY)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "hanging")
                .attr("font-family", "system-ui, sans-serif")
                .attr("font-size", `${detailFontSize}px`)
                .attr("fill", colors.statsFill)
                .text(statsTopLine);
        }

        // Stats bottom line (right side, same gap from stats top line as location from title)
        if (statsBottomLine) {
            statBarGroup.append("text")
                .attr("x", statsX)
                .attr("y", titleY + detailFontSize + lineGap)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "hanging")
                .attr("font-family", "system-ui, sans-serif")
                .attr("font-size", `${detailFontSize}px`)
                .attr("fill", colors.statsFill)
                .text(statsBottomLine);
        }

        // Flag/image (far right, vertically centered within stat bar area only)
        if (imageUrl) {
            const flagX = width - posterPadding - flagWidth;
            // Keep flag within the stat bar area (below the map border)
            // statBarTop is the top of the stat bar area, titleAreaHeight is the height
            const flagY = statBarTop + (titleAreaHeight - flagHeight) / 2;

            statBarGroup.append("image")
                .attr("x", flagX)
                .attr("y", flagY)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("href", imageUrl)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

    }, [processed, geoJson, elevationData, gridSize, landmarks, fileName, onVisibleLandmarksCalculated, onInBoundsLandmarksCalculated, selectedLandmarkIds, countryCode, statsOverrides, onDefaultsCalculated, imageOverride, containerSize, isDarkMode, showWater, waterData, showMarkers]);

    return (
        <div ref={containerRef} className={`w-full h-full relative ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
            {isLoadingElevation && (
                <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-neutral-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border border-neutral-100 z-10">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Fetching terrain...
                </div>
            )}
            {elevationError && (
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 text-[10px] text-red-500 bg-red-50/90 backdrop-blur-sm px-3 py-2 rounded border border-red-100 z-10 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold uppercase tracking-wider">Topography Offline:</span>
                        <span>{elevationError} Showing artistic simulation instead.</span>
                    </div>
                </div>
            )}
            <svg
                ref={svgRef}
                className={`w-full h-full ${isPlacingLandmark ? 'cursor-crosshair' : ''}`}
                onClick={(e) => {
                    if (!isPlacingLandmark || !onMapClick || !projectionRef.current) return;

                    const svg = svgRef.current;
                    if (!svg) return;

                    const rect = svg.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    // Convert screen coordinates to geo coordinates
                    const invert = projectionRef.current.invert;
                    if (!invert) return;

                    const coords = invert([x, y]);
                    if (coords) {
                        onMapClick(coords[1], coords[0]); // lat, lng
                    }
                }}
            />
            {isPlacingLandmark && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-xs px-3 py-2 rounded-full shadow-lg z-10">
                    Click on the map to place your landmark
                </div>
            )}
        </div>
    );
});

ArtCanvas.displayName = 'ArtCanvas';

export default ArtCanvas;
