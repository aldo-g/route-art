'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CurrencyConfig, CURRENCIES, convertPrice, formatPriceWithCurrency } from '@/config/currency';

interface CurrencyContextValue {
    currency: CurrencyConfig;
    countryCode: string | null;
    /** Convert a EUR price in cents and format for display */
    formatPrice: (eurCents: number) => string;
    /** Convert EUR cents to local currency smallest unit */
    convert: (eurCents: number) => number;
    loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
    currency: CURRENCIES.EUR,
    countryCode: null,
    formatPrice: (eurCents: number) => `€${(eurCents / 100).toFixed(0)}`,
    convert: (eurCents: number) => eurCents,
    loading: true,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrency] = useState<CurrencyConfig>(CURRENCIES.EUR);
    const [countryCode, setCountryCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/detect-currency')
            .then(res => res.json())
            .then(data => {
                if (data.currency && data.symbol) {
                    setCurrency({
                        code: data.currency,
                        symbol: data.symbol,
                        rate: data.rate,
                        zeroDecimal: data.zeroDecimal,
                    });
                }
                if (data.countryCode) {
                    setCountryCode(data.countryCode);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const value: CurrencyContextValue = {
        currency,
        countryCode,
        formatPrice: (eurCents: number) => formatPriceWithCurrency(convertPrice(eurCents, currency), currency),
        convert: (eurCents: number) => convertPrice(eurCents, currency),
        loading,
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    return useContext(CurrencyContext);
}
