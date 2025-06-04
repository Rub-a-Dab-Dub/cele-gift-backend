import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { PostgreSQLArray, PostgreSQLJSON } from '../types/postgres.types';

export abstract class BasePostgreSQLRepository<T> extends Repository<T> {
  constructor(
    protected dataSource: DataSource,
    target: any
  ) {
    super(target, dataSource.createEntityManager());
  }

  // Array operations
  async findByArrayContains(field: string, value: any): Promise<T[]> {
    return this.createQueryBuilder()
      .where(`${field} @> :value`, { value: [value] })
      .getMany();
  }

  async findByArrayOverlap(field: string, values: any[]): Promise<T[]> {
    return this.createQueryBuilder()
      .where(`${field} && :values`, { values })
      .getMany();
  }

  async findByArrayLength(field: string, length: number): Promise<T[]> {
    return this.createQueryBuilder()
      .where(`array_length(${field}, 1) = :length`, { length })
      .getMany();
  }

  // JSON/JSONB operations
  async findByJsonPath(field: string, path: string, value: any): Promise<T[]> {
    return this.createQueryBuilder()
      .where(`${field}->>'${path}' = :value`, { value })
      .getMany();
  }

  async findByJsonContains(field: string, data: PostgreSQLJSON): Promise<T[]> {
    return this.createQueryBuilder()
      .where(`${field} @> :data`, { data })
      .getMany();
  }

  async findByJsonExists(field: string, key: string): Promise<T[]> {
    return this.createQueryBuilder()
      .where(`${field} ? :key`, { key })
      .getMany();
  }

  // Full-text search
  async fullTextSearch(field: string, query: string): Promise<T[]> {
    return this.createQueryBuilder()
      .where(`to_tsvector('english', ${field}) @@ plainto_tsquery('english', :query)`, { query })
      .getMany();
  }

  // HStore operations
  async findByHStoreKey(field: string, key: string): Promise<T[]> {
    return this.createQueryBuilder()
      .where(`${field} ? :key`, { key })
      .getMany();
  }

  async findByHStoreValue(field: string, key: string, value: string): Promise<T[]> {
    return this.createQueryBuilder()
      .where(`${field}->:key = :value`, { key, value })
      .getMany();
  }

  // Advanced PostgreSQL functions
  async getDistinctCount(field: string): Promise<number> {
    const result = await this.createQueryBuilder()
      .select(`COUNT(DISTINCT ${field})`, 'count')
      .getRawOne();
    return parseInt(result.count);
  }

  async getPercentileValue(field: string, percentile: number): Promise<number> {
    const result = await this.createQueryBuilder()
      .select(`percentile_cont(${percentile}) WITHIN GROUP (ORDER BY ${field})`, 'value')
      .getRawOne();
    return parseFloat(result.value);
  }

  // Window functions
  async getRankedResults(orderField: string, partitionField?: string): Promise<any[]> {
    let query = this.createQueryBuilder()
      .select('*')
      .addSelect(`ROW_NUMBER() OVER (ORDER BY ${orderField})`, 'rank');
    
    if (partitionField) {
      query = query.addSelect(`ROW_NUMBER() OVER (PARTITION BY ${partitionField} ORDER BY ${orderField})`, 'partition_rank');
    }
    
    return query.getRawMany();
  }
}
