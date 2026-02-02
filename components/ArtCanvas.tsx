
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
    onLandmarksLoaded?: (landmarks: Landmark[]) => void;
    onVisibleLandmarksCalculated?: (visibleIds: number[]) => void;
    onInBoundsLandmarksCalculated?: (inBoundsIds: number[]) => void;
    onDefaultsCalculated?: (defaults: RouteDefaults) => void;
    onCountryCodeDetected?: (countryCode: string | null) => void;
    onMapClick?: (lat: number, lng: number) => void;
}

export interface ArtCanvasHandle {
    exportSVG: (fileName: string) => void;
    exportPDF: (fileName: string) => void;
}

const ArtCanvas = forwardRef<ArtCanvasHandle, ArtCanvasProps>(({ geoJson, fileName, selectedLandmarkIds, customLandmarks, statsOverrides, imageOverride, isPlacingLandmark, isDarkMode = false, onLandmarksLoaded, onVisibleLandmarksCalculated, onInBoundsLandmarksCalculated, onDefaultsCalculated, onCountryCodeDetected, onMapClick }, ref) => {
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

    // Track container size changes with ResizeObserver
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setContainerSize({ width, height });
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
            setViewBbox({
                minLng: topLeft[0],
                maxLat: topLeft[1],
                maxLng: bottomRight[0],
                minLat: bottomRight[1]
            });
        }
    }, [processed, containerSize]);

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
                    maxDistance: 15, // 15km from route for better coverage on larger maps
                    limit: 50
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

        const contourGroup = svg.append("g")
            .attr("class", "contours")
            .attr("clip-path", `url(#${clipId})`);

        contourGroup.selectAll("path")
            .data(contours)
            .enter().append("path")
            .attr("d", d3.geoPath(d3.geoTransform({
                point: function (x, y) {
                    this.stream.point(x * scaleX, y * scaleY);
                }
            })))
            .attr("fill", "none")
            .attr("stroke", colors.contourStroke)
            .attr("stroke-width", 1);


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

        // 4. Render Landmarks (spacing only applies for initial auto-selection)
        if (landmarks.length > 0) {
            const landmarkGroup = svg.append("g")
                .attr("class", "landmarks")
                .attr("clip-path", `url(#${clipId})`);

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
                const labelOnLeft = isLeftOfRoute(x, y);
                const textAnchor = labelOnLeft ? "end" : "start";
                const labelBaseX = labelOnLeft ? x - 8 : x + 8;
                const labelBaseY = y + 3;
                const lineHeight = 11;
                const charWidth = 5.5;

                // Calculate available space to the edge
                const availableWidth = labelOnLeft
                    ? x - 8 - clipBounds.minX - 5
                    : clipBounds.maxX - x - 8 - 5;

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

        // 5. Render Stat Bar (in the reserved bottom area)
        const scaleFactor = Math.min(width, height) / 600;
        const titleFontSize = 18 * scaleFactor;
        const detailFontSize = 12 * scaleFactor;

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

        // Stat bar area
        const statBarTop = height - posterPadding - titleAreaHeight;
        const locationText = statsOverrides?.location || '';
        const hasLocation = !!locationText;

        // Stat bar group
        const statBarGroup = svg.append("g").attr("class", "stat-bar");

        // Calculate dimensions
        const locationFontSize = 10 * scaleFactor;
        const lineGap = 4 * scaleFactor;
        const charWidthTitle = titleFontSize * 0.65; // Approximate character width for uppercase
        const charWidthDetail = detailFontSize * 0.55;

        // Calculate flag dimensions
        const flagHeight = imageUrl ? titleAreaHeight * 0.6 : 0;
        const flagWidth = imageUrl ? flagHeight * 1.5 : 0;
        const flagGap = imageUrl ? 12 * scaleFactor : 0;

        // Estimate widths
        const titleWidth = routeName.length * charWidthTitle;
        const locationWidth = hasLocation ? locationText.length * charWidthDetail * 0.9 : 0;
        const leftContentWidth = Math.max(titleWidth, locationWidth);

        // Available width for stats (right side)
        const availableStatsWidth = width - posterPadding * 2 - leftContentWidth - flagWidth - flagGap - 20 * scaleFactor;

        // Build stats text, potentially splitting into two lines if needed
        const statsLine1Parts = [dateText, distanceText, ascentText, descentText].filter(Boolean);
        const fullStatsText = statsLine1Parts.join('  ·  ');
        const fullStatsWidth = fullStatsText.length * charWidthDetail;

        // Check if we need to split stats into two lines
        let statsTextLine1 = '';
        let statsTextLine2 = '';

        if (fullStatsWidth <= availableStatsWidth) {
            // Everything fits on one line
            statsTextLine1 = fullStatsText;
        } else {
            // Split: date on line 1 (with location), distance/elevation on line 2 (with title)
            if (dateText) {
                statsTextLine1 = dateText;
                statsTextLine2 = [distanceText, ascentText, descentText].filter(Boolean).join('  ·  ');
            } else {
                // No date, just put distance/elevation, maybe split if still too long
                const metricsText = [distanceText, ascentText, descentText].filter(Boolean).join('  ·  ');
                if (metricsText.length * charWidthDetail <= availableStatsWidth) {
                    statsTextLine1 = metricsText;
                } else {
                    // Split metrics across two lines
                    statsTextLine1 = distanceText;
                    statsTextLine2 = [ascentText, descentText].filter(Boolean).join('  ·  ');
                }
            }
        }

        // Calculate vertical positions - now potentially 2 lines on each side
        const hasStatsLine2 = !!statsTextLine2;
        const leftHasTwoLines = hasLocation;
        const rightHasTwoLines = hasStatsLine2;
        const hasTwoLines = leftHasTwoLines || rightHasTwoLines;

        const totalTextHeight = hasTwoLines
            ? titleFontSize + lineGap + Math.max(locationFontSize, detailFontSize)
            : titleFontSize;
        const titleY = statBarTop + (titleAreaHeight - totalTextHeight) / 2 + titleFontSize;
        const secondLineY = titleY + lineGap + Math.max(locationFontSize, detailFontSize);

        // Stats X position (right side, before flag)
        const statsX = width - posterPadding - flagWidth - flagGap;

        // Route name (left side, top)
        statBarGroup.append("text")
            .attr("x", posterPadding)
            .attr("y", titleY)
            .attr("font-family", "system-ui, sans-serif")
            .attr("font-size", `${titleFontSize}px`)
            .attr("font-weight", "600")
            .attr("letter-spacing", "0.1em")
            .attr("fill", colors.titleFill)
            .text(routeName.toUpperCase());

        // Location (left side, below title)
        if (hasLocation) {
            statBarGroup.append("text")
                .attr("x", posterPadding)
                .attr("y", secondLineY)
                .attr("font-family", "system-ui, sans-serif")
                .attr("font-size", `${locationFontSize}px`)
                .attr("font-weight", "400")
                .attr("fill", colors.statsFill)
                .text(locationText);
        }

        // Stats line 2 (right side, aligned with title) - metrics like distance/elevation
        if (statsTextLine2) {
            statBarGroup.append("text")
                .attr("x", statsX)
                .attr("y", titleY)
                .attr("text-anchor", "end")
                .attr("font-family", "system-ui, sans-serif")
                .attr("font-size", `${detailFontSize}px`)
                .attr("fill", colors.statsFill)
                .text(statsTextLine2);
        }

        // Stats line 1 (right side, aligned with location/second line) - date or all stats if fits
        if (statsTextLine1) {
            const statsLine1Y = hasTwoLines ? secondLineY : titleY;
            statBarGroup.append("text")
                .attr("x", statsX)
                .attr("y", statsLine1Y)
                .attr("text-anchor", "end")
                .attr("font-family", "system-ui, sans-serif")
                .attr("font-size", `${detailFontSize}px`)
                .attr("fill", colors.statsFill)
                .text(statsTextLine1);
        }

        // Flag/image (far right, vertically centered)
        if (imageUrl) {
            const flagX = width - posterPadding - flagWidth;
            const flagCenterY = statBarTop + titleAreaHeight / 2;
            const flagY = flagCenterY - flagHeight / 2;

            statBarGroup.append("image")
                .attr("x", flagX)
                .attr("y", flagY)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("href", imageUrl)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

    }, [processed, geoJson, elevationData, gridSize, landmarks, fileName, onVisibleLandmarksCalculated, onInBoundsLandmarksCalculated, selectedLandmarkIds, countryCode, statsOverrides, onDefaultsCalculated, imageOverride, containerSize, isDarkMode]);

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
