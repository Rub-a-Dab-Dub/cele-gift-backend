export interface PerformanceTestOptions {
    baseline: string;
    timeout?: number;
    iterations?: number;
    warmup?: number;
    thresholds?: {
      max?: number;
      avg?: number;
      p95?: number;
    };
  }
  
  export const PERFORMANCE_TEST_METADATA = 'performance-test-metadata';
  
  export const PerformanceTest = (options: PerformanceTestOptions) => {
    return SetMetadata(PERFORMANCE_TEST_METADATA, options);
  };