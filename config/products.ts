export type PrintSize = "A4" | "A3" | "A2" | "A1";

export interface PrintSizeConfig {
  label: string;
  price: number; // in cents
  stripePriceId: string | null;
  printfulVariantId: string | null;
  dimensions: string;
}

export const PRINT_SIZES: Record<PrintSize, PrintSizeConfig> = {
  A4: {
    label: "A4",
    price: 1500,
    stripePriceId: null,
    printfulVariantId: null,
    dimensions: "210 × 297 mm",
  },
  A3: {
    label: "A3",
    price: 2500,
    stripePriceId: null,
    printfulVariantId: null,
    dimensions: "297 × 420 mm",
  },
  A2: {
    label: "A2",
    price: 3900,
    stripePriceId: null,
    printfulVariantId: null,
    dimensions: "420 × 594 mm",
  },
  A1: {
    label: "A1",
    price: 5900,
    stripePriceId: null,
    printfulVariantId: null,
    dimensions: "594 × 841 mm",
  },
};

export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(0)}`;
}
