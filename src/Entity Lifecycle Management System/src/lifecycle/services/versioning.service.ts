import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { EntityVersion } from "../entities/entity-version.entity"

export interface CreateVersionDto {
  entityType: string
  entityId: string
  version: number
  entityData: Record<string, any>
  changeSummary?: string
  changedBy?: string
  isMajorVersion?: boolean
  metadata?: Record<string, any>
}

@Injectable()
export class VersioningService {
  private versionRepository: Repository<EntityVersion>

  constructor(versionRepository: Repository<EntityVersion>) {
    this.versionRepository = versionRepository
  }

  async createVersion(dto: CreateVersionDto): Promise<EntityVersion> {
    const version = this.versionRepository.create(dto)
    return this.versionRepository.save(version)
  }

  async getVersionHistory(entityType: string, entityId: string): Promise<EntityVersion[]> {
    return this.versionRepository.find({
      where: { entityType, entityId },
      order: { version: "DESC" },
    })
  }

  async getVersion(entityType: string, entityId: string, version: number): Promise<EntityVersion | null> {
    return this.versionRepository.findOne({
      where: { entityType, entityId, version },
    })
  }

  async getLatestVersion(entityType: string, entityId: string): Promise<EntityVersion | null> {
    return this.versionRepository.findOne({
      where: { entityType, entityId },
      order: { version: "DESC" },
    })
  }

  async getMajorVersions(entityType: string, entityId: string): Promise<EntityVersion[]> {
    return this.versionRepository.find({
      where: { entityType, entityId, isMajorVersion: true },
      order: { version: "DESC" },
    })
  }

  async compareVersions(
    entityType: string,
    entityId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<{
    from: EntityVersion | null
    to: EntityVersion | null
    differences: Record<string, { from: any; to: any }>
  }> {
    const [from, to] = await Promise.all([
      this.getVersion(entityType, entityId, fromVersion),
      this.getVersion(entityType, entityId, toVersion),
    ])

    const differences: Record<string, { from: any; to: any }> = {}

    if (from && to) {
      const allKeys = new Set([...Object.keys(from.entityData), ...Object.keys(to.entityData)])

      for (const key of allKeys) {
        if (from.entityData[key] !== to.entityData[key]) {
          differences[key] = {
            from: from.entityData[key],
            to: to.entityData[key],
          }
        }
      }
    }

    return { from, to, differences }
  }

  async cleanupOldVersions(entityType: string, entityId: string, keepCount = 10): Promise<void> {
    const versions = await this.versionRepository.find({
      where: { entityType, entityId },
      order: { version: "DESC" },
      skip: keepCount,
    })

    if (versions.length > 0) {
      await this.versionRepository.remove(versions)
    }
  }
}
