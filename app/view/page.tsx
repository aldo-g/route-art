
// app/view/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ArtCanvas, { ArtCanvasHandle, StatsOverrides, RouteDefaults, ImageOverride } from '@/components/ArtCanvas';
import EditPanel from '@/components/EditPanel';
import { Landmark } from '@/lib/landmarks';
import { Download, ArrowLeft, Pencil, RectangleHorizontal, RectangleVertical } from 'lucide-react';

export default function ViewPage() {
    const router = useRouter();
    const [geoJson, setGeoJson] = useState<any>(null);
    const [fileName, setFileName] = useState<string>('');
    const canvasRef = useRef<ArtCanvasHandle>(null);

    // Landmark editing state
    const [allLandmarks, setAllLandmarks] = useState<Landmark[]>([]);
    const [selectedLandmarkIds, setSelectedLandmarkIds] = useState<Set<number> | null>(null);
    const [hasInitialSelection, setHasInitialSelection] = useState(false);

    // Stats editing state
    const [statsOverrides, setStatsOverrides] = useState<StatsOverrides>({});
    const [routeDefaults, setRouteDefaults] = useState<RouteDefaults | null>(null);

    // Image override state
    const [imageOverride, setImageOverride] = useState<ImageOverride>({ enabled: true });
    const [countryCode, setCountryCode] = useState<string | null>(null);


    // Edit panel state
    const [editTab, setEditTab] = useState<'landmarks' | 'statbox' | null>(null);

    // Poster orientation state
    const [isPortrait, setIsPortrait] = useState(false);

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

    // Set initial selection based on which landmarks are actually visible (pass spacing filter)
    const handleVisibleLandmarksCalculated = useCallback((visibleIds: number[]) => {
        if (!hasInitialSelection) {
            setSelectedLandmarkIds(new Set(visibleIds));
            setHasInitialSelection(true);
            // Save to sessionStorage
            sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify(visibleIds));
        }
    }, [hasInitialSelection]);

    const handleToggleLandmark = (id: number) => {
        setSelectedLandmarkIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            // Save to sessionStorage
            sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify([...newSet]));
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const allIds = new Set(allLandmarks.map(l => l.id));
        setSelectedLandmarkIds(allIds);
        sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify([...allIds]));
    };

    const handleDeselectAll = () => {
        setSelectedLandmarkIds(new Set());
        sessionStorage.setItem('routeArtSelectedLandmarks', JSON.stringify([]));
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
        sessionStorage.setItem('routeArtStatsOverrides', JSON.stringify(overrides));
    };

    const handleImageOverrideSave = (override: ImageOverride) => {
        setImageOverride(override);
        sessionStorage.setItem('routeArtImageOverride', JSON.stringify(override));
    };

    const handleCountryCodeDetected = useCallback((code: string | null) => {
        setCountryCode(code);
    }, []);

    const handleExportSVG = () => {
        canvasRef.current?.exportSVG(fileName);
    };

    const handleExportPDF = () => {
        canvasRef.current?.exportPDF(fileName);
    };

    const handleBack = () => {
        sessionStorage.removeItem('routeArtData');
        sessionStorage.removeItem('routeArtFileName');
        sessionStorage.removeItem('routeArtSelectedLandmarks');
        sessionStorage.removeItem('routeArtStatsOverrides');
        sessionStorage.removeItem('routeArtImageOverride');
        sessionStorage.removeItem('routeArtStatsBoxPosition');
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
            <header className="p-6 border-b border-neutral-200 bg-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-neutral-500 hover:text-neutral-800 transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        New Route
                    </button>
                    <div className="h-4 w-px bg-neutral-200" />
                    <h1 className="text-xl font-bold tracking-tight">Route Art</h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsPortrait(!isPortrait)}
                        className="flex items-center gap-2 px-4 py-2 border border-neutral-300 bg-white text-neutral-900 rounded-md hover:bg-neutral-50 transition-colors text-sm font-medium"
                        title={isPortrait ? 'Switch to landscape' : 'Switch to portrait'}
                    >
                        {isPortrait ? (
                            <RectangleHorizontal className="w-4 h-4" />
                        ) : (
                            <RectangleVertical className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        onClick={() => setEditTab('landmarks')}
                        className="flex items-center gap-2 px-4 py-2 border border-neutral-300 bg-white text-neutral-900 rounded-md hover:bg-neutral-50 transition-colors text-sm font-medium"
                    >
                        <Pencil className="w-4 h-4" />
                        Edit
                    </button>
                    <button
                        onClick={handleExportSVG}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 transition-colors text-sm font-medium"
                    >
                        <Download className="w-4 h-4" />
                        SVG
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 border border-neutral-300 bg-white text-neutral-900 rounded-md hover:bg-neutral-50 transition-colors text-sm font-medium"
                    >
                        <Download className="w-4 h-4" />
                        PDF
                    </button>
                </div>
            </header>

            <div className="flex-1 flex min-h-0 overflow-hidden">
                <div className={`flex-1 flex items-center justify-center min-h-0 ${isPortrait ? 'py-2 px-4' : 'p-6'}`}>
                    <div
                        className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden relative"
                        style={isPortrait ? {
                            aspectRatio: '2 / 3',
                            height: '85vh',
                            maxWidth: 'calc(85vh * 0.667)' // 2:3 ratio constraint
                        } : {
                            aspectRatio: '3 / 2',
                            width: '100%',
                            maxWidth: 'calc((100vh - 180px) * 1.5)', // 3:2 ratio constraint
                            maxHeight: 'calc(100vh - 180px)'
                        }}
                    >
                        <ArtCanvas
                            ref={canvasRef}
                            geoJson={geoJson}
                            fileName={fileName}
                            selectedLandmarkIds={selectedLandmarkIds ?? undefined}
                            statsOverrides={statsOverrides}
                            imageOverride={imageOverride}
                            onLandmarksLoaded={handleLandmarksLoaded}
                            onVisibleLandmarksCalculated={handleVisibleLandmarksCalculated}
                            onDefaultsCalculated={handleDefaultsCalculated}
                            onCountryCodeDetected={handleCountryCodeDetected}
                        />
                    </div>
                </div>
                {editTab && (
                    <EditPanel
                        landmarks={allLandmarks}
                        selectedLandmarkIds={selectedLandmarkIds ?? new Set()}
                        onToggleLandmark={handleToggleLandmark}
                        onSelectAllLandmarks={handleSelectAll}
                        onDeselectAllLandmarks={handleDeselectAll}
                        statsDefaults={routeDefaults}
                        statsOverrides={statsOverrides}
                        onSaveStats={handleStatsOverridesSave}
                        countryCode={countryCode}
                        imageOverride={imageOverride}
                        onSaveImage={handleImageOverrideSave}
                        initialTab={editTab}
                        onClose={() => setEditTab(null)}
                    />
                )}
            </div>
        </main>
    );
}
