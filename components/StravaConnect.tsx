// components/StravaConnect.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import {
    StravaTokens,
    StravaActivity,
    StravaActivityDetail,
    getStravaAuthUrl,
    formatDistance,
    formatDuration,
    formatDate,
    activitiesToGeoJSON,
    calculateElevationLoss,
} from '@/lib/strava';

interface StravaConnectProps {
    onDataLoaded: (data: unknown, fileName: string) => void;
}

export default function StravaConnect({ onDataLoaded }: StravaConnectProps) {
    const [tokens, setTokens] = useState<StravaTokens | null>(null);
    const [activities, setActivities] = useState<StravaActivity[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [importing, setImporting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customTitle, setCustomTitle] = useState<string>('');

    // Load tokens from sessionStorage on mount
    useEffect(() => {
        const stored = sessionStorage.getItem('stravaTokens');
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as StravaTokens;
                // Check if token is expired
                if (parsed.expires_at * 1000 > Date.now()) {
                    setTokens(parsed);
                } else {
                    sessionStorage.removeItem('stravaTokens');
                }
            } catch {
                sessionStorage.removeItem('stravaTokens');
            }
        }
    }, []);

    // Listen for OAuth callback messages
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'strava-auth-success') {
                setTokens(event.data.tokens);
                setShowModal(true);
                setLoading(false);
            } else if (event.data?.type === 'strava-auth-error') {
                setError(event.data.error);
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Fetch activities when tokens are available and modal opens
    useEffect(() => {
        if (tokens && showModal && activities.length === 0) {
            fetchActivities();
        }
    }, [tokens, showModal]);

    const fetchActivities = async () => {
        if (!tokens) return;

        setLoadingActivities(true);
        setError(null);

        try {
            const response = await fetch('/api/strava/activities?per_page=50', {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    handleDisconnect();
                    throw new Error('Session expired. Please reconnect.');
                }
                throw new Error('Failed to fetch activities');
            }

            const data = await response.json();
            setActivities(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch activities');
        } finally {
            setLoadingActivities(false);
        }
    };

    const handleConnect = () => {
        setLoading(true);
        setError(null);

        const authUrl = getStravaAuthUrl();
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        window.open(
            authUrl,
            'strava-auth',
            `width=${width},height=${height},left=${left},top=${top}`
        );
    };

    const handleDisconnect = () => {
        sessionStorage.removeItem('stravaTokens');
        setTokens(null);
        setActivities([]);
        setSelectedIds(new Set());
        setShowModal(false);
        setCustomTitle('');
    };

    const toggleActivity = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleImport = async () => {
        if (!tokens || selectedIds.size === 0) return;

        setImporting(true);
        setError(null);

        try {
            // Fetch detailed activity data for selected activities
            const selectedActivities = activities.filter((a) => selectedIds.has(a.id));
            const detailedActivities: Array<{ polyline: string; name: string; date: string; distance: number; totalElevationGain: number; totalElevationLoss: number }> = [];

            for (const activity of selectedActivities) {
                // Always fetch detailed activity to get splits for elevation loss
                const response = await fetch(`/api/strava/activity/${activity.id}`, {
                    headers: {
                        Authorization: `Bearer ${tokens.access_token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch activity: ${activity.name}`);
                }

                const detail: StravaActivityDetail = await response.json();
                const polyline = detail.map?.polyline || detail.map?.summary_polyline || activity.map?.summary_polyline;

                // Calculate elevation loss from splits_metric
                const elevationLoss = calculateElevationLoss(detail.splits_metric);

                if (polyline) {
                    detailedActivities.push({
                        polyline,
                        name: activity.name,
                        date: activity.start_date_local,
                        distance: activity.distance,
                        totalElevationGain: activity.total_elevation_gain,
                        totalElevationLoss: elevationLoss,
                    });
                }
            }

            if (detailedActivities.length === 0) {
                throw new Error('No route data found in selected activities');
            }

            // Convert to GeoJSON (pass custom title if multiple activities)
            const geojson = activitiesToGeoJSON(
                detailedActivities,
                detailedActivities.length > 1 ? customTitle : undefined
            );

            // Generate filename
            const fileName =
                detailedActivities.length === 1
                    ? `${detailedActivities[0].name}.strava`
                    : `${detailedActivities.length} Strava Activities`;

            onDataLoaded(geojson, fileName);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import activities');
            setImporting(false);
        }
    };

    const handleBrowseActivities = () => {
        setShowModal(true);
    };

    // Activity type icons/colors
    const getActivityIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'run':
                return '🏃';
            case 'ride':
                return '🚴';
            case 'swim':
                return '🏊';
            case 'hike':
                return '🥾';
            case 'walk':
                return '🚶';
            case 'ski':
            case 'alpineski':
            case 'backcountryski':
                return '⛷️';
            default:
                return '🏃';
        }
    };

    return (
        <>
            <div className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-neutral-200 hover:border-neutral-400">
                <div className="flex flex-col items-center gap-4 text-neutral-500">
                    <svg
                        className="w-8 h-8 opacity-50"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                    </svg>
                    {!tokens ? (
                        <div className="space-y-3">
                            <p className="font-medium text-neutral-800">Connect Strava</p>
                            <button
                                onClick={handleConnect}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FC4C02] text-white rounded-md hover:bg-[#e34402] transition-colors disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                                    </svg>
                                )}
                                Connect with Strava
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="font-medium text-neutral-800">
                                Connected as {tokens.athlete.firstname}
                            </p>
                            <div className="flex gap-2 justify-center">
                                <button
                                    onClick={handleBrowseActivities}
                                    className="px-4 py-2 bg-[#FC4C02] text-white rounded-md hover:bg-[#e34402] transition-colors"
                                >
                                    Browse Activities
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-md hover:bg-neutral-300 transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Activities Modal */}
            {showModal && tokens && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold">Select Activities</h3>
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    setCustomTitle('');
                                }}
                                className="p-1 hover:bg-neutral-100 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {error && (
                            <div className="mx-4 mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingActivities ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                                </div>
                            ) : activities.length === 0 ? (
                                <p className="text-center text-neutral-500 py-12">
                                    No activities found
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {activities.map((activity) => (
                                        <button
                                            key={activity.id}
                                            onClick={() => toggleActivity(activity.id)}
                                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                                selectedIds.has(activity.id)
                                                    ? 'border-[#FC4C02] bg-orange-50'
                                                    : 'border-neutral-200 hover:border-neutral-300'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                        selectedIds.has(activity.id)
                                                            ? 'bg-[#FC4C02] border-[#FC4C02]'
                                                            : 'border-neutral-300'
                                                    }`}
                                                >
                                                    {selectedIds.has(activity.id) && (
                                                        <Check className="w-3 h-3 text-white" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span>{getActivityIcon(activity.type)}</span>
                                                        <span className="font-medium truncate">
                                                            {activity.name}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-neutral-500 mt-1">
                                                        {formatDate(activity.start_date_local)} •{' '}
                                                        {formatDistance(activity.distance)} •{' '}
                                                        {formatDuration(activity.moving_time)}
                                                        {activity.total_elevation_gain > 0 &&
                                                            ` • ${Math.round(activity.total_elevation_gain)}m elevation`}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-neutral-50 space-y-3">
                            {selectedIds.size > 1 && (
                                <div>
                                    <label htmlFor="route-title" className="block text-sm font-medium text-neutral-700 mb-1">
                                        Route Title
                                    </label>
                                    <input
                                        id="route-title"
                                        type="text"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        placeholder="Enter a title for the combined route..."
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FC4C02] focus:border-transparent"
                                    />
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600">
                                    {selectedIds.size} {selectedIds.size === 1 ? 'activity' : 'activities'}{' '}
                                    selected
                                </span>
                                <button
                                    onClick={handleImport}
                                    disabled={selectedIds.size === 0 || importing}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#FC4C02] text-white rounded-md hover:bg-[#e34402] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {selectedIds.size > 1
                                        ? `Import & Combine (${selectedIds.size})`
                                        : 'Import Activity'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
