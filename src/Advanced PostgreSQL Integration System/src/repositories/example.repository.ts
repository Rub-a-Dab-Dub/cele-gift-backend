import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ExampleEntity } from "../entities/example.entity"
import type { DatabaseService } from "../database/database.service"

export interface ExampleSearchOptions {
  tags?: string[]
  metadata?: Record<string, any>
  location?: { center: { x: number; y: number }; radius: number }
  textSearch?: string
  dateRange?: { start: Date; end: Date }
  includeDeleted?: boolean
}

@Injectable()
export class ExampleRepository {
  constructor(
    private readonly repository: Repository<ExampleEntity>,
    private readonly databaseService: DatabaseService,
  ) {}

  // Basic CRUD operations with PostgreSQL optimizations
  async create(data: Partial<ExampleEntity>): Promise<ExampleEntity> {
    const entity = this.repository.create(data)
    return this.repository.save(entity)
  }

  async findById(id: string, includeDeleted = false): Promise<ExampleEntity> {
    const query = this.repository.createQueryBuilder("example").where("example.id = :id", { id })

    if (!includeDeleted) {
      query.andWhere("example.deletedAt IS NULL")
    }

    return query.getOne()
  }

  async update(id: string, data: Partial<ExampleEntity>): Promise<ExampleEntity> {
    // Increment version for optimistic locking
    const updateData = { ...data, version: () => "version + 1" }
    await this.repository.update(id, updateData as any)
    return this.findById(id)
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.update(id, {
      deletedAt: new Date(),
      version: () => "version + 1",
    } as any)
  }

  // Advanced PostgreSQL-specific queries
  async findByTagsContaining(tags: string[]): Promise<ExampleEntity[]> {
    return this.repository
      .createQueryBuilder("example")
      .where("example.tags && :tags", { tags })
      .andWhere("example.deletedAt IS NULL")
      .getMany()
  }

  async findByTagsExact(tags: string[]): Promise<ExampleEntity[]> {
    return this.repository
      .createQueryBuilder("example")
      .where("example.tags = :tags", { tags })
      .andWhere("example.deletedAt IS NULL")
      .getMany()
  }

  async findByMetadataPath(path: string, value: any): Promise<ExampleEntity[]> {
    return this.repository
      .createQueryBuilder("example")
      .where(`example.metadata->>'${path}' = :value`, { value })
      .andWhere("example.deletedAt IS NULL")
      .getMany()
  }

  async findByMetadataContains(data: Record<string, any>): Promise<ExampleEntity[]> {
    return this.repository
      .createQueryBuilder("example")
      .where("example.metadata @> :data", { data: JSON.stringify(data) })
      .andWhere("example.deletedAt IS NULL")
      .getMany()
  }

  async updateMetadataField(id: string, path: string, value: any): Promise<void> {
    await this.databaseService.updateJsonbField("examples", id, "metadata", path, value)
  }

  async findWithinDistance(center: { x: number; y: number }, distance: number): Promise<ExampleEntity[]> {
    return this.repository
      .createQueryBuilder("example")
      .where(`point(:x, :y) <-> example.location < :distance`, {
        x: center.x,
        y: center.y,
        distance,
      })
      .andWhere("example.deletedAt IS NULL")
      .orderBy(`point(:x, :y) <-> example.location`)
      .setParameters({ x: center.x, y: center.y })
      .getMany()
  }

  async fullTextSearch(query: string): Promise<ExampleEntity[]> {
    return this.repository
      .createQueryBuilder("example")
      .where("example.searchVector @@ plainto_tsquery(:query)", { query })
      .andWhere("example.deletedAt IS NULL")
      .orderBy("ts_rank(example.searchVector, plainto_tsquery(:query))", "DESC")
      .setParameter("query", query)
      .getMany()
  }

  async findByHstoreKey(key: string, value?: string): Promise<ExampleEntity[]> {
    const query = this.repository
      .createQueryBuilder("example")
      .where("example.attributes ? :key", { key })
      .andWhere("example.deletedAt IS NULL")

    if (value !== undefined) {
      query.andWhere("example.attributes -> :key = :value", { key, value })
    }

    return query.getMany()
  }

  async findByDateRange(start: Date, end: Date): Promise<ExampleEntity[]> {
    return this.repository
      .createQueryBuilder("example")
      .where("example.createdAt BETWEEN :start AND :end", { start, end })
      .andWhere("example.deletedAt IS NULL")
      .orderBy("example.createdAt", "DESC")
      .getMany()
  }

  // Complex search with multiple criteria
  async search(options: ExampleSearchOptions): Promise<ExampleEntity[]> {
    let query = this.repository.createQueryBuilder("example")

    if (!options.includeDeleted) {
      query = query.where("example.deletedAt IS NULL")
    }

    if (options.tags && options.tags.length > 0) {
      query = query.andWhere("example.tags && :tags", { tags: options.tags })
    }

    if (options.metadata) {
      query = query.andWhere("example.metadata @> :metadata", {
        metadata: JSON.stringify(options.metadata),
      })
    }

    if (options.location) {
      const { center, radius } = options.location
      query = query.andWhere(`point(:x, :y) <-> example.location < :radius`, { x: center.x, y: center.y, radius })
    }

    if (options.textSearch) {
      query = query.andWhere("example.searchVector @@ plainto_tsquery(:textSearch)", { textSearch: options.textSearch })
    }

    if (options.dateRange) {
      query = query.andWhere("example.createdAt BETWEEN :start AND :end", {
        start: options.dateRange.start,
        end: options.dateRange.end,
      })
    }

    return query.getMany()
  }

  // Aggregation queries
  async getTagsStatistics(): Promise<Array<{ tag: string; count: number }>> {
    const result = await this.repository
      .createQueryBuilder("example")
      .select("unnest(example.tags) as tag, COUNT(*) as count")
      .where("example.deletedAt IS NULL")
      .groupBy("tag")
      .orderBy("count", "DESC")
      .getRawMany()

    return result.map((row) => ({ tag: row.tag, count: Number.parseInt(row.count) }))
  }

  async getMetadataStatistics(path: string): Promise<Array<{ value: string; count: number }>> {
    const result = await this.repository
      .createQueryBuilder("example")
      .select(`example.metadata->>'${path}' as value, COUNT(*) as count`)
      .where("example.deletedAt IS NULL")
      .andWhere(`example.metadata->>'${path}' IS NOT NULL`)
      .groupBy("value")
      .orderBy("count", "DESC")
      .getRawMany()

    return result.map((row) => ({ value: row.value, count: Number.parseInt(row.count) }))
  }

  // Bulk operations
  async bulkCreate(entities: Partial<ExampleEntity>[]): Promise<ExampleEntity[]> {
    return this.repository.save(entities)
  }

  async bulkUpdate(updates: Array<{ id: string; data: Partial<ExampleEntity> }>): Promise<void> {
    await this.databaseService.executeWithTransaction(async (queryRunner) => {
      for (const update of updates) {
        await queryRunner.manager.update(ExampleEntity, update.id, {
          ...update.data,
          version: () => "version + 1",
        } as any)
      }
    })
  }

  async bulkSoftDelete(ids: string[]): Promise<void> {
    await this.repository.update(ids, {
      deletedAt: new Date(),
      version: () => "version + 1",
    } as any)
  }

  // Utility methods
  async exists(id: string): Promise<boolean> {
    const count = await this.repository
      .createQueryBuilder("example")
      .where("example.id = :id", { id })
      .andWhere("example.deletedAt IS NULL")
      .getCount()

    return count > 0
  }

  async count(options?: Partial<ExampleSearchOptions>): Promise<number> {
    let query = this.repository.createQueryBuilder("example")

    if (!options?.includeDeleted) {
      query = query.where("example.deletedAt IS NULL")
    }

    if (options?.tags && options.tags.length > 0) {
      query = query.andWhere("example.tags && :tags", { tags: options.tags })
    }

    if (options?.metadata) {
      query = query.andWhere("example.metadata @> :metadata", {
        metadata: JSON.stringify(options.metadata),
      })
    }

    return query.getCount()
  }
}
