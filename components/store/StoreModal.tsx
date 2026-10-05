'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, Check, ShoppingCart, Minus, Plus, Loader2 } from 'lucide-react';
import { PRODUCTS, ProductType, PrintSize, getPrintAspect } from '@/config/products';
import { useCurrency } from '@/components/CurrencyProvider';

interface StoreModalProps {
    /** Preview captured at the selected variant's print ratio; null while it is being re-captured. */
    imageUrl: string | null;
    /** False while the canvas is re-rendering for the selected size; blocks Add to cart. */
    isReady: boolean;
    isPortrait: boolean;
    routeName: string;
    routeId: string;
    /** Fired on open and whenever product/size changes, so the parent can re-lay out the artwork. */
    onSelectionChange: (productType: ProductType, size: PrintSize) => void;
    onClose: () => void;
    onAddToCart: (productType: ProductType, size: PrintSize, quantity: number) => Promise<void>;
    /** Progress text while the print file is rendered and uploaded; null when idle. */
    addStatus: string | null;
}

const productTypes: ProductType[] = ['poster', 'framed', 'canvas'];

export default function StoreModal({ imageUrl, isReady, isPortrait, routeName, onSelectionChange, onAddToCart, onClose, addStatus }: StoreModalProps) {
    const { formatPrice } = useCurrency();
    const [selectedType, setSelectedType] = useState<ProductType>('poster');
    const product = PRODUCTS[selectedType];
    const availableSizes = Object.keys(product.sizes) as PrintSize[];
    const [selectedSize, setSelectedSize] = useState<PrintSize>(availableSizes.includes('A3') ? 'A3' : availableSizes[0]);
    const [quantity, setQuantity] = useState(1);

    // Reset size when switching product type if current size isn't available
    const handleTypeChange = (type: ProductType) => {
        setSelectedType(type);
        const sizes = Object.keys(PRODUCTS[type].sizes) as PrintSize[];
        if (!sizes.includes(selectedSize)) {
            setSelectedSize(sizes.includes('A3') ? 'A3' : sizes[0]);
        }
    };

    const variant = product.sizes[selectedSize];
    const isAdding = addStatus !== null;

    useEffect(() => {
        onSelectionChange(selectedType, selectedSize);
    }, [selectedType, selectedSize, onSelectionChange]);

    // Placeholder with the print's proportions, shown while the preview re-renders for a new size
    const aspect = getPrintAspect(selectedType, selectedSize);
    const previewAspect = isPortrait ? `1 / ${aspect}` : `${aspect} / 1`;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center sm:p-4" onClick={isAdding ? undefined : onClose}>
            <div
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    disabled={isAdding}
                    className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-600 transition-colors z-10 bg-white/80 rounded-full disabled:opacity-40"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Poster preview, laid out at the selected variant's print ratio */}
                <div className="bg-neutral-100 p-4 sm:p-6 flex flex-col items-center justify-center gap-2">
                    {imageUrl ? (
                        <Image
                            src={imageUrl}
                            alt={routeName}
                            width={400}
                            height={Math.round(400 * (isPortrait ? aspect : 1 / aspect))}
                            unoptimized
                            className="max-h-36 sm:max-h-48 w-auto rounded-lg shadow-lg"
                        />
                    ) : (
                        <div
                            className="h-36 sm:h-48 bg-neutral-200 animate-pulse rounded-lg"
                            style={{ aspectRatio: previewAspect }}
                            aria-label="Preparing preview"
                        />
                    )}
                    {variant && (
                        <p className="text-[10px] text-neutral-400">Shown at the {variant.dimensions} print ratio</p>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 space-y-4">
                    {/* Title */}
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-900">{routeName}</h2>
                        <p className="text-xs text-neutral-500 mt-1">{product.description}</p>
                    </div>

                    {/* Product type selector */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Product</p>
                        <div className="flex gap-2">
                            {productTypes.map((type) => {
                                const isSelected = type === selectedType;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => handleTypeChange(type)}
                                        className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                                            isSelected
                                                ? 'border-neutral-900 bg-neutral-50 text-neutral-900'
                                                : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                                        }`}
                                    >
                                        {PRODUCTS[type].label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Size selector */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Size</p>
                        <div className={`grid gap-2 ${availableSizes.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                            {availableSizes.map((size) => {
                                const v = product.sizes[size]!;
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
                                        <span className="text-sm font-semibold text-neutral-900">{v.label}</span>
                                        <span className="text-[10px] text-neutral-400 mt-0.5">{v.dimensions}</span>
                                        <span className="text-xs font-medium text-neutral-600 mt-1">{formatPrice(v.price)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Quantity + Total */}
                    {variant && (
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-500">Qty</span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                        disabled={quantity <= 1}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="text-sm font-semibold text-neutral-900 w-6 text-center">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(q => q + 1)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 transition-colors"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <span className="text-xl font-semibold text-neutral-900">{formatPrice(variant.price * quantity)}</span>
                        </div>
                    )}

                    {/* CTA */}
                    <button
                        onClick={() => onAddToCart(selectedType, selectedSize, quantity)}
                        disabled={isAdding || !isReady}
                        className="w-full py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                    >
                        {isAdding || !isReady ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                        {isAdding ? addStatus : isReady ? 'Add to cart' : 'Preparing preview…'}
                    </button>
                    {isAdding && (
                        <p className="text-[11px] text-neutral-400 text-center -mt-2">
                            Preparing a print-resolution file. This can take a moment on large sizes.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
