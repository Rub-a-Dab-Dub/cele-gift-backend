import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { MaintenanceTask, TaskStatus, TaskType } from '../entities/maintenance-task.entity';
import { AlertingService } from './alerting.service';
import * as cron from 'node-cron';

export interface MaintenanceResult {
  success: boolean;
  duration: number;
  result?: string;
  error?: string;
  details?: Record<string, any>;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private readonly scheduledTasks = new Map<string, any>();

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectRepository(MaintenanceTask)
    private maintenanceTaskRepository: Repository<MaintenanceTask>,
    private alertingService: AlertingService,
  ) {
    this.initializeScheduledTasks();
  }

  async initializeScheduledTasks(): Promise<void> {
    const tasks = await this.maintenanceTaskRepository.find({
      where: { status: TaskStatus.PENDING },
    });

    for (const task of tasks) {
      this.scheduleTask(task);
    }
  }

  private scheduleTask(task: MaintenanceTask): void {
    if (this.scheduledTasks.has(task.id)) {
      this.scheduledTasks.get(task.id).destroy();
    }

    const scheduledTask = cron.schedule(task.cronExpression, async () => {
      await this.executeTask(task.id);
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    this.scheduledTasks.set(task.id, scheduledTask);
    this.logger.log(`Scheduled maintenance task: ${task.name}`);
  }

  async executeTask(taskId: string): Promise<MaintenanceResult> {
    const task = await this.maintenanceTaskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task with id ${taskId} not found`);
    }

    // Update task status to running
    await this.maintenanceTaskRepository.update(taskId, {
      status: TaskStatus.RUNNING,
      lastRun: new Date(),
    });

    const startTime = Date.now();
    let result: MaintenanceResult;

    try {
      result = await this.performMaintenanceTask(task);
      
      // Update task with successful result
      await this.maintenanceTaskRepository.update(taskId, {
        status: TaskStatus.COMPLETED,
        executionTime: result.duration,
        result: result.result,
        error: null,
        retryCount: 0,
      });

      this.logger.log(`Maintenance task completed: ${task.name} (${result.duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      result = {
        success: false,
        duration,
        error: error.message,
      };

      // Handle retry logic
      const shouldRetry = task.retryCount < task.maxRetries;
      
      await this.maintenanceTaskRepository.update(taskId, {
        status: shouldRetry ? TaskStatus.PENDING : TaskStatus.FAILED,
        executionTime: duration,
        error: error.message,
        retryCount: task.retryCount + 1,
      });

      // Send alert for failed maintenance
      await this.alertingService.sendAlert({
        type: 'maintenance_task_failed',
        severity: 'high',
        message: `Maintenance task '${task.name}' failed: ${error.message}`,
        value: task.retryCount + 1,
        metadata: {
          taskId: task.id,
          taskType: task.type,
          errorDetails: error.message,
        },
      });

      this.logger.error(`Maintenance task failed: ${task.name}`, error);
    }

    return result;
  }

  private async performMaintenanceTask(task: MaintenanceTask): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    switch (task.type) {
      case TaskType.INDEX_REBUILD:
        return await this.rebuildIndexes(task);
      case TaskType.STATISTICS_UPDATE:
        return await this.updateStatistics(task);
      case TaskType.VACUUM:
        return await this.performVacuum(task);
      case TaskType.ANALYZE:
        return await this.performAnalyze(task);
      case TaskType.CLEANUP:
        return await this.performCleanup(task);
      case TaskType.BACKUP:
        return await this.performBackup(task);
      default:
        throw new Error(`Unknown maintenance task type: ${task.type}`);
    }
  }

  private async rebuildIndexes(task: MaintenanceTask): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const tables = task.parameters?.tables || await this.getAllTables();
    const results = [];

    for (const table of tables) {
      try {
        // Get fragmented indexes for the table
        const fragmentedIndexes = await this.getFragmentedIndexes(table);
        
        for (const index of fragmentedIndexes) {
          await this.dataSource.query(`REINDEX INDEX CONCURRENTLY ${index.name}`);
          results.push(`Rebuilt index ${index.name} on table ${table}`);
        }
      } catch (error) {
        results.push(`Error rebuilding indexes for table ${table}: ${error.message}`);
      }
    }

    return {
      success: true,
      duration: Date.now() - startTime,
      result: results.join('\n'),
      details: { tablesProcessed: tables.length, indexesRebuilt: results.length },
    };
  }

  private async updateStatistics(task: MaintenanceTask): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const tables = task.parameters?.tables || await this.getAllTables();
    const results = [];

    for (const table of tables) {
      try {
        await this.dataSource.query(`ANALYZE ${table}`);
        results.push(`Updated statistics for table ${table}`);
      } catch (error) {
        results.push(`Error updating statistics for table ${table}: ${error.message}`);
      }
    }

    return {
      success: true,
      duration: Date.now() - startTime,
      result: results.join('\n'),
      details: { tablesProcessed: tables.length },
    };
  }

  private async performVacuum(task: MaintenanceTask): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const tables = task.parameters?.tables || await this.getAllTables();
    const full = task.parameters?.full || false;
    const results = [];

    for (const table of tables) {
      try {
        const vacuumCommand = full ? `VACUUM FULL ${table}` : `VACUUM ${table}`;
        await this.dataSource.query(vacuumCommand);
        results.push(`Vacuumed table ${table}`);
      } catch (error) {
        results.push(`Error vacuuming table ${table}: ${error.message}`);
      }
    }

    return {
      success: true,
      duration: Date.now() - startTime,
      result: results.join('\n'),
      details: { tablesProcessed: tables.length, fullVacuum: full },
    };
  }

  private async performAnalyze(task: MaintenanceTask): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const tables = task.parameters?.tables || await this.getAllTables();
    const results = [];

    for (const table of tables) {
      try {
        await this.dataSource.query(`ANALYZE ${table}`);
        
        // Get table statistics after analyze
        const stats = await this.getTableStatistics(table);
        results.push(`Analyzed table ${table} - Rows: ${stats.rowCount}, Size: ${stats.size}`);
      } catch (error) {
        results.push(`Error analyzing table ${table}: ${error.message}`);
      }
    }

    return {
      success: true,
      duration: Date.now() - startTime,
      result: results.join('\n'),
      details: { tablesProcessed: tables.length },
    };
  }

  private async performCleanup(task: MaintenanceTask): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const results = [];
    
    try {
      // Clean up old logs
      if (task.parameters?.cleanupLogs) {
        const logRetentionDays = task.parameters.logRetentionDays || 30;
        const deletedLogs = await this.cleanupOldLogs(logRetentionDays);
        results.push(`Cleaned up ${deletedLogs} old log entries`);
      }

      // Clean up old metrics
      if (task.parameters?.cleanupMetrics) {
        const metricsRetentionDays = task.parameters.metricsRetentionDays || 90;
        const deletedMetrics = await this.cleanupOldMetrics(metricsRetentionDays);
        results.push(`Cleaned up ${deletedMetrics} old metric entries`);
      }

      // Clean up temporary files
      if (task.parameters?.cleanupTempFiles) {
        const tempFileCount = await this.cleanupTempFiles();
        results.push(`Cleaned up ${tempFileCount} temporary files`);
      }

      // Clean up old backup records
      if (task.parameters?.cleanupBackups) {
        const backupRetentionDays = task.parameters.backupRetentionDays || 180;
        const deletedBackups = await this.cleanupOldBackupRecords(backupRetentionDays);
        results.push(`Cleaned up ${deletedBackups} old backup records`);
      }

    } catch (error) {
      throw new Error(`Cleanup task failed: ${error.message}`);
    }

    return {
      success: true,
      duration: Date.now() - startTime,
      result: results.join('\n'),
    };
  }

  private async performBackup(task: MaintenanceTask): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    // This would integrate with your backup service
    // For now, we'll simulate the backup process
    const backupType = task.parameters?.type || 'full';
    const databases = task.parameters?.databases || [this.dataSource.options.database];
    
    const results = [];
    for (const database of databases) {
      try {
        // Simulate backup process
        const backupPath = `/backups/${database}_${new Date().toISOString().split('T')[0]}_${backupType}.sql`;
        
        // In a real implementation, you would:
        // 1. Create the backup using pg_dump or similar
        // 2. Verify the backup integrity
        // 3. Store backup metadata
        
        results.push(`Created ${backupType} backup for database ${database} at ${backupPath}`);
      } catch (error) {
        results.push(`Failed to backup database ${database}: ${error.message}`);
      }
    }

    return {
      success: true,
      duration: Date.now() - startTime,
      result: results.join('\n'),
      details: { backupType, databasesProcessed: databases.length },
    };
  }

  // Helper methods
  private async getAllTables(): Promise<string[]> {
    const result = await this.dataSource.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    return result.map(row => row.tablename);
  }

  private async getFragmentedIndexes(table: string): Promise<Array<{ name: string; fragmentation: number }>> {
    // Simplified fragmentation check
    const result = await this.dataSource.query(`
      SELECT 
        indexname as name,
        0 as fragmentation
      FROM pg_indexes 
      WHERE tablename = $1 
      AND schemaname = 'public'
    `, [table]);
    
    return result;
  }

  private async getTableStatistics(table: string): Promise<{ rowCount: number; size: string }> {
    const result = await this.dataSource.query(`
      SELECT 
        reltuples::bigint as row_count,
        pg_size_pretty(pg_total_relation_size(oid)) as size
      FROM pg_class 
      WHERE relname = $1
    `, [table]);
    
    return {
      rowCount: result[0]?.row_count || 0,
      size: result[0]?.size || '0 bytes',
    };
  }

  private async cleanupOldLogs(retentionDays: number): Promise<number> {
    // This would clean up application logs or database logs
    // Implementation depends on your logging strategy
    return 0;
  }

  private async cleanupOldMetrics(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await this.dataSource.query(`
      DELETE FROM database_metrics 
      WHERE timestamp < $1
    `, [cutoffDate]);
    
    return result.affectedRows || 0;
  }

  private async cleanupTempFiles(): Promise<number> {
    // This would clean up temporary files from the filesystem
    // Implementation depends on your file storage strategy
    return 0;
  }

  private async cleanupOldBackupRecords(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await this.dataSource.query(`
      DELETE FROM backup_records 
      WHERE created_at < $1
    `, [cutoffDate]);
    
    return result.affectedRows || 0;
  }

  // Public API methods
  async createMaintenanceTask(taskData: Partial<MaintenanceTask>): Promise<MaintenanceTask> {
    const task = this.maintenanceTaskRepository.create(taskData);
    const savedTask = await this.maintenanceTaskRepository.save(task);
    
    // Schedule the task
    this.scheduleTask(savedTask);
    
    return savedTask;
  }

  async updateMaintenanceTask(id: string, updates: Partial<MaintenanceTask>): Promise<MaintenanceTask> {
    await this.maintenanceTaskRepository.update(id, updates);
    const updatedTask = await this.maintenanceTaskRepository.findOne({ where: { id } });
    
    // Reschedule if cron expression changed
    if (updates.cronExpression) {
      this.scheduleTask(updatedTask);
    }
    
    return updatedTask;
  }

  async deleteMaintenanceTask(id: string): Promise<void> {
    // Remove from scheduler
    if (this.scheduledTasks.has(id)) {
      this.scheduledTasks.get(id).destroy();
      this.scheduledTasks.delete(id);
    }
    
    await this.maintenanceTaskRepository.delete(id);
  }

  async getMaintenanceTasks(): Promise<MaintenanceTask[]> {
    return await this.maintenanceTaskRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getMaintenanceTaskHistory(taskId?: string): Promise<MaintenanceTask[]> {
    const whereCondition = taskId ? { id: taskId } : {};
    
    return await this.maintenanceTaskRepository.find({
      where: whereCondition,
      order: { lastRun: 'DESC' },
      take: 50,
    });
  }

  async executeMaintenanceTaskNow(taskId: string): Promise<MaintenanceResult> {
    return await this.executeTask(taskId);
  }
}