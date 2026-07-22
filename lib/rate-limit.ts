import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

let redis: Redis | null = null;

function getRedis(): Redis | null {
    if (redis) return redis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    redis = new Redis({ url, token });
    return redis;
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, requests: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`): Ratelimit | null {
    const client = getRedis();
    if (!client) return null;

    const cached = limiters.get(name);
    if (cached) return cached;

    const limiter = new Ratelimit({
        redis: client,
        limiter: Ratelimit.slidingWindow(requests, window),
        prefix: `ratelimit:${name}`,
        analytics: false,
    });
    limiters.set(name, limiter);
    return limiter;
}

function getClientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) return forwardedFor.split(',')[0].trim();
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;
    return 'unknown';
}

interface RateLimitOptions {
    name: string;
    requests: number;
    window: `${number} ${'s' | 'm' | 'h' | 'd'}`;
    identifier?: (request: NextRequest) => string;
}

/**
 * Returns a NextResponse (429) if the request should be blocked, or null to proceed.
 * If Upstash env vars aren't configured, this fails open (no rate limiting) rather
 * than breaking the route — but logs a warning so misconfiguration is visible.
 */
export async function checkRateLimit(request: NextRequest, options: RateLimitOptions): Promise<NextResponse | null> {
    const limiter = getLimiter(options.name, options.requests, options.window);

    if (!limiter) {
        console.warn(`Rate limiting disabled for "${options.name}": UPSTASH_REDIS_REST_URL/TOKEN not set`);
        return null;
    }

    const identifier = options.identifier ? options.identifier(request) : getClientIp(request);
    const { success, limit, remaining, reset } = await limiter.limit(`${options.name}:${identifier}`);

    if (!success) {
        return NextResponse.json(
            { error: 'Too many requests, please try again later.' },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': String(limit),
                    'X-RateLimit-Remaining': String(remaining),
                    'X-RateLimit-Reset': String(reset),
                    'Retry-After': String(Math.max(0, Math.ceil((reset - Date.now()) / 1000))),
                },
            }
        );
    }

    return null;
}
