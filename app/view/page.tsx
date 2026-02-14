
// app/view/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ArtCanvas, { ArtCanvasHandle, StatsOverrides, RouteDefaults, ImageOverride } from '@/components/ArtCanvas';
import EditPanel from '@/components/EditPanel';
import LoadingOverlay from '@/components/LoadingOverlay';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Landmark } from '@/lib/landmarks';

export default function ViewPage() {
    const router = useRouter();
    const [geoJson, setGeoJson] = useState<any>(null);
    const [fileName, setFileName] = useState<string>('');
    const canvasRef = useRef<ArtCanvasHandle>(null);

    // Landmark editing state
    const [allLandmarks, setAllLandmarks] = useState<Landmark[]>([]);
    const [customLandmarks, setCustomLandmarks] = useState<Landmark[]>([]);
    const [selectedLandmarkIds, setSelectedLandmarkIds] = useState<Set<number> | null>(null);
    const [hasInitialSelection, setHasInitialSelection] = useState(false);
    const [inBoundsLandmarkIds, setInBoundsLandmarkIds] = useState<Set<number> | null>(null);

    // Stats editing state
    const [statsOverrides, setStatsOverrides] = useState<StatsOverrides>({});
    const [routeDefaults, setRouteDefaults] = useState<RouteDefaults | null>(null);

    // Image override state
    const [imageOverride, setImageOverride] = useState<ImageOverride>({ enabled: true });
    const [countryCode, setCountryCode] = useState<string | null>(null);


    // Poster orientation state
    const [isPortrait, setIsPortrait] = useState(false);

    // Canvas dark mode state
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showWater, setShowWater] = useState(true);
    const [showMarkers, setShowMarkers] = useState(true);
    const [showShading, setShowShading] = useState(true);
    const [shadingIntensity, setShadingIntensity] = useState(0.5);
    const [artMode, setArtMode] = useState(false);
    const [routeHighlight, setRouteHighlight] = useState(true);
    const [routeHighlightIntensity, setRouteHighlightIntensity] = useState(0.5);
    const [showHighlights, setShowHighlights] = useState(false);

    // Unified loading state
    const [loadingStatus, setLoadingStatus] = useState<string | null>("Processing route...");

    // Click-to-place landmark state
    const [isPlacingLandmark, setIsPlacingLandmark] = useState(false);
    const [pendingLandmark, setPendingLandmark] = useState<{ name: string; iconType: Landmark['type']; elevation?: string } | null>(null);

    useEffect(() => {
        // Retrieve data from sessionStorage
        const storedData = sessionStorage.getItem('routeArtData');
        const storedFileName = sessionStorage.getItem('routeArtFileName');

        if (storedData && storedFileName) {
            try {
                setGeoJson(JSON.parse(storedData));
                setFileName(storedFileName);

                // Also restore selected landmarks if saved
                const storedSelectedIds = sessionStorage.getItem('routeArtSelectedLandmarks');
                if (storedSelectedIds) {
                    setSelectedLandmarkIds(new Set(JSON.parse(storedSelectedIds)));
                    setHasInitialSelection(true);
                }

                // Restore stats overrides if saved
                const storedStatsOverrides = sessionStorage.getItem('routeArtStatsOverrides');
                if (storedStatsOverrides) {
                    setStatsOverrides(JSON.parse(storedStatsOverrides));
                }

                // Restore image override if saved
                const storedImageOverride = sessionStorage.getItem('routeArtImageOverride');
                if (storedImageOverride) {
                    setImageOverride(JSON.parse(storedImageOverride));
                }

                // Restore custom landmarks if saved
                const storedCustomLandmarks = sessionStorage.getItem('routeArtCustomLandmarks');
                if (storedCustomLandmarks) {
                    setCustomLandmarks(JSON.parse(storedCustomLandmarks));
                }

                // Restore design toggles
                const storedShowWater = sessionStorage.getItem('routeArtShowWater');
                if (storedShowWater !== null) {
                    setShowWater(storedShowWater === 'true');
                }

                const storedShowShading = sessionStorage.getItem('routeArtShowShading');
                if (storedShowShading !== null) {
                    setShowShading(storedShowShading === 'true');
                }

                const storedShadingIntensity = sessionStorage.getItem('routeArtShadingIntensity');
                if (storedShadingIntensity !== null) {
                    setShadingIntensity(parseFloat(storedShadingIntensity));
                }

                const storedArtMode = sessionStorage.getItem('routeArtArtMode');
                if (storedArtMode !== null) {
                    setArtMode(storedArtMode === 'true');
                }

                // Finish initial load status
                setLoadingStatus(null);

            } catch {
                console.error('Failed to parse stored route data');
                router.push('/');
            }
        } else {
            // No data, redirect back to upload
            router.push('/');
        }
    }, [router]);

    const handleLandmarksLoaded = useCallback((landmarks: Landmark[]) => {
        setAllLandmarks(landmarks);
    }, []);

    // Combine API landmarks with custom landmarks, filtered to only those in bounds
    const combinedLandmarks = [...allLandmarks, ...customLandmarks].filter(
        l => !inBoundsLandmarkIds || inBoundsLandmarkIds.has(l.id)
    );

    const handleAddCustomLandmark = useCallback((landmark: Omit<Landmark, 'id'>) => {
        const newLandmark: Landmark = {
            ...landmark,
            id: Date.now(), // Use timestamp as unique ID
            isCustom: true
        };
        setCustomLandmarks(prev => {
            const updated = [...prev, newLandmark];
            try {
                sessionStorage.setItem('routeArtCustomLandmarks', JSON.stringify(updated));
            } catch {
                console.warn('Failed to save custom landmarks to sessionStorage (quota exceeded)');
            }
            return updated;
        });
        // Auto-select the new landmark
        setSelectedLandmarkIds(prev => {
            const newSet = new Set(prev);
            newSet.add(newLandmark.id);
            try {
                sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify([...newSet]));
            } catch {
                console.warn('Failed to save selected landmarks to sessionStorage (quota exceeded)');
            }
            return newSet;
        });
    }, []);

    const handleDeleteCustomLandmark = (id: number) => {
        setCustomLandmarks(prev => {
            const updated = prev.filter(l => l.id !== id);
            try {
                sessionStorage.setItem('routeArtCustomLandmarks', JSON.stringify(updated));
            } catch {
                console.warn('Failed to save custom landmarks to sessionStorage');
            }
            return updated;
        });
        // Also remove from selection
        setSelectedLandmarkIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            try {
                sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify([...newSet]));
            } catch {
                console.warn('Failed to save selected landmarks to sessionStorage');
            }
            return newSet;
        });
    };

    // Start placing a landmark - called from EditPanel
    const handleStartPlacingLandmark = (name: string, iconType: Landmark['type'], elevation?: string) => {
        setPendingLandmark({ name, iconType, elevation });
        setIsPlacingLandmark(true);
    };

    // Cancel placing a landmark
    const handleCancelPlacingLandmark = () => {
        setPendingLandmark(null);
        setIsPlacingLandmark(false);
    };

    // Called when user clicks on the canvas to place the landmark
    const handleMapClick = useCallback((lat: number, lng: number) => {
        if (!pendingLandmark) return;

        const elevation = pendingLandmark.elevation ? parseFloat(pendingLandmark.elevation) : undefined;

        handleAddCustomLandmark({
            type: pendingLandmark.iconType,
            name: pendingLandmark.name,
            lat,
            lng,
            elevation: isNaN(elevation as number) ? undefined : elevation,
            isCustom: true
        });

        // Reset placing state
        setPendingLandmark(null);
        setIsPlacingLandmark(false);
    }, [pendingLandmark, handleAddCustomLandmark]);

    // Set initial selection based on which landmarks are actually visible (pass spacing filter)
    const handleVisibleLandmarksCalculated = useCallback((visibleIds: number[]) => {
        if (!hasInitialSelection) {
            setSelectedLandmarkIds(new Set(visibleIds));
            setHasInitialSelection(true);
            // Save to sessionStorage
            try {
                sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify(visibleIds));
            } catch {
                console.warn('Failed to save selected landmarks to sessionStorage (quota exceeded)');
            }
        }
    }, [hasInitialSelection]);

    // Track which landmarks are within the visible map bounds (for edit panel filtering)
    const handleInBoundsLandmarksCalculated = useCallback((inBoundsIds: number[]) => {
        setInBoundsLandmarkIds(prev => {
            // Only update if the IDs actually changed to prevent infinite loops
            const newSet = new Set(inBoundsIds);
            if (prev && prev.size === newSet.size && [...prev].every(id => newSet.has(id))) {
                return prev;
            }
            return newSet;
        });
    }, []);

    const handleToggleLandmark = (id: number) => {
        setSelectedLandmarkIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            // Save to sessionStorage
            try {
                sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify([...newSet]));
            } catch {
                console.warn('Failed to save selected landmarks to sessionStorage (quota exceeded)');
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const allIds = new Set(combinedLandmarks.map(l => l.id));
        setSelectedLandmarkIds(allIds);
        try {
            sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify([...allIds]));
        } catch {
            console.warn('Failed to save selected landmarks to sessionStorage (quota exceeded)');
        }
    };

    const handleDeselectAll = () => {
        setSelectedLandmarkIds(new Set());
        try {
            sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify([]));
        } catch {
            console.warn('Failed to save selected landmarks to sessionStorage (quota exceeded)');
        }
    };

    const handleDefaultsCalculated = useCallback((defaults: RouteDefaults) => {
        setRouteDefaults(prev => {
            // Only update if values actually changed to prevent infinite loops
            if (prev &&
                prev.routeName === defaults.routeName &&
                prev.distance === defaults.distance &&
                prev.elevationGain === defaults.elevationGain &&
                prev.elevationLoss === defaults.elevationLoss) {
                return prev;
            }
            return defaults;
        });
    }, []);

    const handleStatsOverridesSave = (overrides: StatsOverrides) => {
        setStatsOverrides(overrides);
        try {
            sessionStorage.setItem('routeArtStatsOverrides', JSON.stringify(overrides));
        } catch {
            // If quota exceeded, try clearing large image data first and retry
            try {
                sessionStorage.removeItem('routeArtImageOverride');
                sessionStorage.setItem('routeArtStatsOverrides', JSON.stringify(overrides));
            } catch {
                console.warn('Failed to save stats overrides to sessionStorage (quota exceeded)');
            }
        }
    };

    const handleImageOverrideSave = (override: ImageOverride) => {
        setImageOverride(override);
        try {
            // Only persist non-data-URL images to avoid quota issues
            const persistableOverride = {
                enabled: override.enabled,
                url: override.url?.startsWith('data:') ? undefined : override.url
            };
            sessionStorage.setItem('routeArtImageOverride', JSON.stringify(persistableOverride));
        } catch {
            console.warn('Failed to save image override to sessionStorage (quota exceeded)');
        }
    };

    const handleCountryCodeDetected = useCallback((code: string | null) => {
        setCountryCode(code);
    }, []);

    const handleToggleWater = (value: boolean) => {
        setShowWater(value);
        try {
            sessionStorage.setItem('routeArtShowWater', value ? 'true' : 'false');
        } catch {
            console.warn('Failed to save design preference to sessionStorage');
        }
    };

    const handleToggleShading = (value: boolean) => {
        setShowShading(value);
        try {
            sessionStorage.setItem('routeArtShowShading', value ? 'true' : 'false');
        } catch {
            console.warn('Failed to save design preference to sessionStorage');
        }
    };

    const handleShadingIntensityChange = (value: number) => {
        setShadingIntensity(value);
        try {
            sessionStorage.setItem('routeArtShadingIntensity', value.toString());
        } catch {
            console.warn('Failed to save design preference to sessionStorage');
        }
    };

    const handleToggleArtMode = (value: boolean) => {
        setArtMode(value);
        try {
            sessionStorage.setItem('routeArtArtMode', value ? 'true' : 'false');
        } catch {
            console.warn('Failed to save design preference to sessionStorage');
        }
    };

    const handleExportPNG = () => {
        canvasRef.current?.exportPNG(fileName);
    };

    const handleBack = () => {
        sessionStorage.removeItem('routeArtData');
        sessionStorage.removeItem('routeArtFileName');
        sessionStorage.removeItem('routeArtSelectedLandmarks');
        sessionStorage.removeItem('routeArtStatsOverrides');
        sessionStorage.removeItem('routeArtImageOverride');
        sessionStorage.removeItem('routeArtCustomLandmarks');
        sessionStorage.removeItem('routeArtShowWater');
        sessionStorage.removeItem('routeArtShowShading');
        sessionStorage.removeItem('routeArtShadingIntensity');
        sessionStorage.removeItem('routeArtArtMode');
        router.push('/');
    };

    if (!geoJson) {
        return (
            <main className="min-h-screen bg-neutral-100 flex items-center justify-center">
                <div className="text-neutral-400">Loading...</div>
            </main>
        );
    }

    return (
        <main className="h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans overflow-hidden">
            <Header showBackButton onBack={handleBack} />

            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                <div className={`flex-1 flex items-center justify-center min-h-0 ${isPortrait ? 'py-2 px-4' : 'p-4 lg:p-6'}`}>
                    <div
                        className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden relative"
                        style={isPortrait ? {
                            aspectRatio: '1 / 1.4142',
                            height: 'min(70vh, calc(100vw * 1.4142))',
                            maxWidth: 'calc(70vh / 1.4142)' // A-series ratio constraint
                        } : {
                            aspectRatio: '1.4142 / 1',
                            width: '100%',
                            maxWidth: 'min(calc((100vh - 180px) * 1.4142), 100%)', // A-series ratio constraint
                            maxHeight: 'calc(100vh - 180px)'
                        }}
                    >
                        <ArtCanvas
                            ref={canvasRef}
                            geoJson={geoJson}
                            fileName={fileName}
                            selectedLandmarkIds={showHighlights ? (selectedLandmarkIds ?? undefined) : new Set()}
                            customLandmarks={customLandmarks}
                            statsOverrides={statsOverrides}
                            imageOverride={imageOverride}
                            isPlacingLandmark={isPlacingLandmark}
                            isDarkMode={isDarkMode}
                            showWater={showWater}
                            showMarkers={showMarkers}
                            showShading={showShading}
                            shadingIntensity={shadingIntensity}
                            artMode={artMode}
                            routeHighlight={routeHighlight}
                            routeHighlightIntensity={routeHighlightIntensity}
                            onLandmarksLoaded={handleLandmarksLoaded}
                            onVisibleLandmarksCalculated={handleVisibleLandmarksCalculated}
                            onInBoundsLandmarksCalculated={handleInBoundsLandmarksCalculated}
                            onDefaultsCalculated={handleDefaultsCalculated}
                            onCountryCodeDetected={handleCountryCodeDetected}
                            onMapClick={handleMapClick}
                            onLoadingStatusChange={setLoadingStatus}
                        />
                        <LoadingOverlay
                            isVisible={!!loadingStatus}
                            message={loadingStatus ?? ""}
                        />
                    </div>
                </div>
                <EditPanel
                    landmarks={combinedLandmarks}
                    selectedLandmarkIds={selectedLandmarkIds ?? new Set()}
                    onToggleLandmark={handleToggleLandmark}
                    onSelectAllLandmarks={handleSelectAll}
                    onDeselectAllLandmarks={handleDeselectAll}
                    onDeleteCustomLandmark={handleDeleteCustomLandmark}
                    onAddCustomLandmark={handleAddCustomLandmark}
                    isPlacingLandmark={isPlacingLandmark}
                    onStartPlacingLandmark={handleStartPlacingLandmark}
                    onCancelPlacingLandmark={handleCancelPlacingLandmark}
                    statsDefaults={routeDefaults}
                    statsOverrides={statsOverrides}
                    onSaveStats={handleStatsOverridesSave}
                    countryCode={countryCode}
                    imageOverride={imageOverride}
                    onSaveImage={handleImageOverrideSave}
                    showWater={showWater}
                    onToggleWater={handleToggleWater}
                    showMarkers={showMarkers}
                    onToggleMarkers={setShowMarkers}
                    isPortrait={isPortrait}
                    onToggleOrientation={setIsPortrait}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={setIsDarkMode}
                    showShading={showShading}
                    onToggleShading={handleToggleShading}
                    shadingIntensity={shadingIntensity}
                    onShadingIntensityChange={handleShadingIntensityChange}
                    artMode={artMode}
                    onToggleArtMode={handleToggleArtMode}
                    routeHighlight={routeHighlight}
                    onToggleRouteHighlight={setRouteHighlight}
                    routeHighlightIntensity={routeHighlightIntensity}
                    onRouteHighlightIntensityChange={setRouteHighlightIntensity}
                    showHighlights={showHighlights}
                    onToggleHighlights={setShowHighlights}
                    onExportPNG={handleExportPNG}
                />
            </div>
            <div className="hidden lg:block">
                <Footer />
            </div>
        </main>
    );
}
