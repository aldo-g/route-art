// components/EditPanel.tsx
'use client';

import React, { useState, useRef } from 'react';
import { X, Mountain, Droplets, Triangle, MapPin, Upload, Trash2, Plus, Star } from 'lucide-react';
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
}

export interface ImageOverride {
    url?: string;
    enabled: boolean;
}

type TabType = 'landmarks' | 'statbox';

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
    // General
    initialTab?: TabType;
    onClose: () => void;
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
    initialTab = 'landmarks',
    onClose
}: EditPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);

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

    // Image editing state - changes save immediately
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

        // Convert file to data URL
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            onSaveImage({
                ...imageOverride,
                url: dataUrl
            });
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be selected again
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
        // Reset form after starting placement
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

        // Reset form
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

    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'landmarks', label: 'Landmarks', icon: <MapPin className="w-3.5 h-3.5" /> },
        { id: 'statbox', label: 'Stat Bar', icon: <Mountain className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="w-80 h-full max-h-full bg-white border-l border-neutral-200 shadow-lg flex flex-col flex-shrink-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-sm">Edit</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                        Customize your route art
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-neutral-100 rounded transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-200">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'text-neutral-900 border-b-2 border-neutral-900 -mb-px'
                                : 'text-neutral-500 hover:text-neutral-700'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'landmarks' && (
                    <div className="flex flex-col h-full">
                        <div className="p-2 border-b border-neutral-100 flex gap-2">
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
                        <div className="p-2 border-b border-neutral-100">
                            {isPlacingLandmark ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-neutral-600">Placing landmark...</span>
                                        <button
                                            onClick={onCancelPlacingLandmark}
                                            className="p-1 hover:bg-neutral-100 rounded"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
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
                                        <button
                                            onClick={handleCancelForm}
                                            className="p-1 hover:bg-neutral-100 rounded"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
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

                                    {/* Toggle between click-to-place and manual coords */}
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
                                                className="w-full py-1.5 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Add Landmark
                                            </button>
                                            {!newLandmarkName.trim() && newLandmarkLat && newLandmarkLng && (
                                                <p className="text-[10px] text-amber-600 text-center">
                                                    Please enter a name above
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <button
                                            onClick={handleStartPlacing}
                                            disabled={!newLandmarkName.trim()}
                                            className="w-full py-1.5 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                        >
                                            <MapPin className="w-3 h-3" />
                                            Click on map to place
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            <p className="text-xs text-neutral-400 mb-2 px-2">
                                {selectedCount} of {totalCount} selected
                            </p>
                            {landmarks.length === 0 ? (
                                <p className="text-xs text-neutral-400 text-center py-8">
                                    No landmarks found near this route
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {landmarks.map(landmark => (
                                        <div
                                            key={landmark.id}
                                            className={`flex items-center gap-3 p-2 rounded transition-colors ${
                                                selectedLandmarkIds.has(landmark.id)
                                                    ? 'bg-neutral-100'
                                                    : 'hover:bg-neutral-50'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedLandmarkIds.has(landmark.id)}
                                                onChange={() => onToggleLandmark(landmark.id)}
                                                className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 cursor-pointer"
                                            />
                                            <span className="text-neutral-400">
                                                {getLandmarkIcon(landmark.type)}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {landmark.name}
                                                    {landmark.isCustom && (
                                                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-neutral-200 text-neutral-500 rounded">
                                                            custom
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-neutral-400">
                                                    {landmark.elevation ? `${Math.round(landmark.elevation)}m` : ''}
                                                    {landmark.elevation && landmark.distanceToRoute ? ' · ' : ''}
                                                    {landmark.distanceToRoute ? `${landmark.distanceToRoute.toFixed(1)}km from route` : ''}
                                                </p>
                                            </div>
                                            {landmark.isCustom && (
                                                <button
                                                    onClick={() => onDeleteCustomLandmark(landmark.id)}
                                                    className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete custom landmark"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'statbox' && (
                    <div className="p-4 space-y-4">
                        {!statsDefaults ? (
                            <p className="text-xs text-neutral-400 text-center py-8">
                                Loading route data...
                            </p>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                                        Route Name
                                    </label>
                                    <input
                                        type="text"
                                        value={routeName}
                                        onChange={(e) => setRouteName(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="e.g. Albanian Alps, Albania"
                                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                                        Distance (km)
                                    </label>
                                    <input
                                        type="text"
                                        value={distance}
                                        onChange={(e) => setDistance(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                                        Elevation Gain (m)
                                    </label>
                                    <input
                                        type="text"
                                        value={elevationGain}
                                        onChange={(e) => setElevationGain(e.target.value)}
                                        placeholder="0"
                                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                                        Elevation Loss (m)
                                    </label>
                                    <input
                                        type="text"
                                        value={elevationLoss}
                                        onChange={(e) => setElevationLoss(e.target.value)}
                                        placeholder="0"
                                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-medium text-neutral-600">
                                            Date
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsDateRange(!isDateRange)}
                                            className="text-[10px] text-neutral-500 hover:text-neutral-700 transition-colors"
                                        >
                                            {isDateRange ? 'Single date' : 'Date range'}
                                        </button>
                                    </div>
                                    <div className={`flex gap-2 ${isDateRange ? '' : ''}`}>
                                        <input
                                            type="date"
                                            value={dateStart}
                                            onChange={(e) => setDateStart(e.target.value)}
                                            className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                                        />
                                        {isDateRange && (
                                            <>
                                                <span className="flex items-center text-neutral-400 text-sm">–</span>
                                                <input
                                                    type="date"
                                                    value={dateEnd}
                                                    onChange={(e) => setDateEnd(e.target.value)}
                                                    className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleResetStats}
                                    className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                                >
                                    Reset to original values
                                </button>

                                {/* Divider */}
                                <div className="border-t border-neutral-200 pt-4">
                                    <h4 className="text-xs font-medium text-neutral-600 mb-3">Image</h4>

                                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                                        <input
                                            type="checkbox"
                                            checked={imageOverride.enabled}
                                            onChange={(e) => handleToggleImageEnabled(e.target.checked)}
                                            className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                                        />
                                        <span className="text-sm text-neutral-700">
                                            Show image
                                        </span>
                                    </label>

                                    {imageOverride.enabled && (
                                        <>
                                            {/* Current Image */}
                                            <div className="mb-3">
                                                {imageOverride.url ? (
                                                    <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-md border border-neutral-100">
                                                        <img
                                                            src={imageOverride.url}
                                                            alt="Custom image"
                                                            className="h-10 w-auto rounded shadow-sm"
                                                        />
                                                        <div className="flex-1">
                                                            <span className="text-xs text-neutral-500">
                                                                Custom image
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={handleRemoveCustomImage}
                                                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                            title="Remove custom image"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : defaultFlagUrl ? (
                                                    <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-md border border-neutral-100">
                                                        <img
                                                            src={defaultFlagUrl}
                                                            alt="Country flag"
                                                            className="h-10 w-auto rounded shadow-sm"
                                                        />
                                                        <span className="text-xs text-neutral-500">
                                                            {countryCode} flag (auto-detected)
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-neutral-400 p-3 bg-neutral-50 rounded-md border border-neutral-100">
                                                        No country detected for this route
                                                    </p>
                                                )}
                                            </div>

                                            {/* Upload Custom Image */}
                                            <div>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                />
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-neutral-200 rounded-md hover:border-neutral-400 hover:bg-neutral-50 transition-colors text-sm text-neutral-600"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    Upload custom image
                                                </button>
                                            </div>

                                            {imageOverride.url && (
                                                <button
                                                    onClick={handleResetImage}
                                                    className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors mt-2"
                                                >
                                                    Reset to default flag
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Footer with Save */}
            {activeTab === 'statbox' && (
                <div className="p-3 border-t border-neutral-200">
                    <button
                        onClick={handleSaveStats}
                        className="w-full py-2 bg-neutral-900 text-white text-sm font-medium rounded hover:bg-neutral-800 transition-colors"
                    >
                        Save Changes
                    </button>
                </div>
            )}

            {activeTab === 'landmarks' && (
                <div className="p-3 border-t border-neutral-200">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-neutral-900 text-white text-sm font-medium rounded hover:bg-neutral-800 transition-colors"
                    >
                        Done
                    </button>
                </div>
            )}
        </div>
    );
}
