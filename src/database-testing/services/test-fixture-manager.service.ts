import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { TestFixture, FixtureStatus } from '../entities/test-fixture.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface FixtureData {
  [tableName: string]: any[];
}

export interface FixtureLoadOptions {
  cascade?: boolean;
  skipValidation?: boolean;
  truncateFirst?: boolean;
  preserveIds?: boolean;
  batchSize?: number;
}

export interface FixtureLoadResult {
  fixture: string;
  tablesLoaded: string[];
  recordsLoaded: number;
  duration: number;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class TestFixtureManager {
  private readonly logger = new Logger(TestFixtureManager.name);
  private readonly loadedFixtures = new Map<string, FixtureLoadResult>();
  private readonly fixtureCache = new Map<string, FixtureData>();

  constructor(
    @InjectRepository(TestFixture)
    private fixtureRepository: Repository<TestFixture>,
    @InjectDataSource() private dataSource: DataSource,
    @Inject('DATABASE_TESTING_OPTIONS') private options: any,
  ) {}

  async loadFixture(
    fixtureName: string, 
    queryRunner?: QueryRunner,
    options: FixtureLoadOptions = {}
  ): Promise<FixtureLoadResult> {
    const startTime = Date.now();
    const result: FixtureLoadResult = {
      fixture: fixtureName,
      tablesLoaded: [],
      recordsLoaded: 0,
      duration: 0,
      errors: [],
      warnings: [],
    };

    try {
      // Get fixture definition
      const fixture = await this.getFixture(fixtureName);
      if (!fixture) {
        throw new Error(`Fixture '${fixtureName}' not found`);
      }

      // Load dependencies first
      if (fixture.dependencies && fixture.dependencies.length > 0 && options.cascade !== false) {
        for (const dependency of fixture.dependencies) {
          await this.loadFixture(dependency, queryRunner, options);
        }
      }

      // Load fixture data
      const fixtureData = await this.loadFixtureData(fixture);
      
      // Use provided query runner or create new one
      const runner = queryRunner || this.dataSource.createQueryRunner();
      const shouldConnect = !queryRunner;
      
      if (shouldConnect) {
        await runner.connect();
      }

      try {
        // Truncate tables if requested
        if (options.truncateFirst) {
          await this.truncateTables(runner, Object.keys(fixtureData));
        }

        // Load data for each table
        for (const [tableName, records] of Object.entries(fixtureData)) {
          if (!Array.isArray(records) || records.length === 0) {
            continue;
          }

          const loadedCount = await this.loadTableData(
            runner, 
            tableName, 
            records, 
            options
          );
          
          result.tablesLoaded.push(tableName);
          result.recordsLoaded += loadedCount;
        }

        // Update fixture status
        await this.fixtureRepository.update(fixture.id, {
          status: FixtureStatus.ACTIVE,
          lastLoaded: new Date(),
          loadCount: fixture.loadCount + 1,
          loadError: null,
        });

        // Cache the loaded fixture
        this.loadedFixtures.set(fixtureName, result);

        this.logger.log(`Loaded fixture '${fixtureName}' with ${result.recordsLoaded} records`);

      } finally {
        if (shouldConnect) {
          await runner.release();
        }
      }

    } catch (error) {
      result.errors.push(error.message);
      this.logger.error(`Failed to load fixture '${fixtureName}'`, error);
      
      // Update fixture with error
      const fixture = await this.getFixture(fixtureName);
      if (fixture) {
        await this.fixtureRepository.update(fixture.id, {
          status: FixtureStatus.FAILED,
          loadError: error.message,
        });
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  async loadFixtures(
    fixtureNames: string[], 
    queryRunner?: QueryRunner,
    options: FixtureLoadOptions = {}
  ): Promise<FixtureLoadResult[]> {
    const results: FixtureLoadResult[] = [];
    
    // Sort fixtures by load order and dependencies
    const sortedFixtures = await this.sortFixturesByDependencies(fixtureNames);
    
    for (const fixtureName of sortedFixtures) {
      const result = await this.loadFixture(fixtureName, queryRunner, options);
      results.push(result);
      
      // Stop on first error if cascade is enabled
      if (result.errors.length > 0 && options.cascade !== false) {
        break;
      }
    }
    
    return results;
  }

  private async loadTableData(
    queryRunner: QueryRunner,
    tableName: string,
    records: any[],
    options: FixtureLoadOptions
  ): Promise<number> {
    let loadedCount = 0;
    const batchSize = options.batchSize || 100;

    // Process records in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          // Prepare insert query
          const columns = Object.keys(record);
          const values = Object.values(record);
          const placeholders = values.map((_, index) => `${index + 1}`).join(', ');
          
          let query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
          
          // Handle ID preservation
          if (options.preserveIds && record.id) {
            query += ` ON CONFLICT (id) DO UPDATE SET ${columns
              .filter(col => col !== 'id')
              .map(col => `${col} = EXCLUDED.${col}`)
              .join(', ')}`;
          } else {
            query += ` ON CONFLICT DO NOTHING`;
          }

          await queryRunner.query(query, values);
          loadedCount++;
        } catch (error) {
          this.logger.warn(`Failed to insert record into ${tableName}:`, error.message);
          if (!options.skipValidation) {
            throw error;
          }
        }
      }
    }

    return loadedCount;
  }

  private async truncateTables(queryRunner: QueryRunner, tableNames: string[]): Promise<void> {
    // Disable foreign key checks temporarily
    await queryRunner.query('SET session_replication_role = replica');
    
    try {
      for (const tableName of tableNames) {
        await queryRunner.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
      }
    } finally {
      // Re-enable foreign key checks
      await queryRunner.query('SET session_replication_role = DEFAULT');
    }
  }

  private async loadFixtureData(fixture: TestFixture): Promise<FixtureData> {
    // Check cache first
    if (this.fixtureCache.has(fixture.name)) {
      return this.fixtureCache.get(fixture.name);
    }

    let fixtureData: FixtureData;

    if (fixture.fixtureData) {
      // Data is stored in database
      fixtureData = fixture.fixtureData;
    } else {
      // Load from file
      fixtureData = await this.loadFixtureFromFile(fixture.filePath);
    }

    // Apply table mapping if provided
    if (fixture.tableMapping) {
      const mappedData: FixtureData = {};
      for (const [originalTable, mappedTable] of Object.entries(fixture.tableMapping)) {
        if (fixtureData[originalTable]) {
          mappedData[mappedTable] = fixtureData[originalTable];
        }
      }
      fixtureData = { ...fixtureData, ...mappedData };
    }

    // Cache the data
    this.fixtureCache.set(fixture.name, fixtureData);
    
    return fixtureData;
  }

  private async loadFixtureFromFile(filePath: string): Promise<FixtureData> {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fixture file not found: ${fullPath}`);
    }

    const fileExtension = path.extname(fullPath).toLowerCase();
    const fileContent = fs.readFileSync(fullPath, 'utf8');

    switch (fileExtension) {
      case '.json':
        return JSON.parse(fileContent);
      
      case '.yaml':
      case '.yml':
        return yaml.load(fileContent) as FixtureData;
      
      case '.sql':
        // For SQL files, we'll parse them differently
        return await this.parseSqlFixture(fileContent);
      
      default:
        throw new Error(`Unsupported fixture file format: ${fileExtension}`);
    }
  }

  private async parseSqlFixture(sqlContent: string): Promise<FixtureData> {
    // This is a simplified SQL parser for INSERT statements
    // In production, you might want to use a proper SQL parser
    const fixtureData: FixtureData = {};
    const insertRegex = /INSERT\s+INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/gi;
    
    let match;
    while ((match = insertRegex.exec(sqlContent)) !== null) {
      const tableName = match[1];
      const columns = match[2].split(',').map(col => col.trim());
      const values = match[3].split(',').map(val => val.trim().replace(/'/g, ''));
      
      if (!fixtureData[tableName]) {
        fixtureData[tableName] = [];
      }
      
      const record: any = {};
      columns.forEach((col, index) => {
        record[col] = values[index];
      });
      
      fixtureData[tableName].push(record);
    }
    
    return fixtureData;
  }

  async cleanupFixture(fixtureName: string, queryRunner?: QueryRunner): Promise<void> {
    const fixture = await this.getFixture(fixtureName);
    if (!fixture || !fixture.autoCleanup) {
      return;
    }

    const runner = queryRunner || this.dataSource.createQueryRunner();
    const shouldConnect = !queryRunner;
    
    if (shouldConnect) {
      await runner.connect();
    }

    try {
      const fixtureData = await this.loadFixtureData(fixture);
      const tableNames = Object.keys(fixtureData);
      
      // Cleanup in reverse order to handle foreign key constraints
      for (const tableName of tableNames.reverse()) {
        await runner.query(`DELETE FROM ${tableName} WHERE 1=1`);
      }
      
      this.logger.log(`Cleaned up fixture '${fixtureName}'`);
    } finally {
      if (shouldConnect) {
        await runner.release();
      }
    }

    // Remove from cache
    this.fixtureCache.delete(fixtureName);
    this.loadedFixtures.delete(fixtureName);
  }

  async cleanupAllFixtures(queryRunner?: QueryRunner): Promise<void> {
    const loadedFixtureNames = Array.from(this.loadedFixtures.keys());
    
    for (const fixtureName of loadedFixtureNames) {
      await this.cleanupFixture(fixtureName, queryRunner);
    }
  }

  private async sortFixturesByDependencies(fixtureNames: string[]): Promise<string[]> {
    const fixtures = await this.fixtureRepository.find({
      where: { name: fixtureNames as any },
      order: { loadOrder: 'ASC' },
    });

    // Topological sort based on dependencies
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (fixtureName: string) => {
      if (visiting.has(fixtureName)) {
        throw new Error(`Circular dependency detected involving fixture: ${fixtureName}`);
      }
      
      if (visited.has(fixtureName)) {
        return;
      }

      visiting.add(fixtureName);
      
      const fixture = fixtures.find(f => f.name === fixtureName);
      if (fixture && fixture.dependencies) {
        for (const dependency of fixture.dependencies) {
          if (fixtureNames.includes(dependency)) {
            visit(dependency);
          }
        }
      }
      
      visiting.delete(fixtureName);
      visited.add(fixtureName);
      sorted.push(fixtureName);
    };

    for (const fixtureName of fixtureNames) {
      visit(fixtureName);
    }

    return sorted;
  }

  async createFixture(
    name: string,
    filePath: string,
    options: Partial<TestFixture> = {}
  ): Promise<TestFixture> {
    const existingFixture = await this.fixtureRepository.findOne({ where: { name } });
    if (existingFixture) {
      throw new Error(`Fixture '${name}' already exists`);
    }

    const fixture = this.fixtureRepository.create({
      name,
      filePath,
      description: options.description || `Test fixture: ${name}`,
      dependencies: options.dependencies || [],
      loadOrder: options.loadOrder || 0,
      autoCleanup: options.autoCleanup !== false,
      status: FixtureStatus.INACTIVE,
      ...options,
    });

    return await this.fixtureRepository.save(fixture);
  }

  async updateFixture(name: string, updates: Partial<TestFixture>): Promise<TestFixture> {
    const fixture = await this.getFixture(name);
    if (!fixture) {
      throw new Error(`Fixture '${name}' not found`);
    }

    await this.fixtureRepository.update(fixture.id, updates);
    
    // Clear cache
    this.fixtureCache.delete(name);
    
    return await this.getFixture(name);
  }

  async deleteFixture(name: string): Promise<void> {
    const fixture = await this.getFixture(name);
    if (!fixture) {
      throw new Error(`Fixture '${name}' not found`);
    }

    await this.fixtureRepository.delete(fixture.id);
    
    // Clear cache
    this.fixtureCache.delete(name);
    this.loadedFixtures.delete(name);
  }

  async getFixture(name: string): Promise<TestFixture | null> {
    return await this.fixtureRepository.findOne({ where: { name } });
  }

  async getAllFixtures(): Promise<TestFixture[]> {
    return await this.fixtureRepository.find({
      order: { loadOrder: 'ASC', name: 'ASC' },
    });
  }

  async getFixtureStatus(name: string): Promise<any> {
    const fixture = await this.getFixture(name);
    if (!fixture) {
      return null;
    }

    const loadResult = this.loadedFixtures.get(name);
    
    return {
      fixture: {
        name: fixture.name,
        status: fixture.status,
        lastLoaded: fixture.lastLoaded,
        loadCount: fixture.loadCount,
        dependencies: fixture.dependencies,
      },
      loadResult,
      isLoaded: this.loadedFixtures.has(name),
      isCached: this.fixtureCache.has(name),
    };
  }

  async validateFixture(name: string): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const fixture = await this.getFixture(name);
      if (!fixture) {
        errors.push(`Fixture '${name}' not found`);
        return { isValid: false, errors };
      }

      // Check file existence
      if (fixture.filePath && !fs.existsSync(fixture.filePath)) {
        errors.push(`Fixture file not found: ${fixture.filePath}`);
      }

      // Check dependencies
      if (fixture.dependencies) {
        for (const dependency of fixture.dependencies) {
          const dependencyFixture = await this.getFixture(dependency);
          if (!dependencyFixture) {
            errors.push(`Dependency fixture '${dependency}' not found`);
          }
        }
      }

      // Try to load fixture data
      try {
        const fixtureData = await this.loadFixtureData(fixture);
        
        // Validate data structure
        if (!fixtureData || typeof fixtureData !== 'object') {
          errors.push('Invalid fixture data structure');
        } else {
          // Check if tables exist in database
          for (const tableName of Object.keys(fixtureData)) {
            const tableExists = await this.tableExists(tableName);
            if (!tableExists) {
              errors.push(`Table '${tableName}' does not exist in database`);
            }
          }
        }
      } catch (error) {
        errors.push(`Failed to load fixture data: ${error.message}`);
      }

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [tableName]);
      
      return result[0]?.exists || false;
    } catch (error) {
      return false;
    }
  }

  async generateFixtureFromDatabase(
    tableName: string,
    fixtureName: string,
    options: {
      where?: string;
      limit?: number;
      includeRelated?: boolean;
    } = {}
  ): Promise<TestFixture> {
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select('*')
      .from(tableName, tableName);

    if (options.where) {
      queryBuilder.where(options.where);
    }

    if (options.limit) {
      queryBuilder.limit(options.limit);
    }

    const records = await queryBuilder.getRawMany();
    
    const fixtureData: FixtureData = {
      [tableName]: records,
    };

    const fixture = this.fixtureRepository.create({
      name: fixtureName,
      description: `Generated fixture from table ${tableName}`,
      filePath: '',
      fixtureData,
      status: FixtureStatus.ACTIVE,
    });

    return await this.fixtureRepository.save(fixture);
  }
}