import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Migration, MigrationType } from '../entities/migration.entity';
import { MigrationExecution, MigrationStatus } from '../entities/migration-execution.entity';
import { MigrationEnvironment, EnvironmentType } from '../entities/migration-environment.entity';
import { ValidationResult, MigrationRisk } from '../interfaces/migration.interfaces';

@Injectable()
export class MigrationValidatorService {
  constructor(
    @InjectRepository(Migration)
    private migrationRepository: Repository<Migration>,
    @InjectRepository(MigrationExecution)
    private executionRepository: Repository<MigrationExecution>,
  ) {}

  async validateMigration(migration: Migration): Promise<ValidationResult> {
    const errors = [];
    const warnings = [];

    // Validate script syntax
    if (!migration.upScript || migration.upScript.trim().length === 0) {
      errors.push({
        code: 'EMPTY_UP_SCRIPT',
        message: 'Migration up script cannot be empty',
        severity: 'error' as const,
      });
    }

    if (migration.isReversible && (!migration.downScript || migration.downScript.trim().length === 0)) {
      errors.push({
        code: 'EMPTY_DOWN_SCRIPT',
        message: 'Reversible migration must have a down script',
        severity: 'error' as const,
      });
    }

    // Validate dangerous operations
    const dangerousPatterns = [
      { pattern: /DROP\s+TABLE/i, risk: 'Dropping tables can cause data loss' },
      { pattern: /DROP\s+COLUMN/i, risk: 'Dropping columns can cause data loss' },
      { pattern: /TRUNCATE/i, risk: 'Truncate operations remove all data' },
      { pattern: /DELETE\s+FROM.*WHERE/i, risk: 'Mass delete operations can be dangerous' },
    ];

    for (const { pattern, risk } of dangerousPatterns) {
      if (pattern.test(migration.upScript)) {
        warnings.push({
          code: 'DANGEROUS_OPERATION',
          message: risk,
          recommendation: 'Consider adding data backup steps before execution',
        });
      }
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(migration.version)) {
      warnings.push({
        code: 'INVALID_VERSION_FORMAT',
        message: 'Version should follow semantic versioning (x.y.z)',
        recommendation: 'Use semantic versioning for better tracking',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateDependencies(migration: Migration, environmentId: string): Promise<ValidationResult> {
    const errors = [];
    const warnings = [];

    if (migration.dependencies && migration.dependencies.length > 0) {
      for (const dependency of migration.dependencies) {
        const execution = await this.executionRepository.findOne({
          where: {
            migrationId: dependency.dependsOnId,
            environmentId,
            status: MigrationStatus.COMPLETED,
          },
        });

        if (!execution) {
          const message = `Dependency migration ${dependency.dependsOnId} has not been executed in this environment`;
          
          if (dependency.isHard) {
            errors.push({
              code: 'MISSING_HARD_DEPENDENCY',
              message,
              severity: 'error' as const,
            });
          } else {
            warnings.push({
              code: 'MISSING_SOFT_DEPENDENCY',
              message,
              recommendation: 'Consider executing dependency first for optimal results',
            });
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async assessMigrationRisks(migrations: Migration[], environment: MigrationEnvironment): Promise<MigrationRisk[]> {
    const risks: MigrationRisk[] = [];

    // Production environment risks
    if (environment.type === EnvironmentType.PRODUCTION) {
      const hasSchemaChanges = migrations.some(m => m.type === MigrationType.SCHEMA);
      if (hasSchemaChanges) {
        risks.push({
          level: 'high',
          description: 'Schema changes in production environment',
          mitigation: 'Ensure thorough testing in staging environment and have rollback plan ready',
        });
      }

      const hasDataMigrations = migrations.some(m => m.type === MigrationType.DATA);
      if (hasDataMigrations) {
        risks.push({
          level: 'medium',
          description: 'Data migrations in production environment',
          mitigation: 'Create data backup before execution and monitor performance impact',
        });
      }
    }

    // Large batch risk
    if (migrations.length > 10) {
      risks.push({
        level: 'medium',
        description: `Large batch of migrations (${migrations.length} migrations)`,
        mitigation: 'Consider breaking into smaller batches for easier rollback',
      });
    }

    // Non-reversible migrations
    const nonReversible = migrations.filter(m => !m.isReversible);
    if (nonReversible.length > 0) {
      risks.push({
        level: 'high',
        description: `${nonReversible.length} migrations are not reversible`,
        mitigation: 'Create manual rollback procedures and data backups',
      });
    }

    return risks;
  }
