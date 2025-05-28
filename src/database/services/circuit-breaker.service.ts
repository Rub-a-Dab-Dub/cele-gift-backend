import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerConfig } from '../config/database-config.interface';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerStats {
  failures: number;
  successes: number;
  requests: number;
  lastFailureTime?: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, {
    state: CircuitBreakerState;
    stats: CircuitBreakerStats;
    config: CircuitBreakerConfig;
    nextAttempt?: number;
  }>();

  registerBreaker(name: string, config: CircuitBreakerConfig): void {
    this.breakers.set(name, {
      state: CircuitBreakerState.CLOSED,
      stats: { failures: 0, successes: 0, requests: 0 },
      config,
    });
    
    this.logger.log(`Circuit breaker '${name}' registered`);
  }

  async execute<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      throw new Error(`Circuit breaker '${name}' not found`);
    }

    if (!this.canExecute(name)) {
      throw new Error(`Circuit breaker '${name}' is OPEN`);
    }

    try {
      const result = await Promise.race([
        operation(),
        this.timeout(breaker.config.timeout),
      ]);
      
      this.onSuccess(name);
      return result;
    } catch (error) {
      this.onFailure(name, error);
      throw error;
    }
  }

  private canExecute(name: string): boolean {
    const breaker = this.breakers.get(name)!;
    const now = Date.now();

    switch (breaker.state) {
      case CircuitBreakerState.CLOSED:
        return true;
      
      case CircuitBreakerState.OPEN:
        if (breaker.nextAttempt && now >= breaker.nextAttempt) {
          breaker.state = CircuitBreakerState.HALF_OPEN;
          this.logger.warn(`Circuit breaker '${name}' transitioning to HALF_OPEN`);
          return true;
        }
        return false;
      
      case CircuitBreakerState.HALF_OPEN:
        return true;
      
      default:
        return false;
    }
  }

  private onSuccess(name: string): void {
    const breaker = this.breakers.get(name)!;
    breaker.stats.successes++;
    breaker.stats.requests++;

    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      breaker.state = CircuitBreakerState.CLOSED;
      breaker.stats.failures = 0;
      this.logger.log(`Circuit breaker '${name}' closed after successful request`);
    }
  }

  private onFailure(name: string, error: any): void {
    const breaker = this.breakers.get(name)!;
    breaker.stats.failures++;
    breaker.stats.requests++;
    breaker.stats.lastFailureTime = Date.now();

    const failureRate = (breaker.stats.failures / breaker.stats.requests) * 100;
    
    if (failureRate >= breaker.config.errorThresholdPercentage && 
        breaker.state !== CircuitBreakerState.OPEN) {
      breaker.state = CircuitBreakerState.OPEN;
      breaker.nextAttempt = Date.now() + breaker.config.resetTimeout;
      
      this.logger.error(
        `Circuit breaker '${name}' opened due to failure rate: ${failureRate.toFixed(2)}%`,
        error.stack
      );
    }
  }

  private timeout<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), ms);
    });
  }

  getStats(name: string) {
    const breaker = this.breakers.get(name);
    return breaker ? { state: breaker.state, stats: breaker.stats } : null;
  }
}