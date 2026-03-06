/**
 * Rate Limiting Middleware
 * Protect bot from spam and abuse
 */

import { Context, NextFunction } from "https://deno.land/x/grammy@v1.19.0/mod.ts";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  blockDurationMs: number; // How long to block after exceeding limit
}

interface UserRateLimit {
  count: number;
  resetTime: number;
  blockedUntil: number | null;
}

const userLimits = new Map<number, UserRateLimit>();

const defaultConfig: RateLimitConfig = {
  maxRequests: 30, // 30 requests
  windowMs: 60000, // per minute
  blockDurationMs: 300000, // block for 5 minutes
};

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  
  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await next();
      return;
    }
    
    const now = Date.now();
    let userLimit = userLimits.get(userId);
    
    // Initialize or reset if window expired
    if (!userLimit || now > userLimit.resetTime) {
      userLimit = {
        count: 0,
        resetTime: now + finalConfig.windowMs,
        blockedUntil: null,
      };
      userLimits.set(userId, userLimit);
    }
    
    // Check if user is blocked
    if (userLimit.blockedUntil && now < userLimit.blockedUntil) {
      const remainingSeconds = Math.ceil((userLimit.blockedUntil - now) / 1000);
      try {
        await ctx.reply(
          `⚠️ Слишком много запросов. Пожалуйста, подождите ${remainingSeconds} сек.`,
        );
      } catch {
        // Ignore reply errors
      }
      return;
    }
    
    // Unblock if block duration expired
    if (userLimit.blockedUntil && now >= userLimit.blockedUntil) {
      userLimit.blockedUntil = null;
      userLimit.count = 0;
      userLimit.resetTime = now + finalConfig.windowMs;
    }
    
    // Increment request count
    userLimit.count++;
    
    // Check if limit exceeded
    if (userLimit.count > finalConfig.maxRequests) {
      userLimit.blockedUntil = now + finalConfig.blockDurationMs;
      try {
        await ctx.reply(
          `⚠️ Превышен лимит запросов (${finalConfig.maxRequests} в минуту). ` +
          `Вы заблокированы на ${finalConfig.blockDurationMs / 1000 / 60} мин.`,
        );
      } catch {
        // Ignore reply errors
      }
      return;
    }
    
    await next();
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of userLimits.entries()) {
    if (now > limit.resetTime && (!limit.blockedUntil || now > limit.blockedUntil)) {
      userLimits.delete(userId);
    }
  }
}, 60000); // Clean up every minute
