/**
 * Sliding Window In-Memory Rate Limiter
 * Suitable for Edge / Node runtime and easily swapped with Redis/Upstash
 */
interface RateLimitRecord {
  timestamps: number[];
}

export class RateLimiter {
  private static store: Map<string, RateLimitRecord> = new Map();

  /**
   * Check if an action by an identifier (e.g. device hash or IP) is permitted.
   *
   * @param key Identifier string (IP or device fingerprint)
   * @param maxRequests Maximum allowed requests in window
   * @param windowSeconds Window duration in seconds
   */
  public static check(key: string, maxRequests: number = 10, windowSeconds: number = 60): {
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
  } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const threshold = now - windowMs;

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    // Filter out timestamps outside the active window
    record.timestamps = record.timestamps.filter((ts) => ts > threshold);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const resetInSeconds = Math.ceil((oldest + windowMs - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.max(1, resetInSeconds),
      };
    }

    record.timestamps.push(now);

    return {
      allowed: true,
      remaining: maxRequests - record.timestamps.length,
      resetInSeconds: windowSeconds,
    };
  }

  /**
   * Periodic garbage collection of stale rate limit entries
   */
  public static cleanup(): void {
    const threshold = Date.now() - 3600 * 1000;
    for (const [key, record] of this.store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > threshold);
      if (record.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}
