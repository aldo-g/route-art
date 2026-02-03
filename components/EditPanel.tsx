// components/EditPanel.tsx
'use client';

import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronRight, Mountain, Droplets, Triangle, MapPin, Upload, Trash2, Plus, Star, Download, Heart, X } from 'lucide-react';
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

interface CollapsibleSectionProps {
    title: string;
    icon: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function CollapsibleSection({ title, icon, isOpen, onToggle, children }: CollapsibleSectionProps) {
    return (
        <div className="border-b border-neutral-200">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 p-3 hover:bg-neutral-50 transition-colors"
            >
                {isOpen ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                <span className="text-neutral-500">{icon}</span>
                <span className="text-sm font-medium">{title}</span>
            </button>
            {isOpen && (
                <div className="px-3 pb-3">
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
    onExportPNG,
}: EditPanelProps) {
    // Section open/closed state
    const [sectionsOpen, setSectionsOpen] = useState({
        landmarks: true,
        statbar: false,
        design: false,
    });

    const toggleSection = (section: keyof typeof sectionsOpen) => {
        setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
    };

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
            // Auto-fill dates from Strava if available and not already set
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

    const handleResetImage = () => {
        onSaveImage({
            enabled: true,
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

    return (
        <div className="w-72 h-full max-h-full bg-white border-l border-neutral-200 flex flex-col flex-shrink-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-neutral-200">
                <h3 className="font-semibold text-sm">Customize</h3>
            </div>

            {/* Collapsible Sections */}
            <div className="flex-1 overflow-y-auto">
                {/* Landmarks Section */}
                <CollapsibleSection
                    title="Landmarks"
                    icon={<MapPin className="w-4 h-4" />}
                    isOpen={sectionsOpen.landmarks}
                    onToggle={() => toggleSection('landmarks')}
                >
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <button
                                onClick={onSelectAllLandmarks}
                                className="flex-1 text-xs py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                            >
                                Select All
                            </button>
                            <button
                                onClick={onDeselectAllLandmarks}
                                className="flex-1 text-xs py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                            >
                                Deselect All
                            </button>
                        </div>

                        {/* Add Custom Landmark */}
                        <div className="border-t border-neutral-100 pt-2">
                            {isPlacingLandmark ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-neutral-500 text-center py-2">
                                        Click on the map to place your landmark
                                    </p>
                                    <button
                                        onClick={onCancelPlacingLandmark}
                                        className="w-full py-1.5 text-xs border border-neutral-200 text-neutral-600 rounded hover:bg-neutral-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : !showAddForm ? (
                                <button
                                    onClick={() => setShowAddForm(true)}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Custom Landmark
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-neutral-600">New Landmark</span>
                                        <button onClick={handleCancelForm} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Name (required)"
                                        value={newLandmarkName}
                                        onChange={(e) => setNewLandmarkName(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                    />
                                    <div className="flex gap-1 flex-wrap">
                                        {iconOptions.map(option => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setNewLandmarkIcon(option.value)}
                                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded border transition-colors ${
                                                    newLandmarkIcon === option.value
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
                                        className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                    />
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setUseManualCoords(false)}
                                            className={`flex-1 py-1.5 text-[10px] rounded border transition-colors ${
                                                !useManualCoords
                                                    ? 'bg-neutral-900 text-white border-neutral-900'
                                                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                            }`}
                                        >
                                            Click on map
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setUseManualCoords(true)}
                                            className={`flex-1 py-1.5 text-[10px] rounded border transition-colors ${
                                                useManualCoords
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
                                                    className="flex-1 px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Longitude"
                                                    value={newLandmarkLng}
                                                    onChange={(e) => setNewLandmarkLng(e.target.value)}
                                                    className="flex-1 px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                                />
                                            </div>
                                            <button
                                                onClick={handleAddWithCoords}
                                                disabled={!newLandmarkName.trim() || !newLandmarkLat || !newLandmarkLng}
                                                className="w-full py-1.5 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Add Landmark
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={handleStartPlacing}
                                            disabled={!newLandmarkName.trim()}
                                            className="w-full py-1.5 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Click on map to place
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Landmarks List */}
                        <div className="border-t border-neutral-100 pt-2 max-h-48 overflow-y-auto">
                            <p className="text-xs text-neutral-400 mb-2">
                                {selectedCount} of {totalCount} selected
                            </p>
                            {landmarks.length === 0 ? (
                                <p className="text-xs text-neutral-400 text-center py-4">
                                    No landmarks found near this route
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {landmarks.map(landmark => (
                                        <div
                                            key={landmark.id}
                                            className={`flex items-center gap-2 p-1.5 rounded transition-colors ${
                                                selectedLandmarkIds.has(landmark.id)
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

                {/* Stats Section */}
                <CollapsibleSection
                    title="Stats"
                    icon={<Mountain className="w-4 h-4" />}
                    isOpen={sectionsOpen.statbar}
                    onToggle={() => toggleSection('statbar')}
                >
                    {!statsDefaults ? (
                        <p className="text-xs text-neutral-400 text-center py-4">Loading...</p>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Route Name</label>
                                <input
                                    type="text"
                                    value={routeName}
                                    onChange={(e) => setRouteName(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Location</label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g. Albanian Alps, Albania"
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">Distance (km)</label>
                                    <input
                                        type="text"
                                        value={distance}
                                        onChange={(e) => setDistance(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">Gain (m)</label>
                                    <input
                                        type="text"
                                        value={elevationGain}
                                        onChange={(e) => setElevationGain(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">Loss (m)</label>
                                    <input
                                        type="text"
                                        value={elevationLoss}
                                        onChange={(e) => setElevationLoss(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Date</label>
                                <div className="flex gap-1 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsDateRange(false)}
                                        className={`flex-1 py-1 text-[10px] rounded border transition-colors ${
                                            !isDateRange
                                                ? 'bg-neutral-900 text-white border-neutral-900'
                                                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                        }`}
                                    >
                                        Single date
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsDateRange(true)}
                                        className={`flex-1 py-1 text-[10px] rounded border transition-colors ${
                                            isDateRange
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
                                        className="flex-1 px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                    />
                                    {isDateRange && (
                                        <>
                                            <span className="flex items-center text-neutral-400 text-xs">–</span>
                                            <input
                                                type="date"
                                                value={dateEnd}
                                                onChange={(e) => setDateEnd(e.target.value)}
                                                className="flex-1 px-2 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveStats}
                                    className="flex-1 py-1.5 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors"
                                >
                                    Save Changes
                                </button>
                                <button
                                    onClick={handleResetStats}
                                    className="py-1.5 px-3 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                                >
                                    Reset
                                </button>
                            </div>

                            {/* Image subsection */}
                            <div className="border-t border-neutral-100 pt-3 mt-3">
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input
                                        type="checkbox"
                                        checked={imageOverride.enabled}
                                        onChange={(e) => handleToggleImageEnabled(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                                    />
                                    <span className="text-xs text-neutral-700">Show image/flag</span>
                                </label>
                                {imageOverride.enabled && (
                                    <>
                                        <div className="mb-2">
                                            {imageOverride.url ? (
                                                <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded border border-neutral-100">
                                                    <img src={imageOverride.url} alt="Custom" className="h-8 w-auto rounded" />
                                                    <span className="text-[10px] text-neutral-500 flex-1">Custom image</span>
                                                    <button onClick={handleRemoveCustomImage} className="p-1 text-neutral-400 hover:text-red-500">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : defaultFlagUrl ? (
                                                <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded border border-neutral-100">
                                                    <img src={defaultFlagUrl} alt="Flag" className="h-8 w-auto rounded" />
                                                    <span className="text-[10px] text-neutral-500">{countryCode} flag</span>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-neutral-400 p-2 bg-neutral-50 rounded border border-neutral-100">No country detected</p>
                                            )}
                                        </div>
                                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border border-dashed border-neutral-200 rounded text-xs text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50"
                                        >
                                            <Upload className="w-3 h-3" />
                                            Upload custom image
                                        </button>
                                        {imageOverride.url && (
                                            <button onClick={handleResetImage} className="text-[10px] text-neutral-500 hover:text-neutral-700 mt-1">
                                                Reset to default flag
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </CollapsibleSection>

                {/* Design Section */}
                <CollapsibleSection
                    title="Design"
                    icon={<Droplets className="w-4 h-4" />}
                    isOpen={sectionsOpen.design}
                    onToggle={() => toggleSection('design')}
                >
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-700">Water shading</span>
                            <input
                                type="checkbox"
                                checked={showWater}
                                onChange={(e) => onToggleWater(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-700">Start/End markers</span>
                            <input
                                type="checkbox"
                                checked={showMarkers}
                                onChange={(e) => onToggleMarkers(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-700">Orientation</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => onToggleOrientation(false)}
                                    className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                                        !isPortrait
                                            ? 'bg-neutral-900 text-white border-neutral-900'
                                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                    }`}
                                >
                                    Landscape
                                </button>
                                <button
                                    onClick={() => onToggleOrientation(true)}
                                    className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                                        isPortrait
                                            ? 'bg-neutral-900 text-white border-neutral-900'
                                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                                    }`}
                                >
                                    Portrait
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-700">Dark mode</span>
                            <input
                                type="checkbox"
                                checked={isDarkMode}
                                onChange={(e) => onToggleDarkMode(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                            />
                        </div>
                    </div>
                </CollapsibleSection>

            </div>

            {/* Download & Purchase */}
            <div className="p-3 border-t border-neutral-200 space-y-2">
                <button
                    onClick={handleDownloadPNG}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-neutral-300 text-neutral-900 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Download PNG
                </button>
                <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-300 text-neutral-500 text-sm font-medium rounded-lg cursor-not-allowed"
                >
                    Purchase Print – Coming Soon
                </button>
            </div>

            {/* Tip Modal */}
            {showTipModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm mx-4 overflow-hidden">
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
    );
}
