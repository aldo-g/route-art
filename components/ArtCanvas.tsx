
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
    distance?: string;
    elevationGain?: string;
    elevationLoss?: string;
}

export interface RouteDefaults {
    routeName: string;
    distance: number;
    elevationGain: number;
    elevationLoss: number;
}

export interface ImageOverride {
    url?: string;
    enabled: boolean;
}

interface ArtCanvasProps {
    geoJson: any; // Raw GeoJSON from parser
    fileName?: string;
    selectedLandmarkIds?: Set<number>;
    statsOverrides?: StatsOverrides;
    imageOverride?: ImageOverride;
    onLandmarksLoaded?: (landmarks: Landmark[]) => void;
    onVisibleLandmarksCalculated?: (visibleIds: number[]) => void;
    onDefaultsCalculated?: (defaults: RouteDefaults) => void;
    onCountryCodeDetected?: (countryCode: string | null) => void;
}

export interface ArtCanvasHandle {
    exportSVG: (fileName: string) => void;
    exportPDF: (fileName: string) => void;
}

const ArtCanvas = forwardRef<ArtCanvasHandle, ArtCanvasProps>(({ geoJson, fileName, selectedLandmarkIds, statsOverrides, imageOverride, onLandmarksLoaded, onVisibleLandmarksCalculated, onDefaultsCalculated, onCountryCodeDetected }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [processed, setProcessed] = useState<ProcessedRoute | null>(null);
    const [elevationData, setElevationData] = useState<number[] | null>(null);
    const [isLoadingElevation, setIsLoadingElevation] = useState(false);
    const [elevationError, setElevationError] = useState<string | null>(null);
    const [gridSize] = useState({ w: 200, h: 200 });
    const [viewBbox, setViewBbox] = useState<{ minLng: number; minLat: number; maxLng: number; maxLat: number } | null>(null);
    const [allLandmarks, setAllLandmarks] = useState<Landmark[]>([]);
    const [countryCode, setCountryCode] = useState<string | null>(null);

    // Filter landmarks based on selection (if in edit mode with selections)
    const landmarks = selectedLandmarkIds
        ? allLandmarks.filter(l => selectedLandmarkIds.has(l.id))
        : allLandmarks;

    useEffect(() => {
        if (geoJson) {
            const result = processRoute(geoJson);
            setProcessed(result);
            setElevationData(null);
            setElevationError(null);
        }
    }, [geoJson]);

    useEffect(() => {
        if (!processed || !containerRef.current) return;

        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width === 0 || height === 0) return;

        const padding = 20;
        const projection = d3.geoMercator()
            .fitExtent([[padding, padding], [width - padding, height - padding]], processed.feature);

        const topLeft = (projection.invert as (coords: [number, number]) => [number, number] | null)([0, 0]);
        const bottomRight = (projection.invert as (coords: [number, number]) => [number, number] | null)([width, height]);

        if (topLeft && bottomRight) {
            setViewBbox({
                minLng: topLeft[0],
                maxLat: topLeft[1],
                maxLng: bottomRight[0],
                minLat: bottomRight[1]
            });
        }
    }, [processed]);

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
            try {
                const result = await fetchLandmarks(viewBbox, processed.feature, {
                    maxDistance: 5, // 5km from route
                    limit: 30
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

    useImperativeHandle(ref, () => ({
        exportSVG: (fileName: string) => {
            if (!svgRef.current) return;

            const svgElement = svgRef.current;
            const { width, height } = svgElement.getBoundingClientRect();

            const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
            svgClone.setAttribute('width', width.toString());
            svgClone.setAttribute('height', height.toString());
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = svgUrl;
            downloadLink.download = `${fileName.replace(/\.[^/.]+$/, "")}.svg`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(svgUrl);
        },
        exportPDF: (fileName: string) => {
            if (!svgRef.current || !processed) return;

            const svgElement = svgRef.current;
            const { width, height } = svgElement.getBoundingClientRect();

            const orientation = width > height ? 'l' : 'p';
            const pdf = new jsPDF(orientation, 'px', [width, height]);

            const svgData = new XMLSerializer().serializeToString(svgRef.current);
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
        }
    }));

    useEffect(() => {
        if (!processed || !svgRef.current || !containerRef.current) return;

        const svg = d3.select(svgRef.current);
        const { width, height } = containerRef.current.getBoundingClientRect();

        // Clear previous
        svg.selectAll("*").remove();

        // 1. Setup Projection
        const padding = 20;
        const projection = d3.geoMercator()
            .fitExtent([[padding, padding], [width - padding, height - padding]], processed.feature);

        const pathGenerator = d3.geoPath().projection(projection);

        // 2. Generate Background Terrain (Contours)
        const resX = width / (gridSize.w - 1);
        const resY = height / (gridSize.h - 1);

        let terrainValues: number[] | Float64Array;
        let usedGridSize = [gridSize.w, gridSize.h];
        let scaleX = resX;
        let scaleY = resY;

        if (elevationData) {
            terrainValues = elevationData;
        } else {
            const res = 4;
            const terrWidth = Math.ceil(width / res);
            const terrHeight = Math.ceil(height / res);
            terrainValues = Array.from(generateTerrain(terrWidth, terrHeight, processed.stats.center[0] + processed.stats.center[1]));
            usedGridSize = [terrWidth, terrHeight];
            scaleX = res;
            scaleY = res;
        }

        const contours = d3.contours()
            .size([usedGridSize[0], usedGridSize[1]])
            .thresholds(30)
            (Array.from(terrainValues));

        const contourGroup = svg.append("g").attr("class", "contours");

        contourGroup.selectAll("path")
            .data(contours)
            .enter().append("path")
            .attr("d", d3.geoPath(d3.geoTransform({
                point: function (x, y) {
                    this.stream.point(x * scaleX, y * scaleY);
                }
            })))
            .attr("fill", "none")
            .attr("stroke", "#e5e5e5")
            .attr("stroke-width", 1);


        // 3. Render Route
        const routeGroup = svg.append("g").attr("class", "route");

        routeGroup.append("path")
            .datum(processed.feature)
            .attr("d", pathGenerator)
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-width", 6)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round");

        routeGroup.append("path")
            .datum(processed.feature)
            .attr("d", pathGenerator)
            .attr("fill", "none")
            .attr("stroke", "#171717")
            .attr("stroke-width", 2)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round");

        // 4. Render Landmarks (spacing only applies for initial auto-selection)
        if (landmarks.length > 0) {
            const landmarkGroup = svg.append("g").attr("class", "landmarks");

            // Get projected route coordinates for determining label side
            const routeCoords = processed.feature.geometry.coordinates.map(
                coord => projection(coord as [number, number])
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

            landmarks.forEach(landmark => {
                const coords = projection([landmark.lng, landmark.lat]);
                if (!coords) return;

                const [x, y] = coords;

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
                const label = landmark.elevation
                    ? `${landmark.name} (${Math.round(landmark.elevation)}m)`
                    : landmark.name;

                // Estimate label width for positioning
                const estimatedLabelWidth = label.length * 5.5;

                // Determine label position based on which side of route
                const labelOnLeft = isLeftOfRoute(x, y);
                const labelX = labelOnLeft ? x - 8 - estimatedLabelWidth : x + 8;
                const labelY = y + 3;
                const textAnchor = labelOnLeft ? "end" : "start";

                // Draw marker based on type
                if (landmark.type === 'peak' || landmark.type === 'volcano') {
                    // Triangle marker for peaks
                    const size = 5;
                    landmarkGroup.append("path")
                        .attr("d", `M${x},${y - size} L${x - size * 0.7},${y + size * 0.5} L${x + size * 0.7},${y + size * 0.5} Z`)
                        .attr("fill", "#171717")
                        .attr("stroke", "white")
                        .attr("stroke-width", 1.5);
                } else {
                    // Circle marker for other landmarks
                    landmarkGroup.append("circle")
                        .attr("cx", x)
                        .attr("cy", y)
                        .attr("r", 2.5)
                        .attr("fill", "#171717")
                        .attr("stroke", "white")
                        .attr("stroke-width", 1.5);
                }

                // White background for readability
                landmarkGroup.append("text")
                    .attr("x", labelOnLeft ? x - 8 : x + 8)
                    .attr("y", labelY)
                    .attr("text-anchor", textAnchor)
                    .attr("font-family", "system-ui, sans-serif")
                    .attr("font-size", "9px")
                    .attr("font-weight", "500")
                    .attr("fill", "white")
                    .attr("stroke", "white")
                    .attr("stroke-width", 3)
                    .attr("paint-order", "stroke")
                    .text(label);

                // Text on top
                landmarkGroup.append("text")
                    .attr("x", labelOnLeft ? x - 8 : x + 8)
                    .attr("y", labelY)
                    .attr("text-anchor", textAnchor)
                    .attr("font-family", "system-ui, sans-serif")
                    .attr("font-size", "9px")
                    .attr("font-weight", "500")
                    .attr("fill", "#171717")
                    .text(label);
            });

            // Report which landmarks are actually visible (for initial selection)
            onVisibleLandmarksCalculated?.(visibleLandmarkIds);
        }

        // 5. Render Stats Box
        const statsGroup = svg.append("g").attr("class", "stats");
        const boxPadding = 20;
        const boxX = 28;
        const boxY = height - 110;
        const lineHeight = 22;

        // Default values from route data
        const defaultRouteName = processed.name || fileName?.replace(/\.[^/.]+$/, "") || "Route";
        const defaultDistance = processed.stats.distance;
        const defaultElevationGain = processed.stats.elevationGain;
        const defaultElevationLoss = processed.stats.elevationLoss;

        // Report defaults to parent for editing
        onDefaultsCalculated?.({
            routeName: defaultRouteName,
            distance: defaultDistance,
            elevationGain: defaultElevationGain,
            elevationLoss: defaultElevationLoss
        });

        // Apply overrides if provided
        const routeName = statsOverrides?.routeName ?? defaultRouteName;
        const displayDistance = statsOverrides?.distance ?? defaultDistance.toFixed(1);
        const displayElevationGain = statsOverrides?.elevationGain ?? (defaultElevationGain > 0 ? Math.round(defaultElevationGain).toString() : '');
        const displayElevationLoss = statsOverrides?.elevationLoss ?? (defaultElevationLoss > 0 ? Math.round(defaultElevationLoss).toString() : '');

        // Format stats
        const distanceText = `${displayDistance} km`;
        const ascentText = displayElevationGain ? `↑ ${displayElevationGain}m` : '';
        const descentText = displayElevationLoss ? `↓ ${displayElevationLoss}m` : '';
        const elevationText = [ascentText, descentText].filter(Boolean).join('  ');

        // Calculate box dimensions
        const hasElevation = elevationText.length > 0;
        const boxHeight = hasElevation ? lineHeight * 3 + boxPadding * 2 : lineHeight * 2 + boxPadding * 2;

        // Calculate actual text width based on content
        const routeNameWidth = routeName.length * 8; // ~8px per character at 16px font
        const distanceWidth = distanceText.length * 6.5; // ~6.5px per character at 13px font
        const elevationWidth = elevationText.length * 6.5;
        const textWidth = Math.max(routeNameWidth, distanceWidth, elevationWidth, 100);

        // Determine image URL (custom override, default flag, or none)
        const imageEnabled = imageOverride?.enabled !== false; // Default to true if not specified
        const imageUrl = imageEnabled
            ? (imageOverride?.url || (countryCode ? `https://flagcdn.com/${countryCode.toLowerCase()}.svg` : null))
            : null;

        // Calculate image dimensions (if image available)
        const flagHeight = imageUrl ? boxHeight - boxPadding * 2 : 0;
        const flagWidth = imageUrl ? flagHeight * 1.5 : 0; // Standard flag aspect ratio ~3:2
        const flagGap = imageUrl ? 6 : 0; // Small gap between text and image

        const boxWidth = textWidth + flagWidth + flagGap + boxPadding * 2;

        // Background box
        statsGroup.append("rect")
            .attr("x", boxX - boxPadding)
            .attr("y", boxY - boxPadding - 18)
            .attr("width", boxWidth)
            .attr("height", boxHeight)
            .attr("fill", "white")
            .attr("stroke", "#e5e5e5")
            .attr("stroke-width", 1)
            .attr("rx", 6)
            .attr("ry", 6);

        // Title with flag on the right
        const titleGroup = statsGroup.append("g").attr("class", "title");

        // Route name
        titleGroup.append("text")
            .attr("x", boxX)
            .attr("y", boxY)
            .attr("font-family", "system-ui, sans-serif")
            .attr("font-size", "16px")
            .attr("font-weight", "600")
            .attr("fill", "#171717")
            .text(routeName);

        // Image inside the box on the right (if image available)
        if (imageUrl) {
            const flagX = boxX + textWidth + flagGap;
            const flagY = boxY - boxPadding - 18 + boxPadding;

            statsGroup.append("image")
                .attr("x", flagX)
                .attr("y", flagY)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("href", imageUrl)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        // Distance
        statsGroup.append("text")
            .attr("x", boxX)
            .attr("y", boxY + lineHeight)
            .attr("font-family", "system-ui, sans-serif")
            .attr("font-size", "13px")
            .attr("fill", "#525252")
            .text(distanceText);

        // Elevation (if available)
        if (hasElevation) {
            statsGroup.append("text")
                .attr("x", boxX)
                .attr("y", boxY + lineHeight * 2)
                .attr("font-family", "system-ui, sans-serif")
                .attr("font-size", "13px")
                .attr("fill", "#525252")
                .text(elevationText);
        }

    }, [processed, geoJson, elevationData, gridSize, landmarks, fileName, onVisibleLandmarksCalculated, selectedLandmarkIds, countryCode, statsOverrides, onDefaultsCalculated, imageOverride]);

    return (
        <div ref={containerRef} className="w-full h-full bg-white relative">
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
            <svg ref={svgRef} className="w-full h-full" />
        </div>
    );
});

ArtCanvas.displayName = 'ArtCanvas';

export default ArtCanvas;
