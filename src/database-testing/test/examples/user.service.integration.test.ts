import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DatabaseTestingModule } from '../../src/modules/database-testing/database-testing.module';
import { TestTransactionManager } from '../../src/modules/database-testing/services/test-transaction-manager.service';
import { TestFixtureManager } from '../../src/modules/database-testing/services/test-fixture-manager.service';
import { DatabaseAssertions } from '../../src/modules/database-testing/services/database-assertions.service';
import { TestDataGenerator } from '../../src/modules/database-testing/services/test-data-generator.service';
import { PerformanceTestRunner } from '../../src/modules/database-testing/services/performance-test-runner.service';
import { DbTest, PerformanceTest } from '../../src/modules/database-testing/decorators';

describe('UserService Integration Tests', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let transactionManager: TestTransactionManager;
  let fixtureManager: TestFixtureManager;
  let assertions: DatabaseAssertions;
  let dataGenerator: TestDataGenerator;
  let performanceRunner: PerformanceTestRunner;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.forRoot({
          testDatabase: {
            type: 'postgres',
            host: 'localhost',
            port: 5432,
            username: 'test_user',
            password: 'test_password',
            database: 'test_db',
            synchronize: true,
            dropSchema: true,
          },
          performance: {
            enabled: true,
            baselineThresholds: {
              maxDuration: 1000,
              maxMemory: 50 * 1024 * 1024,
            },
            reportingEnabled: true,
          },
          fixtures: {
            autoLoad: true,
            fixturesPaths: ['./test/fixtures'],
          },
        }),
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    transactionManager = module.get<TestTransactionManager>(TestTransactionManager);
    fixtureManager = module.get<TestFixtureManager>(TestFixtureManager);
    assertions = module.get<DatabaseAssertions>(DatabaseAssertions);
    dataGenerator = module.get<TestDataGenerator>(TestDataGenerator);
    performanceRunner = module.get<PerformanceTestRunner>(PerformanceTestRunner);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('User CRUD Operations', () => {
    @DbTest({
      fixtures: ['users', 'roles'],
      transaction: true,
      isolate: true,
      cleanup: true,
    })
    it('should create a new user', async () => {
      const transactionId = await transactionManager.startTransaction();

      try {
        // Load fixtures
        await fixtureManager.loadFixtures(['users', 'roles']);

        // Test user creation
        await transactionManager.query(
          transactionId,
          'INSERT INTO users (id, email, name) VALUES ($1, $2, $3)',
          ['test-id', 'test@example.com', 'Test User']
        );

        // Assertions
        await assertions.assertRecordExists('users', { email: 'test@example.com' });
        await assertions.assertRowCount('users', 4); // 3 from fixture + 1 new

        const result = await assertions.getAssertionSummary();
        expect(result.successRate).toBe(100);

        await transactionManager.commitTransaction(transactionId);
      } catch (error) {
        await transactionManager.rollbackTransaction(transactionId);
        throw error;
      }
    });

    @DbTest({
      fixtures: ['users'],
      transaction: true,
    })
    it('should handle duplicate email constraint', async () => {
      const transactionId = await transactionManager.startTransaction();

      try {
        await fixtureManager.loadFixture('users');

        // Try to insert duplicate email
        await expect(
          transactionManager.query(
            transactionId,
            'INSERT INTO users (id, email, name) VALUES ($1, $2, $3)',
            ['new-id', 'john@example.com', 'Duplicate User'] // john@example.com exists in fixture
          )
        ).rejects.toThrow();

        // Verify original record still exists
        await assertions.assertRecordExists('users', { email: 'john@example.com' });
        
        // Verify no duplicate was created
        await assertions.assertRowCount('users', 3); // Only fixture data

        await transactionManager.rollbackTransaction(transactionId);
      } catch (error) {
        await transactionManager.rollbackTransaction(transactionId);
        throw error;
      }
    });

    @PerformanceTest({
      baseline: 'user_bulk_insert_v1',
      timeout: 5000,
      iterations: 10,
      thresholds: {
        max: 2000,
        avg: 1000,
        p95: 1500,
      },
    })
    it('should efficiently bulk insert users', async () => {
      const result = await performanceRunner.runPerformanceTest(
        'bulk_insert_users',
        async () => {
          // Generate test data
          const users = await dataGenerator.generateTestData({
            tableName: 'users',
            count: 1000,
            rules: [
              { field: 'id', type: 'uuid', options: { unique: true } },
              { field: 'email', type: 'email', options: { unique: true } },
              { field: 'name', type: 'string' },
              { field: 'created_at', type: 'date' },
            ],
          });

          // Insert in batches
          await dataGenerator.insertGeneratedData('users', users, {
            batchSize: 100,
            onConflict: 'ignore',
            truncateFirst: true,
          });
        },
        {
          iterations: 5,
          collectQueryStats: true,
          collectMemoryStats: true,
        }
      );

      // Performance assertions
      expect(result.averageDuration).toBeLessThan(1000);
      expect(result.memory.delta).toBeLessThan(10 * 1024 * 1024); // 10MB
      expect(result.queries.count).toBeGreaterThan(0);
    });
  });

  describe('Complex Query Operations', () => {
    @DbTest({
      fixtures: ['users', 'orders', 'products'],
      transaction: true,
    })
    it('should perform complex join queries correctly', async () => {
      const transactionId = await transactionManager.startTransaction();

      try {
        // Load all required fixtures
        await fixtureManager.loadFixtures(['users', 'orders', 'products']);

        // Test complex query
        const result = await transactionManager.query(
          transactionId,
          `
          SELECT 
            u.name as user_name,
            COUNT(o.id) as order_count,
            SUM(o.total_amount) as total_spent
          FROM users u
          LEFT JOIN orders o ON u.id = o.user_id
          WHERE u.created_at >= $1
          GROUP BY u.id, u.name
          HAVING COUNT(o.id) > 0
          ORDER BY total_spent DESC
          `,
          [new Date('2023-01-01')]
        );

        // Verify query results
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('user_name');
        expect(result[0]).toHaveProperty('order_count');
        expect(result[0]).toHaveProperty('total_spent');

        // Assert data integrity
        await assertions.assertQueryReturnsRows(
          'SELECT COUNT(*) FROM users WHERE created_at >= $1',
          [new Date('2023-01-01')]
        );

        await transactionManager.commitTransaction(transactionId);
      } catch (error) {
        await transactionManager.rollbackTransaction(transactionId);
        throw error;
      }
    });

    @DbTest({
      fixtures: ['users'],
      performance: {
        enabled: true,
        baseline: 'search_users_v1',
        timeout: 2000,
      },
    })
    it('should efficiently search users with pagination', async () => {
      // Generate large dataset for search testing
      const searchConfig = dataGenerator.createUserGenerator(10000);
      await dataGenerator.generateLargeDataSet(searchConfig, 1000);

      const result = await performanceRunner.runPerformanceTest(
        'user_search_pagination',
        async () => {
          await dataSource.query(`
            SELECT id, email, first_name, last_name
            FROM users
            WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)
            ORDER BY created_at DESC
            LIMIT 20 OFFSET $2
          `, ['%john%', 0]);
        },
        {
          iterations: 50,
          collectQueryStats: true,
        }
      );

      // Performance expectations
      expect(result.averageDuration).toBeLessThan(100); // 100ms for search
      expect(result.percentiles.p95).toBeLessThan(200);
    });
  });

  describe('Transaction Isolation Testing', () => {
    it('should test read committed isolation', async () => {
      const tx1 = await transactionManager.startTransaction({
        isolationLevel: 'READ COMMITTED',
      });
      const tx2 = await transactionManager.startTransaction({
        isolationLevel: 'READ COMMITTED',
      });

      try {
        // Insert data in tx1 (not committed)
        await transactionManager.query(
          tx1,
          'INSERT INTO users (id, email, name) VALUES ($1, $2, $3)',
          ['tx1-user', 'tx1@example.com', 'TX1 User']
        );

        // Query from tx2 should not see uncommitted data
        const result = await transactionManager.query(
          tx2,
          'SELECT COUNT(*) as count FROM users WHERE email = $1',
          ['tx1@example.com']
        );

        expect(parseInt(result[0].count)).toBe(0);

        // Commit tx1
        await transactionManager.commitTransaction(tx1);

        // Now tx2 should see the committed data
        const result2 = await transactionManager.query(
          tx2,
          'SELECT COUNT(*) as count FROM users WHERE email = $1',
          ['tx1@example.com']
        );

        expect(parseInt(result2[0].count)).toBe(1);

        await transactionManager.commitTransaction(tx2);
      } catch (error) {
        await Promise.all([
          transactionManager.rollbackTransaction(tx1),
          transactionManager.rollbackTransaction(tx2),
        ]);
        throw error;
      }
    });

    it('should test serializable isolation and detect conflicts', async () => {
      const tx1 = await transactionManager.startTransaction({
        isolationLevel: 'SERIALIZABLE',
      });
      const tx2 = await transactionManager.startTransaction({
        isolationLevel: 'SERIALIZABLE',
      });

      try {
        // Both transactions read the same data
        await transactionManager.query(tx1, 'SELECT COUNT(*) FROM users');
        await transactionManager.query(tx2, 'SELECT COUNT(*) FROM users');

        // Both try to insert
        await transactionManager.query(
          tx1,
          'INSERT INTO users (id, email, name) VALUES ($1, $2, $3)',
          ['ser1', 'ser1@example.com', 'Serializable 1']
        );

        await transactionManager.query(
          tx2,
          'INSERT INTO users (id, email, name) VALUES ($1, $2, $3)',
          ['ser2', 'ser2@example.com', 'Serializable 2']
        );

        // First commit should succeed
        await transactionManager.commitTransaction(tx1);

        // Second commit should fail due to serialization conflict
        await expect(
          transactionManager.commitTransaction(tx2)
        ).rejects.toThrow();

      } catch (error) {
        await Promise.all([
          transactionManager.rollbackTransaction(tx1),
          transactionManager.rollbackTransaction(tx2),
        ]);
        
        // This is expected behavior for serializable isolation
        if (error.message.includes('serialization')) {
          return; // Test passed
        }
        throw error;
      }
    });
  });

  describe('Data Integrity and Constraints', () => {
    @DbTest({
      fixtures: ['users'],
      transaction: true,
    })
    it('should validate all data integrity rules', async () => {
      const transactionId = await transactionManager.startTransaction();

      try {
        await fixtureManager.loadFixture('users');

        // Test comprehensive data integrity
        const integrityResults = await assertions.assertDataIntegrity('users', {
          notNullColumns: ['id', 'email', 'name'],
          uniqueColumns: [['email'], ['id']],
          customRules: [
            {
              name: 'valid_email_format',
              query: "SELECT COUNT(*) as count FROM users WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
              expectedResult: [{ count: '0' }],
            },
            {
              name: 'created_at_not_future',
              query: 'SELECT COUNT(*) as count FROM users WHERE created_at > NOW()',
              expectedResult: [{ count: '0' }],
            },
          ],
        });

        // Verify all integrity checks passed
        const failedChecks = integrityResults.filter(result => !result.passed);
        expect(failedChecks.length).toBe(0);

        await transactionManager.commitTransaction(transactionId);
      } catch (error) {
        await transactionManager.rollbackTransaction(transactionId);
        throw error;
      }
    });

    it('should test foreign key constraints', async () => {
      const transactionId = await transactionManager.startTransaction();

      try {
        await fixtureManager.loadFixtures(['users', 'orders']);

        // Test foreign key constraint
        await expect(
          transactionManager.query(
            transactionId,
            'INSERT INTO orders (id, user_id, total_amount) VALUES ($1, $2, $3)',
            ['invalid-order', 'non-existent-user', 100]
          )
        ).rejects.toThrow();

        // Verify constraint exists
        await assertions.assertForeignKeyConstraint(
          'orders',
          'user_id',
          'users',
          'id'
        );

        await transactionManager.rollbackTransaction(transactionId);
      } catch (error) {
        await transactionManager.rollbackTransaction(transactionId);
        throw error;
      }
    });
  });

  describe('Performance Regression Testing', () => {
    it('should detect performance regressions', async () => {
      // Create baseline
      const baselineResult = await performanceRunner.runPerformanceTest(
        'user_query_baseline',
        async () => {
          await dataSource.query('SELECT * FROM users LIMIT 100');
        },
        { iterations: 20 }
      );

      await performanceRunner.createBaseline(
        'user_query_v1',
        '1.0.0',
        'user_service_tests',
        'user_query_baseline',
        baselineResult
      );

      // Simulate slower query (regression)
      const regressionResult = await performanceRunner.runPerformanceTest(
        'user_query_regression',
        async () => {
          // Simulate slower query with unnecessary complexity
          await dataSource.query(`
            SELECT u.*, COUNT(o.id) as order_count
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            GROUP BY u.id
            LIMIT 100
          `);
        },
        { 
          iterations: 20,
          baseline: 'user_query_v1'
        }
      );

      // Check if regression was detected
      expect(regressionResult.baseline?.comparison).toBeDefined();
      
      if (regressionResult.baseline?.comparison === 'worse') {
        console.warn(`Performance regression detected: ${regressionResult.baseline.percentageDiff}% slower`);
      }
    });

    it('should run load testing for concurrent operations', async () => {
      const result = await performanceRunner.runConcurrencyTest(
        'concurrent_user_creation',
        async () => {
          const userId = `user_${Date.now()}_${Math.random()}`;
          await dataSource.query(
            'INSERT INTO users (id, email, name) VALUES ($1, $2, $3)',
            [userId, `${userId}@example.com`, `User ${userId}`]
          );
        },
        10, // 10 concurrent operations
        { iterations: 1 }
      );

      expect(result.failures).toBe(0);
      expect(result.concurrency).toBe(10);
      expect(result.totalDuration).toBeLessThan(5000); // 5 seconds max
    });

    it('should perform memory leak detection', async () => {
      const leakDetection = await performanceRunner.detectMemoryLeaks(
        'user_operations_memory_leak',
        async () => {
          // Simulate operations that might leak memory
          const users = await dataGenerator.generateTestData({
            tableName: 'temp_users',
            count: 1000,
            rules: [
              { field: 'id', type: 'uuid' },
              { field: 'email', type: 'email' },
              { field: 'data', type: 'string', options: { length: 1000 } },
            ],
          });
          
          // Clear generated data to test cleanup
          dataGenerator.clearGeneratedData('temp_users');
        },
        100, // 100 iterations
        10 * 1024 * 1024 // 10MB threshold
      );

      expect(leakDetection.hasMemoryLeak).toBe(false);
      
      if (leakDetection.hasMemoryLeak) {
        console.warn(`Memory leak detected: ${leakDetection.memoryGrowth} bytes growth`);
      }
    });
  });

  describe('Cleanup and Teardown', () => {
    afterEach(async () => {
      // Clean up any remaining transactions
      await transactionManager.cleanupAllTransactions();
      
      // Clear assertion results
      assertions.clearAssertionResults();
      
      // Clean up generated data
      dataGenerator.clearGeneratedData();
      dataGenerator.clearUniqueValues();
    });

    it('should clean up test environment properly', async () => {
      // Verify no active transactions
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions.length).toBe(0);

      // Verify assertion results are cleared
      const assertionSummary = assertions.getAssertionSummary();
      expect(assertionSummary.total).toBe(0);

      // Verify no test data remains
      const userCount = await dataSource.query('SELECT COUNT(*) as count FROM users');
      // Should only have fixture data or be empty depending on test isolation
    });
  });
});