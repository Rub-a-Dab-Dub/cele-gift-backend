import { SetMetadata } from '@nestjs/common';

export interface DbTestOptions {
  fixtures?: string[];
  transaction?: boolean;
  isolate?: boolean;
  performance?: {
    enabled: boolean;
    baseline?: string;
    timeout?: number;
  };
  cleanup?: boolean;
}

export const DB_TEST_METADATA = 'db-test-metadata';

export const DbTest = (options: DbTestOptions = {}) => {
  return SetMetadata(DB_TEST_METADATA, {
    fixtures: options.fixtures || [],
    transaction: options.transaction !== false,
    isolate: options.isolate !== false,
    performance: options.performance || { enabled: false },
    cleanup: options.cleanup !== false,
  });
};