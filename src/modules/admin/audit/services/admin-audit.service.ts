import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindManyOptions } from 'typeorm';
import { AdminAuditLog, AuditAction, AuditLevel } from '../../entities/admin-audit-log.entity';

export interface AuditLogData {
  adminId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  description?: string;
  level?: AuditLevel;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  context?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  isSystemAction?: boolean;
  metadata?: Record<string, any>;
}

export interface AuditQueryOptions {
  adminId?: string;
  action?: AuditAction;
  resource?: string;
  level?: AuditLevel;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AdminAuditLog)
    private auditLogRepository: Repository<AdminAuditLog>,
  ) {}

  async logAction(data: AuditLogData): Promise<AdminAuditLog> {
    const auditLog = this.auditLogRepository.create({
      ...data,
      level: data.level || AuditLevel.MEDIUM,
      isSystemAction: data.isSystemAction || false,
    });

    return await this.auditLogRepository.save(auditLog);
  }

  async getAuditLogs(options: AuditQueryOptions = {}): Promise<{
    logs: AdminAuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      adminId,
      action,
      resource,
      level,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = options;

    const queryOptions: FindManyOptions<AdminAuditLog> = {
      relations: ['admin'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    };

    const where: any = {};

    if (adminId) {
      where.adminId = adminId;
    }

    if (action) {
      where.action = action;
    }

    if (resource) {
      where.resource = resource;
    }

    if (level) {
      where.level = level;
    }

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = Between(startDate, new Date());
    }

    queryOptions.where = where;

    const [logs, total] = await this.auditLogRepository.findAndCount(queryOptions);

    return {
      logs,
      total,
      page,
      limit,
    };
  }

  async getAdminActivitySummary(adminId: string, days = 30): Promise<{
    totalActions: number;
    actionBreakdown: Record<AuditAction, number>;
    riskScore: number;
    lastActivity: Date;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.auditLogRepository.find({
      where: {
        adminId,
        createdAt: Between(startDate, new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    const actionBreakdown: Record<AuditAction, number> = {} as Record<AuditAction, number>;
    let riskScore = 0;

    logs.forEach(log => {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;

      // Calculate risk score based on action level
      switch (log.level) {
        case AuditLevel.LOW:
          riskScore += 1;
          break;
        case AuditLevel.MEDIUM:
          riskScore += 2;
          break;
        case AuditLevel.HIGH:
          riskScore += 5;
          break;
        case AuditLevel.CRITICAL:
          riskScore += 10;
          break;
      }
    });

    return {
      totalActions: logs.length,
      actionBreakdown,
      riskScore,
      lastActivity: logs.length > 0 ? logs[0].createdAt : null,
    };
  }

  async getSecurityAlerts(hours = 24): Promise<AdminAuditLog[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    return await this.auditLogRepository.find({
      where: {
        level: AuditLevel.CRITICAL,
        createdAt: Between(startDate, new Date()),
      },
      relations: ['admin'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFailedLoginAttempts(hours = 24): Promise<{
    attempts: AdminAuditLog[];
    uniqueIPs: string[];
    suspiciousPatterns: any[];
  }> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const attempts = await this.auditLogRepository.find({
      where: {
        action: AuditAction.FAILED_LOGIN,
        createdAt: Between(startDate, new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    const ipCounts: Record<string, number> = {};
    const uniqueIPs: string[] = [];

    attempts.forEach(attempt => {
      if (attempt.ipAddress) {
        ipCounts[attempt.ipAddress] = (ipCounts[attempt.ipAddress] || 0) + 1;
        if (!uniqueIPs.includes(attempt.ipAddress)) {
          uniqueIPs.push(attempt.ipAddress);
        }
      }
    });

    // Identify suspicious patterns (more than 5 attempts from same IP)
    const suspiciousPatterns = Object.entries(ipCounts)
      .filter(([ip, count]) => count > 5)
      .map(([ip, count]) => ({ ip, attempts: count }));

    return {
      attempts,
      uniqueIPs,
      suspiciousPatterns,
    };
  }

  async getSystemMetrics(days = 7): Promise<{
    totalActions: number;
    dailyActivity: Record<string, number>;
    actionTypes: Record<AuditAction, number>;
    riskLevels: Record<AuditLevel, number>;
    topAdmins: Array<{ adminId: string; actions: number; email?: string }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.auditLogRepository.find({
      where: {
        createdAt: Between(startDate, new Date()),
      },
      relations: ['admin'],
      order: { createdAt: 'DESC' },
    });

    const dailyActivity: Record<string, number> = {};
    const actionTypes: Record<AuditAction, number> = {} as Record<AuditAction, number>;
    const riskLevels: Record<AuditLevel, number> = {} as Record<AuditLevel, number>;
    const adminActivity: Record<string, { count: number; email?: string }> = {};

    logs.forEach(log => {
      const dateKey = log.createdAt.toISOString().split('T')[0];
      dailyActivity[dateKey] = (dailyActivity[dateKey] || 0) + 1;

      actionTypes[log.action] = (actionTypes[log.action] || 0) + 1;
      riskLevels[log.level] = (riskLevels[log.level] || 0) + 1;

      if (log.adminId) {
        if (!adminActivity[log.adminId]) {
          adminActivity[log.adminId] = {
            count: 0,
            email: log.admin?.email,
          };
        }
        adminActivity[log.adminId].count++;
      }
    });

    const topAdmins = Object.entries(adminActivity)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([adminId, data]) => ({
        adminId,
        actions: data.count,
        email: data.email,
      }));

    return {
      totalActions: logs.length,
      dailyActivity,
      actionTypes,
      riskLevels,
      topAdmins,
    };
  }

  async cleanupOldLogs(daysToKeep = 365): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.auditLogRepository.delete({
      createdAt: Between(new Date('1970-01-01'), cutoffDate),
    });

    await this.logAction({
      action: AuditAction.SYSTEM_ACTION,
      resource: 'audit_logs',
      description: `Cleaned up old audit logs: ${result.affected} records deleted`,
      level: AuditLevel.LOW,
      isSystemAction: true,
      metadata: { daysToKeep, cutoffDate, deletedCount: result.affected },
    });

    return { deleted: result.affected || 0 };
  }

  async exportAuditLogs(options: AuditQueryOptions): Promise<AdminAuditLog[]> {
    const { logs } = await this.getAuditLogs({ ...options, limit: 10000 });
    
    await this.logAction({
      action: AuditAction.SYSTEM_ACTION,
      resource: 'audit_logs',
      description: `Exported ${logs.length} audit log records`,
      level: AuditLevel.MEDIUM,
      metadata: { exportOptions: options, recordCount: logs.length },
    });

    return logs;
  }
} 