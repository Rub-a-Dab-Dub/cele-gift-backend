import { Injectable, BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { SortConfig, SortDirection } from '../interfaces/pagination.interface';

@Injectable()
export class SortBuilder {
  applySort<T>(
    queryBuilder: SelectQueryBuilder<T>,
    sortConfig: SortConfig,
    alias?: string,
  ): void {
    this.applySingleSort(queryBuilder, sortConfig, alias);
  }

  applySorts<T>(
    queryBuilder: SelectQueryBuilder<T>,
    sortConfigs: SortConfig[],
    alias?: string,
  ): void {
    sortConfigs.forEach((config, index) => {
      if (index === 0) {
        this.applySingleSort(queryBuilder, config, alias);
      } else {
        this.addSingleSort(queryBuilder, config, alias);
      }
    });
  }

  private applySingleSort<T>(
    queryBuilder: SelectQueryBuilder<T>,
    sortConfig: SortConfig,
    alias?: string,
  ): void {
    const fieldPath = this.buildSortFieldPath(sortConfig.field, alias, sortConfig.relation);
    const direction = sortConfig.direction || SortDirection.ASC;
    const nullsOrder = sortConfig.nullsFirst ? 'NULLS FIRST' : 'NULLS LAST';

    queryBuilder.orderBy(fieldPath, direction, nullsOrder);
  }

  private addSingleSort<T>(
    queryBuilder: SelectQueryBuilder<T>,
    sortConfig: SortConfig,
    alias?: string,
  ): void {
    const fieldPath = this.buildSortFieldPath(sortConfig.field, alias, sortConfig.relation);
    const direction = sortConfig.direction || SortDirection.ASC;
    const nullsOrder = sortConfig.nullsFirst ? 'NULLS FIRST' : 'NULLS LAST';

    queryBuilder.addOrderBy(fieldPath, direction, nullsOrder);
  }

  private buildSortFieldPath(field: string, alias?: string, relation?: string): string {
    if (relation) {
      return `${relation}.${field}`;
    }
    return alias ? `${alias}.${field}` : field;
  }

  validateSortField(field: string, allowedFields: string[]): void {
    if (allowedFields.length > 0 && !allowedFields.includes(field)) {
      throw new BadRequestException(
        `Invalid sort field: ${field}. Allowed fields: ${allowedFields.join(', ')}`
      );
    }
  }
}