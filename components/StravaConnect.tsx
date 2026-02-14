// components/StravaConnect.tsx
'use client';

import React from 'react';

interface StravaConnectProps {
    onDataLoaded: (data: unknown, fileName: string) => void;
}

export default function StravaConnect({ onDataLoaded: _onDataLoaded }: StravaConnectProps) {
    return (
        <div className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-neutral-200">
            <div className="flex flex-col items-center gap-4 text-neutral-400">
                <svg
                    className="w-8 h-8 opacity-30"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                <div className="space-y-3">
                    <p className="font-medium text-neutral-400">Connect Strava</p>
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-200 text-neutral-500 rounded-md cursor-default text-sm">
                        Coming Soon
                    </span>
                </div>
            </div>
        </div>
    );
}
