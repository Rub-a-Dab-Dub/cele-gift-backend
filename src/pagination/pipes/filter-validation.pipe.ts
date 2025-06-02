import {
    PipeTransform,
    Injectable,
    ArgumentMetadata,
    BadRequestException,
  } from '@nestjs/common';
  import { FilterOperator } from '../interfaces/pagination.interface';
  
  @Injectable()
  export class FilterValidationPipe implements PipeTransform {
    private readonly allowedOperators = Object.values(FilterOperator);
  
    transform(value: any, metadata: ArgumentMetadata) {
      if (metadata.type !== 'query' || !value.filters) {
        return value;
      }
  
      try {
        this.validateFilters(value.filters);
        return value;
      } catch (error) {
        throw new BadRequestException(`Invalid filters: ${error.message}`);
      }
    }
  
    private validateFilters(filters: Record<string, any>): void {
      Object.entries(filters).forEach(([field, filterValue]) => {
        this.validateSingleFilter(field, filterValue);
      });
    }
  
    private validateSingleFilter(field: string, filterValue: any): void {
      // Simple value filters (string, number, boolean, array)
      if (this.isSimpleFilter(filterValue)) {
        return;
      }
  
      // Complex filter objects
      if (this.isComplexFilter(filterValue)) {
        this.validateComplexFilter(field, filterValue);
        return;
      }
  
      throw new Error(`Invalid filter format for field: ${field}`);
    }
  
    private isSimpleFilter(value: any): boolean {
      return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        Array.isArray(value) ||
        value === null
      );
    }
  
    private isComplexFilter(value: any): boolean {
      return (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date) &&
        'operator' in value
      );
    }
  
    private validateComplexFilter(field: string, filter: any): void {
      if (!filter.operator) {
        throw new Error(`Missing operator for field: ${field}`);
      }
  
      if (!this.allowedOperators.includes(filter.operator)) {
        throw new Error(
          `Invalid operator "${filter.operator}" for field: ${field}. ` +
          `Allowed operators: ${this.allowedOperators.join(', ')}`
        );
      }
  
      // Validate operator-specific requirements
      this.validateOperatorRequirements(field, filter);
    }
  
    private validateOperatorRequirements(field: string, filter: any): void {
      const { operator, value } = filter;
  
      switch (operator) {
        case FilterOperator.IN:
        case FilterOperator.NOT_IN:
        case FilterOperator.ARRAY_OVERLAP:
          if (!Array.isArray(value)) {
            throw new Error(`${operator} operator requires an array value for field: ${field}`);
          }
          break;
  
        case FilterOperator.BETWEEN:
          if (!value || typeof value !== 'object' || !value.min || !value.max) {
            throw new Error(`BETWEEN operator requires min and max values for field: ${field}`);
          }
          break;
  
        case FilterOperator.IS_NULL:
        case FilterOperator.IS_NOT_NULL:
          // These operators don't require a value
          break;
  
        default:
          if (value === undefined) {
            throw new Error(`${operator} operator requires a value for field: ${field}`);
          }
      }
    }
  }