import { Injectable, Inject } from '@nestjs/common';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { DatabaseLoggerService } from '../services/database-logger.service';

export function DatabaseOperation(operationType: 'read' | 'write' = 'read') {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const circuitBreaker: CircuitBreakerService = this.circuitBreakerService;
      const dbLogger: DatabaseLoggerService = this.databaseLoggerService;
      
      const startTime = Date.now();
      
      try {
        const result = await circuitBreaker.execute('database', () => method.apply(this, args));
        
        const duration = Date.now() - startTime;
        dbLogger.logQuery({
          query: `${target.constructor.name}.${propertyName}`,
          duration,
          timestamp: new Date(),
          connection: operationType === 'read' ? 'read' : 'primary',
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        dbLogger.logQuery({
          query: `${target.constructor.name}.${propertyName}`,
          duration,
          timestamp: new Date(),
          connection: operationType === 'read' ? 'read' : 'primary',
          error: error.message,
        });
        
        throw error;
      }
    };
  };
}