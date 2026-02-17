'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, Package } from 'lucide-react';
import { clearCart } from '@/lib/cart';

function SuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        clearCart().catch(() => {});
        if (sessionId) {
            fetch(`/api/verify-session?session_id=${sessionId}`).catch(() => {});
        }
    }, [sessionId]);

    return (
        <main className="min-h-screen flex items-center justify-center bg-white p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold text-neutral-900">Your print is being prepared.</h1>
                    <p className="text-sm text-neutral-500">
                        Thank you for your order. We&apos;ll send you an email with tracking details once your print ships.
                    </p>
                </div>

                {sessionId && (
                    <div className="space-y-2">
                        <p className="text-xs text-neutral-400">
                            Order reference: {sessionId.slice(0, 20)}...
                        </p>
                        <Link
                            href={`/order/${sessionId}`}
                            className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors underline underline-offset-2"
                        >
                            <Package className="w-4 h-4" />
                            View order details
                        </Link>
                    </div>
                )}

                <div className="pt-4 space-y-3">
                    <Link
                        href="/"
                        className="block w-full py-3 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
                    >
                        Create another poster
                    </Link>
                    <Link
                        href="/view"
                        className="block w-full py-3 border border-neutral-200 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors"
                    >
                        Back to editor
                    </Link>
                </div>
            </div>
        </main>
    );
}

export default function CheckoutSuccessPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen flex items-center justify-center bg-white p-6">
                <p className="text-sm text-neutral-400">Loading...</p>
            </main>
        }>
            <SuccessContent />
        </Suspense>
    );
}
