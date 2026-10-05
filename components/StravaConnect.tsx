// components/StravaConnect.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Loader2, Search } from 'lucide-react';
import {
    StravaTokens,
    StravaActivity,
    StravaActivityDetail,
    getStravaAuthUrl,
    formatDistance,
    formatDuration,
    formatDate,
    activitiesToGeoJSON,
    hasPrivateActivityAccess,
    calculateElevationLoss,
    calculateElevationFromStream,
    StravaAltitudeStream,
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
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hideRouteless, setHideRouteless] = useState(true);
    const [search, setSearch] = useState('');

    // Load tokens from sessionStorage on mount
    useEffect(() => {
        const stored = sessionStorage.getItem('stravaTokens');
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as StravaTokens;
                // Drop tokens with no recorded scope: they were issued before we
                // requested activity:read_all, so they can only see public activities.
                // Clearing them re-prompts for the wider scope instead of silently
                // hiding the user's private routes.
                if (parsed.scope === undefined) {
                    sessionStorage.removeItem('stravaTokens');
                } else if (parsed.expires_at * 1000 > Date.now()) {
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

    // Strava caps per_page at 200 and returns pages newest-first. One page is never
    // the whole history, so we page through on demand rather than showing only the
    // most recent slice.
    const PER_PAGE = 100;

    const loadPage = useCallback(
        async (pageToLoad: number) => {
            if (!tokens) return;

            const isFirstPage = pageToLoad === 1;
            if (isFirstPage) setLoadingActivities(true);
            else setLoadingMore(true);
            setError(null);

            try {
                const response = await fetch(
                    `/api/strava/activities?per_page=${PER_PAGE}&page=${pageToLoad}`,
                    {
                        headers: {
                            Authorization: `Bearer ${tokens.access_token}`,
                        },
                    }
                );

                if (!response.ok) {
                    if (response.status === 401) {
                        handleDisconnect();
                        throw new Error('Session expired. Please reconnect.');
                    }
                    throw new Error('Failed to fetch activities');
                }

                const data: StravaActivity[] = await response.json();

                setActivities((prev) => {
                    if (isFirstPage) return data;
                    // Guard against duplicates if a page is requested twice.
                    const seen = new Set(prev.map((a) => a.id));
                    return [...prev, ...data.filter((a) => !seen.has(a.id))];
                });
                // A short page means Strava has nothing older left.
                setHasMore(data.length === PER_PAGE);
                setPage(pageToLoad);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch activities');
            } finally {
                setLoadingActivities(false);
                setLoadingMore(false);
            }
        },
        [tokens]
    );

    // Fetch the first page when tokens are available and the modal opens
    useEffect(() => {
        if (tokens && showModal && activities.length === 0) {
            loadPage(1);
        }
    }, [tokens, showModal, activities.length, loadPage]);

    // Activities without a summary polyline (indoor rides, weights, elliptical) can
    // never be turned into a poster, so hide them by default.
    const routedActivities = hideRouteless
        ? activities.filter((a) => !!a.map?.summary_polyline)
        : activities;

    // Search matches the activity name or its sport type ("ride", "hike"), so
    // "orme" and "hike" both work. Only the pages already loaded are searched —
    // the modal says so, and Load more widens the pool.
    const query = search.trim().toLowerCase();
    const visibleActivities = query
        ? routedActivities.filter(
              (a) =>
                  a.name.toLowerCase().includes(query) ||
                  a.sport_type?.toLowerCase().includes(query) ||
                  a.type?.toLowerCase().includes(query)
          )
        : routedActivities;

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
        setSearch('');
        setPage(1);
        setHasMore(true);
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

                // Prefer the altitude stream: it is the full per-point series, so it
                // captures every climb and descent. splits_metric only holds the NET
                // change per kilometre, which cancels out rolling terrain and badly
                // under-reports loss. Fall back to splits if the stream is unavailable
                // (some manually-entered activities have no stream).
                let elevationGain = activity.total_elevation_gain;
                let elevationLoss = calculateElevationLoss(detail.splits_metric);

                try {
                    const streamRes = await fetch(
                        `/api/strava/activity/${activity.id}/streams`,
                        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
                    );
                    if (streamRes.ok) {
                        const streams: StravaAltitudeStream = await streamRes.json();
                        const fromStream = calculateElevationFromStream(streams.altitude?.data);
                        if (fromStream) {
                            elevationGain = fromStream.gain;
                            elevationLoss = fromStream.loss;
                        }
                    }
                } catch {
                    // Keep the fallback values; a missing stream should not block import.
                }

                if (polyline) {
                    detailedActivities.push({
                        polyline,
                        name: activity.name,
                        date: activity.start_date_local,
                        distance: activity.distance,
                        totalElevationGain: elevationGain,
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
            <div className="h-full border-2 border-ink bg-paper p-8 sm:p-10 flex flex-col items-start gap-4">
                <svg className="w-7 h-7 text-ink" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                {!tokens ? (
                    <>
                        <div>
                            <p className="text-[20px] font-semibold text-ink">Import from Strava</p>
                            <p className="mt-1.5 text-[14px] text-muted">
                                Connect once, then pick any activity — or combine several into one route.
                            </p>
                        </div>
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="mt-1 inline-flex items-center gap-2.5 px-6 py-4 min-h-[44px] bg-strava text-white text-[15px] font-semibold tracking-[0.04em] uppercase hover:brightness-95 transition disabled:opacity-50"
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
                        <p className="text-[12px] text-faint">We only read your activities. Nothing is posted.</p>
                    </>
                ) : (
                    <>
                        <div>
                            <p className="text-[20px] font-semibold text-ink">
                                Connected as {tokens.athlete.firstname}
                            </p>
                            <p className="mt-1.5 text-[14px] text-muted">
                                Pick any activity — or combine several into one route.
                            </p>
                            {!hasPrivateActivityAccess(tokens) && (
                                <p className="mt-3 border-l-2 border-accent pl-3 text-[13px] text-muted">
                                    Private activities are hidden. Strava asks separately for those —
                                    reconnect and tick the private-activity permission to include them.
                                </p>
                            )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3">
                            <button
                                onClick={handleBrowseActivities}
                                className="px-6 py-4 min-h-[44px] bg-strava text-white text-[15px] font-semibold tracking-[0.04em] uppercase hover:brightness-95 transition"
                            >
                                Browse activities
                            </button>
                            <button
                                onClick={handleDisconnect}
                                className="px-6 py-4 min-h-[44px] border-2 border-ink text-ink text-[15px] font-semibold tracking-[0.04em] uppercase hover:bg-ink hover:text-white transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Activities Modal */}
            {showModal && tokens && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <h3 className="text-lg font-semibold">Select Activities</h3>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={hideRouteless}
                                            onChange={(e) => setHideRouteless(e.target.checked)}
                                            className="accent-[#FC4C02]"
                                        />
                                        Only activities with a route
                                    </label>
                                    <button
                                        onClick={() => {
                                            setShowModal(false);
                                            setCustomTitle('');
                                            setSearch('');
                                        }}
                                        aria-label="Close"
                                        className="p-1 hover:bg-neutral-100 rounded"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by name or sport"
                                    aria-label="Search activities"
                                    className="w-full min-h-[44px] pl-9 pr-9 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-[#FC4C02]"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch('')}
                                        aria-label="Clear search"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-700 rounded"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
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
                            ) : visibleActivities.length === 0 ? (
                                <div className="text-center text-neutral-500 py-12 space-y-1">
                                    {query ? (
                                        <>
                                            <p>No loaded activity matches “{search.trim()}”.</p>
                                            {hasMore && (
                                                <p className="text-sm">
                                                    Older activities are not loaded yet — try Load older
                                                    activities below.
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p>
                                            {activities.length > 0 && hideRouteless
                                                ? 'No activities with a recorded route on this page'
                                                : 'No activities found'}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {visibleActivities.map((activity) => (
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

                            {!loadingActivities && hasMore && (
                                <button
                                    onClick={() => loadPage(page + 1)}
                                    disabled={loadingMore}
                                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 rounded-md text-sm text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                                >
                                    {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {loadingMore ? 'Loading…' : 'Load older activities'}
                                </button>
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
