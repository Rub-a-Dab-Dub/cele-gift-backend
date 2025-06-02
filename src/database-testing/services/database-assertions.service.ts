import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

export interface AssertionResult {
  passed: boolean;
  message: string;
  expected?: any;
  actual?: any;
  assertion: string;
  timestamp: Date;
}

export interface TableState {
  rowCount: number;
  columns: string[];
  constraints: any[];
  indexes: any[];
  triggers: any[];
}

@Injectable()
export class DatabaseAssertions {
  private readonly logger = new Logger(DatabaseAssertions.name);
  private assertionResults: AssertionResult[] = [];

  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  private recordAssertion(
    assertion: string,
    passed: boolean,
    message: string,
    expected?: any,
    actual?: any
  ): AssertionResult {
    const result: AssertionResult = {
      passed,
      message,
      expected,
      actual,
      assertion,
      timestamp: new Date(),
    };

    this.assertionResults.push(result);
    
    if (!passed) {
      this.logger.error(`Assertion failed: ${assertion} - ${message}`);
    } else {
      this.logger.debug(`Assertion passed: ${assertion}`);
    }

    return result;
  }

  // Record Count Assertions
  async assertRowCount(
    tableName: string,
    expectedCount: number,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const actualCount = parseInt(result[0].count);

      const passed = actualCount === expectedCount;
      return this.recordAssertion(
        'assertRowCount',
        passed,
        passed 
          ? `Table ${tableName} has expected ${expectedCount} rows`
          : `Table ${tableName} has ${actualCount} rows, expected ${expectedCount}`,
        expectedCount,
        actualCount
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertRowCountGreaterThan(
    tableName: string,
    minCount: number,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const actualCount = parseInt(result[0].count);

      const passed = actualCount > minCount;
      return this.recordAssertion(
        'assertRowCountGreaterThan',
        passed,
        passed 
          ? `Table ${tableName} has ${actualCount} rows (> ${minCount})`
          : `Table ${tableName} has ${actualCount} rows, expected > ${minCount}`,
        `> ${minCount}`,
        actualCount
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertRowCountBetween(
    tableName: string,
    minCount: number,
    maxCount: number,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const actualCount = parseInt(result[0].count);

      const passed = actualCount >= minCount && actualCount <= maxCount;
      return this.recordAssertion(
        'assertRowCountBetween',
        passed,
        passed 
          ? `Table ${tableName} has ${actualCount} rows (between ${minCount} and ${maxCount})`
          : `Table ${tableName} has ${actualCount} rows, expected between ${minCount} and ${maxCount}`,
        `${minCount} - ${maxCount}`,
        actualCount
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  // Record Existence Assertions
  async assertRecordExists(
    tableName: string,
    conditions: Record<string, any>,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const whereClause = Object.keys(conditions)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      
      const values = Object.values(conditions);
      
      const result = await runner.query(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`,
        values
      );
      
      const count = parseInt(result[0].count);
      const passed = count > 0;

      return this.recordAssertion(
        'assertRecordExists',
        passed,
        passed 
          ? `Record exists in ${tableName} with conditions ${JSON.stringify(conditions)}`
          : `No record found in ${tableName} with conditions ${JSON.stringify(conditions)}`,
        conditions,
        count
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertRecordNotExists(
    tableName: string,
    conditions: Record<string, any>,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const whereClause = Object.keys(conditions)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      
      const values = Object.values(conditions);
      
      const result = await runner.query(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`,
        values
      );
      
      const count = parseInt(result[0].count);
      const passed = count === 0;

      return this.recordAssertion(
        'assertRecordNotExists',
        passed,
        passed 
          ? `No record exists in ${tableName} with conditions ${JSON.stringify(conditions)}`
          : `Found ${count} record(s) in ${tableName} with conditions ${JSON.stringify(conditions)}`,
        conditions,
        count
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  // Column Value Assertions
  async assertColumnValue(
    tableName: string,
    columnName: string,
    expectedValue: any,
    conditions: Record<string, any>,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const whereClause = Object.keys(conditions)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      
      const values = Object.values(conditions);
      
      const result = await runner.query(
        `SELECT ${columnName} FROM ${tableName} WHERE ${whereClause} LIMIT 1`,
        values
      );
      
      if (result.length === 0) {
        return this.recordAssertion(
          'assertColumnValue',
          false,
          `No record found in ${tableName} with conditions ${JSON.stringify(conditions)}`,
          expectedValue,
          null
        );
      }

      const actualValue = result[0][columnName];
      const passed = actualValue === expectedValue;

      return this.recordAssertion(
        'assertColumnValue',
        passed,
        passed 
          ? `Column ${columnName} has expected value ${expectedValue}`
          : `Column ${columnName} has value ${actualValue}, expected ${expectedValue}`,
        expectedValue,
        actualValue
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertColumnNotNull(
    tableName: string,
    columnName: string,
    conditions: Record<string, any> = {},
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      let whereClause = `${columnName} IS NULL`;
      let values: any[] = [];

      if (Object.keys(conditions).length > 0) {
        const conditionClause = Object.keys(conditions)
          .map((key, index) => `${key} = $${index + 1}`)
          .join(' AND ');
        whereClause = `${conditionClause} AND ${columnName} IS NULL`;
        values = Object.values(conditions);
      }
      
      const result = await runner.query(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`,
        values
      );
      
      const nullCount = parseInt(result[0].count);
      const passed = nullCount === 0;

      return this.recordAssertion(
        'assertColumnNotNull',
        passed,
        passed 
          ? `Column ${columnName} has no null values`
          : `Column ${columnName} has ${nullCount} null values`,
        'no null values',
        `${nullCount} null values`
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertColumnValues(
    tableName: string,
    columnName: string,
    expectedValues: any[],
    conditions: Record<string, any> = {},
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      let whereClause = '';
      let values: any[] = [];

      if (Object.keys(conditions).length > 0) {
        whereClause = 'WHERE ' + Object.keys(conditions)
          .map((key, index) => `${key} = $${index + 1}`)
          .join(' AND ');
        values = Object.values(conditions);
      }
      
      const result = await runner.query(
        `SELECT ${columnName} FROM ${tableName} ${whereClause} ORDER BY ${columnName}`,
        values
      );
      
      const actualValues = result.map(row => row[columnName]).sort();
      const sortedExpected = [...expectedValues].sort();
      const passed = JSON.stringify(actualValues) === JSON.stringify(sortedExpected);

      return this.recordAssertion(
        'assertColumnValues',
        passed,
        passed 
          ? `Column ${columnName} has expected values`
          : `Column ${columnName} values don't match expected`,
        sortedExpected,
        actualValues
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  // Database Schema Assertions
  async assertTableExists(tableName: string, queryRunner?: QueryRunner): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [tableName]);
      
      const exists = result[0].exists;

      return this.recordAssertion(
        'assertTableExists',
        exists,
        exists 
          ? `Table ${tableName} exists`
          : `Table ${tableName} does not exist`,
        true,
        exists
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertColumnExists(
    tableName: string,
    columnName: string,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        )
      `, [tableName, columnName]);
      
      const exists = result[0].exists;

      return this.recordAssertion(
        'assertColumnExists',
        exists,
        exists 
          ? `Column ${columnName} exists in table ${tableName}`
          : `Column ${columnName} does not exist in table ${tableName}`,
        true,
        exists
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertColumnType(
    tableName: string,
    columnName: string,
    expectedType: string,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [tableName, columnName]);
      
      if (result.length === 0) {
        return this.recordAssertion(
          'assertColumnType',
          false,
          `Column ${columnName} does not exist in table ${tableName}`,
          expectedType,
          null
        );
      }

      const actualType = result[0].data_type;
      const passed = actualType.toLowerCase() === expectedType.toLowerCase();

      return this.recordAssertion(
        'assertColumnType',
        passed,
        passed 
          ? `Column ${columnName} has expected type ${expectedType}`
          : `Column ${columnName} has type ${actualType}, expected ${expectedType}`,
        expectedType,
        actualType
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertIndexExists(
    tableName: string,
    indexName: string,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE tablename = $1 AND indexname = $2
        )
      `, [tableName, indexName]);
      
      const exists = result[0].exists;

      return this.recordAssertion(
        'assertIndexExists',
        exists,
        exists 
          ? `Index ${indexName} exists on table ${tableName}`
          : `Index ${indexName} does not exist on table ${tableName}`,
        true,
        exists
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertIndexOnColumns(
    tableName: string,
    columnNames: string[],
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      // Get all indexes for the table with their column information
      const result = await runner.query(`
        SELECT 
          i.indexname,
          array_agg(a.attname ORDER BY a.attnum) as columns
        FROM pg_indexes i
        JOIN pg_class c ON c.relname = i.tablename
        JOIN pg_index idx ON idx.indexrelid = (
          SELECT oid FROM pg_class WHERE relname = i.indexname
        )
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(idx.indkey)
        WHERE i.tablename = $1
        GROUP BY i.indexname
      `, [tableName]);

      const expectedColumns = columnNames.sort();
      const matchingIndex = result.find(index => {
        const indexColumns = index.columns.sort();
        return JSON.stringify(indexColumns) === JSON.stringify(expectedColumns);
      });

      const passed = !!matchingIndex;

      return this.recordAssertion(
        'assertIndexOnColumns',
        passed,
        passed 
          ? `Index exists on columns [${columnNames.join(', ')}] in table ${tableName}`
          : `No index found on columns [${columnNames.join(', ')}] in table ${tableName}`,
        columnNames,
        matchingIndex?.indexname || 'none'
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  // Query Result Assertions
  async assertQueryResult(
    query: string,
    expectedResult: any[],
    queryParams?: any[],
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(query, queryParams);
      const passed = JSON.stringify(result) === JSON.stringify(expectedResult);

      return this.recordAssertion(
        'assertQueryResult',
        passed,
        passed 
          ? `Query returned expected result`
          : `Query result does not match expected result`,
        expectedResult,
        result
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertQueryReturnsRows(
    query: string,
    queryParams?: any[],
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(query, queryParams);
      const passed = result.length > 0;

      return this.recordAssertion(
        'assertQueryReturnsRows',
        passed,
        passed 
          ? `Query returned ${result.length} rows`
          : `Query returned no rows`,
        'rows returned',
        result.length
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertQueryReturnsNoRows(
    query: string,
    queryParams?: any[],
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(query, queryParams);
      const passed = result.length === 0;

      return this.recordAssertion(
        'assertQueryReturnsNoRows',
        passed,
        passed 
          ? `Query returned no rows as expected`
          : `Query returned ${result.length} rows, expected no rows`,
        'no rows',
        result.length
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertQueryReturnsExactly(
    query: string,
    expectedCount: number,
    queryParams?: any[],
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(query, queryParams);
      const actualCount = result.length;
      const passed = actualCount === expectedCount;

      return this.recordAssertion(
        'assertQueryReturnsExactly',
        passed,
        passed 
          ? `Query returned exactly ${expectedCount} rows`
          : `Query returned ${actualCount} rows, expected ${expectedCount}`,
        expectedCount,
        actualCount
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  // Foreign Key and Constraint Assertions
  async assertForeignKeyConstraint(
    tableName: string,
    columnName: string,
    referencedTable: string,
    referencedColumn: string,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = $1
            AND kcu.column_name = $2
            AND ccu.table_name = $3
            AND ccu.column_name = $4
        )
      `, [tableName, columnName, referencedTable, referencedColumn]);
      
      const exists = result[0].exists;

      return this.recordAssertion(
        'assertForeignKeyConstraint',
        exists,
        exists 
          ? `Foreign key constraint exists: ${tableName}.${columnName} -> ${referencedTable}.${referencedColumn}`
          : `Foreign key constraint does not exist: ${tableName}.${columnName} -> ${referencedTable}.${referencedColumn}`,
        true,
        exists
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertUniqueConstraint(
    tableName: string,
    columnNames: string[],
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      // Check for duplicate values
      const columns = columnNames.join(', ');
      const result = await runner.query(`
        SELECT ${columns}, COUNT(*) as count
        FROM ${tableName}
        GROUP BY ${columns}
        HAVING COUNT(*) > 1
        LIMIT 1
      `);
      
      const passed = result.length === 0;

      return this.recordAssertion(
        'assertUniqueConstraint',
        passed,
        passed 
          ? `Unique constraint satisfied for columns: ${columnNames.join(', ')}`
          : `Unique constraint violated for columns: ${columnNames.join(', ')}`,
        'unique values',
        passed ? 'unique values' : 'duplicate values found'
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertCheckConstraint(
    tableName: string,
    constraintName: string,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = $1 
            AND constraint_name = $2 
            AND constraint_type = 'CHECK'
        )
      `, [tableName, constraintName]);
      
      const exists = result[0].exists;

      return this.recordAssertion(
        'assertCheckConstraint',
        exists,
        exists 
          ? `Check constraint ${constraintName} exists on table ${tableName}`
          : `Check constraint ${constraintName} does not exist on table ${tableName}`,
        true,
        exists
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  // Performance Assertions
  async assertQueryExecutionTime(
    query: string,
    maxTimeMs: number,
    queryParams?: any[],
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const startTime = Date.now();
      await runner.query(query, queryParams);
      const executionTime = Date.now() - startTime;

      const passed = executionTime <= maxTimeMs;

      return this.recordAssertion(
        'assertQueryExecutionTime',
        passed,
        passed 
          ? `Query executed in ${executionTime}ms (within ${maxTimeMs}ms limit)`
          : `Query took ${executionTime}ms, exceeded limit of ${maxTimeMs}ms`,
        `≤ ${maxTimeMs}ms`,
        `${executionTime}ms`
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  async assertQueryPlan(
    query: string,
    expectedPlanElements: string[],
    queryParams?: any[],
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const planResult = await runner.query(`EXPLAIN ${query}`, queryParams);
      const planText = planResult.map(row => Object.values(row)[0]).join('\n');

      const missingElements = expectedPlanElements.filter(element => 
        !planText.toLowerCase().includes(element.toLowerCase())
      );

      const passed = missingElements.length === 0;

      return this.recordAssertion(
        'assertQueryPlan',
        passed,
        passed 
          ? `Query plan contains all expected elements`
          : `Query plan missing elements: ${missingElements.join(', ')}`,
        expectedPlanElements,
        planText
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  // Database State Assertions
  async assertDatabaseState(
    tableName: string,
    expectedState: Partial<TableState>,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const currentState = await this.getTableState(tableName, runner);
      const differences: string[] = [];

      if (expectedState.rowCount !== undefined && currentState.rowCount !== expectedState.rowCount) {
        differences.push(`Row count: expected ${expectedState.rowCount}, got ${currentState.rowCount}`);
      }

      if (expectedState.columns && !this.arraysEqual(currentState.columns, expectedState.columns)) {
        differences.push(`Columns: expected ${expectedState.columns.join(', ')}, got ${currentState.columns.join(', ')}`);
      }

      const passed = differences.length === 0;

      return this.recordAssertion(
        'assertDatabaseState',
        passed,
        passed 
          ? `Database state matches expected state for table ${tableName}`
          : `Database state differences: ${differences.join('; ')}`,
        expectedState,
        currentState
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }

  private async getTableState(tableName: string, queryRunner: QueryRunner): Promise<TableState> {
    // Get row count
    const countResult = await queryRunner.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const rowCount = parseInt(countResult[0].count);

    // Get columns
    const columnsResult = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [tableName]);
    const columns = columnsResult.map(row => row.column_name);

    // Get constraints
    const constraintsResult = await queryRunner.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = $1
    `, [tableName]);

    // Get indexes
    const indexesResult = await queryRunner.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = $1
    `, [tableName]);

    // Get triggers
    const triggersResult = await queryRunner.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = $1
    `, [tableName]);

    return {
      rowCount,
      columns,
      constraints: constraintsResult,
      indexes: indexesResult,
      triggers: triggersResult,
    };
  }

  private arraysEqual(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
  }

  // Transaction Isolation Assertions
  async assertTransactionIsolation(
    isolationLevel: string,
    queryRunner?: QueryRunner
  ): Promise<AssertionResult> {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;

    try {
      if (shouldConnect) await runner.connect();

      const result = await runner.query("SELECT current_setting('transaction_isolation')");
      const currentIsolation = result[0].current_setting.replace(/ /g, '_').toUpperCase();
      const expectedIsolation = isolationLevel.replace(/ /g, '_').toUpperCase();

      const passed = currentIsolation === expectedIsolation;

      return this.recordAssertion(
        'assertTransactionIsolation',
        passed,
        passed 
          ? `Transaction isolation level is ${isolationLevel}`
          : `Transaction isolation level is ${currentIsolation}, expected ${expectedIsolation}`,
        expectedIsolation,
        currentIsolation
      );
    } finally {
      if (shouldConnect) await runner.release();
    }
  }
}