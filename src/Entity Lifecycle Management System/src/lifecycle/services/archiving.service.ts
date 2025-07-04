import { Injectable } from "@nestjs/common"
import { type Repository, LessThan } from "typeorm"
import type { EntityArchive } from "../entities/entity-archive.entity"

export interface CreateArchiveDto {
  entityType: string
  entityId: string
  entityData: Record<string, any>
  archivedBy?: string
  reason?: string
  retentionUntil?: Date
  isPermanent?: boolean
  metadata?: Record<string, any>
}

@Injectable()
export class ArchivingService {
  private archiveRepository: Repository<EntityArchive>

  constructor(archiveRepository: Repository<EntityArchive>) {
    this.archiveRepository = archiveRepository
  }

  async archiveEntity(dto: CreateArchiveDto): Promise<EntityArchive> {
    const archive = this.archiveRepository.create({
      ...dto,
      archivedAt: new Date(),
    })
    return this.archiveRepository.save(archive)
  }

  async getArchivedEntity(entityType: string, entityId: string): Promise<EntityArchive | null> {
    return this.archiveRepository.findOne({
      where: { entityType, entityId },
      order: { archivedAt: "DESC" },
    })
  }

  async getArchivedEntities(entityType: string, limit = 100): Promise<EntityArchive[]> {
    return this.archiveRepository.find({
      where: { entityType },
      order: { archivedAt: "DESC" },
      take: limit,
    })
  }

  async restoreFromArchive(entityType: string, entityId: string): Promise<EntityArchive | null> {
    const archive = await this.getArchivedEntity(entityType, entityId)
    if (archive) {
      await this.archiveRepository.remove(archive)
    }
    return archive
  }

  async getExpiredArchives(): Promise<EntityArchive[]> {
    return this.archiveRepository.find({
      where: {
        retentionUntil: LessThan(new Date()),
        isPermanent: false,
      },
    })
  }

  async cleanupExpiredArchives(): Promise<number> {
    const expiredArchives = await this.getExpiredArchives()
    if (expiredArchives.length > 0) {
      await this.archiveRepository.remove(expiredArchives)
    }
    return expiredArchives.length
  }

  async getArchiveStatistics(): Promise<{
    totalArchives: number
    archivesByType: Record<string, number>
    expiredCount: number
    permanentCount: number
  }> {
    const [totalArchives, expiredArchives, permanentArchives] = await Promise.all([
      this.archiveRepository.count(),
      this.archiveRepository.count({
        where: {
          retentionUntil: LessThan(new Date()),
          isPermanent: false,
        },
      }),
      this.archiveRepository.count({ where: { isPermanent: true } }),
    ])

    const archivesByTypeQuery = await this.archiveRepository
      .createQueryBuilder("archive")
      .select("archive.entityType", "entityType")
      .addSelect("COUNT(*)", "count")
      .groupBy("archive.entityType")
      .getRawMany()

    const archivesByType = archivesByTypeQuery.reduce((acc, item) => {
      acc[item.entityType] = Number.parseInt(item.count)
      return acc
    }, {})

    return {
      totalArchives,
      archivesByType,
      expiredCount: expiredArchives,
      permanentCount: permanentArchives,
    }
  }
}
