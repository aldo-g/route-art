'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CheckoutCancelPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-white p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold text-neutral-900">Checkout cancelled</h1>
                    <p className="text-sm text-neutral-500">
                        No worries — your poster design is still saved. You can return to the editor and try again anytime.
                    </p>
                </div>

                <div className="pt-4">
                    <Link
                        href="/view"
                        className="inline-flex items-center gap-2 py-3 px-6 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to editor
                    </Link>
                </div>
            </div>
        </main>
    );
}
