import { Injectable } from '@nestjs/common';
import { AdminAuditService } from '../../audit/services/admin-audit.service';

export interface DashboardMetrics {
  systemOverview: {
    totalAdmins: number;
    activeAdmins: number;
    totalUsers: number;
    activeUsers: number;
    systemUptime: number;
    lastBackup: Date;
  };
  activityMetrics: {
    dailyLogins: Record<string, number>;
    adminActions: Record<string, number>;
    userRegistrations: Record<string, number>;
    errorRates: Record<string, number>;
  };
  securityMetrics: {
    failedLogins: number;
    suspiciousActivities: number;
    blockedIPs: number;
    securityAlerts: number;
  };
  performanceMetrics: {
    averageResponseTime: number;
    databaseConnections: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  services: {
    database: 'up' | 'down' | 'degraded';
    redis: 'up' | 'down' | 'degraded';
    email: 'up' | 'down' | 'degraded';
    storage: 'up' | 'down' | 'degraded';
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly auditService: AdminAuditService,
  ) {}

  async getDashboardMetrics(days = 7): Promise<DashboardMetrics> {
    const systemMetrics = await this.auditService.getSystemMetrics(days);
    const securityAlerts = await this.auditService.getSecurityAlerts(24);
    const failedLogins = await this.auditService.getFailedLoginAttempts(24);

    return {
      systemOverview: {
        totalAdmins: await this.getTotalAdmins(),
        activeAdmins: await this.getActiveAdmins(),
        totalUsers: await this.getTotalUsers(),
        activeUsers: await this.getActiveUsers(),
        systemUptime: this.getSystemUptime(),
        lastBackup: await this.getLastBackupTime(),
      },
      activityMetrics: {
        dailyLogins: await this.getDailyLogins(days),
        adminActions: systemMetrics.actionTypes,
        userRegistrations: await this.getUserRegistrations(days),
        errorRates: await this.getErrorRates(days),
      },
      securityMetrics: {
        failedLogins: failedLogins.attempts.length,
        suspiciousActivities: failedLogins.suspiciousPatterns.length,
        blockedIPs: await this.getBlockedIPs(),
        securityAlerts: securityAlerts.length,
      },
      performanceMetrics: {
        averageResponseTime: await this.getAverageResponseTime(),
        databaseConnections: await this.getDatabaseConnections(),
        memoryUsage: await this.getMemoryUsage(),
        cpuUsage: await this.getCpuUsage(),
      },
    };
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const services = {
      database: await this.checkDatabaseHealth(),
      redis: await this.checkRedisHealth(),
      email: await this.checkEmailHealth(),
      storage: await this.checkStorageHealth(),
    };

    const alerts = await this.getSystemAlerts();
    const criticalServices = Object.values(services).filter(status => status === 'down').length;
    const degradedServices = Object.values(services).filter(status => status === 'degraded').length;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalServices > 0) {
      status = 'critical';
    } else if (degradedServices > 0 || alerts.some(alert => alert.level === 'critical' && !alert.resolved)) {
      status = 'warning';
    }

    return {
      status,
      services,
      alerts,
    };
  }

  async getRealtimeMetrics(): Promise<{
    activeUsers: number;
    activeAdmins: number;
    currentRequests: number;
    responseTime: number;
    errorRate: number;
  }> {
    return {
      activeUsers: await this.getCurrentActiveUsers(),
      activeAdmins: await this.getCurrentActiveAdmins(),
      currentRequests: await this.getCurrentRequests(),
      responseTime: await this.getCurrentResponseTime(),
      errorRate: await this.getCurrentErrorRate(),
    };
  }

  async getTopMetrics(): Promise<{
    topPages: Array<{ path: string; views: number }>;
    topErrors: Array<{ error: string; count: number }>;
    topUsers: Array<{ userId: string; actions: number }>;
    topAdmins: Array<{ adminId: string; actions: number }>;
  }> {
    const systemMetrics = await this.auditService.getSystemMetrics(7);

    return {
      topPages: await this.getTopPages(),
      topErrors: await this.getTopErrors(),
      topUsers: await this.getTopUsers(),
      topAdmins: systemMetrics.topAdmins,
    };
  }

  // Private helper methods
  private async getTotalAdmins(): Promise<number> {
    // Implementation would query admin repository
    return 0;
  }

  private async getActiveAdmins(): Promise<number> {
    // Implementation would query active admins
    return 0;
  }

  private async getTotalUsers(): Promise<number> {
    // Implementation would query user repository
    return 0;
  }

  private async getActiveUsers(): Promise<number> {
    // Implementation would query active users
    return 0;
  }

  private getSystemUptime(): number {
    // Implementation would return system uptime in seconds
    return process.uptime();
  }

  private async getLastBackupTime(): Promise<Date> {
    // Implementation would return last backup timestamp
    return new Date();
  }

  private async getDailyLogins(days: number): Promise<Record<string, number>> {
    // Implementation would aggregate login data
    return {};
  }

  private async getUserRegistrations(days: number): Promise<Record<string, number>> {
    // Implementation would aggregate user registration data
    return {};
  }

  private async getErrorRates(days: number): Promise<Record<string, number>> {
    // Implementation would aggregate error rate data
    return {};
  }

  private async getBlockedIPs(): Promise<number> {
    // Implementation would count blocked IPs
    return 0;
  }

  private async getAverageResponseTime(): Promise<number> {
    // Implementation would calculate average response time
    return 0;
  }

  private async getDatabaseConnections(): Promise<number> {
    // Implementation would get database connection count
    return 0;
  }

  private async getMemoryUsage(): Promise<number> {
    // Implementation would get memory usage percentage
    const used = process.memoryUsage();
    return Math.round((used.heapUsed / used.heapTotal) * 100);
  }

  private async getCpuUsage(): Promise<number> {
    // Implementation would get CPU usage percentage
    return 0;
  }

  private async checkDatabaseHealth(): Promise<'up' | 'down' | 'degraded'> {
    // Implementation would check database connectivity
    return 'up';
  }

  private async checkRedisHealth(): Promise<'up' | 'down' | 'degraded'> {
    // Implementation would check Redis connectivity
    return 'up';
  }

  private async checkEmailHealth(): Promise<'up' | 'down' | 'degraded'> {
    // Implementation would check email service
    return 'up';
  }

  private async checkStorageHealth(): Promise<'up' | 'down' | 'degraded'> {
    // Implementation would check storage service
    return 'up';
  }

  private async getSystemAlerts(): Promise<Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>> {
    // Implementation would fetch system alerts
    return [];
  }

  private async getCurrentActiveUsers(): Promise<number> {
    // Implementation would get current active users
    return 0;
  }

  private async getCurrentActiveAdmins(): Promise<number> {
    // Implementation would get current active admins
    return 0;
  }

  private async getCurrentRequests(): Promise<number> {
    // Implementation would get current request count
    return 0;
  }

  private async getCurrentResponseTime(): Promise<number> {
    // Implementation would get current response time
    return 0;
  }

  private async getCurrentErrorRate(): Promise<number> {
    // Implementation would get current error rate
    return 0;
  }

  private async getTopPages(): Promise<Array<{ path: string; views: number }>> {
    // Implementation would get top pages by views
    return [];
  }

  private async getTopErrors(): Promise<Array<{ error: string; count: number }>> {
    // Implementation would get top errors
    return [];
  }

  private async getTopUsers(): Promise<Array<{ userId: string; actions: number }>> {
    // Implementation would get top users by activity
    return [];
  }
} 