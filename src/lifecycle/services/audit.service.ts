import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { IAuditLog } from '../interfaces/audit-log.interface';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>
  ) {}

  async createAuditLog(data: Partial<IAuditLog>): Promise<AuditLog> {
    try {
      const auditLog = this.auditRepository.create(data);
      return await this.auditRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Error creating audit log:', error);
      throw error;
    }
  }

  async createBulkAuditLogs(data: Partial<IAuditLog>[]): Promise<AuditLog[]> {
    try {
      const auditLogs = this.auditRepository.create(data);
      return await this.auditRepository.save(auditLogs);
    } catch (error) {
      this.logger.error('Error creating bulk audit logs:', error);
      throw error;
    }
  }

  async getAuditHistory(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' }
    });
  }

  async getAuditByTransaction(transactionId: string): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { transactionId },
      order: { timestamp: 'ASC' }
    });
  }
}