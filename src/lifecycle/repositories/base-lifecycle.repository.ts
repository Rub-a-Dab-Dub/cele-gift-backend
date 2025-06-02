import { Repository, SelectQueryBuilder, FindManyOptions, FindOneOptions } from 'typeorm';
import { ILifecycleEntity } from '../interfaces/lifecycle-entity.interface';

export class BaseLifecycleRepository<T extends ILifecycleEntity> extends Repository<T> {
  
  // Override find methods to exclude soft deleted by default
  async find(options?: FindManyOptions<T>): Promise<T[]> {
    const query = this.createQueryBuilder('entity');
    this.applyDefaultFilters(query);
    
    if (options?.where) {
      query.andWhere(options.where);
    }
    
    if (options?.relations) {
      options.relations.forEach(relation => {
        query.leftJoinAndSelect(`entity.${relation}`, relation);
      });
    }
    
    if (options?.order) {
      Object.entries(options.order).forEach(([key, value]) => {
        query.addOrderBy(`entity.${key}`, value);
      });
    }
    
    if (options?.skip) {
      query.skip(options.skip);
    }
    
    if (options?.take) {
      query.take(options.take);
    }
    
    return query.getMany();
  }

  async findOne(options?: FindOneOptions<T>): Promise<T | null> {
    const query = this.createQueryBuilder('entity');
    this.applyDefaultFilters(query);
    
    if (options?.where) {
      query.andWhere(options.where);
    }
    
    if (options?.relations) {
      options.relations.forEach(relation => {
        query.leftJoinAndSelect(`entity.${relation}`, relation);
      });
    }
    
    return query.getOne();
  }

  // Methods that include soft deleted entities
  async findWithDeleted(options?: FindManyOptions<T>): Promise<T[]> {
    return super.find(options);
  }

  async findOneWithDeleted(options?: FindOneOptions<T>): Promise<T | null> {
    return super.findOne(options);
  }

  // Methods for archived entities
  async findArchived(options?: FindManyOptions<T>): Promise<T[]> {
    const query = this.createQueryBuilder('entity');
    query.where('entity.isArchived = :isArchived', { isArchived: true });
    
    if (options?.where) {
      query.andWhere(options.where);
    }
    
    return query.getMany();
  }

  // Methods for only deleted entities
  async findDeleted(options?: FindManyOptions<T>): Promise<T[]> {
    const query = this.createQueryBuilder('entity');
    query.where('entity.isDeleted = :isDeleted', { isDeleted: true });
    
    if (options?.where) {
      query.andWhere(options.where);
    }
    
    return query.getMany();
  }

  private applyDefaultFilters(query: SelectQueryBuilder<T>): void {
    query.where('entity.isDeleted = :isDeleted', { isDeleted: false });
    query.andWhere('entity.isArchived = :isArchived', { isArchived: false });
  }
}