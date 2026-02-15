export type OrderStatus = 'pending' | 'paid' | 'fulfilled';

export interface Order {
    id: string;
    stripe_session_id: string;
    route_id: string;
    route_name: string;
    size: string;
    image_url: string;
    price: number;
    status: OrderStatus;
    created_at: string;
}

// In-memory store for development. Replace with a real database (e.g. Supabase, Postgres) for production.
const orders: Map<string, Order> = new Map();

export function createOrder(order: Omit<Order, 'id' | 'created_at'>): Order {
    const id = crypto.randomUUID();
    const newOrder: Order = {
        ...order,
        id,
        created_at: new Date().toISOString(),
    };
    orders.set(id, newOrder);
    return newOrder;
}

export function getOrderByStripeSession(sessionId: string): Order | undefined {
    for (const order of orders.values()) {
        if (order.stripe_session_id === sessionId) return order;
    }
    return undefined;
}

export function updateOrderStatus(id: string, status: OrderStatus): Order | undefined {
    const order = orders.get(id);
    if (order) {
        order.status = status;
        orders.set(id, order);
    }
    return order;
}

export function getOrder(id: string): Order | undefined {
    return orders.get(id);
}
