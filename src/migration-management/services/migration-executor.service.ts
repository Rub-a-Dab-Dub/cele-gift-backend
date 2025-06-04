import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { Migration } from '../entities/migration.entity';
import { MigrationExecution } from '../entities/migration-execution.entity';
import { MigrationResult } from '../interfaces/migration.interfaces';

@Injectable()
export class MigrationExecutorService {
  private readonly logger = new Logger(MigrationExecutorService.name);

  async execute(
    migration: Migration,
    execution: MigrationExecution,
    queryRunner: QueryRunner
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      await queryRunner.startTransaction();

      // Execute the migration script
      await this.executeScript(migration.upScript, queryRunner);

      // Execute data migration if present
      if (migration.dataScript) {
        await this.executeScript(migration.dataScript, queryRunner);
      }

      // Store rollback data if migration is reversible
      if (migration.isReversible) {
        const rollbackData = await this.captureRollbackData(migration, queryRunner);
        execution.rollbackData = rollbackData;
      }

      await queryRunner.commitTransaction();

      const executionTime = Date.now() - startTime;

      this.logger.log(`Migration ${migration.name} executed successfully in ${executionTime}ms`);

      return {
        success: true,
        executionId: execution.id,
        executionTime,
        message: 'Migration executed successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      const executionTime = Date.now() - startTime;
      
      this.logger.error(`Migration ${migration.name} failed: ${error.message}`);

      return {
        success: false,
        executionId: execution.id,
        executionTime,
        message: error.message,
        rollbackRequired: false, // Already rolled back
      };
    }
  }

  async rollback(execution: MigrationExecution, userId: string): Promise<MigrationResult> {
    const startTime = Date.now();
    const queryRunner = execution.environment.connectionConfig.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Execute rollback script
      await this.executeScript(execution.migration.downScript, queryRunner);

      // Restore data if rollback data exists
      if (execution.rollbackData) {
        await this.restoreRollbackData(execution.rollbackData, queryRunner);
      }

      await queryRunner.commitTransaction();

      // Update execution status
      execution.status = MigrationStatus.ROLLED_BACK;
      
      const executionTime = Date.now() - startTime;

      this.logger.log(`Migration ${execution.migration.name} rolled back successfully in ${executionTime}ms`);

      return {
        success: true,
        executionId: execution.id,
        executionTime,
        message: 'Migration rolled back successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      const executionTime = Date.now() - startTime;
      
      this.logger.error(`Rollback failed for migration ${execution.migration.name}: ${error.message}`);

      return {
        success: false,
        executionId: execution.id,
        executionTime,
        message: `Rollback failed: ${error.message}`,
      };
    } finally {
      await queryRunner.release();
    }
  }

  private async executeScript(script: string, queryRunner: QueryRunner): Promise<void> {
    const statements = this.parseStatements(script);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await queryRunner.query(statement);
      }
    }
  }

  private parseStatements(script: string): string[] {
    // Simple SQL statement parser - can be enhanced for complex scenarios
    return script.split(';').map(stmt => stmt.trim()).filter(stmt => stmt.length > 0);
  }

  private async captureRollbackData(migration: Migration, queryRunner: QueryRunner): Promise<any> {
    // Capture necessary data for rollback based on migration metadata
    const rollbackData: any = {};
    
    if (migration.metadata?.rollbackQueries) {
      for (const query of migration.metadata.rollbackQueries) {
        const result = await queryRunner.query(query.sql);
        rollbackData[query.key] = result;
      }
    }

    return rollbackData;
  }

  private async restoreRollbackData(rollbackData: any, queryRunner: QueryRunner): Promise<void> {
    // Restore data based on captured rollback information
    for (const [key, data] of Object.entries(rollbackData)) {
      if (Array.isArray(data) && data.length > 0) {
        // Generate INSERT statements to restore data
        const tableName = key;
        const columns = Object.keys(data[0]);
        
        for (const row of data) {
          const values = columns.map(col => `'${row[col]}'`).join(', ');
          await queryRunner.query(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values})`);
        }
      }
    }
  }
}
