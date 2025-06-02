
import { Injectable, BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { FilterOperator } from '../interfaces/pagination.interface';

@Injectable()
export class FilterBuilder {
  applyFilters<T>(
    queryBuilder: SelectQueryBuilder<T>,
    filters: Record<string, any>,
    alias?: string,
  ): void {
    Object.entries(filters).forEach(([field, filterValue], index) => {
      this.applyFilter(queryBuilder, field, filterValue, alias, index);
    });
  }

  private applyFilter<T>(
    queryBuilder: SelectQueryBuilder<T>,
    field: string,
    filterValue: any,
    alias?: string,
    index: number,
  ): void {
    // Handle complex filter objects
    if (this.isComplexFilter(filterValue)) {
      this.applyComplexFilter(queryBuilder, field, filterValue, alias, index);
      return;
    }

    // Handle simple equality filter
    this.applySimpleFilter(queryBuilder, field, filterValue, alias, index);
  }

  private isComplexFilter(value: any): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    );
  }

  private applyComplexFilter<T>(
    queryBuilder: SelectQueryBuilder<T>,
    field: string,
    filterConfig: any,
    alias?: string,
    index: number,
  ): void {
    const { operator, value, relation } = filterConfig;
    const fieldPath = this.buildFieldPath(field, alias, relation);
    const paramName = `filter_${index}`;

    switch (operator) {
      case FilterOperator.EQUALS:
        queryBuilder.andWhere(`${fieldPath} = :${paramName}`, { [paramName]: value });
        break;

      case FilterOperator.NOT_EQUALS:
        queryBuilder.andWhere(`${fieldPath} != :${paramName}`, { [paramName]: value });
        break;

      case FilterOperator.GREATER_THAN:
        queryBuilder.andWhere(`${fieldPath} > :${paramName}`, { [paramName]: value });
        break;

      case FilterOperator.GREATER_THAN_OR_EQUAL:
        queryBuilder.andWhere(`${fieldPath} >= :${paramName}`, { [paramName]: value });
        break;

      case FilterOperator.LESS_THAN:
        queryBuilder.andWhere(`${fieldPath} < :${paramName}`, { [paramName]: value });
        break;

      case FilterOperator.LESS_THAN_OR_EQUAL:
        queryBuilder.andWhere(`${fieldPath} <= :${paramName}`, { [paramName]: value });
        break;

      case FilterOperator.LIKE:
        queryBuilder.andWhere(`${fieldPath} LIKE :${paramName}`, { 
          [paramName]: `%${value}%` 
        });
        break;

      case FilterOperator.ILIKE:
        queryBuilder.andWhere(`${fieldPath} ILIKE :${paramName}`, { 
          [paramName]: `%${value}%` 
        });
        break;

      case FilterOperator.IN:
        if (!Array.isArray(value)) {
          throw new BadRequestException(`IN operator requires an array value for field: ${field}`);
        }
        queryBuilder.andWhere(`${fieldPath} IN (:...${paramName})`, { [paramName]: value });
        break;

      case FilterOperator.NOT_IN:
        if (!Array.isArray(value)) {
          throw new BadRequestException(`NOT_IN operator requires an array value for field: ${field}`);
        }
        queryBuilder.andWhere(`${fieldPath} NOT IN (:...${paramName})`, { [paramName]: value });
        break;

      case FilterOperator.IS_NULL:
        queryBuilder.andWhere(`${fieldPath} IS NULL`);
        break;

      case FilterOperator.IS_NOT_NULL:
        queryBuilder.andWhere(`${fieldPath} IS NOT NULL`);
        break;

      case FilterOperator.BETWEEN:
        if (!value.min || !value.max) {
          throw new BadRequestException(`BETWEEN operator requires min and max values for field: ${field}`);
        }
        queryBuilder.andWhere(`${fieldPath} BETWEEN :${paramName}_min AND :${paramName}_max`, {
          [`${paramName}_min`]: value.min,
          [`${paramName}_max`]: value.max,
        });
        break;

      case FilterOperator.ARRAY_CONTAINS:
        queryBuilder.andWhere(`${fieldPath} @> :${paramName}`, { [paramName]: [value] });
        break;

      case FilterOperator.ARRAY_OVERLAP:
        if (!Array.isArray(value)) {
          throw new BadRequestException(`ARRAY_OVERLAP operator requires an array value for field: ${field}`);
        }
        queryBuilder.andWhere(`${fieldPath} && :${paramName}`, { [paramName]: value });
        break;

      case FilterOperator.JSON_CONTAINS:
        queryBuilder.andWhere(`${fieldPath} @> :${paramName}`, { [paramName]: JSON.stringify(value) });
        break;

      default:
        throw new BadRequestException(`Unsupported filter operator: ${operator}`);
    }
  }

  private applySimpleFilter<T>(
    queryBuilder: SelectQueryBuilder<T>,
    field: string,
    value: any,
    alias?: string,
    index: number,
  ): void {
    const fieldPath = this.buildFieldPath(field, alias);
    const paramName = `filter_${index}`;

    if (value === null) {
      queryBuilder.andWhere(`${fieldPath} IS NULL`);
    } else if (Array.isArray(value)) {
      queryBuilder.andWhere(`${fieldPath} IN (:...${paramName})`, { [paramName]: value });
    } else {
      queryBuilder.andWhere(`${fieldPath} = :${paramName}`, { [paramName]: value });
    }
  }

  private buildFieldPath(field: string, alias?: string, relation?: string): string {
    if (relation) {
      return `${relation}.${field}`;
    }
    return alias ? `${alias}.${field}` : field;
  }
}