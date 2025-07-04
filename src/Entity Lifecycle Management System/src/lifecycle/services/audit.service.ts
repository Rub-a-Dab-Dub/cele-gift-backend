import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { AuditLog, AuditAction } from "../entities/audit-log.entity"

export interface CreateAuditLogDto {
  entityType: string
  entityId: string
  action: AuditAction
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  changedFields?: string[]
  userId?: string
  ipAddress?: string
  userAgent?: string
  reason?: string
  metadata?: Record<string, any>
}

@Injectable()
export class AuditService {
  private auditLogRepository: Repository<AuditLog>

  constructor(auditLogRepository: Repository<AuditLog>) {
    this.auditLogRepository = auditLogRepository
  }

  async createAuditLog(dto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(dto)
    return this.auditLogRepository.save(auditLog)
  }

  async getAuditTrail(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { createdAt: "DESC" },
    })
  }

  async getAuditLogsByUser(userId: string, limit = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
    })
  }

  async getAuditLogsByAction(action: AuditAction, limit = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action },
      order: { createdAt: "DESC" },
      take: limit,
    })
  }

  private getChangedFields(oldValues: any, newValues: any): string[] {
    const changedFields: string[] = []
    const allKeys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})])

    for (const key of allKeys) {
      if (oldValues?.[key] !== newValues?.[key]) {
        changedFields.push(key)
      }
    }

    return changedFields
  }

  async logEntityChange(
    entityType: string,
    entityId: string,
    action: AuditAction,
    oldEntity?: any,
    newEntity?: any,
    userId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const changedFields = this.getChangedFields(oldEntity, newEntity)

    await this.createAuditLog({
      entityType,
      entityId,
      action,
      oldValues: oldEntity,
      newValues: newEntity,
      changedFields,
      userId,
      metadata,
    })
  }
}
