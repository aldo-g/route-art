// components/EditPanel.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Mountain, Droplets, Triangle, MapPin, Upload, Trash2, Plus, Star, Download, Heart, X, Settings, Printer, ShoppingBag, Coffee, ArrowRight } from 'lucide-react';
import { Landmark } from '@/lib/landmarks';

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

interface EditPanelProps {
    // Landmarks props
    landmarks: Landmark[];
    selectedLandmarkIds: Set<number>;
    onToggleLandmark: (id: number) => void;
    onSelectAllLandmarks: () => void;
    onDeselectAllLandmarks: () => void;
    onDeleteCustomLandmark: (id: number) => void;
    onAddCustomLandmark: (landmark: Omit<Landmark, 'id'>) => void;
    // Click-to-place props
    isPlacingLandmark: boolean;
    onStartPlacingLandmark: (name: string, iconType: Landmark['type'], elevation?: string) => void;
    onCancelPlacingLandmark: () => void;
    // Stats props
    statsDefaults: RouteDefaults | null;
    statsOverrides: StatsOverrides;
    onSaveStats: (overrides: StatsOverrides) => void;
    // Image props
    countryCode: string | null;
    imageOverride: ImageOverride;
    onSaveImage: (override: ImageOverride) => void;
    // Design props
    showWater: boolean;
    onToggleWater: (value: boolean) => void;
    showMarkers: boolean;
    onToggleMarkers: (value: boolean) => void;
    isPortrait: boolean;
    onToggleOrientation: (value: boolean) => void;
    isDarkMode: boolean;
    onToggleDarkMode: (value: boolean) => void;
    showShading: boolean;
    onToggleShading: (value: boolean) => void;
    shadingIntensity: number;
    onShadingIntensityChange: (value: number) => void;
    // Art Mode props
    artMode: boolean;
    onToggleArtMode: (value: boolean) => void;
    // Download props
    onExportPNG: () => void;
}

const getLandmarkIcon = (type: Landmark['type']) => {
    switch (type) {
        case 'peak':
        case 'volcano':
            return <Triangle className="w-3 h-3" />;
        case 'waterfall':
            return <Droplets className="w-3 h-3" />;
        case 'custom':
            return <Star className="w-3 h-3" />;
        default:
            return <Mountain className="w-3 h-3" />;
    }
};

// Section Header Component
function SectionHeader({ title }: { title: string }) {
    return (
        <div className="mb-3">
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{title}</h4>
        </div>
    );
}

// Tour steps configuration
const TOUR_STEPS = [
    {
        target: 'route-section',
        title: 'Route Info',
        description: 'Edit your route name, location, distance, and date. Click "Edit route details" to customize what appears on your map.',
    },
    {
        target: 'appearance-section',
        title: 'Appearance',
        description: 'Change how your map looks. Toggle dark theme, show water features, or add terrain relief shading for a dramatic effect.',
    },
    {
        target: 'details-section',
        title: 'Details',
        description: 'Fine-tune your map. Show start/finish markers, add a country flag, or switch between landscape and portrait layouts.',
    },
    {
        target: 'export-section',
        title: 'Export',
        description: 'When you\'re happy with your design, download your map as a high-quality PNG image to print or share.',
    },
];

// Full-screen Tour Overlay Component
function TourOverlay({
    steps,
    currentStep,
    onNext,
    onSkip,
}: {
    steps: typeof TOUR_STEPS;
    currentStep: number;
    onNext: () => void;
    onSkip: () => void;
}) {
    const step = steps[currentStep];
    const isLast = currentStep === steps.length - 1;
    const targetRef = useRef<HTMLElement | null>(null);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        // Find the target element
        const target = document.getElementById(step.target);
        if (target) {
            targetRef.current = target;
            setTargetRect(target.getBoundingClientRect());

            // Scroll the target into view
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [step.target, currentStep]);

    // Calculate tooltip position
    const getTooltipPosition = () => {
        if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

        // Position to the left of the panel on desktop
        const isMobile = window.innerWidth < 1024;

        if (isMobile) {
            // Position above the target on mobile
            return {
                bottom: `${window.innerHeight - targetRect.top + 16}px`,
                left: '16px',
                right: '16px',
            };
        }

        // Position to the left of the target on desktop
        return {
            top: `${targetRect.top}px`,
            right: `${window.innerWidth - targetRect.left + 16}px`,
        };
    };

    const tooltipStyle = getTooltipPosition();

    // Generate clip-path to cut out the highlighted section from the overlay
    const getClipPath = () => {
        if (!targetRect) return 'none';

        const padding = 8; // Extra padding around the cutout
        const top = targetRect.top - padding;
        const left = targetRect.left - padding;
        const right = targetRect.right + padding;
        const bottom = targetRect.bottom + padding;

        // Create a polygon that covers the entire screen except for the cutout area
        // This uses CSS clip-path with a polygon that draws the screen outline, then cuts inward
        return `polygon(
            0% 0%,
            0% 100%,
            ${left}px 100%,
            ${left}px ${top}px,
            ${right}px ${top}px,
            ${right}px ${bottom}px,
            ${left}px ${bottom}px,
            ${left}px 100%,
            100% 100%,
            100% 0%
        )`;
    };

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            {/* Dark overlay with cutout for highlighted section */}
            <div
                className="absolute inset-0 bg-black/60 pointer-events-auto transition-all duration-300"
                onClick={onSkip}
                style={{ clipPath: getClipPath() }}
            />

            {/* Highlight ring around the cutout area */}
            {targetRect && (
                <div
                    className="absolute rounded-lg ring-4 ring-blue-500 ring-offset-4 ring-offset-transparent pointer-events-none transition-all duration-300"
                    style={{
                        top: targetRect.top - 8,
                        left: targetRect.left - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                    }}
                />
            )}

            {/* Tooltip card */}
            <div
                className="absolute w-80 bg-white rounded-xl shadow-2xl p-5 animate-in fade-in slide-in-from-right-4 duration-300 pointer-events-auto"
                style={tooltipStyle as React.CSSProperties}
            >
                {/* Progress indicator */}
                <div className="flex items-center gap-1.5 mb-4">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all ${
                                i === currentStep
                                    ? 'w-6 bg-blue-600'
                                    : i < currentStep
                                    ? 'w-1.5 bg-blue-300'
                                    : 'w-1.5 bg-neutral-200'
                            }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">{step.title}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed mb-5">{step.description}</p>

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={onSkip}
                        className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                        Skip tour
                    </button>
                    <button
                        onClick={onNext}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {isLast ? 'Get Started' : 'Next'}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Toggle Switch Component
function ToggleSwitch({
    checked,
    onChange,
    id
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    id: string;
}) {
    return (
        <div className="relative inline-block w-9 h-5 align-middle select-none">
            <input
                type="checkbox"
                id={id}
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only peer"
            />
            <label
                htmlFor={id}
                className={`block w-9 h-5 rounded-full cursor-pointer transition-colors duration-200 ${
                    checked ? 'bg-neutral-900' : 'bg-neutral-300'
                }`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        checked ? 'translate-x-4' : 'translate-x-0'
                    }`}
                />
            </label>
        </div>
    );
}

// Toggle Row Component
function ToggleRow({
    label,
    checked,
    onChange,
    id
}: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    id: string;
}) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-neutral-700">{label}</span>
            <ToggleSwitch checked={checked} onChange={onChange} id={id} />
        </div>
    );
}

// Collapsible Section for Highlights
interface CollapsibleSectionProps {
    title: string;
    icon: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    count?: string;
}

function CollapsibleSection({ title, icon, isOpen, onToggle, children, count }: CollapsibleSectionProps) {
    return (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 p-3 hover:bg-neutral-50 transition-colors bg-white"
            >
                {isOpen ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                <span className="text-neutral-500">{icon}</span>
                <span className="text-sm font-medium text-neutral-700">{title}</span>
                {count && <span className="ml-auto text-xs text-neutral-400">{count}</span>}
            </button>
            {isOpen && (
                <div className="px-3 pb-3 bg-white border-t border-neutral-100">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function EditPanel({
    landmarks,
    selectedLandmarkIds,
    onToggleLandmark,
    onSelectAllLandmarks,
    onDeselectAllLandmarks,
    onDeleteCustomLandmark,
    onAddCustomLandmark,
    isPlacingLandmark,
    onStartPlacingLandmark,
    onCancelPlacingLandmark,
    statsDefaults,
    statsOverrides,
    onSaveStats,
    countryCode,
    imageOverride,
    onSaveImage,
    showWater,
    onToggleWater,
    showMarkers,
    onToggleMarkers,
    isPortrait,
    onToggleOrientation,
    isDarkMode,
    onToggleDarkMode,
    showShading,
    onToggleShading,
    shadingIntensity,
    onShadingIntensityChange,
    artMode: _artMode,
    onToggleArtMode: _onToggleArtMode,
    onExportPNG,
}: EditPanelProps) {
    // Tour state
    const [showTour, setShowTour] = useState(false);
    const [tourStep, setTourStep] = useState(0);

    // Check if user has seen the tour before
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('routeArt_hasSeenTour');
        if (!hasSeenTour) {
            // Small delay so the UI renders first
            const timer = setTimeout(() => setShowTour(true), 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleNextTourStep = () => {
        if (tourStep < TOUR_STEPS.length - 1) {
            setTourStep(tourStep + 1);
        } else {
            // Tour complete
            setShowTour(false);
            localStorage.setItem('routeArt_hasSeenTour', 'true');
        }
    };

    const handleSkipTour = () => {
        setShowTour(false);
        localStorage.setItem('routeArt_hasSeenTour', 'true');
    };

    // Section open/closed state
    const [highlightsOpen, setHighlightsOpen] = useState(false);
    const [statsEditOpen, setStatsEditOpen] = useState(false);

    // Custom landmark form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newLandmarkName, setNewLandmarkName] = useState('');
    const [newLandmarkElevation, setNewLandmarkElevation] = useState('');
    const [newLandmarkIcon, setNewLandmarkIcon] = useState<Landmark['type']>('custom');
    const [newLandmarkLat, setNewLandmarkLat] = useState('');
    const [newLandmarkLng, setNewLandmarkLng] = useState('');
    const [useManualCoords, setUseManualCoords] = useState(false);

    const iconOptions: { value: Landmark['type']; label: string }[] = [
        { value: 'custom', label: 'Star' },
        { value: 'peak', label: 'Peak' },
        { value: 'waterfall', label: 'Waterfall' },
        { value: 'saddle', label: 'Saddle' },
        { value: 'cliff', label: 'Cliff' },
        { value: 'valley', label: 'Valley' },
        { value: 'spring', label: 'Spring' },
        { value: 'cave', label: 'Cave' },
    ];

    // Stats editing state
    const [routeName, setRouteName] = useState(statsOverrides.routeName ?? statsDefaults?.routeName ?? '');
    const [location, setLocation] = useState(statsOverrides.location ?? '');
    const [distance, setDistance] = useState(statsOverrides.distance ?? statsDefaults?.distance.toFixed(1) ?? '');
    const [elevationGain, setElevationGain] = useState(
        statsOverrides.elevationGain ?? (statsDefaults ? Math.round(statsDefaults.elevationGain).toString() : '')
    );
    const [elevationLoss, setElevationLoss] = useState(
        statsOverrides.elevationLoss ?? (statsDefaults ? Math.round(statsDefaults.elevationLoss).toString() : '')
    );
    const [dateStart, setDateStart] = useState(statsOverrides.dateStart ?? '');
    const [dateEnd, setDateEnd] = useState(statsOverrides.dateEnd ?? '');
    const [isDateRange, setIsDateRange] = useState(!!statsOverrides.dateEnd);

    // Helper to format ISO date to YYYY-MM-DD for date input
    const formatDateForInput = (isoDate: string): string => {
        try {
            return new Date(isoDate).toISOString().split('T')[0];
        } catch {
            return '';
        }
    };

    // Helper to format date for display
    const formatDateForDisplay = (dateStr: string): string => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // Update form fields when statsDefaults loads
    React.useEffect(() => {
        if (statsDefaults) {
            if (!statsOverrides.routeName && !routeName) {
                setRouteName(statsDefaults.routeName);
            }
            if (!statsOverrides.distance && !distance) {
                setDistance(statsDefaults.distance.toFixed(1));
            }
            if (!statsOverrides.elevationGain && !elevationGain) {
                setElevationGain(Math.round(statsDefaults.elevationGain).toString());
            }
            if (!statsOverrides.elevationLoss && !elevationLoss) {
                setElevationLoss(Math.round(statsDefaults.elevationLoss).toString());
            }
            if (statsDefaults.dateStart && !statsOverrides.dateStart && !dateStart) {
                setDateStart(formatDateForInput(statsDefaults.dateStart));
            }
            if (statsDefaults.dateEnd && !statsOverrides.dateEnd && !dateEnd) {
                setDateEnd(formatDateForInput(statsDefaults.dateEnd));
                setIsDateRange(true);
            }
        }
    }, [statsDefaults, statsOverrides, routeName, distance, elevationGain, elevationLoss, dateStart, dateEnd]);

    // Tip modal state
    const [showTipModal, setShowTipModal] = useState(false);

    const handleDownloadPNG = () => {
        onExportPNG();
        setShowTipModal(true);
    };

    // Image editing state
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSaveStats = () => {
        if (!statsDefaults) return;
        onSaveStats({
            routeName: routeName !== statsDefaults.routeName ? routeName : undefined,
            location: location || undefined,
            distance: distance !== statsDefaults.distance.toFixed(1) ? distance : undefined,
            elevationGain: elevationGain !== Math.round(statsDefaults.elevationGain).toString() ? elevationGain : undefined,
            elevationLoss: elevationLoss !== Math.round(statsDefaults.elevationLoss).toString() ? elevationLoss : undefined,
            dateStart: dateStart || undefined,
            dateEnd: isDateRange && dateEnd ? dateEnd : undefined,
        });
        setStatsEditOpen(false);
    };

    const handleResetStats = () => {
        if (!statsDefaults) return;
        setRouteName(statsDefaults.routeName);
        setLocation('');
        setDistance(statsDefaults.distance.toFixed(1));
        setElevationGain(Math.round(statsDefaults.elevationGain).toString());
        setElevationLoss(Math.round(statsDefaults.elevationLoss).toString());
        setDateStart('');
        setDateEnd('');
        setIsDateRange(false);
    };

    const handleToggleImageEnabled = (enabled: boolean) => {
        onSaveImage({
            ...imageOverride,
            enabled
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            onSaveImage({
                ...imageOverride,
                url: dataUrl
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleRemoveCustomImage = () => {
        onSaveImage({
            ...imageOverride,
            url: undefined
        });
    };

    const handleStartPlacing = () => {
        if (!newLandmarkName.trim()) return;
        onStartPlacingLandmark(newLandmarkName.trim(), newLandmarkIcon, newLandmarkElevation || undefined);
        setNewLandmarkName('');
        setNewLandmarkElevation('');
        setNewLandmarkIcon('custom');
        setShowAddForm(false);
    };

    const handleCancelForm = () => {
        setShowAddForm(false);
        setNewLandmarkName('');
        setNewLandmarkElevation('');
        setNewLandmarkIcon('custom');
        setNewLandmarkLat('');
        setNewLandmarkLng('');
        setUseManualCoords(false);
        if (isPlacingLandmark) {
            onCancelPlacingLandmark();
        }
    };

    const handleAddWithCoords = () => {
        if (!newLandmarkName.trim()) return;
        const lat = parseFloat(newLandmarkLat);
        const lng = parseFloat(newLandmarkLng);
        if (isNaN(lat) || isNaN(lng)) return;

        const elevation = newLandmarkElevation ? parseFloat(newLandmarkElevation) : undefined;

        onAddCustomLandmark({
            type: newLandmarkIcon,
            name: newLandmarkName.trim(),
            lat,
            lng,
            elevation: isNaN(elevation as number) ? undefined : elevation,
            isCustom: true
        });

        setNewLandmarkName('');
        setNewLandmarkElevation('');
        setNewLandmarkIcon('custom');
        setNewLandmarkLat('');
        setNewLandmarkLng('');
        setUseManualCoords(false);
        setShowAddForm(false);
    };

    const selectedCount = selectedLandmarkIds.size;
    const totalCount = landmarks.length;
    const defaultFlagUrl = countryCode ? `https://flagcdn.com/${countryCode.toLowerCase()}.svg` : null;

    // Get display values for stats
    const displayRouteName = statsOverrides.routeName || routeName || statsDefaults?.routeName || '';
    const displayLocation = statsOverrides.location || location || '';
    const displayDistance = statsOverrides.distance || distance || (statsDefaults?.distance.toFixed(1)) || '';
    const displayElevationGain = statsOverrides.elevationGain || elevationGain || (statsDefaults ? Math.round(statsDefaults.elevationGain).toString() : '');
    const displayElevationLoss = statsOverrides.elevationLoss || elevationLoss || (statsDefaults ? Math.round(statsDefaults.elevationLoss).toString() : '');
    const displayDateStart = statsOverrides.dateStart || dateStart || '';
    const displayDateEnd = statsOverrides.dateEnd || dateEnd || '';

    // Mobile drawer state
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <>
            {/* Mobile toggle button - fixed at bottom */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-full shadow-lg"
            >
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Customize</span>
                <ChevronUp className={`w-4 h-4 transition-transform ${isMobileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Tour overlay */}
            {showTour && (
                <TourOverlay
                    steps={TOUR_STEPS}
                    currentStep={tourStep}
                    onNext={handleNextTourStep}
                    onSkip={handleSkipTour}
                />
            )}

            {/* Panel - sidebar on desktop, bottom drawer on mobile */}
            <div className={`
                lg:relative lg:w-80 lg:h-full lg:max-h-full lg:translate-y-0
                fixed bottom-0 left-0 right-0 z-50 max-h-[80vh]
                bg-neutral-50 border-l border-neutral-200 flex flex-col flex-shrink-0 overflow-hidden
                transition-transform duration-300 ease-out
                ${isMobileOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
                rounded-t-xl lg:rounded-none shadow-xl lg:shadow-none
            `}>
                {/* Header */}
                <div className="p-4 border-b border-neutral-200 bg-white flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-base text-neutral-900">Customize</h3>
                        <p className="text-xs text-neutral-400 mt-0.5">Adjust your map below</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setTourStep(0); setShowTour(true); }}
                            className="hidden lg:block text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
                            title="Show guided tour"
                        >
                            ?
                        </button>
                        <button
                            onClick={() => setIsMobileOpen(false)}
                            className="lg:hidden p-1 hover:bg-neutral-100 rounded"
                        >
                            <X className="w-5 h-5 text-neutral-500" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">

                    {/* ========== SECTION 1: Route ========== */}
                    <div id="route-section" className="p-4 bg-white border-b border-neutral-200">
                        <SectionHeader title="Route" />

                        {!statsDefaults ? (
                            <p className="text-sm text-neutral-400 text-center py-4">Loading route info...</p>
                        ) : (
                            <div className="space-y-3">
                                {/* Route Name & Location - editable on click */}
                                <div className="space-y-1">
                                    <p className="text-base font-medium text-neutral-900">{displayRouteName || 'Untitled Route'}</p>
                                    {displayLocation && (
                                        <p className="text-sm text-neutral-500">{displayLocation}</p>
                                    )}
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-neutral-50 rounded-lg p-2.5 text-center">
                                        <p className="text-xs text-neutral-500 mb-0.5">Distance</p>
                                        <p className="text-sm font-semibold text-neutral-900">{displayDistance} km</p>
                                    </div>
                                    <div className="bg-neutral-50 rounded-lg p-2.5 text-center">
                                        <p className="text-xs text-neutral-500 mb-0.5">Elevation +</p>
                                        <p className="text-sm font-semibold text-neutral-900">{displayElevationGain} m</p>
                                    </div>
                                    <div className="bg-neutral-50 rounded-lg p-2.5 text-center">
                                        <p className="text-xs text-neutral-500 mb-0.5">Elevation -</p>
                                        <p className="text-sm font-semibold text-neutral-900">{displayElevationLoss} m</p>
                                    </div>
                                </div>

                                {/* Date */}
                                {(displayDateStart || displayDateEnd) && (
                                    <p className="text-sm text-neutral-500">
                                        {formatDateForDisplay(displayDateStart)}
                                        {displayDateEnd && displayDateEnd !== displayDateStart && (
                                            <> – {formatDateForDisplay(displayDateEnd)}</>
                                        )}
                                    </p>
                                )}

                                {/* Edit Stats Button */}
                                <button
                                    onClick={() => setStatsEditOpen(!statsEditOpen)}
                                    className={`text-xs font-medium transition-colors ${
                                        statsEditOpen
                                            ? 'text-neutral-500 hover:text-neutral-700'
                                            : 'text-blue-600 hover:text-blue-700 underline underline-offset-2'
                                    }`}
                                >
                                    {statsEditOpen ? 'Cancel' : 'Edit route details →'}
                                </button>

                                {/* Inline Stats Editor */}
                                {statsEditOpen && (
                                    <div className="mt-3 p-3 bg-neutral-50 rounded-lg space-y-3 border border-neutral-200">
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 mb-1">Route Name</label>
                                            <input
                                                type="text"
                                                value={routeName}
                                                onChange={(e) => setRouteName(e.target.value)}
                                                className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 mb-1">Location</label>
                                            <input
                                                type="text"
                                                value={location}
                                                onChange={(e) => setLocation(e.target.value)}
                                                placeholder="e.g. Albanian Alps, Albania"
                                                className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-xs font-medium text-neutral-600 mb-1">Distance (km)</label>
                                                <input
                                                    type="text"
                                                    value={distance}
                                                    onChange={(e) => setDistance(e.target.value)}
                                                    className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-neutral-600 mb-1">Gain (m)</label>
                                                <input
                                                    type="text"
                                                    value={elevationGain}
                                                    onChange={(e) => setElevationGain(e.target.value)}
                                                    className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-neutral-600 mb-1">Loss (m)</label>
                                                <input
                                                    type="text"
                                                    value={elevationLoss}
                                                    onChange={(e) => setElevationLoss(e.target.value)}
                                                    className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 mb-1">Date</label>
                                            <div className="flex gap-1 mb-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsDateRange(false)}
                                                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${!isDateRange
                                                        ? 'bg-neutral-900 text-white border-neutral-900'
                                                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                                    }`}
                                                >
                                                    Single date
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsDateRange(true)}
                                                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${isDateRange
                                                        ? 'bg-neutral-900 text-white border-neutral-900'
                                                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                                    }`}
                                                >
                                                    Date range
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="date"
                                                    value={dateStart}
                                                    onChange={(e) => setDateStart(e.target.value)}
                                                    className="flex-1 px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white"
                                                />
                                                {isDateRange && (
                                                    <>
                                                        <span className="flex items-center text-neutral-400 text-sm">–</span>
                                                        <input
                                                            type="date"
                                                            value={dateEnd}
                                                            onChange={(e) => setDateEnd(e.target.value)}
                                                            className="flex-1 px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white"
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={handleSaveStats}
                                                className="flex-1 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={handleResetStats}
                                                className="py-2 px-3 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Highlights (Landmarks) - Collapsible */}
                                <div className="pt-2">
                                    <CollapsibleSection
                                        title="Highlights"
                                        icon={<MapPin className="w-4 h-4" />}
                                        isOpen={highlightsOpen}
                                        onToggle={() => setHighlightsOpen(!highlightsOpen)}
                                        count={`${selectedCount}/${totalCount}`}
                                    >
                                        <div className="space-y-2 pt-2">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={onSelectAllLandmarks}
                                                    className="flex-1 text-xs py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    onClick={onDeselectAllLandmarks}
                                                    className="flex-1 text-xs py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                                                >
                                                    Deselect All
                                                </button>
                                            </div>

                                            {/* Add Custom Landmark */}
                                            <div className="border-t border-neutral-100 pt-2">
                                                {isPlacingLandmark ? (
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-neutral-500 text-center py-2">
                                                            Click on the map to place your highlight
                                                        </p>
                                                        <button
                                                            onClick={onCancelPlacingLandmark}
                                                            className="w-full py-1.5 text-xs border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : !showAddForm ? (
                                                    <button
                                                        onClick={() => setShowAddForm(true)}
                                                        className="w-full flex items-center justify-center gap-2 py-2 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Add highlight
                                                    </button>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-medium text-neutral-600">New Highlight</span>
                                                            <button onClick={handleCancelForm} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder="Name (required)"
                                                            value={newLandmarkName}
                                                            onChange={(e) => setNewLandmarkName(e.target.value)}
                                                            className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400"
                                                        />
                                                        <div className="flex gap-1 flex-wrap">
                                                            {iconOptions.map(option => (
                                                                <button
                                                                    key={option.value}
                                                                    type="button"
                                                                    onClick={() => setNewLandmarkIcon(option.value)}
                                                                    className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg border transition-colors ${newLandmarkIcon === option.value
                                                                        ? 'bg-neutral-900 text-white border-neutral-900'
                                                                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                                                    }`}
                                                                >
                                                                    {getLandmarkIcon(option.value)}
                                                                    {option.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder="Elevation in meters (optional)"
                                                            value={newLandmarkElevation}
                                                            onChange={(e) => setNewLandmarkElevation(e.target.value)}
                                                            className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400"
                                                        />
                                                        <div className="flex gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setUseManualCoords(false)}
                                                                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${!useManualCoords
                                                                    ? 'bg-neutral-900 text-white border-neutral-900'
                                                                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                                                }`}
                                                            >
                                                                Click on map
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setUseManualCoords(true)}
                                                                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${useManualCoords
                                                                    ? 'bg-neutral-900 text-white border-neutral-900'
                                                                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                                                }`}
                                                            >
                                                                Enter coordinates
                                                            </button>
                                                        </div>
                                                        {useManualCoords ? (
                                                            <>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Latitude"
                                                                        value={newLandmarkLat}
                                                                        onChange={(e) => setNewLandmarkLat(e.target.value)}
                                                                        className="flex-1 px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Longitude"
                                                                        value={newLandmarkLng}
                                                                        onChange={(e) => setNewLandmarkLng(e.target.value)}
                                                                        className="flex-1 px-2.5 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400"
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={handleAddWithCoords}
                                                                    disabled={!newLandmarkName.trim() || !newLandmarkLat || !newLandmarkLng}
                                                                    className="w-full py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                                                                >
                                                                    Add Highlight
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={handleStartPlacing}
                                                                disabled={!newLandmarkName.trim()}
                                                                className="w-full py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                Click on map to place
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Landmarks List */}
                                            <div className="border-t border-neutral-100 pt-2 max-h-40 overflow-y-auto">
                                                {landmarks.length === 0 ? (
                                                    <p className="text-xs text-neutral-400 text-center py-4">
                                                        No highlights found near this route
                                                    </p>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {landmarks.map(landmark => (
                                                            <div
                                                                key={landmark.id}
                                                                className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors ${selectedLandmarkIds.has(landmark.id)
                                                                    ? 'bg-neutral-100'
                                                                    : 'hover:bg-neutral-50'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedLandmarkIds.has(landmark.id)}
                                                                    onChange={() => onToggleLandmark(landmark.id)}
                                                                    className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 cursor-pointer"
                                                                />
                                                                <span className="text-neutral-400">
                                                                    {getLandmarkIcon(landmark.type)}
                                                                </span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-medium truncate">
                                                                        {landmark.name}
                                                                        {landmark.isCustom && (
                                                                            <span className="ml-1 text-[9px] px-1 py-0.5 bg-neutral-200 text-neutral-500 rounded">
                                                                                custom
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                {landmark.isCustom && (
                                                                    <button
                                                                        onClick={() => onDeleteCustomLandmark(landmark.id)}
                                                                        className="p-0.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CollapsibleSection>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ========== SECTION 2: Appearance (FEATURED) ========== */}
                    <div id="appearance-section" className="p-4">
                        <SectionHeader title="Appearance" />

                        {/* Featured Card */}
                        <div className="bg-white rounded-xl p-4 border border-neutral-200 shadow-sm space-y-4">
                            {/* Theme Toggles */}
                            <div className="space-y-1">
                                <ToggleRow
                                    label="Dark theme"
                                    checked={isDarkMode}
                                    onChange={onToggleDarkMode}
                                    id="darkTheme"
                                />
                                <ToggleRow
                                    label="Show water"
                                    checked={showWater}
                                    onChange={onToggleWater}
                                    id="showWater"
                                />
                                <ToggleRow
                                    label="Relief shading"
                                    checked={showShading}
                                    onChange={onToggleShading}
                                    id="reliefShading"
                                />
                            </div>

                            {/* Relief Strength Slider - Only visible when shading is ON */}
                            {showShading && (
                                <div className="pt-2 border-t border-neutral-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-neutral-700">Relief strength</span>
                                        <span className="text-xs text-neutral-400 tabular-nums">{Math.round(shadingIntensity * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={shadingIntensity}
                                        onChange={(e) => onShadingIntensityChange(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-neutral-200 rounded-full appearance-none cursor-pointer accent-neutral-900"
                                    />
                                    <p className="text-xs text-neutral-400 mt-1.5">Controls how dramatic the terrain looks</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ========== SECTION 3: Details ========== */}
                    <div id="details-section" className="p-4 pt-0">
                        <SectionHeader title="Details" />

                        <div className="space-y-3">
                            {/* Start & Finish Dots */}
                            <div className="flex items-center justify-between py-1">
                                <span className="text-sm text-neutral-600">Start & finish dots</span>
                                <ToggleSwitch
                                    checked={showMarkers}
                                    onChange={onToggleMarkers}
                                    id="startFinishDots"
                                />
                            </div>

                            {/* Flag Badge */}
                            <div className="flex items-center justify-between py-1">
                                <span className="text-sm text-neutral-600">Flag badge</span>
                                <ToggleSwitch
                                    checked={imageOverride.enabled}
                                    onChange={handleToggleImageEnabled}
                                    id="flagBadge"
                                />
                            </div>

                            {/* Custom Image Upload (only when flag badge is enabled) */}
                            {imageOverride.enabled && (
                                <div className="pl-0 pt-1">
                                    {imageOverride.url ? (
                                        <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                                            <img src={imageOverride.url} alt="Custom" className="h-8 w-auto rounded" />
                                            <span className="text-xs text-neutral-500 flex-1">Custom image</span>
                                            <button onClick={handleRemoveCustomImage} className="p-1 text-neutral-400 hover:text-red-500">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : defaultFlagUrl ? (
                                        <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                                            <img src={defaultFlagUrl} alt="Flag" className="h-8 w-auto rounded" />
                                            <span className="text-xs text-neutral-500">{countryCode} flag (auto-detected)</span>
                                        </div>
                                    ) : null}
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 transition-colors"
                                    >
                                        <Upload className="w-3 h-3" />
                                        Upload custom image
                                    </button>
                                </div>
                            )}

                            {/* Layout */}
                            <div className="flex items-center justify-between py-1">
                                <span className="text-sm text-neutral-600">Layout</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onToggleOrientation(false)}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${!isPortrait
                                            ? 'bg-neutral-900 text-white border-neutral-900'
                                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                        }`}
                                    >
                                        Landscape
                                    </button>
                                    <button
                                        onClick={() => onToggleOrientation(true)}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${isPortrait
                                            ? 'bg-neutral-900 text-white border-neutral-900'
                                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                        }`}
                                    >
                                        Portrait
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* ========== SECTION 4: Export (Sticky Bottom) ========== */}
                <div id="export-section" className="p-4 border-t border-neutral-200 bg-white space-y-3">
                    <SectionHeader title="Export" />

                    {/* Primary Button */}
                    <button
                        onClick={handleDownloadPNG}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Download Image
                    </button>

                    {/* Secondary Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            disabled
                            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 border border-neutral-200 text-neutral-400 text-xs rounded-lg cursor-not-allowed"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print PDF</span>
                        </button>
                        <button
                            disabled
                            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 border border-neutral-200 text-neutral-400 text-xs rounded-lg cursor-not-allowed"
                        >
                            <ShoppingBag className="w-4 h-4" />
                            <span>Buy Print</span>
                        </button>
                        <a
                            href="https://ko-fi.com/aligrant"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 border border-neutral-200 text-neutral-600 text-xs rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
                        >
                            <Coffee className="w-4 h-4" />
                            <span>Tip</span>
                        </a>
                    </div>
                </div>

                {/* Tip Modal */}
                {showTipModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl max-w-sm mx-4 overflow-hidden relative">
                            <div className="p-6 text-center">
                                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Heart className="w-6 h-6 text-pink-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                                    Enjoy your download!
                                </h3>
                                <p className="text-sm text-neutral-600 mb-6">
                                    If you found this tool useful, consider supporting its development with a small tip.
                                </p>
                                <div className="space-y-3">
                                    <a
                                        href="https://ko-fi.com/aligrant"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#FF5E5B] text-white text-sm font-medium rounded-lg hover:bg-[#e54e4b] transition-colors"
                                    >
                                        <Heart className="w-4 h-4" />
                                        Support on Ko-fi
                                    </a>
                                    <button
                                        onClick={() => setShowTipModal(false)}
                                        className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
                                    >
                                        Maybe later
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTipModal(false)}
                                className="absolute top-3 right-3 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
