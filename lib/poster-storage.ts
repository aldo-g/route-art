// lib/poster-storage.ts
// Where poster files live in Supabase Storage. Shared by the upload-url and checkout routes.

export const POSTER_BUCKET = 'poster-images';

/** Full-resolution PNG sent to Printful. */
export const printFilePath = (posterId: string) => `${posterId}.png`;

/** Small PNG shown in the cart, Stripe Checkout, and the order page. */
export const previewFilePath = (posterId: string) => `${posterId}-preview.png`;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
