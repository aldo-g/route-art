import type Stripe from 'stripe';

/**
 * Session-level money totals (smallest currency unit) persisted onto every order row
 * for the session, so the order page and bookkeeping can show what the customer paid.
 */
export interface OrderTotals {
    amount_subtotal: number | null;
    amount_tax: number | null;
    amount_shipping: number | null;
    amount_total: number | null;
}

export function getOrderTotals(session: Stripe.Checkout.Session): OrderTotals {
    return {
        amount_subtotal: session.amount_subtotal ?? null,
        amount_tax: session.total_details?.amount_tax ?? null,
        amount_shipping: session.total_details?.amount_shipping ?? null,
        amount_total: session.amount_total ?? null,
    };
}
