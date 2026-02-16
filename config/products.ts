export type ProductType = "poster" | "framed" | "canvas";
export type PrintSize = "A4" | "A3" | "A2" | "A1";

export interface ProductVariant {
  price: number; // in cents
  dimensions: string;
  printfulVariantId: string | null;
}

export interface ProductConfig {
  label: string;
  description: string;
  sizes: Partial<Record<PrintSize, ProductVariant>>;
}

export const PRODUCTS: Record<ProductType, ProductConfig> = {
  poster: {
    label: "Matte Poster",
    description: "Museum-quality archival matte paper (200gsm), giclée printed.",
    sizes: {
      A4: { price: 1500, dimensions: "210 × 297 mm", printfulVariantId: null },
      A3: { price: 2500, dimensions: "297 × 420 mm", printfulVariantId: null },
      A2: { price: 3900, dimensions: "420 × 594 mm", printfulVariantId: null },
      A1: { price: 5900, dimensions: "594 × 841 mm", printfulVariantId: null },
    },
  },
  framed: {
    label: "Framed Poster",
    description: "Matte poster in a sleek black frame with plexiglass front. Ready to hang.",
    sizes: {
      A4: { price: 3500, dimensions: "210 × 297 mm", printfulVariantId: null },
      A3: { price: 4900, dimensions: "297 × 420 mm", printfulVariantId: null },
      A2: { price: 6900, dimensions: "420 × 594 mm", printfulVariantId: null },
      A1: { price: 9900, dimensions: "594 × 841 mm", printfulVariantId: null },
    },
  },
  canvas: {
    label: "Canvas",
    description: "Gallery-wrapped canvas on 1.5\" wooden frame. No frame needed.",
    sizes: {
      A3: { price: 4500, dimensions: "297 × 420 mm", printfulVariantId: null },
      A2: { price: 6500, dimensions: "420 × 594 mm", printfulVariantId: null },
      A1: { price: 8900, dimensions: "594 × 841 mm", printfulVariantId: null },
    },
  },
};

// Backward-compatible helper: flat lookup for size config by type + size
export function getVariant(type: ProductType, size: PrintSize): ProductVariant | undefined {
  return PRODUCTS[type].sizes[size];
}

// Legacy PRINT_SIZES for any code that still references it
export const PRINT_SIZES: Record<PrintSize, { label: string; price: number; dimensions: string; stripePriceId: string | null; printfulVariantId: string | null }> = {
  A4: { label: "A4", price: 1500, stripePriceId: null, printfulVariantId: null, dimensions: "210 × 297 mm" },
  A3: { label: "A3", price: 2500, stripePriceId: null, printfulVariantId: null, dimensions: "297 × 420 mm" },
  A2: { label: "A2", price: 3900, stripePriceId: null, printfulVariantId: null, dimensions: "420 × 594 mm" },
  A1: { label: "A1", price: 5900, stripePriceId: null, printfulVariantId: null, dimensions: "594 × 841 mm" },
};

export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(0)}`;
}
