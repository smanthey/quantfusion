/**
 * Circuit Breaker Pattern
 * 
 * Prevents trading on stale/bad data by monitoring API health.
 * When APIs fail repeatedly, circuit opens and stops trading.
 * 
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Too many failures, block all requests
 * - HALF_OPEN: Testing if service recovered
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Open after N failures
  successThreshold: number; // Close after N successes in HALF_OPEN
  timeout: number; // Time to wait before HALF_OPEN (ms)
  name: string;
}

export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: Date | null;
  lastStateChange: Date;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: Date | null = null;
  private lastStateChange: Date = new Date();
  private nextAttemptTime: Date | null = null;
  
  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is OPEN
    if (this.state === 'OPEN') {
      // Check if timeout expired (move to HALF_OPEN)
      if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime.getTime()) {
        this.moveToHalfOpen();
      } else {
        throw new Error(`Circuit breaker ${this.config.name} is OPEN`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.moveToClosed();
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.state === 'HALF_OPEN') {
      this.moveToOpen();
    } else if (this.failures >= this.config.failureThreshold) {
      this.moveToOpen();
    }
  }

  private moveToOpen(): void {
    this.state = 'OPEN';
    this.lastStateChange = new Date();
    this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
    this.successes = 0;
    console.log(`🔴 Circuit breaker ${this.config.name} OPENED (too many failures)`);
  }

  private moveToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.lastStateChange = new Date();
    this.successes = 0;
    this.failures = 0;
    console.log(`🟡 Circuit breaker ${this.config.name} HALF_OPEN (testing recovery)`);
  }

  private moveToClosed(): void {
    this.state = 'CLOSED';
    this.lastStateChange = new Date();
    this.failures = 0;
    this.successes = 0;
    console.log(`🟢 Circuit breaker ${this.config.name} CLOSED (service recovered)`);
  }

  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange
    };
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastStateChange = new Date();
    console.log(`🔄 Circuit breaker ${this.config.name} manually reset`);
  }
}

/**
 * Circuit Breaker Manager
 * Manages all circuit breakers in the system
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  createBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    const breaker = new CircuitBreaker(config);
    this.breakers.set(config.name, breaker);
    return breaker;
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAllStats(): Map<string, CircuitStats> {
    const stats = new Map<string, CircuitStats>();
    for (const [name, breaker] of this.breakers.entries()) {
      stats.set(name, breaker.getStats());
    }
    return stats;
  }

  hasOpenBreakers(): boolean {
    return Array.from(this.breakers.values()).some(b => b.isOpen());
  }

  getOpenBreakers(): string[] {
    return Array.from(this.breakers.entries())
      .filter(([_, breaker]) => breaker.isOpen())
      .map(([name, _]) => name);
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    console.log('🔄 All circuit breakers reset');
  }
}

export const circuitBreakerManager = new CircuitBreakerManager();
