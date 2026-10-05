/**
 * Stripe Tax configuration.
 *
 * Tax is calculated by Stripe Tax at checkout from the customer's shipping address.
 * Stripe only charges tax in jurisdictions where a registration has been added in
 * the Stripe Dashboard (Settings → Tax → Registrations), so this code is only half
 * of the setup — see README "Tax (Stripe Tax)" for the dashboard checklist.
 */

/** Stripe product tax code for prints, framed prints and canvases: "General – Tangible Goods". */
export const PRODUCT_TAX_CODE = 'txcd_99999999';

/** Stripe tax code for shipping charges. Shipping is taxed at the rate of the goods it accompanies. */
export const SHIPPING_TAX_CODE = 'txcd_92010001';

export type TaxBehavior = 'inclusive' | 'exclusive';

/**
 * Currencies whose markets expect tax to be added on top of the displayed price
 * (US sales tax, Canadian GST/HST). Everywhere else (EU, UK, CH, NO, AU, NZ, JP, …)
 * consumer-protection rules expect the displayed price to be the final, tax-inclusive price.
 */
const TAX_EXCLUSIVE_CURRENCIES = new Set(['usd', 'cad']);

/**
 * Whether the catalogue price for a given currency already contains tax.
 * - inclusive: the displayed price is what the customer pays; Stripe backs VAT out of it.
 * - exclusive: Stripe adds sales tax on top of the displayed price at checkout.
 */
export function getTaxBehavior(currencyCode: string): TaxBehavior {
    return TAX_EXCLUSIVE_CURRENCIES.has(currencyCode.toLowerCase()) ? 'exclusive' : 'inclusive';
}

/** Short note shown next to prices so customers know how tax is handled before checkout. */
export function getTaxNote(currencyCode: string): string {
    return getTaxBehavior(currencyCode) === 'exclusive'
        ? 'Sales tax calculated at checkout'
        : 'Includes VAT where applicable';
}

/**
 * Automatic tax is on by default. Set STRIPE_AUTOMATIC_TAX=false to create sessions
 * without it (e.g. local development against a Stripe account where Tax isn't activated —
 * Stripe rejects automatic_tax sessions until Tax is enabled in the Dashboard).
 */
export function isAutomaticTaxEnabled(): boolean {
    return process.env.STRIPE_AUTOMATIC_TAX !== 'false';
}
