import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { DatabaseHealthController } from './controllers/database-health.controller';
import { DatabaseMetricsController } from './controllers/database-metrics.controller';
import { BackupController } from './controllers/backup.controller';

import { DatabaseHealthService } from './services/database-health.service';
import { DatabaseMetricsService } from './services/database-metrics.service';
import { AlertingService } from './services/alerting.service';
import { MaintenanceService } from './services/maintenance.service';
import { LogAnalysisService } from './services/log-analysis.service';
import { CapacityPlanningService } from './services/capacity-planning.service';
import { BackupService } from './services/backup.service';
import { DisasterRecoveryService } from './services/disaster-recovery.service';

import { DatabaseMetric } from './entities/database-metric.entity';
import { AlertRule } from './entities/alert-rule.entity';
import { MaintenanceTask } from './entities/maintenance-task.entity';
import { BackupRecord } from './entities/backup-record.entity';
import { CapacityMetric } from './entities/capacity-metric.entity';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      DatabaseMetric,
      AlertRule,
      MaintenanceTask,
      BackupRecord,
      CapacityMetric,
    ]),
  ],
  controllers: [
    DatabaseHealthController,
    DatabaseMetricsController,
    BackupController,
  ],
  providers: [
    DatabaseHealthService,
    DatabaseMetricsService,
    AlertingService,
    MaintenanceService,
    LogAnalysisService,
    CapacityPlanningService,
    BackupService,
    DisasterRecoveryService,
  ],
  exports: [
    DatabaseHealthService,
    DatabaseMetricsService,
    AlertingService,
  ],
})
export class DatabaseMonitoringModule {}