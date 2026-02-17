'use client';

import { useEffect, useState } from 'react';
import { X, Trash2, ShoppingBag, Minus, Plus, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from './CartProvider';
import { PRODUCTS, getVariant } from '@/config/products';
import { useCurrency } from '@/components/CurrencyProvider';
import { CartItem, getCartImage, getAllCartImages } from '@/lib/cart';

function CartItemRow({
    item,
    onRemove,
    onUpdateQuantity,
    formatPrice,
}: {
    item: CartItem;
    onRemove: () => void;
    onUpdateQuantity: (quantity: number) => void;
    formatPrice: (eurCents: number) => string;
}) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        getCartImage(item.id).then(setImageUrl).catch(() => {});
    }, [item.id]);

    const variant = getVariant(item.productType || 'poster', item.size);
    const product = PRODUCTS[item.productType || 'poster'];
    const price = variant?.price || 0;

    return (
        <div className="flex gap-3 py-3">
            <div className="w-16 h-20 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                {imageUrl ? (
                    <img src={imageUrl} alt={item.routeName} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-neutral-200 animate-pulse" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{item.routeName}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{product.label} &mdash; {item.size} ({variant?.dimensions})</p>
                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => item.quantity <= 1 ? onRemove() : onUpdateQuantity(item.quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 transition-colors"
                        >
                            {item.quantity <= 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        </button>
                        <span className="text-sm font-medium text-neutral-900 w-6 text-center">{item.quantity}</span>
                        <button
                            onClick={() => onUpdateQuantity(item.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900">{formatPrice(price * item.quantity)}</p>
                </div>
            </div>
        </div>
    );
}

export default function CartDrawer() {
    const { items, count, isCartOpen, setCartOpen, removeItem, updateQuantity, clearAll } = useCart();
    const { formatPrice, currency, countryCode } = useCurrency();
    const [loading, setLoading] = useState(false);
    const [shippingEstimate, setShippingEstimate] = useState<string | null>(null);

    const total = items.reduce((sum, item) => {
        const variant = getVariant(item.productType || 'poster', item.size);
        return sum + (variant?.price || 0) * item.quantity;
    }, 0);

    // Fetch shipping estimate when cart opens with items
    useEffect(() => {
        if (!isCartOpen || items.length === 0) return;
        setShippingEstimate(null);

        const cartItems = items.map(item => ({
            productType: item.productType || 'poster',
            size: item.size,
            quantity: item.quantity,
        }));

        fetch('/api/shipping-rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ countryCode: countryCode || 'DE', items: cartItems }),
        })
            .then(res => res.json())
            .then(data => {
                const standard = data.rates?.find((r: { id: string }) => r.id === 'STANDARD');
                if (standard) {
                    // Printful returns rate in AUD — convert to EUR cents then to user currency
                    const audRate = 1.65; // AUD per EUR
                    const eurCents = Math.round((parseFloat(standard.rate) / audRate) * 100);
                    setShippingEstimate(formatPrice(eurCents));
                }
            })
            .catch(() => {});
    }, [isCartOpen, items, countryCode, formatPrice]);

    const handleCheckout = async () => {
        if (items.length === 0) return;
        setLoading(true);

        try {
            const images = await getAllCartImages();

            const checkoutItems = items.map(item => ({
                routeId: item.routeId,
                routeName: item.routeName,
                productType: item.productType || 'poster',
                size: item.size,
                quantity: item.quantity,
                imageBase64: images[item.id] || '',
            }));

            const res = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: checkoutItems, currency: currency.code, countryCode: countryCode || 'DE' }),
            });

            const data = await res.json();

            if (!res.ok) {
                console.error('Checkout API error:', data.error);
                toast.error(data.error || 'Something went wrong. Please try again.');
                setLoading(false);
                return;
            }

            if (data.url) {
                await clearAll();
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

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />

            {/* Drawer */}
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-neutral-700" />
                        <h2 className="text-lg font-semibold text-neutral-900">Cart ({count})</h2>
                    </div>
                    <button
                        onClick={() => setCartOpen(false)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto px-5">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <ShoppingBag className="w-12 h-12 text-neutral-200 mb-4" />
                            <p className="text-sm text-neutral-500">Your cart is empty</p>
                            <p className="text-xs text-neutral-400 mt-1">Add a poster from the editor to get started</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-100">
                            {items.map(item => (
                                <CartItemRow
                                    key={item.id}
                                    item={item}
                                    onRemove={() => removeItem(item.id)}
                                    onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
                                    formatPrice={formatPrice}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="border-t border-neutral-100 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-500">Subtotal</span>
                                <span className="text-sm font-medium text-neutral-900">{formatPrice(total)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-500 flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5" />
                                    Shipping
                                </span>
                                <span className="text-sm text-neutral-500">
                                    {shippingEstimate ? `~${shippingEstimate}` : 'Calculated at checkout'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={handleCheckout}
                            disabled={loading}
                            className="w-full py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? `Uploading ${count} poster${count > 1 ? 's' : ''}...` : 'Continue to checkout'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
