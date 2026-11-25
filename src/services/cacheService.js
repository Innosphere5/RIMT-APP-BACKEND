/**
 * cacheService.js — High-Performance Cache Service for BACKEND-RIMT-API
 * ======================================================================
 * Cache-Aside, Single-Flight Stampede Guard, TTL Jittering, and Dual-Tier Fallback.
 */

const { getClient, isConnected } = require('../config/redis');

const localMemoryFallback = new Map();
const inFlightRequests = new Map();

class CacheService {
  /**
   * Cache-Aside getOrSet with single-flight mutex
   * @param {string} key
   * @param {Function} fetcher
   * @param {number} ttlSeconds
   */
  static async getOrSet(key, fetcher, ttlSeconds = 3600) {
    if (!key) return await fetcher();

    // 1. Try L2 Redis TCP
    if (isConnected()) {
      try {
        const client = getClient();
        const raw = await client.get(key);
        if (raw !== null && raw !== undefined) {
          return JSON.parse(raw);
        }
      } catch (err) {
        console.warn(`[Backend Cache] Redis GET error on "${key}":`, err.message);
      }
    }

    // 2. Try L1 Local Memory
    const localHit = localMemoryFallback.get(key);
    if (localHit && localHit.expiresAt > Date.now()) {
      return localHit.data;
    }

    // 3. Stampede Guard
    if (inFlightRequests.has(key)) {
      return await inFlightRequests.get(key);
    }

    const fetchPromise = (async () => {
      try {
        const freshData = await fetcher();

        if (freshData !== null && freshData !== undefined) {
          const jitter = Math.floor(Math.random() * Math.max(1, ttlSeconds * 0.1));
          const effectiveTtl = ttlSeconds + jitter;

          localMemoryFallback.set(key, {
            data: freshData,
            expiresAt: Date.now() + effectiveTtl * 1000,
          });

          if (isConnected()) {
            try {
              const client = getClient();
              await client.set(key, JSON.stringify(freshData), 'EX', effectiveTtl);
            } catch (writeErr) {
              console.warn(`[Backend Cache] Redis SET error on "${key}":`, writeErr.message);
            }
          }
        }

        return freshData;
      } finally {
        inFlightRequests.delete(key);
      }
    })();

    inFlightRequests.set(key, fetchPromise);
    return await fetchPromise;
  }

  /**
   * Invalidate one or more keys
   */
  static async invalidate(...keys) {
    if (!keys || keys.length === 0) return;

    for (const k of keys) {
      if (k) localMemoryFallback.delete(k);
    }

    if (isConnected()) {
      try {
        const client = getClient();
        await client.del(...keys.filter(Boolean));
      } catch (err) {
        console.warn('[Backend Cache] Redis DEL error:', err.message);
      }
    }
  }

  /**
   * Invalidate wildcard pattern
   */
  static async invalidatePattern(pattern) {
    if (!pattern) return;

    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    for (const k of localMemoryFallback.keys()) {
      if (regex.test(k)) localMemoryFallback.delete(k);
    }

    if (isConnected()) {
      try {
        const client = getClient();
        const stream = client.scanStream({ match: pattern, count: 100 });
        stream.on('data', async (keys) => {
          if (keys.length) await client.del(...keys);
        });
      } catch (err) {
        console.warn('[Backend Cache] Pattern scan error:', err.message);
      }
    }
  }
}

module.exports = CacheService;
