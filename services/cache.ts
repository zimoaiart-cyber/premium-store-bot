/**
 * Cache Service with Redis
 * For high-performance data caching
 */

import { Redis } from "https://deno.land/x/redis@v0.32.2/mod.ts";

let redisClient: Redis | null = null;

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export async function initCache(config?: CacheConfig): Promise<void> {
  const redisUrl = Deno.env.get("REDIS_URL");
  
  if (redisUrl) {
    redisClient = await Redis.connect(redisUrl);
    console.log("✅ Redis connected");
    return;
  }
  
  if (config) {
    redisClient = await Redis.connect({
      hostname: config.host,
      port: config.port,
      password: config.password,
      db: config.db ?? 0,
    });
    console.log("✅ Redis connected");
    return;
  }
  
  console.log("ℹ️ Redis not configured, caching disabled");
}

export function getCache(): Redis | null {
  return redisClient;
}

export async function closeCache(): Promise<void> {
  if (redisClient) {
    redisClient.close();
    redisClient = null;
    console.log("Redis connection closed");
  }
}

// Cache helpers
export async function get<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;
  
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error("Cache get error:", error);
    return null;
  }
}

export async function set<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  if (!redisClient) return;
  
  try {
    const data = JSON.stringify(value);
    if (ttlSeconds) {
      await redisClient.set(key, data, { ex: ttlSeconds });
    } else {
      await redisClient.set(key, data);
    }
  } catch (error) {
    console.error("Cache set error:", error);
  }
}

export async function del(key: string): Promise<void> {
  if (!redisClient) return;
  
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error("Cache delete error:", error);
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  if (!redisClient) return;
  
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (error) {
    console.error("Cache invalidate error:", error);
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
