/**
 * redis.js — Singleton Redis TCP Client for Express Backend API
 * Supports TLS (rediss://) with Server Name Indication (SNI) for Upstash & Cloud Redis.
 */

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'rediss://default:********@cuddly-possum-217024.upstash.io:6379';

let client = null;
let isReady = false;

function initRedis() {
  const isTest = process.env.NODE_ENV === 'test'
    || process.argv?.some((arg) => arg.includes('test'))
    || Boolean(process.env.VITEST)
    || Boolean(process.env.JEST_WORKER_ID);

  if (!REDIS_URL || (isTest && !process.env.REDIS_TEST_ENABLED)) {
    return;
  }

  try {
    const options = {
      maxRetriesPerRequest: 1,
      connectTimeout: 6000,
      lazyConnect: true,
      enableAutoPipelining: true,
      retryStrategy: (times) => {
        if (times > 10) return 10000;
        return Math.min(times * 200, 3000);
      },
    };

    if (REDIS_URL.startsWith('rediss://')) {
      try {
        const { URL } = require('url');
        const parsed = new URL(REDIS_URL);
        options.tls = {
          servername: parsed.hostname,
          rejectUnauthorized: false,
        };
      } catch {
        options.tls = { rejectUnauthorized: false };
      }
    }

    client = new Redis(REDIS_URL, options);

    client.on('connect', () => {
      console.log('⚡ [Backend Redis TCP] Connected to cache DB');
    });

    client.on('ready', () => {
      isReady = true;
      console.log('✅ [Backend Redis TCP] Ready for sub-millisecond profile caching');
    });

    client.on('error', (err) => {
      isReady = false;
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ [Backend Redis TCP] Warning:', err.message);
      }
    });

    client.on('close', () => {
      isReady = false;
    });

    client.connect().catch((err) => {
      isReady = false;
      console.warn('ℹ️ [Backend Redis TCP] Initial connection deferred:', err.message);
    });
  } catch (err) {
    console.warn('⚠️ [Backend Redis TCP] Failed to initialize:', err.message);
    client = null;
    isReady = false;
  }
}

initRedis();

module.exports = {
  getClient: () => client,
  isConnected: () => isReady && client && client.status === 'ready',
};
