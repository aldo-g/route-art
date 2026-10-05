// lib/raster.ts
// Browser-side helpers for turning the poster SVG into raster images.
// Used for the PNG/PDF downloads, the cart thumbnail, and the print file sent to Printful.

export const POSTER_BACKGROUND = '#f8f7f4';

/**
 * Clone the live SVG with explicit dimensions and inline any external <image> hrefs
 * as data URLs so the browser can rasterize it without CORS tainting the canvas.
 * Returns an object URL that the caller must revoke.
 */
export async function svgToObjectUrl(svgElement: SVGSVGElement, width: number, height: number): Promise<string> {
    const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('width', width.toString());
    svgClone.setAttribute('height', height.toString());
    svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const images = svgClone.querySelectorAll('image');
    for (const img of images) {
        const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            try {
                const response = await fetch(href);
                const blob = await response.blob();
                const dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                img.setAttribute('href', dataUrl);
                img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
            } catch (e) {
                console.warn('Failed to convert image to data URL:', href, e);
            }
        }
    }

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    return URL.createObjectURL(svgBlob);
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load SVG for rasterization'));
        img.src = url;
    });
}

/**
 * Rasterize the SVG to a canvas of exactly targetWidth × targetHeight pixels.
 * Browsers re-rasterize SVG images at the destination size, so vector content
 * (contours, route, text) stays sharp at any scale; only embedded rasters are upscaled.
 */
export async function rasterizeSvg(
    svgElement: SVGSVGElement,
    width: number,
    height: number,
    targetWidth: number,
    targetHeight: number,
    background: string = POSTER_BACKGROUND,
): Promise<HTMLCanvasElement> {
    const svgUrl = await svgToObjectUrl(svgElement, width, height);
    try {
        const img = await loadImage(svgUrl);
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error(
                `This browser could not allocate a ${targetWidth}×${targetHeight} canvas. Try a smaller size or a desktop browser.`
            );
        }
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas;
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string = 'image/png', quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('The browser ran out of memory encoding the image. Try a smaller print size or a desktop browser.'));
        }, type, quality);
    });
}

/**
 * Largest canvas area (in pixels) we are willing to allocate in this browser.
 * iOS Safari refuses canvases above ~16.7 MP; desktop browsers go much higher but
 * encoding a PNG of tens of megapixels can still exhaust memory on modest machines.
 */
export function maxCanvasPixels(): number {
    if (typeof navigator === 'undefined') return 40_000_000;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) return 16_000_000;
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg/.test(ua);
    if (isSafari) return 24_000_000;
    return 40_000_000;
}

export interface FitResult {
    width: number;
    height: number;
    /** Effective DPI across the print area, after any browser-imposed cap. */
    dpi: number;
}

/**
 * Compute the pixel size for a print file: scale the artwork (sourceWidth × sourceHeight,
 * any aspect) so it fits inside the print box, rotating the box to match the artwork's
 * orientation, then cap the total area at what this browser can rasterize.
 */
export function fitPrintSize(
    sourceWidth: number,
    sourceHeight: number,
    printWidthPx: number,
    printHeightPx: number,
    printDpi: number,
    maxPixels: number = maxCanvasPixels(),
): FitResult {
    const artworkIsLandscape = sourceWidth > sourceHeight;
    const boxW = artworkIsLandscape ? Math.max(printWidthPx, printHeightPx) : Math.min(printWidthPx, printHeightPx);
    const boxH = artworkIsLandscape ? Math.min(printWidthPx, printHeightPx) : Math.max(printWidthPx, printHeightPx);

    const fullScale = Math.min(boxW / sourceWidth, boxH / sourceHeight);
    let scale = fullScale;
    const area = sourceWidth * scale * sourceHeight * scale;
    if (area > maxPixels) {
        scale *= Math.sqrt(maxPixels / area);
    }

    const width = Math.floor(sourceWidth * scale);
    const height = Math.floor(sourceHeight * scale);
    // If the cap bit, the file covers the same physical area at proportionally fewer dots per inch.
    const dpi = Math.round(printDpi * (scale / fullScale));
    return { width, height, dpi };
}
