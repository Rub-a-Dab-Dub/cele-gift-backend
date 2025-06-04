import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MigrationOrchestratorService } from './services/migration-orchestrator.service';
import { MigrationExecutorService } from './services/migration-executor.service';
import { MigrationValidatorService } from './services/migration-validator.service';
import { DataMigrationService } from './services/data-migration.service';
import { MigrationDashboardService } from './services/migration-dashboard.service';
import { MigrationController } from './controllers/migration.controller';
import { MigrationDashboardController } from './controllers/migration-dashboard.controller';
import { Migration } from './entities/migration.entity';
import { MigrationExecution } from './entities/migration-execution.entity';
import { MigrationDependency } from './entities/migration-dependency.entity';
import { MigrationEnvironment } from './entities/migration-environment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Migration,
      MigrationExecution,
      MigrationDependency,
      MigrationEnvironment,
    ]),
  ],
  controllers: [MigrationController, MigrationDashboardController],
  providers: [
    MigrationOrchestratorService,
    MigrationExecutorService,
    MigrationValidatorService,
    DataMigrationService,
    MigrationDashboardService,
  ],
  exports: [MigrationOrchestratorService],
})
export class MigrationManagementModule {}