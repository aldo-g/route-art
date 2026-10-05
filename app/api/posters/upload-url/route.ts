import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { PRODUCTS, ProductType, PrintSize, getPrintTarget } from '@/config/products';
import { POSTER_BUCKET, printFilePath, previewFilePath } from '@/lib/poster-storage';

/**
 * Issue signed upload URLs so the browser can push the print file and its
 * thumbnail straight to Supabase Storage. Print files are tens of megabytes,
 * far beyond what a Vercel function body may carry, so they never pass
 * through our API routes.
 *
 * Flow:
 *   1. Client POSTs product details here and gets a poster id plus two signed URLs.
 *   2. Client PUTs the PNG print file and the preview to those URLs.
 *   3. Checkout receives the poster id and verifies the print file exists in storage.
 */

interface UploadUrlRequest {
    routeName?: unknown;
    productType?: unknown;
    size?: unknown;
    config?: unknown;
}

export async function POST(request: NextRequest) {
    const rateLimitResponse = await checkRateLimit(request, {
        name: 'poster-upload-url',
        requests: 20,
        window: '1 m',
    });
    if (rateLimitResponse) return rateLimitResponse;

    let body: UploadUrlRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const productType = body.productType as ProductType;
    const size = body.size as PrintSize;
    if (!PRODUCTS[productType]?.sizes[size]) {
        return NextResponse.json({ error: 'Invalid product or size' }, { status: 400 });
    }

    const routeName = typeof body.routeName === 'string' && body.routeName.trim()
        ? body.routeName.trim().slice(0, 200)
        : 'Custom Print';

    const config = body.config && typeof body.config === 'object' && !Array.isArray(body.config)
        ? (body.config as Record<string, unknown>)
        : {};
    if (JSON.stringify(config).length > 10_000) {
        return NextResponse.json({ error: 'Config too large' }, { status: 400 });
    }

    const posterId = crypto.randomUUID();
    const printPath = printFilePath(posterId);
    const previewPath = previewFilePath(posterId);

    try {
        const supabase = getSupabase();
        const bucket = supabase.storage.from(POSTER_BUCKET);

        const [printSigned, previewSigned] = await Promise.all([
            bucket.createSignedUploadUrl(printPath),
            bucket.createSignedUploadUrl(previewPath),
        ]);

        if (printSigned.error || !printSigned.data) throw printSigned.error ?? new Error('No signed URL');
        if (previewSigned.error || !previewSigned.data) throw previewSigned.error ?? new Error('No signed URL');

        const imageUrl = bucket.getPublicUrl(printPath).data.publicUrl;
        const previewUrl = bucket.getPublicUrl(previewPath).data.publicUrl;

        const { error: dbError } = await supabase.from('posters').insert({
            id: posterId,
            route_name: routeName,
            image_url: imageUrl,
            preview_url: previewUrl,
            config: {
                ...config,
                productType,
                size,
                printTarget: getPrintTarget(productType, size),
            },
        });
        if (dbError) throw dbError;

        return NextResponse.json({
            posterId,
            imageUrl,
            previewUrl,
            printUpload: { url: printSigned.data.signedUrl, path: printPath },
            previewUpload: { url: previewSigned.data.signedUrl, path: previewPath },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Poster upload-url error:', message, err);
        return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 });
    }
}
