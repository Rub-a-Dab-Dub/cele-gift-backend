import { QueryPerformanceMetrics } from '../interfaces/performance.interface';
import { QueryMonitorService } from '../services/query-monitor.service';
import { PerformanceRegressionService } from '../services/performance-regression.service';

export function withPerformanceMonitoring<T extends new (...args: any[]) => any>(
  constructor: T,
  queryMonitor: QueryMonitorService,
  regressionService: PerformanceRegressionService,
) {
  return class extends constructor {
    private wrapMethod(originalMethod: Function, methodName: string) {
      return async function (this: any, ...args: any[]) {
        const startTime = Date.now();
        const callStack = new Error().stack;

        try {
          const result = await originalMethod.apply(this, args);
          const executionTime = Date.now() - startTime;

          const metrics: QueryPerformanceMetrics = {
            queryId: `${constructor.name}.${methodName}`,
            sql: this.createSql?.name || `${constructor.name}.${methodName}`,
            executionTime,
            rowsReturned: Array.isArray(result) ? result.length : 1,
            timestamp: new Date(),
            parameters: args,
            callStack,
          };

          queryMonitor.recordQuery(metrics);
          regressionService.checkForRegression(metrics);

          return result;
        } catch (error) {
          const executionTime = Date.now() - startTime;
          
          const metrics: QueryPerformanceMetrics = {
            queryId: `${constructor.name}.${methodName}`,
            sql: `${constructor.name}.${methodName}`,
            executionTime,
            rowsReturned: 0,
            timestamp: new Date(),
            parameters: args,
            callStack,
          };

          queryMonitor.recordQuery(metrics);
          throw error;
        }
      };
    }

    constructor(...args: any[]) {
      super(...args);

      // Wrap all methods that might be database operations
      const prototype = Object.getPrototypeOf(this);
      const methodNames = Object.getOwnPropertyNames(prototype);

      for (const methodName of methodNames) {
        if (methodName !== 'constructor' && typeof this[methodName] === 'function') {
          const originalMethod = this[methodName];
          this[methodName] = this.wrapMethod(originalMethod, methodName);
        }
      }
    }
  };
}