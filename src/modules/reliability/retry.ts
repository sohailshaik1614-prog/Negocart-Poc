export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Executes an async task with exponential backoff and jitter
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const backoffFactor = options.backoffFactor ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      attempt++;
      return await task();
    } catch (error) {
      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Add full jitter (0.5 to 1.5x of delay)
      const jitter = 0.5 + Math.random();
      const sleepMs = Math.min(maxDelayMs, Math.round(delay * jitter));

      await new Promise((resolve) => setTimeout(resolve, sleepMs));
      delay = Math.min(maxDelayMs, delay * backoffFactor);
    }
  }
}
