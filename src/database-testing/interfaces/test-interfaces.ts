export interface TestContext {
    transactionManager: any;
    fixtures: Record<string, any>;
    assertions: any;
    dataGenerator: any;
    mockFactory: any;
  }
  
  export interface PerformanceMetrics {
    duration: number;
    memory: {
      used: number;
      peak: number;
    };
    queries: {
      count: number;
      totalTime: number;
      slowest: number;
    };
    cpu: {
      user: number;
      system: number;
    };
  }
  
  export interface TestResult {
    testName: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    assertions: {
      total: number;
      passed: number;
      failed: number;
    };
    performance?: PerformanceMetrics;
    fixtures?: string[];
  }
  
  export interface DatabaseTestReport {
    testSuite: string;
    timestamp: Date;
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
    };
    results: TestResult[];
    coverage?: {
      tables: string[];
      operations: string[];
      coverage: number;
    };
    performance?: {
      baseline: string;
      improvements: number;
      regressions: number;
    };
  }