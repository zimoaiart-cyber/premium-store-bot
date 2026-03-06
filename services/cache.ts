/**
 * Cache Service (In-Memory)
 * For high-performance data caching
 * Note: Redis removed for Deno Deploy compatibility
 */

let cacheEnabled = false;

// In-memory cache as fallback
const memoryCache = new Map<string, { value: unknown; expiry: number }>();

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export async function initCache(config?: CacheConfig): Promise<void> {
  const redisUrl = Deno.env.get("REDIS_URL");
  
  if (redisUrl) {
    // Redis not available on Deno Deploy, skip
    console.log("ℹ️ Redis URL found but not available on Deno Deploy, using in-memory cache");
  }
  
  // Enable in-memory cache
  cacheEnabled = true;
  console.log("✅ In-memory cache enabled");
  
  // Cleanup expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of memoryCache.entries()) {
      if (data.expiry < now) {
        memoryCache.delete(key);
      }
    }
  }, 300000);
}

export function getCache(): Map<string, { value: unknown; expiry: number }> | null {
  return cacheEnabled ? memoryCache : null;
}

export async function closeCache(): Promise<void> {
  memoryCache.clear();
  cacheEnabled = false;
  console.log("Cache closed");
}

// Cache helpers
export async function get<T>(key: string): Promise<T | null> {
  if (!cacheEnabled) return null;
  
  const data = memoryCache.get(key);
  if (!data || data.expiry < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  
  return data.value as T;
}

export async function set<T>(
  key: string,
  value: T,
  ttlSeconds: number = 3600
): Promise<void> {
  if (!cacheEnabled) return;
  
  const expiry = Date.now() + (ttlSeconds * 1000);
  memoryCache.set(key, { value, expiry });
}

export async function del(key: string): Promise<void> {
  if (!cacheEnabled) return;
  
  memoryCache.delete(key);
}

export async function invalidatePattern(pattern: string): Promise<void> {
  if (!cacheEnabled) return;
  
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}

// Specific cache functions for the bot
export interface CachedProduct {
  id: string;
  name: string;
  price: number;
  category: string;
}

export async function cacheProduct(product: CachedProduct): Promise<void> {
  await set(`product:${product.id}`, product, 3600); // 1 hour TTL
}

export async function getProductFromCache(productId: string): Promise<CachedProduct | null> {
  return await get<CachedProduct>(`product:${productId}`);
}

export interface CachedUser {
  userId: number;
  language: string;
  preferences?: Record<string, unknown>;
}

export async function cacheUser(user: CachedUser): Promise<void> {
  await set(`user:${user.userId}`, user, 86400); // 24 hours TTL
}

export async function getUserFromCache(userId: number): Promise<CachedUser | null> {
  return await get<CachedUser>(`user:${userId}`);
}
