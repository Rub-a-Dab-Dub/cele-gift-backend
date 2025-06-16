import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class DeploymentMonitoringService {
  private readonly deploymentHistory: Map<string, DeploymentStatus> = new Map();
  private  emailTransporter: nodemailer.Transporter;

  constructor(
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {
    this.initializeEmailTransporter();
    this.setupEventListeners();
  }

  private initializeEmailTransporter(): void {
   this.emailTransporter = nodemailer.createTransport({
     host: process.env.SMTP_HOST!,
     port: parseInt(process.env.SMTP_PORT!),
     secure: true,
     auth: {
       user: process.env.SMTP_USER!,
       pass: process.env.SMTP_PASSWORD!,
     },
   });
  }

  private setupEventListeners(): void {
    this.eventEmitter.on(
      'deployment.start',
      this.handleDeploymentStart.bind(this),
    );
    this.eventEmitter.on(
      'deployment.success',
      this.handleDeploymentSuccess.bind(this),
    );
    this.eventEmitter.on(
      'deployment.failure',
      this.handleDeploymentFailure.bind(this),
    );
    this.eventEmitter.on(
      'deployment.warning',
      this.handleDeploymentWarning.bind(this),
    );
    this.eventEmitter.on(
      'performance.regression.detected',
      this.handlePerformanceRegression.bind(this),
    );
  }

  async monitorDeployment(deploymentId: string): Promise<void> {
    try {
      // Start monitoring
      this.deploymentHistory.set(deploymentId, {
        status: 'in_progress',
        startTime: new Date(),
        metrics: {},
      });

      // Monitor database connections
      await this.monitorConnections(deploymentId);

      // Monitor query performance
      await this.monitorQueryPerformance(deploymentId);

      // Monitor resource usage
      await this.monitorResourceUsage(deploymentId);

      // Monitor application health
      await this.monitorApplicationHealth(deploymentId);

      // Update deployment status
      this.updateDeploymentStatus(deploymentId, 'monitoring');
    } catch (error) {
      this.handleMonitoringError(deploymentId, error);
    }
  }

  @Cron('*/5 * * * *') // Run every 5 minutes
  async checkDeploymentHealth(): Promise<void> {
    for (const [deploymentId, status] of this.deploymentHistory.entries()) {
      if (status.status === 'in_progress' || status.status === 'monitoring') {
        try {
          await this.performHealthCheck(deploymentId);
        } catch (error) {
          this.handleHealthCheckError(deploymentId, error);
        }
      }
    }
  }

  private async monitorConnections(deploymentId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const connections = await queryRunner.query(`
        SELECT count(*) as connection_count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      this.updateDeploymentMetrics(
        deploymentId,
        'connections',
        connections[0].connection_count,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async monitorQueryPerformance(deploymentId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const slowQueries = await queryRunner.query(`
        SELECT
          query,
          calls,
          total_time,
          mean_time
        FROM pg_stat_statements
        ORDER BY mean_time DESC
        LIMIT 10
      `);

      this.updateDeploymentMetrics(deploymentId, 'slowQueries', slowQueries);
    } finally {
      await queryRunner.release();
    }
  }

  private async monitorResourceUsage(deploymentId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const resourceUsage = await queryRunner.query(`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          pg_size_pretty(pg_total_relation_size('pg_stat_statements')) as stats_size
      `);

      this.updateDeploymentMetrics(
        deploymentId,
        'resourceUsage',
        resourceUsage[0],
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async monitorApplicationHealth(deploymentId: string): Promise<void> {
    // Implementation for monitoring application health
    // This could include checking API endpoints, service status, etc.
  }

  private async performHealthCheck(deploymentId: string): Promise<void> {
    const status = this.deploymentHistory.get(deploymentId);
    if (!status) return;

    try {
      // Check database connectivity
      await this.checkDatabaseConnectivity();

      // Check query performance
      await this.checkQueryPerformance();

      // Check resource usage
      await this.checkResourceUsage();

      // Update health status
      this.updateDeploymentStatus(deploymentId, 'healthy');
    } catch (error) {
      this.updateDeploymentStatus(deploymentId, 'unhealthy');
      throw error;
    }
  }

  private async sendNotification(
    deploymentId: string,
    type: 'success' | 'failure' | 'warning' | 'regression',
    details: any,
  ): Promise<void> {
    const status = this.deploymentHistory.get(deploymentId);
    if (!status) return;

    const emailContent = this.generateEmailContent(type, details);
    const subject = this.generateEmailSubject(type, deploymentId);

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.NOTIFICATION_RECIPIENTS,
      subject,
      html: emailContent,
    });
  }

  private generateEmailContent(type: string, details: any): string {
    // Implementation for generating email content
    return '';
  }

  private generateEmailSubject(type: string, deploymentId: string): string {
    // Implementation for generating email subject
    return '';
  }

  private updateDeploymentStatus(
    deploymentId: string,
    status: DeploymentStatus['status'],
  ): void {
    const currentStatus = this.deploymentHistory.get(deploymentId);
    if (currentStatus) {
      currentStatus.status = status;
      currentStatus.lastUpdated = new Date();
      this.deploymentHistory.set(deploymentId, currentStatus);
    }
  }

  private updateDeploymentMetrics(
    deploymentId: string,
    metricName: string,
    value: any,
  ): void {
    const status = this.deploymentHistory.get(deploymentId);
    if (status) {
      status.metrics[metricName] = value;
      status.lastUpdated = new Date();
      this.deploymentHistory.set(deploymentId, status);
    }
  }

  private handleDeploymentStart(payload: any): void {
    this.monitorDeployment(payload.deploymentId);
  }

  private handleDeploymentSuccess(payload: any): void {
    this.updateDeploymentStatus(payload.deploymentId, 'success');
    this.sendNotification(payload.deploymentId, 'success', payload);
  }

  private handleDeploymentFailure(payload: any): void {
    this.updateDeploymentStatus(payload.deploymentId, 'failed');
    this.sendNotification(payload.deploymentId, 'failure', payload);
  }

  private handleDeploymentWarning(payload: any): void {
    this.sendNotification(payload.deploymentId, 'warning', payload);
  }

  private handlePerformanceRegression(payload: any): void {
    this.sendNotification(payload.deploymentId, 'regression', payload);
  }

  private handleMonitoringError(deploymentId: string, error: Error): void {
    this.updateDeploymentStatus(deploymentId, 'error');
    this.sendNotification(deploymentId, 'failure', { error: error.message });
  }

  private handleHealthCheckError(deploymentId: string, error: Error): void {
    this.updateDeploymentStatus(deploymentId, 'unhealthy');
    this.sendNotification(deploymentId, 'warning', { error: error.message });
  }

  private async checkDatabaseConnectivity(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.query('SELECT 1');
    } finally {
      await queryRunner.release();
    }
  }

  private async checkQueryPerformance(): Promise<void> {
    // Implementation for checking query performance
  }

  private async checkResourceUsage(): Promise<void> {
    // Implementation for checking resource usage
  }
}

interface DeploymentStatus {
  status:
    | 'in_progress'
    | 'monitoring'
    | 'success'
    | 'failed'
    | 'error'
    | 'healthy'
    | 'unhealthy';
  startTime: Date;
  lastUpdated?: Date;
  metrics: Record<string, any>;
}
