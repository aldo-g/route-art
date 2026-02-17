'use client';

import { useEffect } from 'react';
import ContourPatternStatic from '@/components/ContourPatternStatic';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Unhandled error:', error);
    }, [error]);

    return (
        <main className="min-h-screen bg-neutral-100 flex items-center justify-center px-6 relative overflow-hidden">
            <ContourPatternStatic seed={500} />
            <div className="relative z-10 text-center">
                <p className="text-8xl font-light tracking-tight text-neutral-300">500</p>
                <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">Something went wrong</h1>
                <p className="mt-2 text-sm text-neutral-500">
                    An unexpected error occurred. Please try again.
                </p>
                <button
                    onClick={reset}
                    className="mt-8 inline-block px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
                >
                    Try again
                </button>
            </div>
        </main>
    );
}
