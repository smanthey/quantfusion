/**
 * Exponential Backoff with Jitter
 * 
 * Based on best practices from:
 * - OpenAI API guidelines
 * - AWS Architecture Blog
 * - OpenAlgo trading platform
 * 
 * Formula: delay = base * (2 ^ attempt) * jitter
 * Max delay capped to prevent infinite waits
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export class ExponentialBackoff {
  private config: RetryConfig;
  
  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: config.maxAttempts || 5,
      baseDelayMs: config.baseDelayMs || 1000,
      maxDelayMs: config.maxDelayMs || 60000,
      jitter: config.jitter !== false  // Default true
    };
  }

  /**
   * Execute function with exponential backoff retry
   */
  async execute<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: any) => boolean = () => true
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry this error
        if (!shouldRetry(error)) {
          throw error;
        }
        
        // Don't delay on last attempt
        if (attempt < this.config.maxAttempts - 1) {
          const delay = this.calculateDelay(attempt);
          console.log(`⏳ Retry ${attempt + 1}/${this.config.maxAttempts} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential: base * (2 ^ attempt)
    let delay = this.config.baseDelayMs * Math.pow(2, attempt);
    
    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelayMs);
    
    // Add full jitter (randomize between 0 and delay)
    // This prevents thundering herd problem
    if (this.config.jitter) {
      delay = Math.random() * delay;
    }
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Rate Limiter with Adaptive Backoff
 * Slows down when errors occur, speeds up on success
 */
export class AdaptiveRateLimiter {
  private minIntervalMs: number;
  private currentIntervalMs: number;
  private lastCallTime: number = 0;
  private successiveErrors: number = 0;
  
  constructor(maxPerSecond: number) {
    this.minIntervalMs = 1000 / maxPerSecond;
    this.currentIntervalMs = this.minIntervalMs;
  }

  /**
   * Throttle call to respect rate limit
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    const timeToWait = this.currentIntervalMs - timeSinceLastCall;
    
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    this.lastCallTime = Date.now();
  }

  /**
   * Call on error - slow down exponentially
   */
  onError(): void {
    this.successiveErrors++;
    this.currentIntervalMs = Math.min(
      this.currentIntervalMs * 2,
      60000 // Max 60 second interval
    );
    console.log(`⚠️ Rate limit error #${this.successiveErrors}, slowing to ${(this.currentIntervalMs/1000).toFixed(1)}s interval`);
  }

  /**
   * Call on success - speed up gradually
   */
  onSuccess(): void {
    if (this.successiveErrors > 0) {
      this.successiveErrors--;
    }
    
    // Gradually return to normal speed
    if (this.currentIntervalMs > this.minIntervalMs) {
      this.currentIntervalMs = Math.max(
        this.minIntervalMs,
        this.currentIntervalMs * 0.9
      );
    }
  }

  getStats() {
    return {
      currentIntervalMs: this.currentIntervalMs,
      successiveErrors: this.successiveErrors,
      requestsPerSecond: 1000 / this.currentIntervalMs
    };
  }
}

/**
 * Helper: Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }
  
  // HTTP rate limits and server errors
  if (error.response) {
    const status = error.response.status;
    return status === 429 || status === 503 || status >= 500;
  }
  
  // Generic timeout/network errors
  if (error.message) {
    const msg = error.message.toLowerCase();
    return msg.includes('timeout') || 
           msg.includes('network') || 
           msg.includes('rate limit') ||
           msg.includes('too many requests');
  }
  
  return false;
}
