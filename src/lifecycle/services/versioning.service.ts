import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityVersion } from '../entities/entity-version.entity';

@Injectable()
export class VersioningService {
  private readonly logger = new Logger(VersioningService.name);

  constructor(
    @InjectRepository(EntityVersion)
    private versionRepository: Repository<EntityVersion>
  ) {}

  async createVersion<T>(
    entityType: string,
    entityId: string,
    version: number,
    data: T,
    userId?: string,
    transactionId?: string
  ): Promise<EntityVersion> {
    try {
      const entityVersion = this.versionRepository.create({
        entityType,
        entityId,
        version,
        data,
        userId,
        transactionId
      });
      return await this.versionRepository.save(entityVersion);
    } catch (error) {
      this.logger.error('Error creating entity version:', error);
      throw error;
    }
  }

  async getVersion(entityType: string, entityId: string, version: number): Promise<EntityVersion | null> {
    return this.versionRepository.findOne({
      where: { entityType, entityId, version }
    });
  }

  async getLatestVersion(entityType: string, entityId: string): Promise<EntityVersion | null> {
    return this.versionRepository.findOne({
      where: { entityType, entityId },
      order: { version: 'DESC' }
    });
  }

  async getVersionHistory(entityType: string, entityId: string): Promise<EntityVersion[]> {
    return this.versionRepository.find({
      where: { entityType, entityId },
      order: { version: 'DESC' }
    });
  }

  async getNextVersion(entityType: string, entityId: string): Promise<number> {
    const latest = await this.getLatestVersion(entityType, entityId);
    return latest ? latest.version + 1 : 1;
  }
}