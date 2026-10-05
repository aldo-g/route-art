'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CartItem, getCartItems, addCartItem, removeCartItem, updateCartItem, clearCart } from '@/lib/cart';
import { PrintSize, ProductType } from '@/config/products';

export interface AddItemParams {
    routeName: string;
    routeId: string;
    productType: ProductType;
    size: PrintSize;
    quantity?: number;
    /** Small preview, kept in IndexedDB for the cart thumbnail. */
    imageDataUrl: string;
    posterId: string;
    imageUrl: string;
    previewUrl: string;
    printWidth: number;
    printHeight: number;
    printDpi: number;
}

interface CartContextValue {
    items: CartItem[];
    count: number;
    isCartOpen: boolean;
    setCartOpen: (open: boolean) => void;
    addItem: (params: AddItemParams) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    updateQuantity: (id: string, quantity: number) => Promise<void>;
    clearAll: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCartOpen, setCartOpen] = useState(false);

    useEffect(() => {
        getCartItems().then(setItems).catch(() => {});
    }, []);

    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    const addItem = useCallback(async (params: AddItemParams) => {
        const item: CartItem = {
            id: crypto.randomUUID(),
            routeName: params.routeName,
            routeId: params.routeId,
            productType: params.productType,
            size: params.size,
            quantity: params.quantity || 1,
            addedAt: Date.now(),
            posterId: params.posterId,
            imageUrl: params.imageUrl,
            previewUrl: params.previewUrl,
            printWidth: params.printWidth,
            printHeight: params.printHeight,
            printDpi: params.printDpi,
        };
        await addCartItem(item, params.imageDataUrl);
        setItems(prev => [...prev, item]);
    }, []);

    const removeItem = useCallback(async (id: string) => {
        await removeCartItem(id);
        setItems(prev => prev.filter(i => i.id !== id));
    }, []);

    const updateQuantity = useCallback(async (id: string, quantity: number) => {
        if (quantity < 1) return;
        setItems(prev => {
            const updated = prev.map(i => i.id === id ? { ...i, quantity } : i);
            const item = updated.find(i => i.id === id);
            if (item) updateCartItem(item).catch(() => {});
            return updated;
        });
    }, []);

    const clearAll = useCallback(async () => {
        await clearCart();
        setItems([]);
    }, []);

    return (
        <CartContext.Provider value={{ items, count, isCartOpen, setCartOpen, addItem, removeItem, updateQuantity, clearAll }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error('useCart must be used within CartProvider');
    return ctx;
}
