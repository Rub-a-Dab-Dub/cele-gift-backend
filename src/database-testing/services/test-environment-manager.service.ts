import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface TestEnvironment {
  id: string;
  name: string;
  type: 'isolated' | 'shared' | 'temporary';
  status: 'active' | 'cleanup' | 'destroyed';
  createdAt: Date;
  config: {
    database: string;
    isolationLevel: string;
    autoCleanup: boolean;
    maxDuration: number;
  };
}

export interface EnvironmentSetupOptions {
  name?: string;
  type?: 'isolated' | 'shared' | 'temporary';
  isolationLevel?: 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  autoCleanup?: boolean;
  maxDuration?: number;
  fixtures?: string[];
  seedData?: any;
}

@Injectable()
export class TestEnvironmentManager {
  private readonly logger = new Logger(TestEnvironmentManager.name);
  private activeEnvironments = new Map<string, TestEnvironment>();
  private environmentTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async createTestEnvironment(options: EnvironmentSetupOptions = {}): Promise<string> {
    const environmentId = `test_env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const environment: TestEnvironment = {
      id: environmentId,
      name: options.name || `Test Environment ${environmentId}`,
      type: options.type || 'isolated',
      status: 'active',
      createdAt: new Date(),
      config: {
        database: `test_db_${environmentId}`,
        isolationLevel: options.isolationLevel || 'READ_COMMITTED',
        autoCleanup: options.autoCleanup !== false,
        maxDuration: options.maxDuration || 300000, // 5 minutes default
      },
    };

    try {
      // Create isolated database if needed
      if (environment.type === 'isolated' || environment.type === 'temporary') {
        await this.createIsolatedDatabase(environment);
      }

      // Set up test data if provided
      if (options.fixtures || options.seedData) {
        await this.setupTestData(environment, options);
      }

      // Set up auto-cleanup timeout
      if (environment.config.autoCleanup && environment.config.maxDuration > 0) {
        const timeout = setTimeout(async () => {
          await this.destroyEnvironment(environmentId);
        }, environment.config.maxDuration);
        
        this.environmentTimeouts.set(environmentId, timeout);
      }

      this.activeEnvironments.set(environmentId, environment);
      
      this.logger.log(`Created test environment: ${environmentId} (${environment.type})`);
      return environmentId;

    } catch (error) {
      this.logger.error(`Failed to create test environment: ${environmentId}`, error);
      throw error;
    }
  }

  private async createIsolatedDatabase(environment: TestEnvironment): Promise<void> {
    // Create a new database for isolation
    try {
      await this.dataSource.query(`CREATE DATABASE ${environment.config.database}`);
      
      // Copy schema from main database
      await this.copyDatabaseSchema(environment.config.database);
      
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
      // Database already exists, continue
    }
  }

  private async copyDatabaseSchema(targetDatabase: string): Promise<void> {
    // Get current database schema
    const tables = await this.dataSource.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    // This is a simplified version - in reality, you'd need to copy
    // the entire schema including constraints, indexes, etc.
    for (const table of tables) {
      await this.dataSource.query(`
        CREATE TABLE ${targetDatabase}.${table.tablename} 
        AS SELECT * FROM ${table.tablename} WHERE 1=0
      `);
    }
  }

  private async setupTestData(
    environment: TestEnvironment, 
    options: EnvironmentSetupOptions
  ): Promise<void> {
    // Load fixtures if provided
    if (options.fixtures) {
      // This would integrate with the fixture manager
      this.logger.log(`Loading fixtures for environment ${environment.id}: ${options.fixtures.join(', ')}`);
    }

    // Insert seed data if provided
    if (options.seedData) {
      this.logger.log(`Setting up seed data for environment ${environment.id}`);
      // Implementation would depend on the structure of seedData
    }
  }

  async getEnvironment(environmentId: string): Promise<TestEnvironment | null> {
    return this.activeEnvironments.get(environmentId) || null;
  }

  async getActiveEnvironments(): Promise<TestEnvironment[]> {
    return Array.from(this.activeEnvironments.values());
  }

  async extendEnvironmentTimeout(environmentId: string, additionalMs: number): Promise<void> {
    const environment = this.activeEnvironments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    // Clear existing timeout
    const existingTimeout = this.environmentTimeouts.get(environmentId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      await this.destroyEnvironment(environmentId);
    }, additionalMs);
    
    this.environmentTimeouts.set(environmentId, timeout);
    
    this.logger.log(`Extended timeout for environment ${environmentId} by ${additionalMs}ms`);
  }

  async cleanupEnvironment(environmentId: string): Promise<void> {
    const environment = this.activeEnvironments.get(environmentId);
    if (!environment) {
      return;
    }

    environment.status = 'cleanup';

    try {
      // Clear test data based on environment type
      if (environment.type === 'shared') {
        await this.cleanupSharedEnvironment(environment);
      } else if (environment.type === 'isolated' || environment.type === 'temporary') {
        await this.cleanupIsolatedEnvironment(environment);
      }

      this.logger.log(`Cleaned up environment: ${environmentId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup environment ${environmentId}`, error);
      throw error;
    }
  }

  private async cleanupSharedEnvironment(environment: TestEnvironment): Promise<void> {
    // For shared environments, only clean up test-specific data
    // This would need to track what data was created during the test
    
    // Example: Clean up by timestamp or test markers
    const cutoffTime = environment.createdAt;
    
    // This is a simplified cleanup - real implementation would need
    // more sophisticated tracking of test data
  }

  private async cleanupIsolatedEnvironment(environment: TestEnvironment): Promise<void> {
    // For isolated environments, we can drop the entire database
    try {
      await this.dataSource.query(`DROP DATABASE IF EXISTS ${environment.config.database}`);
    } catch (error) {
      this.logger.warn(`Failed to drop database ${environment.config.database}`, error);
    }
  }

  async destroyEnvironment(environmentId: string): Promise<void> {
    const environment = this.activeEnvironments.get(environmentId);
    if (!environment) {
      this.logger.warn(`Environment ${environmentId} not found for destruction`);
      return;
    }

    try {
      // Cleanup first
      await this.cleanupEnvironment(environmentId);

      // Clear timeout
      const timeout = this.environmentTimeouts.get(environmentId);
      if (timeout) {
        clearTimeout(timeout);
        this.environmentTimeouts.delete(environmentId);
      }

      // Remove from active environments
      environment.status = 'destroyed';
      this.activeEnvironments.delete(environmentId);

      this.logger.log(`Destroyed environment: ${environmentId}`);

    } catch (error) {
      this.logger.error(`Failed to destroy environment ${environmentId}`, error);
      throw error;
    }
  }

  async destroyAllEnvironments(): Promise<void> {
    const environmentIds = Array.from(this.activeEnvironments.keys());
    
    for (const environmentId of environmentIds) {
      try {
        await this.destroyEnvironment(environmentId);
      } catch (error) {
        this.logger.error(`Failed to destroy environment ${environmentId}`, error);
      }
    }

    this.logger.log(`Destroyed ${environmentIds.length} environments`);
  }

  async getEnvironmentStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    averageLifetime: number;
  }> {
    const environments = Array.from(this.activeEnvironments.values());
    
    const byType = environments.reduce((acc, env) => {
      acc[env.type] = (acc[env.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = environments.reduce((acc, env) => {
      acc[env.status] = (acc[env.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const now = Date.now();
    const lifetimes = environments.map(env => now - env.createdAt.getTime());
    const averageLifetime = lifetimes.length > 0 
      ? lifetimes.reduce((sum, time) => sum + time, 0) / lifetimes.length 
      : 0;

    return {
      total: environments.length,
      byType,
      byStatus,
      averageLifetime,
    };
  }

  // Utility method for test isolation
  async withIsolatedEnvironment<T>(
    testFunction: (environmentId: string) => Promise<T>,
    options: EnvironmentSetupOptions = {}
  ): Promise<T> {
    const environmentId = await this.createTestEnvironment({
      ...options,
      type: 'temporary',
      autoCleanup: true,
    });

    try {
      return await testFunction(environmentId);
    } finally {
      await this.destroyEnvironment(environmentId);
    }
  }

  // Health check for environments
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    environments: Array<{ id: string; status: string; age: number }>;
  }> {
    const issues: string[] = [];
    const environments = Array.from(this.activeEnvironments.values());
    const now = Date.now();

    // Check for long-running environments
    const staleEnvironments = environments.filter(env => 
      now - env.createdAt.getTime() > env.config.maxDuration * 2
    );

    if (staleEnvironments.length > 0) {
      issues.push(`${staleEnvironments.length} stale environments detected`);
    }

    // Check for too many active environments
    if (environments.length > 50) {
      issues.push(`Too many active environments: ${environments.length}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      environments: environments.map(env => ({
        id: env.id,
        status: env.status,
        age: now - env.createdAt.getTime(),
      })),
    };
  }
}