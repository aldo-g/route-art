import { getSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { PRODUCTS, ProductType } from '@/config/products';
import { CURRENCIES, CurrencyConfig, formatPriceWithCurrency } from '@/config/currency';
import { Package, MapPin, CheckCircle, Clock, Printer, Truck, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface OrderRow {
    id: string;
    stripe_session_id: string;
    poster_id: string;
    product_type: string;
    size: string;
    quantity: number;
    price: number;
    currency: string;
    status: string;
    customer_email: string | null;
    shipping_name: string | null;
    shipping_address: Record<string, string> | null;
    printful_order_id: string | null;
    printful_status: string | null;
    created_at: string;
    posters: {
        id: string;
        route_name: string;
        image_url: string;
        preview_url: string | null;
    } | null;
}

function formatAddress(addr: Record<string, string> | null): string | null {
    if (!addr) return null;
    return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
        .filter(Boolean)
        .join(', ');
}

function getCurrency(code: string): CurrencyConfig {
    return Object.values(CURRENCIES).find(c => c.code === code) || CURRENCIES.EUR;
}

export default async function OrderPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = await params;

    if (!sessionId || !sessionId.startsWith('cs_')) {
        notFound();
    }

    const supabase = getSupabase();

    // Try fetching orders — use select('*') to avoid column-not-found errors
    const { data: plainOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('stripe_session_id', sessionId);

    if (!plainOrders || plainOrders.length === 0) {
        notFound();
    }

    // Fetch posters separately (avoids FK dependency)
    const posterIds = [...new Set(plainOrders.map(o => o.poster_id).filter(Boolean))];
    const { data: posters } = posterIds.length > 0
        ? await supabase.from('posters').select('id, route_name, image_url, preview_url').in('id', posterIds)
        : { data: [] };

    const posterMap = new Map((posters || []).map(p => [p.id, p]));

    const orders: OrderRow[] = plainOrders.map(o => ({
        ...o,
        quantity: o.quantity || 1,
        currency: o.currency || 'eur',
        product_type: o.product_type || 'poster',
        posters: posterMap.get(o.poster_id) || null,
    }));

    const currency = getCurrency(orders[0].currency || 'eur');
    const status = orders[0].status;
    const orderDate = new Date(orders[0].created_at);
    const shippingName = orders[0].shipping_name;
    const shippingAddress = formatAddress(orders[0].shipping_address);
    const total = orders.reduce((sum, o) => sum + o.price * o.quantity, 0);
    const printfulStatus = orders[0].printful_status as string | null;

    return (
        <main className="min-h-screen bg-neutral-50 py-12 px-4">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-neutral-900">Order Details</h1>
                        <p className="text-sm text-neutral-400 mt-1">
                            {orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        {status === 'paid' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Paid
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                Pending
                            </span>
                        )}
                        {printfulStatus === 'submitted' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                                <Printer className="w-3.5 h-3.5" />
                                Sent to printer
                            </span>
                        )}
                        {printfulStatus === 'in_production' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                                <Printer className="w-3.5 h-3.5" />
                                In production
                            </span>
                        )}
                        {printfulStatus === 'shipped' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                                <Truck className="w-3.5 h-3.5" />
                                Shipped
                            </span>
                        )}
                        {printfulStatus === 'failed' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Fulfillment issue
                            </span>
                        )}
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-neutral-100">
                        <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Items ({orders.length})
                        </h2>
                    </div>
                    <div className="divide-y divide-neutral-100">
                        {orders.map((order) => {
                            const productLabel = PRODUCTS[order.product_type as ProductType]?.label || order.product_type;
                            const routeName = order.posters?.route_name || 'Custom Print';
                            const imageUrl = order.posters?.preview_url || order.posters?.image_url;

                            return (
                                <div key={order.id} className="flex gap-4 p-5">
                                    <div className="relative w-16 h-20 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                                        {imageUrl ? (
                                            <Image src={imageUrl} alt={routeName} fill sizes="64px" className="object-cover" />
                                        ) : (
                                            <Package className="w-6 h-6 text-neutral-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-neutral-900">{routeName}</p>
                                        <p className="text-xs text-neutral-500 mt-0.5">
                                            {productLabel} &mdash; {order.size}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-neutral-400">Qty: {order.quantity}</span>
                                            <span className="text-sm font-semibold text-neutral-900">
                                                {formatPriceWithCurrency(order.price * order.quantity, currency)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Total */}
                    <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-200 bg-neutral-50">
                        <span className="text-sm font-medium text-neutral-500">Total</span>
                        <span className="text-lg font-semibold text-neutral-900">
                            {formatPriceWithCurrency(total, currency)}
                        </span>
                    </div>
                </div>

                {/* Shipping */}
                {(shippingName || shippingAddress) && (
                    <div className="bg-white border border-neutral-200 rounded-xl p-5">
                        <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 mb-3">
                            <MapPin className="w-4 h-4" />
                            Shipping
                        </h2>
                        {shippingName && (
                            <p className="text-sm text-neutral-900">{shippingName}</p>
                        )}
                        {shippingAddress && (
                            <p className="text-sm text-neutral-500 mt-0.5">{shippingAddress}</p>
                        )}
                    </div>
                )}

                {/* Order reference */}
                <p className="text-xs text-neutral-400 text-center">
                    Order reference: {sessionId.slice(0, 24)}...
                </p>

                {/* CTA */}
                <div className="text-center pt-2">
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
                    >
                        Create another poster
                    </Link>
                </div>
            </div>
        </main>
    );
}
