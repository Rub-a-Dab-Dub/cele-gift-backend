import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Migration, MigrationStatus, MigrationType } from '../entities/migration.entity';
import { MigrationExecution } from '../entities/migration-execution.entity';
import { MigrationDependency } from '../entities/migration-dependency.entity';
import { MigrationEnvironment } from '../entities/migration-environment.entity';
import { MigrationExecutorService } from './migration-executor.service';
import { MigrationValidatorService } from './migration-validator.service';
import { MigrationPlan, PendingMigration, MigrationResult } from '../interfaces/migration.interfaces';

@Injectable()
export class MigrationOrchestratorService {
  private readonly logger = new Logger(MigrationOrchestratorService.name);

  constructor(
    @InjectRepository(Migration)
    private migrationRepository: Repository<Migration>,
    @InjectRepository(MigrationExecution)
    private executionRepository: Repository<MigrationExecution>,
    @InjectRepository(MigrationDependency)
    private dependencyRepository: Repository<MigrationDependency>,
    @InjectRepository(MigrationEnvironment)
    private environmentRepository: Repository<MigrationEnvironment>,
    private dataSource: DataSource,
    private executorService: MigrationExecutorService,
    private validatorService: MigrationValidatorService,
  ) {}

  async createMigrationPlan(environmentId: string, targetVersion?: string): Promise<MigrationPlan> {
    const environment = await this.environmentRepository.findOne({ where: { id: environmentId } });
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    const executedMigrations = await this.getExecutedMigrations(environmentId);
    const availableMigrations = await this.getAvailableMigrations(targetVersion);
    
    const pendingMigrations = availableMigrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );

    const sortedMigrations = await this.resolveDependencies(pendingMigrations);
    
    const plan: MigrationPlan = {
      migrations: sortedMigrations.map(migration => ({
        id: migration.id,
        name: migration.name,
        version: migration.version,
        type: migration.type,
        dependencies: migration.dependencies?.map(dep => dep.dependsOnId) || [],
        estimatedTime: this.estimateExecutionTime(migration),
      })),
      totalSteps: sortedMigrations.length,
      estimatedTime: sortedMigrations.reduce((total, migration) => total + this.estimateExecutionTime(migration), 0),
      risks: await this.assessRisks(sortedMigrations, environment),
    };

    return plan;
  }

  async executeMigrationPlan(environmentId: string, plan: MigrationPlan, userId: string): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      for (const migration of plan.migrations) {
        this.logger.log(`Executing migration ${migration.name} in environment ${environmentId}`);
        
        const result = await this.executeSingleMigration(
          migration.id,
          environmentId,
          userId,
          queryRunner
        );
        
        results.push(result);
        
        if (!result.success) {
          this.logger.error(`Migration ${migration.name} failed, stopping execution`);
          break;
        }
      }
    } finally {
      await queryRunner.release();
    }

    return results;
  }

  async rollbackMigration(executionId: string, userId: string): Promise<MigrationResult> {
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
      relations: ['migration', 'environment'],
    });

    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (!execution.migration.isReversible) {
      throw new Error(`Migration ${execution.migration.name} is not reversible`);
    }

    return this.executorService.rollback(execution, userId);
  }

  async rollbackToVersion(environmentId: string, targetVersion: string, userId: string): Promise<MigrationResult[]> {
    const executions = await this.executionRepository.find({
      where: { 
        environmentId,
        status: MigrationStatus.COMPLETED,
      },
      relations: ['migration'],
      order: { completedAt: 'DESC' },
    });

    const toRollback = executions.filter(
      execution => this.compareVersions(execution.migration.version, targetVersion) > 0
    );

    const results: MigrationResult[] = [];
    
    for (const execution of toRollback) {
      if (execution.migration.isReversible) {
        const result = await this.rollbackMigration(execution.id, userId);
        results.push(result);
        
        if (!result.success) {
          break;
        }
      }
    }

    return results;
  }

  private async executeSingleMigration(
    migrationId: string,
    environmentId: string,
    userId: string,
    queryRunner: QueryRunner
  ): Promise<MigrationResult> {
    const migration = await this.migrationRepository.findOne({
      where: { id: migrationId },
      relations: ['dependencies'],
    });

    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    // Validate dependencies
    const dependencyCheck = await this.validateDependencies(migration, environmentId);
    if (!dependencyCheck.isValid) {
      return {
        success: false,
        executionId: '',
        executionTime: 0,
        message: `Dependency validation failed: ${dependencyCheck.errors.map(e => e.message).join(', ')}`,
      };
    }

    // Create execution record
    const execution = this.executionRepository.create({
      migrationId,
      environmentId,
      status: MigrationStatus.RUNNING,
      startedAt: new Date(),
      executedBy: userId,
    });

    await this.executionRepository.save(execution);

    try {
      const result = await this.executorService.execute(migration, execution, queryRunner);
      
      execution.status = result.success ? MigrationStatus.COMPLETED : MigrationStatus.FAILED;
      execution.completedAt = new Date();
      execution.executionTime = result.executionTime;
      execution.errorMessage = result.message;
      
      await this.executionRepository.save(execution);
      
      return { ...result, executionId: execution.id };
    } catch (error) {
      execution.status = MigrationStatus.FAILED;
      execution.completedAt = new Date();
      execution.errorMessage = error.message;
      
      await this.executionRepository.save(execution);
      
      return {
        success: false,
        executionId: execution.id,
        executionTime: 0,
        message: error.message,
        rollbackRequired: true,
      };
    }
  }

  private async getExecutedMigrations(environmentId: string): Promise<string[]> {
    const executions = await this.executionRepository.find({
      where: { 
        environmentId,
        status: MigrationStatus.COMPLETED,
      },
      select: ['migrationId'],
    });

    return executions.map(execution => execution.migrationId);
  }

  private async getAvailableMigrations(targetVersion?: string): Promise<Migration[]> {
    const query = this.migrationRepository.createQueryBuilder('migration')
      .leftJoinAndSelect('migration.dependencies', 'dependencies');

    if (targetVersion) {
      query.where('migration.version <= :targetVersion', { targetVersion });
    }

    return query.orderBy('migration.version', 'ASC').getMany();
  }

  private async resolveDependencies(migrations: Migration[]): Promise<Migration[]> {
    const resolved: Migration[] = [];
    const resolving: Set<string> = new Set();
    const resolved_ids: Set<string> = new Set();

    const resolve = (migration: Migration) => {
      if (resolved_ids.has(migration.id)) {
        return;
      }

      if (resolving.has(migration.id)) {
        throw new Error(`Circular dependency detected involving migration ${migration.name}`);
      }

      resolving.add(migration.id);

      if (migration.dependencies) {
        for (const dependency of migration.dependencies) {
          const depMigration = migrations.find(m => m.id === dependency.dependsOnId);
          if (depMigration) {
            resolve(depMigration);
          }
        }
      }

      resolving.delete(migration.id);
      resolved_ids.add(migration.id);
      resolved.push(migration);
    };

    for (const migration of migrations) {
      resolve(migration);
    }

    return resolved;
  }

  private async validateDependencies(migration: Migration, environmentId: string) {
    return this.validatorService.validateDependencies(migration, environmentId);
  }

  private estimateExecutionTime(migration: Migration): number {
    // Simple estimation based on migration type and script length
    const baseTime = {
      [MigrationType.SCHEMA]: 30,
      [MigrationType.DATA]: 120,
      [MigrationType.SEED]: 60,
      [MigrationType.HOTFIX]: 15,
    };

    const scriptComplexity = Math.min(migration.upScript.length / 1000, 10);
    return baseTime[migration.type] + (scriptComplexity * 10);
  }

  private async assessRisks(migrations: Migration[], environment: MigrationEnvironment) {
    return this.validatorService.assessMigrationRisks(migrations, environment);
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }
}
