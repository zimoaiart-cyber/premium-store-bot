/**
 * Structured Logger for Premium Store Bot
 * Production-ready logging with levels and formatting
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  stack?: string;
}

class Logger {
  private minLevel: LogLevel;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
  }

  private formatEntry(entry: LogEntry): string {
    const colorCodes: Record<LogLevel, string> = {
      debug: "\x1b[36m", // Cyan
      info: "\x1b[32m",  // Green
      warn: "\x1b[33m",  // Yellow
      error: "\x1b[31m", // Red
    };

    const reset = "\x1b[0m";
    const color = colorCodes[entry.level];
    const time = new Date(entry.timestamp).toISOString();
    
    let log = `${color}[${time}] [${entry.level.toUpperCase()}] [${entry.module}]${reset} ${entry.message}`;
    
    if (entry.data) {
      log += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }
    
    if (entry.error) {
      log += `\n  Error: ${entry.error}`;
    }
    
    if (entry.stack) {
      log += `\n  Stack: ${entry.stack}`;
    }
    
    return log;
  }

  private log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>, error?: Error) {
    if (this.levelPriority[level] < this.levelPriority[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data,
      error: error?.message,
      stack: error?.stack,
    };

    console.log(this.formatEntry(entry));
  }

  debug(module: string, message: string, data?: Record<string, unknown>) {
    this.log("debug", module, message, data);
  }

  info(module: string, message: string, data?: Record<string, unknown>) {
    this.log("info", module, message, data);
  }

  warn(module: string, message: string, data?: Record<string, unknown>) {
    this.log("warn", module, message, data);
  }

  error(module: string, message: string, error?: Error, data?: Record<string, unknown>) {
    this.log("error", module, message, data, error);
  }
}

// Global logger instance
export const logger = new Logger(Deno.env.get("LOG_LEVEL") as LogLevel || "info");

// Performance monitoring
export function measureExecution<T>(
  logger: Logger,
  module: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  logger.debug(module, `Starting: ${operation}`);
  
  return fn()
    .then((result) => {
      const duration = performance.now() - start;
      logger.debug(module, `Completed: ${operation} (${duration.toFixed(2)}ms)`);
      return result;
    })
    .catch((error) => {
      const duration = performance.now() - start;
      logger.error(module, `Failed: ${operation} (${duration.toFixed(2)}ms)`, error);
      throw error;
    });
}
