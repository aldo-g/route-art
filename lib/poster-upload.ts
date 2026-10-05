// lib/poster-upload.ts
// Browser-side upload of a rendered print file to Supabase Storage via signed URLs.

import type { ProductType, PrintSize } from '@/config/products';

export interface UploadedPoster {
    posterId: string;
    imageUrl: string;
    previewUrl: string;
}

interface UploadUrlResponse {
    posterId: string;
    imageUrl: string;
    previewUrl: string;
    printUpload: { url: string; path: string };
    previewUpload: { url: string; path: string };
    error?: string;
}

export interface UploadProgress {
    /** Which file is in flight. */
    stage: 'preparing' | 'print' | 'preview' | 'done';
    /** 0–1 for the current file, when the browser reports it. */
    fraction: number | null;
}

/**
 * PUT a blob to a Supabase signed upload URL, reporting upload progress.
 * Uses XMLHttpRequest because fetch exposes no upload progress events, and
 * print files are large enough that a silent wait feels like a hang.
 */
function putToSignedUrl(url: string, blob: Blob, onProgress?: (fraction: number | null) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('cache-control', 'max-age=3600');
        xhr.upload.onprogress = (e) => {
            onProgress?.(e.lengthComputable ? e.loaded / e.total : null);
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
        };
        xhr.onerror = () => reject(new Error('Upload failed: network error'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));
        xhr.send(blob);
    });
}

export async function uploadPoster(params: {
    routeName: string;
    productType: ProductType;
    size: PrintSize;
    config: Record<string, unknown>;
    printBlob: Blob;
    previewBlob: Blob;
    onProgress?: (progress: UploadProgress) => void;
}): Promise<UploadedPoster> {
    const { onProgress } = params;
    onProgress?.({ stage: 'preparing', fraction: null });

    const res = await fetch('/api/posters/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            routeName: params.routeName,
            productType: params.productType,
            size: params.size,
            config: params.config,
        }),
    });
    const data: UploadUrlResponse = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Could not prepare upload');
    }

    onProgress?.({ stage: 'print', fraction: 0 });
    await putToSignedUrl(data.printUpload.url, params.printBlob, (fraction) =>
        onProgress?.({ stage: 'print', fraction })
    );

    onProgress?.({ stage: 'preview', fraction: 0 });
    await putToSignedUrl(data.previewUpload.url, params.previewBlob, (fraction) =>
        onProgress?.({ stage: 'preview', fraction })
    );

    onProgress?.({ stage: 'done', fraction: 1 });
    return { posterId: data.posterId, imageUrl: data.imageUrl, previewUrl: data.previewUrl };
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
}
