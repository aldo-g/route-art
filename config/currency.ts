export interface CurrencyConfig {
    code: string;       // ISO 4217 currency code (lowercase for Stripe)
    symbol: string;     // Display symbol
    rate: number;       // Multiplier from EUR base price
    zeroDecimal: boolean; // Whether this is a zero-decimal currency (JPY, ISK, etc.)
}

// Supported currencies with approximate conversion rates from EUR
export const CURRENCIES: Record<string, CurrencyConfig> = {
    EUR: { code: 'eur', symbol: '€', rate: 1.00, zeroDecimal: false },
    GBP: { code: 'gbp', symbol: '£', rate: 0.85, zeroDecimal: false },
    USD: { code: 'usd', symbol: '$', rate: 1.08, zeroDecimal: false },
    CHF: { code: 'chf', symbol: 'CHF ', rate: 0.95, zeroDecimal: false },
    NOK: { code: 'nok', symbol: 'kr ', rate: 11.50, zeroDecimal: false },
    ISK: { code: 'isk', symbol: 'kr ', rate: 150.00, zeroDecimal: true },
    CAD: { code: 'cad', symbol: 'CA$', rate: 1.48, zeroDecimal: false },
    AUD: { code: 'aud', symbol: 'A$', rate: 1.65, zeroDecimal: false },
    NZD: { code: 'nzd', symbol: 'NZ$', rate: 1.80, zeroDecimal: false },
    JPY: { code: 'jpy', symbol: '¥', rate: 162.00, zeroDecimal: true },
    SEK: { code: 'sek', symbol: 'kr ', rate: 11.20, zeroDecimal: false },
    DKK: { code: 'dkk', symbol: 'kr ', rate: 7.46, zeroDecimal: false },
    PLN: { code: 'pln', symbol: 'zł ', rate: 4.30, zeroDecimal: false },
    CZK: { code: 'czk', symbol: 'Kč ', rate: 25.20, zeroDecimal: false },
    HUF: { code: 'huf', symbol: 'Ft ', rate: 395.00, zeroDecimal: true },
    RON: { code: 'ron', symbol: 'lei ', rate: 4.97, zeroDecimal: false },
    BGN: { code: 'bgn', symbol: 'лв ', rate: 1.96, zeroDecimal: false },
};

// Map country codes to their currency
const COUNTRY_TO_CURRENCY: Record<string, string> = {
    // Eurozone
    AT: 'EUR', BE: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR', FR: 'EUR',
    DE: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LV: 'EUR', LT: 'EUR',
    LU: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SK: 'EUR', SI: 'EUR',
    ES: 'EUR', HR: 'EUR',
    // Non-euro Europe
    GB: 'GBP',
    CH: 'CHF',
    NO: 'NOK',
    IS: 'ISK',
    SE: 'SEK',
    DK: 'DKK',
    PL: 'PLN',
    CZ: 'CZK',
    HU: 'HUF',
    RO: 'RON',
    BG: 'BGN',
    // Rest of world
    US: 'USD',
    CA: 'CAD',
    AU: 'AUD',
    NZ: 'NZD',
    JP: 'JPY',
};

export function getCurrencyForCountry(countryCode: string | null | undefined): CurrencyConfig {
    if (!countryCode) return CURRENCIES.EUR;
    const currencyCode = COUNTRY_TO_CURRENCY[countryCode.toUpperCase()];
    return CURRENCIES[currencyCode] || CURRENCIES.EUR;
}

/**
 * Convert a EUR price in cents to target currency.
 * Returns the amount in the smallest currency unit (cents, or whole units for zero-decimal).
 */
export function convertPrice(eurCents: number, currency: CurrencyConfig): number {
    const converted = eurCents * currency.rate;
    if (currency.zeroDecimal) {
        // For zero-decimal currencies, Stripe expects whole units
        return Math.round(converted / 100);
    }
    return Math.round(converted);
}

/** Format a converted price for display */
export function formatPriceWithCurrency(amount: number, currency: CurrencyConfig): string {
    if (currency.zeroDecimal) {
        return `${currency.symbol}${amount.toLocaleString()}`;
    }
    const value = amount / 100;
    const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);
    return `${currency.symbol}${formatted}`;
}
