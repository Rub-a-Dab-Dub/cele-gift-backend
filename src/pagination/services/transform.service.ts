import { Injectable, Logger } from '@nestjs/common';
import { plainToClass, ClassConstructor } from 'class-transformer';
import { TransformOptions } from '../interfaces/pagination.interface';

@Injectable()
export class TransformService {
  private readonly logger = new Logger(TransformService.name);

  transformPaginatedResponse<T>(
    paginatedResult: any,
    options: TransformOptions,
  ): any {
    const startTime = Date.now();

    try {
      if (paginatedResult.data) {
        // Handle offset pagination
        paginatedResult.data = this.transformArray(paginatedResult.data, options);
      } else if (paginatedResult.edges) {
        // Handle cursor pagination
        paginatedResult.edges = paginatedResult.edges.map((edge: any) => ({
          ...edge,
          node: this.transformItem(edge.node, options),
        }));
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Response transformation completed in ${duration}ms`);

      return paginatedResult;
    } catch (error) {
      this.logger.error('Error transforming paginated response:', error);
      return paginatedResult; // Return original data on error
    }
  }

  transformArray<T>(items: T[], options: TransformOptions): T[] {
    return items.map(item => this.transformItem(item, options));
  }

  transformItem<T>(item: T, options: TransformOptions): T {
    if (!item || typeof item !== 'object') {
      return item;
    }

    let transformed = { ...item };

    // Apply exclusions
    if (options.exclude) {
      options.exclude.forEach(field => {
        delete (transformed as any)[field];
      });
    }

    // Apply inclusions (if specified, only include these fields)
    if (options.include) {
      const included: any = {};
      options.include.forEach(field => {
        if (field in transformed) {
          included[field] = (transformed as any)[field];
        }
      });
      transformed = included;
    }

    // Apply field transformations
    if (options.transform) {
      Object.entries(options.transform).forEach(([field, transformer]) => {
        if (field in transformed) {
          (transformed as any)[field] = transformer((transformed as any)[field]);
        }
      });
    }

    // Apply nested transformations
    if (options.nested) {
      Object.entries(options.nested).forEach(([field, nestedOptions]) => {
        if (field in transformed) {
          const nestedValue = (transformed as any)[field];
          if (Array.isArray(nestedValue)) {
            (transformed as any)[field] = this.transformArray(nestedValue, nestedOptions);
          } else if (nestedValue && typeof nestedValue === 'object') {
            (transformed as any)[field] = this.transformItem(nestedValue, nestedOptions);
          }
        }
      });
    }

    return transformed;
  }

  toDTO<T, V>(cls: ClassConstructor<V>, items: T[]): V[];
  toDTO<T, V>(cls: ClassConstructor<V>, item: T): V;
  toDTO<T, V>(cls: ClassConstructor<V>, data: T | T[]): V | V[] {
    if (Array.isArray(data)) {
      return data.map(item => plainToClass(cls, item, { excludeExtraneousValues: true }));
    }
    return plainToClass(cls, data, { excludeExtraneousValues: true });
  }
}