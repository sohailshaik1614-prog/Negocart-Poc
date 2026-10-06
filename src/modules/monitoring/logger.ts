export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogContext {
  correlationId?: string;
  storeId?: string;
  merchantId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export class Logger {
  private static readonly SENSITIVE_KEYS = new Set([
    "password",
    "passwordhash",
    "accesstoken",
    "token",
    "secret",
    "minacceptableprice",
    "floorprice",
    "authtag",
    "card",
    "cvv",
  ]);

  /**
   * Recursively sanitizes objects to redact credentials and floor prices
   */
  private static sanitize(obj: unknown): unknown {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (this.SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof val === "object" && val !== null) {
        sanitized[key] = this.sanitize(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  private static output(level: LogLevel, message: string, context?: LogContext): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context ? (this.sanitize(context) as LogContext) : {}),
    };

    const json = JSON.stringify(entry);
    if (level === "ERROR") {
      console.error(json);
    } else if (level === "WARN") {
      console.warn(json);
    } else {
      console.log(json);
    }
  }

  public static debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== "production") {
      this.output("DEBUG", message, context);
    }
  }

  public static info(message: string, context?: LogContext): void {
    this.output("INFO", message, context);
  }

  public static warn(message: string, context?: LogContext): void {
    this.output("WARN", message, context);
  }

  public static error(message: string, error?: unknown, context?: LogContext): void {
    const errDetails =
      error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
        : { rawError: String(error) };

    this.output("ERROR", message, { ...context, ...errDetails });
  }
}
