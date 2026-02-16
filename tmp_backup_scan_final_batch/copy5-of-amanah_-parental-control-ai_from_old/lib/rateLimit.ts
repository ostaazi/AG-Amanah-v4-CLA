import crypto from 'crypto';

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetSec: number;
};

function getEnv(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function stableKey(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 24);
}

/**
 * Recommended defaults:
 * - Preview: 60 requests/min per user/family
 * - Download: 20 requests/min per user/family
 */
export type RateLimitConfig = {
  limit: number; // max requests
  windowSec: number; // time window
  prefix: string; // key namespace
};

type BucketState = { count: number; windowStart: number };

// Memory fallback (DEV ONLY)
const mem = new Map<string, BucketState>();

async function memoryLimit(key: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = mem.get(key);

  if (!bucket || now - bucket.windowStart >= cfg.windowSec) {
    mem.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: cfg.limit - 1, resetSec: cfg.windowSec };
  }

  const count = bucket.count + 1;
  bucket.count = count;
  mem.set(key, bucket);

  const remaining = Math.max(0, cfg.limit - count);
  const resetSec = Math.max(1, cfg.windowSec - (now - bucket.windowStart));

  return { ok: count <= cfg.limit, remaining, resetSec };
}

async function redisLimit(key: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const redisUrl = getEnv('RATE_LIMIT_REDIS_URL');
  if (!redisUrl) return memoryLimit(key, cfg);

  // In a real environment, we would use a singleton client. 
  // Importing dynamically to handle environments without redis installed.
  const { createClient } = await import('redis');
  const client = createClient({ url: redisUrl });

  await client.connect();

  try {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `${cfg.prefix}:${key}:${Math.floor(now / cfg.windowSec)}`;
    const count = await client.incr(windowKey);

    if (count === 1) {
      await client.expire(windowKey, cfg.windowSec);
    }

    const remaining = Math.max(0, cfg.limit - Number(count));
    const resetSec = cfg.windowSec - (now % cfg.windowSec);

    return { ok: Number(count) <= cfg.limit, remaining, resetSec };
  } finally {
    await client.disconnect();
  }
}

export async function rateLimit(
  rawKey: string,
  cfg: RateLimitConfig
): Promise<RateLimitResult> {
  const key = stableKey(rawKey);
  const mode = (getEnv('RATE_LIMIT_DRIVER', 'auto') || 'auto').toLowerCase();

  if (mode === 'redis') return redisLimit(key, cfg);
  if (mode === 'memory') return memoryLimit(key, cfg);

  const hasRedis = Boolean(getEnv('RATE_LIMIT_REDIS_URL'));
  return hasRedis ? redisLimit(key, cfg) : memoryLimit(key, cfg);
}
