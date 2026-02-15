'use client';

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { PRINT_SIZES, PrintSize, formatPrice } from '@/config/products';

interface StoreModalProps {
    imageUrl: string;
    routeName: string;
    routeId: string;
    onClose: () => void;
}

const sizes = Object.keys(PRINT_SIZES) as PrintSize[];

export default function StoreModal({ imageUrl, routeName, routeId, onClose }: StoreModalProps) {
    const [selectedSize, setSelectedSize] = useState<PrintSize>('A3');
    const [loading, setLoading] = useState(false);

    const selected = PRINT_SIZES[selectedSize];

    const handleCheckout = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    routeId,
                    size: selectedSize,
                    imageUrl,
                    routeName,
                }),
            });

            const data = await res.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error('No checkout URL returned');
                setLoading(false);
            }
        } catch (err) {
            console.error('Checkout error:', err);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-600 transition-colors z-10 bg-white/80 rounded-full"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Poster preview */}
                <div className="bg-neutral-100 p-6 flex items-center justify-center">
                    <img
                        src={imageUrl}
                        alt={routeName}
                        className="max-h-56 w-auto rounded-lg shadow-lg"
                    />
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* Title */}
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-900">{routeName}</h2>
                        <p className="text-xs text-neutral-500 mt-1">
                            Museum-quality archival matte paper (200gsm), giclée printed, designed for framing.
                        </p>
                    </div>

                    {/* Size selector */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Select size</p>
                        <div className="grid grid-cols-4 gap-2">
                            {sizes.map((size) => {
                                const config = PRINT_SIZES[size];
                                const isSelected = size === selectedSize;
                                return (
                                    <button
                                        key={size}
                                        onClick={() => setSelectedSize(size)}
                                        className={`relative flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all ${
                                            isSelected
                                                ? 'border-neutral-900 bg-neutral-50'
                                                : 'border-neutral-200 hover:border-neutral-300'
                                        }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-neutral-900 rounded-full flex items-center justify-center">
                                                <Check className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        )}
                                        <span className="text-sm font-semibold text-neutral-900">{config.label}</span>
                                        <span className="text-[10px] text-neutral-400 mt-0.5">{config.dimensions}</span>
                                        <span className="text-xs font-medium text-neutral-600 mt-1">{formatPrice(config.price)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                        <span className="text-sm text-neutral-500">Total</span>
                        <span className="text-xl font-semibold text-neutral-900">{formatPrice(selected.price)}</span>
                    </div>

                    {/* CTA */}
                    <button
                        onClick={handleCheckout}
                        disabled={loading}
                        className="w-full py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Redirecting...' : 'Continue to checkout'}
                    </button>
                </div>
            </div>
        </div>
    );
}
