import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { TestTransactionManager } from './services/test-transaction-manager.service';
import { TestFixtureManager } from './services/test-fixture-manager.service';
import { DatabaseAssertions } from './services/database-assertions.service';
import { TestDataGenerator } from './services/test-data-generator.service';
import { PerformanceTestRunner } from './services/performance-test-runner.service';
import { TestReportGenerator } from './services/test-report-generator.service';
import { DatabaseMockFactory } from './services/database-mock-factory.service';
import { TestEnvironmentManager } from './services/test-environment-manager.service';

import { TestExecution } from './entities/test-execution.entity';
import { TestFixture } from './entities/test-fixture.entity';
import { PerformanceBaseline } from './entities/performance-baseline.entity';
import { TestReport } from './entities/test-report.entity';

import { DatabaseTestController } from './controllers/database-test.controller';

export interface DatabaseTestingModuleOptions {
  entities?: any[];
  testDatabase?: {
    type: 'postgres' | 'mysql' | 'sqlite';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    synchronize?: boolean;
    dropSchema?: boolean;
  };
  performance?: {
    enabled: boolean;
    baselineThresholds: Record<string, number>;
    reportingEnabled: boolean;
  };
  fixtures?: {
    autoLoad: boolean;
    fixturesPaths: string[];
  };
}

@Module({})
export class DatabaseTestingModule {
  static forRoot(options?: DatabaseTestingModuleOptions): DynamicModule {
    return {
      module: DatabaseTestingModule,
      imports: [
        ConfigModule,
        TypeOrmModule.forRoot({
          ...options?.testDatabase,
          entities: [
            TestExecution,
            TestFixture,
            PerformanceBaseline,
            TestReport,
            ...(options?.entities || []),
          ],
          synchronize: true,
          dropSchema: process.env.NODE_ENV === 'test',
          logging: process.env.NODE_ENV !== 'test',
        }),
        TypeOrmModule.forFeature([
          TestExecution,
          TestFixture,
          PerformanceBaseline,
          TestReport,
        ]),
      ],
      controllers: [DatabaseTestController],
      providers: [
        TestTransactionManager,
        TestFixtureManager,
        DatabaseAssertions,
        TestDataGenerator,
        PerformanceTestRunner,
        TestReportGenerator,
        DatabaseMockFactory,
        TestEnvironmentManager,
        {
          provide: 'DATABASE_TESTING_OPTIONS',
          useValue: options || {},
        },
      ],
      exports: [
        TestTransactionManager,
        TestFixtureManager,
        DatabaseAssertions,
        TestDataGenerator,
        PerformanceTestRunner,
        TestReportGenerator,
        DatabaseMockFactory,
        TestEnvironmentManager,
      ],
    };
  }

  static forFeature(entities: any[]): DynamicModule {
    return {
      module: DatabaseTestingModule,
      imports: [TypeOrmModule.forFeature(entities)],
      exports: [TypeOrmModule],
    };
  }
}
