import { CURRENCIES } from './currency';

/**
 * Currency we ask Printful to quote shipping in.
 *
 * Printful's POST /shipping/rates accepts a `currency` field and converts from
 * the store currency itself. This store is configured in AUD (verified against
 * the live API on 2026-10-04: omitting the field returns AUD quotes), so asking
 * for EUR up front means quotes arrive in our base currency and no hardcoded
 * AUD→EUR rate is needed. Callers must still read `currency` off each quote and
 * convert via shippingQuoteToEurCents rather than assuming.
 */
export const PRINTFUL_QUOTE_CURRENCY = 'EUR';

export interface ShippingQuote {
    /** Decimal amount as a string, e.g. "4.93". */
    rate: string;
    /** ISO 4217 code as returned by Printful, e.g. "EUR". */
    currency: string;
}

/**
 * Convert a Printful shipping quote to EUR cents using the CURRENCIES table.
 * Works for whatever currency Printful actually returned, so a change to the
 * store currency setting can't silently misprice shipping.
 * Returns null if the amount is unparseable or the currency is unknown.
 */
export function shippingQuoteToEurCents(quote: ShippingQuote): number | null {
    const amount = parseFloat(quote.rate);
    if (!Number.isFinite(amount)) return null;

    const code = (quote.currency || '').toLowerCase();
    const config = Object.values(CURRENCIES).find(c => c.code === code);
    if (!config) return null;

    // CURRENCIES.rate is "units of this currency per EUR", for zero-decimal
    // currencies too, so dividing by it yields EUR regardless of decimals.
    return Math.round((amount / config.rate) * 100);
}

interface FallbackZone {
    /** EUR cents for the first item. */
    base: number;
    /** EUR cents added per additional item. */
    perExtraItem: number;
    minDays: number;
    maxDays: number;
}

/**
 * Fallback shipping used only when Printful cannot quote (API down, unknown
 * currency, empty response). Derived from live Printful EUR quotes sampled on
 * 2026-10-04 and rounded UP so an outage never undercharges:
 *   EU / UK / US / CA : €4.31–5.05 single item, ≈ +€0.25–1.10 for 3 extra items
 *   CH / NO           : €9.06 single item, ≈ +€1.10 for 3 extra items
 *   AU / NZ / JP      : €5.61 single item, up to +€3.40 (JP) for 3 extra items
 */
const FALLBACK_ZONES: Record<string, FallbackZone> = {
    core: { base: 600, perExtraItem: 100, minDays: 3, maxDays: 7 },
    europeNonEu: { base: 1100, perExtraItem: 150, minDays: 4, maxDays: 9 },
    apac: { base: 800, perExtraItem: 200, minDays: 5, maxDays: 14 },
    other: { base: 1200, perExtraItem: 200, minDays: 7, maxDays: 21 },
};

const COUNTRY_TO_ZONE: Record<string, keyof typeof FALLBACK_ZONES> = {
    AT: 'core', BE: 'core', BG: 'core', HR: 'core', CY: 'core', CZ: 'core',
    DK: 'core', EE: 'core', FI: 'core', FR: 'core', DE: 'core', GR: 'core',
    HU: 'core', IE: 'core', IT: 'core', LV: 'core', LT: 'core', LU: 'core',
    MT: 'core', NL: 'core', PL: 'core', PT: 'core', RO: 'core', SK: 'core',
    SI: 'core', ES: 'core', SE: 'core',
    GB: 'core', US: 'core', CA: 'core',
    CH: 'europeNonEu', NO: 'europeNonEu', IS: 'europeNonEu',
    AU: 'apac', NZ: 'apac', JP: 'apac',
};

export interface FallbackShipping {
    eurCents: number;
    minDays: number;
    maxDays: number;
}

/** Estimate shipping in EUR cents for a destination when no live quote is available. */
export function fallbackShipping(countryCode: string, itemCount: number): FallbackShipping {
    const zone = FALLBACK_ZONES[COUNTRY_TO_ZONE[countryCode.toUpperCase()] ?? 'other'];
    const extraItems = Math.max(0, Math.floor(itemCount) - 1);
    return {
        eurCents: zone.base + extraItems * zone.perExtraItem,
        minDays: zone.minDays,
        maxDays: zone.maxDays,
    };
}
