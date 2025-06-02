import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { faker } from '@faker-js/faker';

export interface DataGenerationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'uuid' | 'enum' | 'foreign_key' | 'custom';
  options?: {
    min?: number;
    max?: number;
    length?: number;
    values?: any[];
    format?: string;
    nullable?: boolean;
    unique?: boolean;
    generator?: () => any;
    references?: {
      table: string;
      column: string;
      where?: string;
    };
  };
}

export interface TableGenerationConfig {
  tableName: string;
  count: number;
  rules: DataGenerationRule[];
  dependencies?: string[];
  cleanup?: boolean;
}

@Injectable()
export class TestDataGenerator {
  private readonly logger = new Logger(TestDataGenerator.name);
  private generatedData = new Map<string, any[]>();
  private uniqueValues = new Map<string, Set<any>>();

  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async generateTestData(config: TableGenerationConfig): Promise<any[]> {
    this.logger.log(`Generating ${config.count} records for table ${config.tableName}`);
    
    const records: any[] = [];
    
    for (let i = 0; i < config.count; i++) {
      const record: any = {};
      
      for (const rule of config.rules) {
        const value = await this.generateFieldValue(rule, i, records);
        record[rule.field] = value;
      }
      
      records.push(record);
    }
    
    // Store generated data for reference
    this.generatedData.set(config.tableName, records);
    
    return records;
  }

  private async generateFieldValue(
    rule: DataGenerationRule,
    index: number,
    existingRecords: any[]
  ): Promise<any> {
    const { type, options = {} } = rule;
    
    // Handle nullable fields
    if (options.nullable && Math.random() < 0.1) {
      return null;
    }
    
    let value: any;
    
    switch (type) {
      case 'string':
        value = this.generateString(options);
        break;
        
      case 'number':
        value = this.generateNumber(options);
        break;
        
      case 'boolean':
        value = faker.datatype.boolean();
        break;
        
      case 'date':
        value = this.generateDate(options);
        break;
        
      case 'email':
        value = faker.internet.email();
        break;
        
      case 'uuid':
        value = faker.string.uuid();
        break;
        
      case 'enum':
        value = faker.helpers.arrayElement(options.values || []);
        break;
        
      case 'foreign_key':
        value = await this.generateForeignKey(options);
        break;
        
      case 'custom':
        value = options.generator ? options.generator() : null;
        break;
        
      default:
        value = faker.lorem.word();
    }
    
    // Handle unique constraint
    if (options.unique) {
      const uniqueKey = `${rule.field}`;
      if (!this.uniqueValues.has(uniqueKey)) {
        this.uniqueValues.set(uniqueKey, new Set());
      }
      
      const uniqueSet = this.uniqueValues.get(uniqueKey);
      let attempts = 0;
      
      while (uniqueSet.has(value) && attempts < 100) {
        value = await this.generateFieldValue(
          { ...rule, options: { ...options, unique: false } },
          index,
          existingRecords
        );
        attempts++;
      }
      
      uniqueSet.add(value);
    }
    
    return value;
  }

  private generateString(options: any): string {
    if (options.format) {
      return faker.helpers.fake(options.format);
    }
    
    const length = options.length || faker.number.int({ min: 5, max: 50 });
    return faker.lorem.words({ min: 1, max: Math.ceil(length / 5) }).substring(0, length);
  }

  private generateNumber(options: any): number {
    const min = options.min || 0;
    const max = options.max || 1000;
    return faker.number.int({ min, max });
  }

  private generateDate(options: any): Date {
    if (options.min && options.max) {
      return faker.date.between({ from: options.min, to: options.max });
    }
    return faker.date.recent();
  }

  private async generateForeignKey(options: any): Promise<any> {
    if (!options.references) {
      throw new Error('Foreign key rule must specify references');
    }
    
    const { table, column, where } = options.references;
    
    try {
      let query = `SELECT ${column} FROM ${table}`;
      const params: any[] = [];
      
      if (where) {
        query += ` WHERE ${where}`;
      }
      
      query += ' ORDER BY RANDOM() LIMIT 1';
      
      const result = await this.dataSource.query(query, params);
      
      if (result.length === 0) {
        this.logger.warn(`No reference data found in ${table}.${column}`);
        return null;
      }
      
      return result[0][column];
    } catch (error) {
      this.logger.error(`Failed to generate foreign key for ${table}.${column}`, error);
      return null;
    }
  }

  async insertGeneratedData(
    tableName: string,
    data: any[],
    options: {
      batchSize?: number;
      onConflict?: 'ignore' | 'update' | 'error';
      truncateFirst?: boolean;
    } = {}
  ): Promise<number> {
    const { batchSize = 1000, onConflict = 'ignore', truncateFirst = false } = options;
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      await queryRunner.startTransaction();
      
      // Truncate table if requested
      if (truncateFirst) {
        await queryRunner.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
      }
      
      let insertedCount = 0;
      
      // Process data in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        if (batch.length === 0) continue;
        
        const columns = Object.keys(batch[0]);
        const values: any[] = [];
        const placeholders: string[] = [];
        
        batch.forEach((record, recordIndex) => {
          const recordPlaceholders: string[] = [];
          columns.forEach((column, columnIndex) => {
            const paramIndex = values.length + 1;
            recordPlaceholders.push(`$${paramIndex}`);
            values.push(record[column]);
          });
          placeholders.push(`(${recordPlaceholders.join(', ')})`);
        });
        
        let query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;
        
        // Handle conflicts
        if (onConflict === 'ignore') {
          query += ' ON CONFLICT DO NOTHING';
        } else if (onConflict === 'update') {
          const updateClauses = columns
            .filter(col => col !== 'id')
            .map(col => `${col} = EXCLUDED.${col}`)
            .join(', ');
          query += ` ON CONFLICT (id) DO UPDATE SET ${updateClauses}`;
        }
        
        const result = await queryRunner.query(query, values);
        insertedCount += result.affectedRows || batch.length;
      }
      
      await queryRunner.commitTransaction();
      
      this.logger.log(`Inserted ${insertedCount} records into ${tableName}`);
      return insertedCount;
      
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to insert data into ${tableName}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async generateDataSet(configs: TableGenerationConfig[]): Promise<Map<string, any[]>> {
    const results = new Map<string, any[]>();
    
    // Sort by dependencies
    const sortedConfigs = this.sortByDependencies(configs);
    
    for (const config of sortedConfigs) {
      const data = await this.generateTestData(config);
      results.set(config.tableName, data);
      
      // Insert data if requested
      if (config.cleanup !== false) {
        await this.insertGeneratedData(config.tableName, data, {
          truncateFirst: true,
          onConflict: 'ignore',
        });
      }
    }
    
    return results;
  }

  private sortByDependencies(configs: TableGenerationConfig[]): TableGenerationConfig[] {
    const sorted: TableGenerationConfig[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (config: TableGenerationConfig) => {
      if (visiting.has(config.tableName)) {
        throw new Error(`Circular dependency detected: ${config.tableName}`);
      }
      
      if (visited.has(config.tableName)) {
        return;
      }
      
      visiting.add(config.tableName);
      
      // Visit dependencies first
      if (config.dependencies) {
        for (const depName of config.dependencies) {
          const depConfig = configs.find(c => c.tableName === depName);
          if (depConfig) {
            visit(depConfig);
          }
        }
      }
      
      visiting.delete(config.tableName);
      visited.add(config.tableName);
      sorted.push(config);
    };
    
    for (const config of configs) {
      visit(config);
    }
    
    return sorted;
  }

  // Predefined generators for common patterns
  createUserGenerator(count: number): TableGenerationConfig {
    return {
      tableName: 'users',
      count,
      rules: [
        {
          field: 'id',
          type: 'uuid',
          options: { unique: true },
        },
        {
          field: 'email',
          type: 'email',
          options: { unique: true },
        },
        {
          field: 'first_name',
          type: 'string',
          options: { generator: () => faker.person.firstName() },
        },
        {
          field: 'last_name',
          type: 'string',
          options: { generator: () => faker.person.lastName() },
        },
        {
          field: 'age',
          type: 'number',
          options: { min: 18, max: 80 },
        },
        {
          field: 'created_at',
          type: 'date',
          options: { 
            min: new Date('2020-01-01'), 
            max: new Date() 
          },
        },
        {
          field: 'is_active',
          type: 'boolean',
        },
      ],
    };
  }

  createOrderGenerator(count: number, userTableName: string = 'users'): TableGenerationConfig {
    return {
      tableName: 'orders',
      count,
      dependencies: [userTableName],
      rules: [
        {
          field: 'id',
          type: 'uuid',
          options: { unique: true },
        },
        {
          field: 'user_id',
          type: 'foreign_key',
          options: {
            references: {
              table: userTableName,
              column: 'id',
            },
          },
        },
        {
          field: 'total_amount',
          type: 'number',
          options: { min: 10, max: 1000 },
        },
        {
          field: 'status',
          type: 'enum',
          options: { values: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] },
        },
        {
          field: 'order_date',
          type: 'date',
          options: { 
            min: new Date('2023-01-01'), 
            max: new Date() 
          },
        },
      ],
    };
  }

  // Data relationship helpers
  async generateRelatedData(
    parentTable: string,
    parentId: any,
    childConfig: TableGenerationConfig,
    foreignKeyField: string
  ): Promise<any[]> {
    const modifiedRules = childConfig.rules.map(rule => {
      if (rule.field === foreignKeyField) {
        return {
          ...rule,
          type: 'custom' as const,
          options: {
            ...rule.options,
            generator: () => parentId,
          },
        };
      }
      return rule;
    });

    return await this.generateTestData({
      ...childConfig,
      rules: modifiedRules,
    });
  }

  // Performance optimized bulk generation
  async generateLargeDataSet(
    config: TableGenerationConfig,
    chunkSize: number = 10000
  ): Promise<number> {
    let totalInserted = 0;
    const totalCount = config.count;
    
    for (let i = 0; i < totalCount; i += chunkSize) {
      const currentChunk = Math.min(chunkSize, totalCount - i);
      
      const chunkConfig = {
        ...config,
        count: currentChunk,
      };
      
      const data = await this.generateTestData(chunkConfig);
      const inserted = await this.insertGeneratedData(config.tableName, data, {
        batchSize: 1000,
        onConflict: 'ignore',
      });
      
      totalInserted += inserted;
      
      this.logger.log(`Generated chunk ${Math.floor(i / chunkSize) + 1}, total: ${totalInserted}/${totalCount}`);
      
      // Clear memory
      this.clearGeneratedData(config.tableName);
    }
    
    return totalInserted;
  }

  // Cleanup methods
  clearGeneratedData(tableName?: string): void {
    if (tableName) {
      this.generatedData.delete(tableName);
    } else {
      this.generatedData.clear();
    }
  }

  clearUniqueValues(): void {
    this.uniqueValues.clear();
  }

  getGeneratedData(tableName: string): any[] {
    return this.generatedData.get(tableName) || [];
  }

  async cleanupTestData(tableNames: string[]): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      await queryRunner.startTransaction();
      
      // Disable foreign key checks temporarily
      await queryRunner.query('SET session_replication_role = replica');
      
      // Clean up in reverse order to handle dependencies
      for (const tableName of tableNames.reverse()) {
        await queryRunner.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
        this.logger.log(`Cleaned up test data from ${tableName}`);
      }
      
      // Re-enable foreign key checks
      await queryRunner.query('SET session_replication_role = DEFAULT');
      
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to cleanup test data', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}