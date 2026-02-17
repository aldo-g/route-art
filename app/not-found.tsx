'use client';

import Link from 'next/link';
import ContourPatternStatic from '@/components/ContourPatternStatic';

export default function NotFound() {
    return (
        <main className="min-h-screen bg-neutral-100 flex items-center justify-center px-6 relative overflow-hidden">
            <ContourPatternStatic seed={404} />
            <div className="relative z-10 text-center">
                <p className="text-8xl font-light tracking-tight text-neutral-300">404</p>
                <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">Page not found</h1>
                <p className="mt-2 text-sm text-neutral-500">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link
                    href="/"
                    className="mt-8 inline-block px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
                >
                    Back to home
                </Link>
            </div>
        </main>
    );
}
