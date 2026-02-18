// lib/tile-cache.ts
// In-memory LRU cache for Mapbox tile data to reduce API calls

interface CacheEntry {
    data: ArrayBuffer;
    timestamp: number;
}

class TileCache {
    private cache = new Map<string, CacheEntry>();
    private maxEntries: number;
    private ttlMs: number;
    private hits = 0;
    private misses = 0;

    constructor({ maxEntries = 500, ttlMs = 24 * 60 * 60 * 1000 } = {}) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
    }

    get(key: string): ArrayBuffer | null {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }

        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.hits++;
        return entry.data;
    }

    set(key: string, data: ArrayBuffer): void {
        // Delete first to reset position if key exists
        this.cache.delete(key);

        // Evict oldest entries if at capacity
        while (this.cache.size >= this.maxEntries) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
        }

        this.cache.set(key, { data, timestamp: Date.now() });
    }

    get size(): number {
        return this.cache.size;
    }

    getStats() {
        const total = this.hits + this.misses;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : 'N/A',
            cached: this.cache.size,
        };
    }
}

export const tileCache = new TileCache();
