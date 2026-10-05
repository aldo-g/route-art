// components/EditPanel.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ChevronUp, Mountain, Droplets, Triangle, Upload, Trash2, Plus, Star, Download, Heart, X, Settings, ArrowRight, Printer, ArrowLeftRight } from 'lucide-react';
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
    // Contour contrast props
    contourIntensity: number;
    onContourIntensityChange: (value: number) => void;
    // Route contrast props
    routeHighlight: boolean;
    onToggleRouteHighlight: (value: boolean) => void;
    routeHighlightIntensity: number;
    onRouteHighlightIntensityChange: (value: number) => void;
    // Highlights visibility props
    showHighlights: boolean;
    onToggleHighlights: (value: boolean) => void;
    // Label side overrides
    labelSideOverrides: Record<number, 'left' | 'right'>;
    onToggleLabelSide: (id: number) => void;
    // Download props
    onExportPNG: () => void;
    // Store props
    onBuyPrint: () => void;
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

// Section Header Component — uppercase micro-label, the system's metadata voice
function SectionHeader({ title }: { title: string }) {
    return (
        <div className="mb-4">
            <h4 className="text-[12px] font-bold tracking-[0.14em] uppercase text-muted">{title}</h4>
        </div>
    );
}

// Segmented Off/On control — replaces the rounded pill switch
function SegmentedToggle({
    checked,
    onChange,
    offLabel = 'Off',
    onLabel = 'On',
    id,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    offLabel?: string;
    onLabel?: string;
    id?: string;
}) {
    const base = 'px-[13px] py-1.5 min-h-[32px] text-[12px] font-semibold tracking-[0.08em] uppercase transition-colors';
    return (
        <div className="flex border-2 border-ink flex-shrink-0" id={id}>
            <button
                type="button"
                aria-pressed={!checked}
                onClick={() => onChange(false)}
                className={`${base} ${!checked ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}
            >
                {offLabel}
            </button>
            <button
                type="button"
                aria-pressed={checked}
                onClick={() => onChange(true)}
                className={`${base} ${checked ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}
            >
                {onLabel}
            </button>
        </div>
    );
}

// Square-track slider with accent fill and a hard ink thumb
function Slider({
    value,
    onChange,
    label,
}: {
    value: number;
    onChange: (value: number) => void;
    label?: string;
}) {
    return (
        <div className="flex items-center gap-3.5">
            <div className="relative flex-1 h-5">
                <div className="absolute left-0 right-0 top-2 h-1 bg-divider" />
                <div className="absolute left-0 top-2 h-1 bg-accent" style={{ width: `${value * 100}%` }} />
                <div
                    className="absolute top-0 w-2 h-5 -ml-1 bg-ink pointer-events-none"
                    style={{ left: `${value * 100}%` }}
                />
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={value}
                    aria-label={label}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-5 opacity-0 cursor-pointer"
                />
            </div>
            <span className="text-[13px] font-bold tracking-[0.04em] tabular-nums w-[38px] text-right">
                {Math.round(value * 100)}%
            </span>
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
        description: 'Dark theme inverts colors for a striking look. Show water displays lakes and rivers. Relief shading adds 3D terrain depth. Route contrast makes your route pop against contours. Highlights labels peaks and landmarks.',
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

            // Scroll the target into view first
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Update rect after scroll animation settles
            const updateRect = () => {
                setTargetRect(target.getBoundingClientRect());
            };

            // Initial update
            updateRect();

            // Update again after scroll animation (350ms should be enough)
            const timer = setTimeout(updateRect, 350);

            // Also listen for scroll events on the panel to update rect
            const panel = target.closest('.overflow-y-auto');
            if (panel) {
                panel.addEventListener('scroll', updateRect);
            }

            return () => {
                clearTimeout(timer);
                if (panel) {
                    panel.removeEventListener('scroll', updateRect);
                }
            };
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

        // Position to the left of the target on desktop, vertically centered with target
        const tooltipHeight = 220; // Approximate height of tooltip
        const targetCenter = targetRect.top + targetRect.height / 2;
        const tooltipTop = Math.max(16, Math.min(targetCenter - tooltipHeight / 2, window.innerHeight - tooltipHeight - 16));

        return {
            top: `${tooltipTop}px`,
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
                    className="absolute border-2 border-accent pointer-events-none transition-all duration-300"
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
                className="absolute w-80 bg-paper border-2 border-ink shadow-[0_12px_32px_color-mix(in_srgb,#2d2b2b_22%,transparent)] p-6 animate-in fade-in slide-in-from-right-4 duration-300 pointer-events-auto"
                style={tooltipStyle as React.CSSProperties}
            >
                {/* Progress indicator */}
                <div className="flex items-center gap-1.5 mb-4">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 transition-all ${
                                i === currentStep
                                    ? 'w-6 bg-accent'
                                    : i < currentStep
                                    ? 'w-1.5 bg-accent-700'
                                    : 'w-1.5 bg-divider'
                            }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <h3 className="text-[20px] font-bold tracking-[-0.02em] mb-2">{step.title}</h3>
                <p className="text-[14px] text-muted leading-[1.55] mb-6">{step.description}</p>

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={onSkip}
                        className="text-[13px] font-semibold tracking-[0.06em] uppercase text-muted hover:text-accent transition-colors"
                    >
                        Skip tour
                    </button>
                    <button
                        onClick={onNext}
                        className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-accent text-white text-[13px] font-semibold tracking-[0.06em] uppercase hover:bg-accent-700 transition-colors"
                    >
                        {isLast ? 'Get Started' : 'Next'}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Toggle Switch Component — segmented Off/On, per the modernist system
function ToggleSwitch({
    checked,
    onChange,
    id
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    id: string;
}) {
    return <SegmentedToggle checked={checked} onChange={onChange} id={id} />;
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
        <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-[15px]">{label}</span>
            <ToggleSwitch checked={checked} onChange={onChange} id={id} />
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
    contourIntensity,
    onContourIntensityChange,
    routeHighlight,
    onToggleRouteHighlight,
    routeHighlightIntensity,
    onRouteHighlightIntensityChange,
    showHighlights,
    onToggleHighlights,
    labelSideOverrides,
    onToggleLabelSide,
    onExportPNG,
    onBuyPrint: _onBuyPrint,
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
                className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-2 px-5 py-3 min-h-[44px] bg-accent text-white border-2 border-ink shadow-[0_3px_10px_color-mix(in_srgb,#2d2b2b_16%,transparent)]"
            >
                <Settings className="w-5 h-5" />
                <span className="text-[13px] font-semibold tracking-[0.06em] uppercase">Customize</span>
                <ChevronUp className={`w-4 h-4 transition-transform ${isMobileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-[color-mix(in_srgb,#2d2b2b_50%,transparent)] z-40"
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
                lg:relative lg:w-[400px] lg:h-full lg:max-h-full lg:translate-y-0
                fixed bottom-0 left-0 right-0 z-50 max-h-[80vh]
                bg-paper border-t-2 lg:border-t-0 border-ink flex flex-col flex-shrink-0 overflow-hidden
                transition-transform duration-300 ease-out
                ${isMobileOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
                shadow-[0_-4px_24px_color-mix(in_srgb,#2d2b2b_18%,transparent)] lg:shadow-none
            `}>
                {/* Header */}
                <div className="px-7 py-6 border-b-2 border-ink bg-paper flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-[22px] font-bold tracking-[-0.02em]">Customize</h3>
                        <p className="mt-0.5 text-[13px] text-muted">Adjust your map below</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setTourStep(0); setShowTour(true); }}
                            className="w-7 h-7 flex items-center justify-center border-2 border-divider text-[13px] font-bold text-muted hover:text-accent hover:border-accent transition-colors"
                            title="Show guided tour"
                        >
                            ?
                        </button>
                        <button
                            onClick={() => setIsMobileOpen(false)}
                            aria-label="Close panel"
                            className="lg:hidden w-8 h-8 flex items-center justify-center text-muted hover:text-accent transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">

                    {/* ========== SECTION 1: Route ========== */}
                    <div id="route-section" className="px-7 py-6 bg-paper border-b-2 border-ink">
                        <SectionHeader title="Route" />

                        {!statsDefaults ? (
                            <p className="text-[13px] tracking-[0.08em] uppercase text-faint text-center py-4">Loading route info…</p>
                        ) : (
                            <div>
                                {/* Route Name & Location */}
                                <p className="text-[20px] font-bold tracking-[-0.01em] leading-[1.2]">{displayRouteName || 'Untitled Route'}</p>
                                {displayLocation && (
                                    <p className="mt-1 text-[14px] text-muted">{displayLocation}</p>
                                )}

                                {/* Stats Grid — hard-ruled cells, no radius */}
                                <div className="mt-5 grid grid-cols-3 gap-0.5 bg-divider border-2 border-divider">
                                    <div className="bg-paper px-2.5 py-3">
                                        <p className="text-[11px] tracking-[0.08em] uppercase text-faint">Distance</p>
                                        <p className="mt-1 text-[17px] font-bold">{displayDistance} km</p>
                                    </div>
                                    <div className="bg-paper px-2.5 py-3">
                                        <p className="text-[11px] tracking-[0.08em] uppercase text-faint">Elevation +</p>
                                        <p className="mt-1 text-[17px] font-bold">{displayElevationGain} m</p>
                                    </div>
                                    <div className="bg-paper px-2.5 py-3">
                                        <p className="text-[11px] tracking-[0.08em] uppercase text-faint">Elevation −</p>
                                        <p className="mt-1 text-[17px] font-bold">{displayElevationLoss} m</p>
                                    </div>
                                </div>

                                {/* Date */}
                                {(displayDateStart || displayDateEnd) && (
                                    <p className="mt-4 text-[14px] text-muted">
                                        {formatDateForDisplay(displayDateStart)}
                                        {displayDateEnd && displayDateEnd !== displayDateStart && (
                                            <> – {formatDateForDisplay(displayDateEnd)}</>
                                        )}
                                    </p>
                                )}

                                {/* Edit Stats Button */}
                                <button
                                    onClick={() => setStatsEditOpen(!statsEditOpen)}
                                    className={`mt-[18px] inline-flex items-center gap-2 pb-0.5 min-h-[44px] text-[13px] font-semibold tracking-[0.06em] uppercase transition-colors ${
                                        statsEditOpen
                                            ? 'text-muted border-b-2 border-divider hover:text-ink hover:border-ink'
                                            : 'text-accent-700 border-b-2 border-accent hover:text-accent'
                                    }`}
                                >
                                    {statsEditOpen ? 'Cancel' : 'Edit route details'}
                                    {!statsEditOpen && <ArrowRight className="w-[15px] h-[15px]" />}
                                </button>

                                {/* Inline Stats Editor */}
                                {statsEditOpen && (
                                    <div className="mt-4 p-4 bg-background space-y-4 border-2 border-divider">
                                        <div>
                                            <label className="block text-[12px] tracking-[0.06em] uppercase text-muted mb-1.5">Route Name</label>
                                            <input
                                                type="text"
                                                value={routeName}
                                                onChange={(e) => setRouteName(e.target.value)}
                                                className="w-full px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] tracking-[0.06em] uppercase text-muted mb-1.5">Location</label>
                                            <input
                                                type="text"
                                                value={location}
                                                onChange={(e) => setLocation(e.target.value)}
                                                placeholder="e.g. Albanian Alps, Albania"
                                                className="w-full px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[11px] tracking-[0.04em] uppercase text-muted mb-1.5 whitespace-nowrap">Distance (km)</label>
                                                <input
                                                    type="text"
                                                    value={distance}
                                                    onChange={(e) => setDistance(e.target.value)}
                                                    className="w-full px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] tracking-[0.04em] uppercase text-muted mb-1.5 whitespace-nowrap">Gain (m)</label>
                                                <input
                                                    type="text"
                                                    value={elevationGain}
                                                    onChange={(e) => setElevationGain(e.target.value)}
                                                    className="w-full px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] tracking-[0.04em] uppercase text-muted mb-1.5 whitespace-nowrap">Loss (m)</label>
                                                <input
                                                    type="text"
                                                    value={elevationLoss}
                                                    onChange={(e) => setElevationLoss(e.target.value)}
                                                    className="w-full px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[12px] tracking-[0.06em] uppercase text-muted mb-1.5">Date</label>
                                            <div className="flex gap-1 mb-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsDateRange(false)}
                                                    className={`flex-1 py-2 min-h-[36px] text-[12px] font-semibold tracking-[0.06em] uppercase border-2 transition-colors ${!isDateRange
                                                        ? 'bg-ink text-paper border-ink'
                                                        : 'bg-paper text-muted border-divider hover:border-ink hover:text-ink'
                                                    }`}
                                                >
                                                    Single date
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsDateRange(true)}
                                                    className={`flex-1 py-2 min-h-[36px] text-[12px] font-semibold tracking-[0.06em] uppercase border-2 transition-colors ${isDateRange
                                                        ? 'bg-ink text-paper border-ink'
                                                        : 'bg-paper text-muted border-divider hover:border-ink hover:text-ink'
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
                                                    className="flex-1 px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                                />
                                                {isDateRange && (
                                                    <>
                                                        <span className="flex items-center text-muted text-[14px]">–</span>
                                                        <input
                                                            type="date"
                                                            value={dateEnd}
                                                            onChange={(e) => setDateEnd(e.target.value)}
                                                            className="flex-1 px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={handleSaveStats}
                                                className="flex-1 py-2.5 min-h-[44px] bg-accent text-white text-[13px] font-semibold tracking-[0.06em] uppercase hover:bg-accent-700 transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={handleResetStats}
                                                className="py-2.5 px-4 min-h-[44px] text-[13px] font-semibold tracking-[0.06em] uppercase text-muted hover:text-accent transition-colors"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}
                    </div>

                    {/* ========== SECTION 2: Appearance (FEATURED) ========== */}
                    <div className="px-7 py-6 border-b-2 border-ink">
                        <SectionHeader title="Appearance" />

                        {/* Featured group */}
                        <div id="appearance-section">
                            {/* Theme Toggles with inline sliders */}
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

                            {/* Contour contrast with slider directly below */}
                            <div className="pt-4">
                                <span className="text-[15px]">Contour contrast</span>
                                <div className="mt-3">
                                    <Slider value={contourIntensity} onChange={onContourIntensityChange} label="Contour contrast" />
                                </div>
                            </div>

                            {/* Relief shading with slider directly below */}
                            <ToggleRow
                                label="Relief shading"
                                checked={showShading}
                                onChange={onToggleShading}
                                id="reliefShading"
                            />
                            {showShading && (
                                <div className="pb-1">
                                    <Slider value={shadingIntensity} onChange={onShadingIntensityChange} label="Relief shading intensity" />
                                </div>
                            )}

                            {/* Route contrast with slider directly below */}
                            <ToggleRow
                                label="Route contrast"
                                checked={routeHighlight}
                                onChange={onToggleRouteHighlight}
                                id="routeContrast"
                            />
                            {routeHighlight && (
                                <div className="pb-1">
                                    <Slider value={routeHighlightIntensity} onChange={onRouteHighlightIntensityChange} label="Route contrast intensity" />
                                </div>
                            )}

                            {/* Highlights toggle with content below */}
                            <ToggleRow
                                label="Highlights"
                                checked={showHighlights}
                                onChange={onToggleHighlights}
                                id="highlightsToggle"
                            />
                            {showHighlights && (
                                <div className="mt-3.5 border-2 border-divider p-3.5 space-y-3">
                                    <div className="flex gap-2.5">
                                        <button
                                            onClick={onSelectAllLandmarks}
                                            className="flex-1 py-2 px-2.5 min-h-[36px] border-2 border-ink text-[11px] font-semibold tracking-[0.08em] uppercase hover:bg-ink hover:text-paper transition-colors"
                                        >
                                            Select all
                                        </button>
                                        <button
                                            onClick={onDeselectAllLandmarks}
                                            className="flex-1 py-2 px-2.5 min-h-[36px] border-2 border-divider text-[11px] font-semibold tracking-[0.08em] uppercase text-muted hover:border-ink hover:text-ink transition-colors"
                                        >
                                            Deselect all
                                        </button>
                                    </div>

                                    {/* Add Custom Landmark */}
                                    <div className="border-t-2 border-divider pt-3">
                                        {isPlacingLandmark ? (
                                            <div className="space-y-2">
                                                <p className="text-[12px] text-muted text-center py-2">
                                                    Click on the map to place your highlight
                                                </p>
                                                <button
                                                    onClick={onCancelPlacingLandmark}
                                                    className="w-full py-2 min-h-[36px] border-2 border-divider text-[12px] font-semibold tracking-[0.06em] uppercase text-muted hover:border-ink hover:text-ink transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : !showAddForm ? (
                                            <button
                                                onClick={() => setShowAddForm(true)}
                                                className="w-full flex items-center justify-center gap-2 py-2 min-h-[36px] text-[12px] font-semibold tracking-[0.08em] uppercase text-accent-700 hover:text-accent transition-colors"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Add highlight
                                            </button>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-muted">New highlight</span>
                                                    <button onClick={handleCancelForm} className="text-[12px] font-semibold tracking-[0.06em] uppercase text-muted hover:text-accent transition-colors">Cancel</button>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Name (required)"
                                                    value={newLandmarkName}
                                                    onChange={(e) => setNewLandmarkName(e.target.value)}
                                                    className="w-full px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                                />
                                                <div className="flex gap-1 flex-wrap">
                                                    {iconOptions.map(option => (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => setNewLandmarkIcon(option.value)}
                                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase border-2 transition-colors ${newLandmarkIcon === option.value
                                                                ? 'bg-ink text-paper border-ink'
                                                                : 'bg-paper text-muted border-divider hover:border-ink hover:text-ink'
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
                                                    className="w-full px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                                />
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setUseManualCoords(false)}
                                                        className={`flex-1 py-2 min-h-[36px] text-[12px] font-semibold tracking-[0.06em] uppercase border-2 transition-colors ${!useManualCoords
                                                            ? 'bg-ink text-paper border-ink'
                                                            : 'bg-paper text-muted border-divider hover:border-ink hover:text-ink'
                                                        }`}
                                                    >
                                                        Click on map
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setUseManualCoords(true)}
                                                        className={`flex-1 py-2 min-h-[36px] text-[12px] font-semibold tracking-[0.06em] uppercase border-2 transition-colors ${useManualCoords
                                                            ? 'bg-ink text-paper border-ink'
                                                            : 'bg-paper text-muted border-divider hover:border-ink hover:text-ink'
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
                                                                className="flex-1 px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Longitude"
                                                                value={newLandmarkLng}
                                                                onChange={(e) => setNewLandmarkLng(e.target.value)}
                                                                className="flex-1 px-3 py-2 min-h-[36px] text-[14px] bg-background border-2 border-divider focus:outline-none focus:border-accent placeholder:text-faint transition-colors"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={handleAddWithCoords}
                                                            disabled={!newLandmarkName.trim() || !newLandmarkLat || !newLandmarkLng}
                                                            className="w-full py-2.5 min-h-[44px] bg-accent text-white text-[13px] font-semibold tracking-[0.06em] uppercase hover:bg-accent-700 disabled:bg-divider disabled:text-faint disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            Add Highlight
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={handleStartPlacing}
                                                        disabled={!newLandmarkName.trim()}
                                                        className="w-full py-2.5 min-h-[44px] bg-accent text-white text-[13px] font-semibold tracking-[0.06em] uppercase hover:bg-accent-700 disabled:bg-divider disabled:text-faint disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        Click on map to place
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Landmarks List */}
                                    <div className="border-t-2 border-divider pt-3 max-h-44 overflow-y-auto">
                                        {landmarks.length === 0 ? (
                                            <p className="text-[12px] text-faint text-center py-4">
                                                No highlights found near this route
                                            </p>
                                        ) : (
                                            <div>
                                                {landmarks.map(landmark => (
                                                    <div
                                                        key={landmark.id}
                                                        className={`flex items-center gap-2.5 py-2 border-b-2 border-divider last:border-b-0 transition-colors ${selectedLandmarkIds.has(landmark.id)
                                                            ? ''
                                                            : 'opacity-70 hover:opacity-100'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLandmarkIds.has(landmark.id)}
                                                            onChange={() => onToggleLandmark(landmark.id)}
                                                            className="w-[15px] h-[15px] flex-none appearance-none border-2 border-divider bg-paper checked:bg-accent checked:border-accent cursor-pointer transition-colors"
                                                        />
                                                        <span className="text-faint flex-none">
                                                            {getLandmarkIcon(landmark.type)}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[13px] truncate">
                                                                {landmark.name}
                                                                {landmark.isCustom && (
                                                                    <span className="ml-1.5 text-[9px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 border border-divider text-muted">
                                                                        custom
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        {selectedLandmarkIds.has(landmark.id) && (
                                                            <button
                                                                onClick={() => onToggleLabelSide(landmark.id)}
                                                                title="Swap label side"
                                                                className={`p-1 flex-none transition-colors ${labelSideOverrides[landmark.id] ? 'text-ink bg-divider' : 'text-faint hover:text-ink'}`}
                                                            >
                                                                <ArrowLeftRight className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        {landmark.isCustom && (
                                                            <button
                                                                onClick={() => onDeleteCustomLandmark(landmark.id)}
                                                                className="p-1 flex-none text-faint hover:text-accent transition-colors"
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
                            )}

                            {/* Layout */}
                            <div className="mt-6 pt-[18px] border-t-2 border-divider">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[15px]">Layout</span>
                                    <div className="flex border-2 border-ink flex-shrink-0">
                                        <button
                                            onClick={() => onToggleOrientation(false)}
                                            aria-pressed={!isPortrait}
                                            className={`px-[13px] py-1.5 min-h-[32px] text-[12px] font-semibold tracking-[0.08em] uppercase transition-colors ${!isPortrait
                                                ? 'bg-ink text-paper'
                                                : 'text-muted hover:text-ink'
                                            }`}
                                        >
                                            Landscape
                                        </button>
                                        <button
                                            onClick={() => onToggleOrientation(true)}
                                            aria-pressed={isPortrait}
                                            className={`px-[13px] py-1.5 min-h-[32px] text-[12px] font-semibold tracking-[0.08em] uppercase transition-colors ${isPortrait
                                                ? 'bg-ink text-paper'
                                                : 'text-muted hover:text-ink'
                                            }`}
                                        >
                                            Portrait
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ========== SECTION 3: Details ========== */}
                    <div id="details-section" className="px-7 py-6 border-b-2 border-ink">
                        <SectionHeader title="Details" />

                        <div>
                            {/* Start & Finish Dots */}
                            <div className="flex items-center justify-between gap-4 py-2">
                                <span className="text-[15px]">Start &amp; finish dots</span>
                                <ToggleSwitch
                                    checked={showMarkers}
                                    onChange={onToggleMarkers}
                                    id="startFinishDots"
                                />
                            </div>

                            {/* Flag Badge */}
                            <div className="flex items-center justify-between gap-4 py-2">
                                <span className="text-[15px]">Flag badge</span>
                                <ToggleSwitch
                                    checked={imageOverride.enabled}
                                    onChange={handleToggleImageEnabled}
                                    id="flagBadge"
                                />
                            </div>

                            {/* Custom Image Upload (only when flag badge is enabled) */}
                            {imageOverride.enabled && (
                                <div className="mt-3.5">
                                    {imageOverride.url ? (
                                        <div className="flex items-center gap-3 px-3.5 py-3 border-2 border-divider">
                                            <Image src={imageOverride.url} alt="Custom" width={32} height={32} unoptimized className="h-5 w-auto border-2 border-ink flex-none" />
                                            <span className="text-[13px] text-muted flex-1">Custom image</span>
                                            <button onClick={handleRemoveCustomImage} aria-label="Remove custom image" className="p-1 text-faint hover:text-accent transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : defaultFlagUrl ? (
                                        <div className="flex items-center gap-3 px-3.5 py-3 border-2 border-divider">
                                            <Image src={defaultFlagUrl} alt="Flag" width={32} height={32} className="h-5 w-auto border-2 border-ink flex-none" />
                                            <span className="text-[13px] text-muted">{countryCode} flag (auto-detected)</span>
                                        </div>
                                    ) : null}
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full mt-2.5 flex items-center gap-2.5 px-3.5 py-3 min-h-[44px] border-2 border-dashed border-divider text-[12px] font-semibold tracking-[0.08em] uppercase text-muted hover:border-ink hover:text-ink transition-colors"
                                    >
                                        <Upload className="w-[15px] h-[15px]" />
                                        Upload custom image
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* ========== SECTION 4: Export (Sticky Bottom) ========== */}
                <div id="export-section" className="px-7 py-6 border-t-2 border-ink bg-paper">
                    <SectionHeader title="Export" />

                    {/* Print */}
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-faint">Print</p>
                        <button
                            disabled
                            className="w-full mt-2.5 flex items-center justify-between gap-3 px-4 py-3.5 border-2 border-divider text-[15px] font-semibold opacity-55 cursor-not-allowed"
                        >
                            <span className="flex items-center gap-2.5">
                                <Printer className="w-[18px] h-[18px]" />
                                Buy Personalised Print
                            </span>
                            <span className="text-[10px] font-bold tracking-[0.1em] uppercase border-2 border-ink px-[7px] py-[3px] whitespace-nowrap">Coming soon</span>
                        </button>
                        <p className="mt-2 text-[12px] text-faint">Printed on archival matte paper</p>
                    </div>

                    {/* Digital */}
                    <div className="mt-6">
                        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-faint">Digital</p>
                        <button
                            onClick={handleDownloadPNG}
                            className="w-full mt-2.5 flex items-center gap-2.5 px-5 py-4 min-h-[44px] bg-accent text-white text-[15px] font-semibold tracking-[0.04em] uppercase hover:bg-accent-700 transition-colors"
                        >
                            <Download className="w-[18px] h-[18px]" />
                            Download image
                        </button>
                        <p className="mt-2 text-[12px] text-faint">High-res PNG, print-ready at A1–A4</p>
                    </div>

                </div>

            </div>

            {/* Tip Modal — rendered outside panel div so it covers everything */}
            {showTipModal && (
                <div className="fixed inset-0 bg-[color-mix(in_srgb,#2d2b2b_50%,transparent)] z-[100] flex items-center justify-center p-6">
                    <div className="bg-paper border-2 border-ink shadow-[0_12px_32px_color-mix(in_srgb,#2d2b2b_22%,transparent)] max-w-lg w-full p-10 relative text-center">
                        <button
                            onClick={() => setShowTipModal(false)}
                            className="absolute top-4 right-4 p-2 text-muted hover:text-accent transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="space-y-6">
                            <div className="w-16 h-16 border-2 border-ink flex items-center justify-center mx-auto">
                                <Heart className="w-8 h-8 text-accent" />
                            </div>
                            <div>
                                <h2 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.12]">
                                    Enjoy your download!
                                </h2>
                                <p className="mt-3 text-[15px] text-muted leading-[1.55]">
                                    This tool is free to use. If you found it useful, a small tip helps keep it running and improving.
                                </p>
                            </div>
                            <div className="space-y-3 pt-2">
                                <a
                                    href="https://ko-fi.com/aligrant"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2 py-4 min-h-[44px] bg-accent text-white text-[15px] font-semibold tracking-[0.04em] uppercase hover:bg-accent-700 transition-colors"
                                >
                                    <Heart className="w-4 h-4" />
                                    Support on Ko-fi
                                </a>
                                <button
                                    onClick={() => setShowTipModal(false)}
                                    className="w-full py-3 min-h-[44px] text-[13px] font-semibold tracking-[0.06em] uppercase text-muted hover:text-accent transition-colors"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
