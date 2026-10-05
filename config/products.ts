export type ProductType = "poster" | "framed" | "canvas";
/**
 * Size tier keys. These are stable identifiers stored in carts and orders, NOT paper sizes:
 * only the A2 and A1 poster/framed variants are actually ISO A-series. Use `label` and
 * `dimensions` for anything customer-facing.
 */
export type PrintSize = "A4" | "A3" | "A2" | "A1";

export interface ProductVariant {
  /** Short size name shown to customers, e.g. "21×30" or "A2". */
  label: string;
  price: number; // in cents
  dimensions: string;
  printfulVariantId: string | null;
  /** Physical print area of the Printful variant, portrait orientation. */
  printWidthMm: number;
  printHeightMm: number;
}

export interface ProductConfig {
  label: string;
  description: string;
  printfulProductId: number;
  sizes: Partial<Record<PrintSize, ProductVariant>>;
}

export const PRODUCTS: Record<ProductType, ProductConfig> = {
  poster: {
    label: "Matte Poster",
    description: "Personalised archival matte paper (200gsm), giclée printed.",
    printfulProductId: 268, // Enhanced Matte Paper Poster (cm)
    sizes: {
      A4: { label: "21×30", price: 1500, dimensions: "21 × 30 cm", printfulVariantId: "8947", printWidthMm: 210, printHeightMm: 300 },   // 21×30 cm
      A3: { label: "30×40", price: 2500, dimensions: "30 × 40 cm", printfulVariantId: "8948", printWidthMm: 300, printHeightMm: 400 },   // 30×40 cm
      A2: { label: "A2", price: 3900, dimensions: "42 × 59.4 cm", printfulVariantId: "19516", printWidthMm: 420, printHeightMm: 594 },  // A2 (42×59.4 cm)
      A1: { label: "A1", price: 5900, dimensions: "59.4 × 84.1 cm", printfulVariantId: "19515", printWidthMm: 594, printHeightMm: 841 },  // A1 (59.4×84.1 cm)
    },
  },
  framed: {
    label: "Framed Poster",
    description: "Matte poster in a sleek black frame with plexiglass front. Ready to hang.",
    printfulProductId: 304, // Enhanced Matte Paper Framed Poster (cm)
    sizes: {
      A4: { label: "21×30", price: 3500, dimensions: "21 × 30 cm", printfulVariantId: "9356", printWidthMm: 210, printHeightMm: 300 },   // 21×30 cm Black
      A3: { label: "30×40", price: 4900, dimensions: "30 × 40 cm", printfulVariantId: "9357", printWidthMm: 300, printHeightMm: 400 },   // 30×40 cm Black
      A2: { label: "A2", price: 6900, dimensions: "42 × 59.4 cm", printfulVariantId: "19643", printWidthMm: 420, printHeightMm: 594 },  // A2 Black
      A1: { label: "A1", price: 9900, dimensions: "59.4 × 84.1 cm", printfulVariantId: "19642", printWidthMm: 594, printHeightMm: 841 },  // A1 Black
    },
  },
  canvas: {
    label: "Canvas",
    description: "Gallery-wrapped canvas on 1.5\" wooden frame. No frame needed.",
    printfulProductId: 3, // Canvas (in)
    sizes: {
      A3: { label: "12×16″", price: 4500, dimensions: "12 × 16 in", printfulVariantId: "5", printWidthMm: 305, printHeightMm: 406 },       // 12″×16″
      A2: { label: "16×24″", price: 6500, dimensions: "16 × 24 in", printfulVariantId: "19303", printWidthMm: 406, printHeightMm: 610 },   // 16″×24″
      A1: { label: "24×36″", price: 8900, dimensions: "24 × 36 in", printfulVariantId: "825", printWidthMm: 610, printHeightMm: 914 },     // 24″×36″
    },
  },
};

/**
 * Artwork proportions (height ÷ width, portrait) used when no print variant is selected,
 * i.e. while designing and for the free PNG download: ISO A-series, 1:√2.
 */
export const DEFAULT_PRINT_ASPECT = Math.SQRT2;

/**
 * Height ÷ width of a variant's print area in portrait orientation. The on-screen artwork
 * is laid out at exactly this ratio while a print is being chosen, so the file sent to
 * Printful fills the print area edge to edge with no stretching, cropping or bars.
 */
export function getPrintAspect(type: ProductType, size: PrintSize): number {
  const variant = PRODUCTS[type].sizes[size];
  return variant ? variant.printHeightMm / variant.printWidthMm : DEFAULT_PRINT_ASPECT;
}

/** Target resolution for print files sent to Printful. 300 DPI is their recommended quality. */
export const PRINT_DPI = 300;

export interface PrintTarget {
  /** Pixel size of the print area at PRINT_DPI, portrait orientation. */
  widthPx: number;
  heightPx: number;
  dpi: number;
}

/**
 * Pixel dimensions a print file should have for a given product variant.
 * The artwork keeps its own aspect ratio and is rendered to fit inside this box
 * (rotated to match the artwork's orientation), so this is an upper bound, not an exact size.
 */
export function getPrintTarget(type: ProductType, size: PrintSize): PrintTarget | undefined {
  const variant = PRODUCTS[type].sizes[size];
  if (!variant) return undefined;
  const pxPerMm = PRINT_DPI / 25.4;
  return {
    widthPx: Math.round(variant.printWidthMm * pxPerMm),
    heightPx: Math.round(variant.printHeightMm * pxPerMm),
    dpi: PRINT_DPI,
  };
}

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
