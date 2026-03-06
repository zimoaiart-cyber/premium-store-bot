/**
 * Metrics and Health Check Service
 * Prometheus-compatible metrics for monitoring
 */

interface Metrics {
  requestsTotal: number;
  requestsByType: Record<string, number>;
  errorsTotal: number;
  responseTimeSum: number;
  responseTimeCount: number;
  activeUsers: Set<number>;
  databaseQueries: number;
  cacheHits: number;
  cacheMisses: number;
}

const metrics: Metrics = {
  requestsTotal: 0,
  requestsByType: {},
  errorsTotal: 0,
  responseTimeSum: 0,
  responseTimeCount: 0,
  activeUsers: new Set(),
  databaseQueries: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

export function incrementRequest(type: string): void {
  metrics.requestsTotal++;
  metrics.requestsByType[type] = (metrics.requestsByType[type] || 0) + 1;
}

export function incrementError(): void {
  metrics.errorsTotal++;
}

export function recordResponseTime(durationMs: number): void {
  metrics.responseTimeSum += durationMs;
  metrics.responseTimeCount++;
}

export function trackUser(userId: number): void {
  metrics.activeUsers.add(userId);
}

export function incrementDatabaseQuery(): void {
  metrics.databaseQueries++;
}

export function recordCacheHit(): void {
  metrics.cacheHits++;
}

export function recordCacheMiss(): void {
  metrics.cacheMisses++;
}

export function getMetrics(): Metrics {
  return metrics;
}

export function getAverageResponseTime(): number {
  if (metrics.responseTimeCount === 0) return 0;
  return metrics.responseTimeSum / metrics.responseTimeCount;
}

export function getHealthStatus(): {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  version: string;
  metrics: {
    requestsTotal: number;
    errorsTotal: number;
    activeUsers: number;
    avgResponseTime: number;
  };
} {
  const uptime = process.uptime();
  const avgResponseTime = getAverageResponseTime();
  
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  
  // Degraded if error rate > 5%
  const errorRate = metrics.errorsTotal / Math.max(metrics.requestsTotal, 1);
  if (errorRate > 0.05) {
    status = "degraded";
  }
  
  // Unhealthy if error rate > 20%
  if (errorRate > 0.2) {
    status = "unhealthy";
  }
  
  return {
    status,
    uptime,
    version: "3.0.0",
    metrics: {
      requestsTotal: metrics.requestsTotal,
      errorsTotal: metrics.errorsTotal,
      activeUsers: metrics.activeUsers.size,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
    },
  };
}

export function generatePrometheusMetrics(): string {
  let output = "# HELP premium_bot_requests_total Total number of requests\n";
  output += "# TYPE premium_bot_requests_total counter\n";
  output += `premium_bot_requests_total ${metrics.requestsTotal}\n\n`;
  
  output += "# HELP premium_bot_errors_total Total number of errors\n";
  output += "# TYPE premium_bot_errors_total counter\n";
  output += `premium_bot_errors_total ${metrics.errorsTotal}\n\n`;
  
  output += "# HELP premium_bot_active_users Number of active users\n";
  output += "# TYPE premium_bot_active_users gauge\n";
  output += `premium_bot_active_users ${metrics.activeUsers.size}\n\n`;
  
  output += "# HELP premium_bot_response_time_avg Average response time in ms\n";
  output += "# TYPE premium_bot_response_time_avg gauge\n";
  output += `premium_bot_response_time_avg ${getAverageResponseTime()}\n\n`;
  
  output += "# HELP premium_bot_database_queries_total Total database queries\n";
  output += "# TYPE premium_bot_database_queries_total counter\n";
  output += `premium_bot_database_queries_total ${metrics.databaseQueries}\n\n`;
  
  output += "# HELP premium_bot_cache_hits_total Total cache hits\n";
  output += "# TYPE premium_bot_cache_hits_total counter\n";
  output += `premium_bot_cache_hits_total ${metrics.cacheHits}\n\n`;
  
  output += "# HELP premium_bot_cache_misses_total Total cache misses\n";
  output += "# TYPE premium_bot_cache_misses_total counter\n";
  output += `premium_bot_cache_misses_total ${metrics.cacheMisses}\n`;
  
  return output;
}

// Reset metrics periodically (every hour)
setInterval(() => {
  metrics.requestsTotal = 0;
  metrics.requestsByType = {};
  metrics.errorsTotal = 0;
  metrics.responseTimeSum = 0;
  metrics.responseTimeCount = 0;
  metrics.activeUsers.clear();
  metrics.databaseQueries = 0;
  metrics.cacheHits = 0;
  metrics.cacheMisses = 0;
  console.log("Metrics reset");
}, 3600000);
