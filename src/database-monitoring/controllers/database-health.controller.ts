import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DatabaseHealthService, HealthMetrics } from '../services/database-health.service';

@ApiTags('Database Health')
@Controller('api/database/health')
// @UseGuards(AuthGuard) // Uncomment if authentication is required
export class DatabaseHealthController {
  constructor(private readonly healthService: DatabaseHealthService) {}

  @Get()
  @ApiOperation({ summary: 'Get overall database health status' })
  @ApiResponse({ status: 200, description: 'Database health summary' })
  async getHealthSummary() {
    return await this.healthService.getHealthSummary();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get detailed database health metrics' })
  @ApiResponse({ status: 200, description: 'Detailed health metrics' })
  async getHealthMetrics(): Promise<HealthMetrics> {
    return await this.healthService.gatherHealthMetrics();
  }

  @Get('connections')
  @ApiOperation({ summary: 'Get database connection pool status' })
  @ApiResponse({ status: 200, description: 'Connection pool metrics' })
  async getConnectionStatus() {
    const metrics = await this.healthService.gatherHealthMetrics();
    return metrics.connectionPool;
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get database performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics' })
  async getPerformanceMetrics() {
    const metrics = await this.healthService.gatherHealthMetrics();
    return metrics.performance;
  }

  @Get('storage')
  @ApiOperation({ summary: 'Get database storage metrics' })
  @ApiResponse({ status: 200, description: 'Storage metrics' })
  async getStorageMetrics() {
    const metrics = await this.healthService.gatherHealthMetrics();
    return metrics.storage;
  }
}

// src/modules/database-monitoring/controllers/database-metrics.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseMetricsService } from '../services/database-metrics.service';
import { AlertingService } from '../services/alerting.service';
import { AlertRule } from '../entities/alert-rule.entity';

@ApiTags('Database Metrics')
@Controller('api/database/metrics')
export class DatabaseMetricsController {
  constructor(
    private readonly metricsService: DatabaseMetricsService,
    private readonly alertingService: AlertingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get database metrics with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Database metrics data' })
  async getMetrics(
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.metricsService.getMetrics({
      type,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit || 100,
      offset: offset || 0,
    });
  }

  @Get('aggregated')
  @ApiOperation({ summary: 'Get aggregated metrics for dashboards' })
  @ApiResponse({ status: 200, description: 'Aggregated metrics data' })
  async getAggregatedMetrics(
    @Query('type') type: string,
    @Query('interval') interval: string = 'hour',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return await this.metricsService.getAggregatedMetrics({
      type,
      interval,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard metrics summary' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics' })
  async getDashboardMetrics() {
    return await this.metricsService.getDashboardSummary();
  }

  // Alert Rules Management
  @Get('alerts/rules')
  @ApiOperation({ summary: 'Get all alert rules' })
  @ApiResponse({ status: 200, description: 'List of alert rules' })
  async getAlertRules() {
    return await this.alertingService.getAlertRules();
  }

  @Post('alerts/rules')
  @ApiOperation({ summary: 'Create new alert rule' })
  @ApiResponse({ status: 201, description: 'Alert rule created' })
  async createAlertRule(@Body() alertRule: Partial<AlertRule>) {
    return await this.alertingService.createAlertRule(alertRule);
  }

  @Put('alerts/rules/:id')
  @ApiOperation({ summary: 'Update alert rule' })
  @ApiResponse({ status: 200, description: 'Alert rule updated' })
  async updateAlertRule(
    @Param('id') id: string,
    @Body() updates: Partial<AlertRule>,
  ) {
    return await this.alertingService.updateAlertRule(id, updates);
  }

  @Delete('alerts/rules/:id')
  @ApiOperation({ summary: 'Delete alert rule' })
  @ApiResponse({ status: 200, description: 'Alert rule deleted' })
  async deleteAlertRule(@Param('id') id: string) {
    await this.alertingService.deleteAlertRule(id);
    return { message: 'Alert rule deleted successfully' };
  }

  @Post('alerts/test/:channel')
  @ApiOperation({ summary: 'Test notification channel' })
  @ApiResponse({ status: 200, description: 'Test notification sent' })
  async testNotificationChannel(@Param('channel') channel: string) {
    const success = await this.alertingService.testNotificationChannel(channel);
    return { success, message: success ? 'Test notification sent' : 'Test notification failed' };
  }
}

// src/modules/database-monitoring/controllers/backup.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BackupService } from '../services/backup.service';
import { DisasterRecoveryService } from '../services/disaster-recovery.service';
import { MaintenanceService } from '../services/maintenance.service';
import { CapacityPlanningService } from '../services/capacity-planning.service';
import { LogAnalysisService } from '../services/log-analysis.service';

@ApiTags('Database Operations')
@Controller('api/database/operations')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly disasterRecoveryService: DisasterRecoveryService,
    private readonly maintenanceService: MaintenanceService,
    private readonly capacityPlanningService: CapacityPlanningService,
    private readonly logAnalysisService: LogAnalysisService,
  ) {}

  // Backup Operations
  @Get('backups')
  @ApiOperation({ summary: 'Get backup history' })
  @ApiResponse({ status: 200, description: 'List of backup records' })
  async getBackups(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.backupService.getBackupHistory(limit, offset);
  }

  @Post('backups')
  @ApiOperation({ summary: 'Create new backup' })
  @ApiResponse({ status: 201, description: 'Backup initiated' })
  async createBackup(@Body() backupConfig: any) {
    return await this.backupService.createBackup(backupConfig);
  }

  @Post('backups/:id/verify')
  @ApiOperation({ summary: 'Verify backup integrity' })
  @ApiResponse({ status: 200, description: 'Backup verification result' })
  async verifyBackup(@Param('id') id: string) {
    return await this.backupService.verifyBackup(id);
  }

  @Delete('backups/:id')
  @ApiOperation({ summary: 'Delete backup' })
  @ApiResponse({ status: 200, description: 'Backup deleted' })
  async deleteBackup(@Param('id') id: string) {
    await this.backupService.deleteBackup(id);
    return { message: 'Backup deleted successfully' };
  }

  // Disaster Recovery
  @Get('disaster-recovery/plans')
  @ApiOperation({ summary: 'Get disaster recovery plans' })
  @ApiResponse({ status: 200, description: 'List of DR plans' })
  async getDisasterRecoveryPlans() {
    return await this.disasterRecoveryService.getRecoveryPlans();
  }

  @Post('disaster-recovery/test')
  @ApiOperation({ summary: 'Test disaster recovery procedures' })
  @ApiResponse({ status: 200, description: 'DR test results' })
  async testDisasterRecovery(@Body() testConfig: any) {
    return await this.disasterRecoveryService.testRecoveryProcedures(testConfig);
  }

  @Post('disaster-recovery/execute')
  @ApiOperation({ summary: 'Execute disaster recovery plan' })
  @ApiResponse({ status: 200, description: 'DR execution status' })
  async executeDisasterRecovery(@Body() recoveryConfig: any) {
    return await this.disasterRecoveryService.executeRecoveryPlan(recoveryConfig);
  }

  // Maintenance Tasks
  @Get('maintenance/tasks')
  @ApiOperation({ summary: 'Get maintenance tasks' })
  @ApiResponse({ status: 200, description: 'List of maintenance tasks' })
  async getMaintenanceTasks() {
    return await this.maintenanceService.getMaintenanceTasks();
  }

  @Post('maintenance/tasks')
  @ApiOperation({ summary: 'Create maintenance task' })
  @ApiResponse({ status: 201, description: 'Maintenance task created' })
  async createMaintenanceTask(@Body() taskData: any) {
    return await this.maintenanceService.createMaintenanceTask(taskData);
  }

  @Post('maintenance/tasks/:id/execute')
  @ApiOperation({ summary: 'Execute maintenance task immediately' })
  @ApiResponse({ status: 200, description: 'Task execution result' })
  async executeMaintenanceTask(@Param('id') id: string) {
    return await this.maintenanceService.executeMaintenanceTaskNow(id);
  }

  @Get('maintenance/history')
  @ApiOperation({ summary: 'Get maintenance task history' })
  @ApiResponse({ status: 200, description: 'Maintenance task history' })
  async getMaintenanceHistory(@Query('taskId') taskId?: string) {
    return await this.maintenanceService.getMaintenanceTaskHistory(taskId);
  }

  // Capacity Planning
  @Get('capacity/metrics')
  @ApiOperation({ summary: 'Get capacity metrics' })
  @ApiResponse({ status: 200, description: 'Capacity metrics data' })
  async getCapacityMetrics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return await this.capacityPlanningService.getCapacityMetrics({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('capacity/forecast')
  @ApiOperation({ summary: 'Get capacity forecast' })
  @ApiResponse({ status: 200, description: 'Capacity forecast data' })
  async getCapacityForecast(
    @Query('days') days: number = 30,
    @Query('metric') metric?: string,
  ) {
    return await this.capacityPlanningService.generateForecast(days, metric);
  }

  @Get('capacity/recommendations')
  @ApiOperation({ summary: 'Get capacity planning recommendations' })
  @ApiResponse({ status: 200, description: 'Capacity recommendations' })
  async getCapacityRecommendations() {
    return await this.capacityPlanningService.getRecommendations();
  }

  // Log Analysis
  @Get('logs/analysis')
  @ApiOperation({ summary: 'Get log analysis results' })
  @ApiResponse({ status: 200, description: 'Log analysis data' })
  async getLogAnalysis(
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return await this.logAnalysisService.getAnalysisResults({
      type,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('logs/errors')
  @ApiOperation({ summary: 'Get database error analysis' })
  @ApiResponse({ status: 200, description: 'Error analysis data' })
  async getErrorAnalysis(
    @Query('severity') severity?: string,
    @Query('limit') limit?: number,
  ) {
    return await this.logAnalysisService.getErrorAnalysis(severity, limit);
  }

  @Get('logs/slow-queries')
  @ApiOperation({ summary: 'Get slow query analysis' })
  @ApiResponse({ status: 200, description: 'Slow query analysis' })
  async getSlowQueryAnalysis(
    @Query('threshold') threshold?: number,
    @Query('limit') limit?: number,
  ) {
    return await this.logAnalysisService.getSlowQueryAnalysis(threshold, limit);
  }

  @Post('logs/analyze')
  @ApiOperation({ summary: 'Trigger log analysis' })
  @ApiResponse({ status: 200, description: 'Analysis triggered' })
  async triggerLogAnalysis(@Body() analysisConfig: any) {
    return await this.logAnalysisService.triggerAnalysis(analysisConfig);
  }
}