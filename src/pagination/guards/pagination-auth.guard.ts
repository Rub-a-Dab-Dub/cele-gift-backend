import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { PAGINATION_KEY } from '../decorators/paginate.decorator';
  
  @Injectable()
  export class PaginationAuthGuard implements CanActivate {
    constructor(private reflector: Reflector) {}
  
    canActivate(context: ExecutionContext): boolean {
      const paginationConfig = this.reflector.getAllAndOverride(PAGINATION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
  
      if (!paginationConfig) {
        return true;
      }
  
      const request = context.switchToHttp().getRequest();
      const query = request.query;
  
      // Validate maximum limit
      if (query.limit && query.limit > paginationConfig.maxLimit) {
        throw new ForbiddenException(
          `Requested limit (${query.limit}) exceeds maximum allowed (${paginationConfig.maxLimit})`
        );
      }
  
      if (query.first && query.first > paginationConfig.maxLimit) {
        throw new ForbiddenException(
          `Requested first (${query.first}) exceeds maximum allowed (${paginationConfig.maxLimit})`
        );
      }
  
      if (query.last && query.last > paginationConfig.maxLimit) {
        throw new ForbiddenException(
          `Requested last (${query.last}) exceeds maximum allowed (${paginationConfig.maxLimit})`
        );
      }
  
      // Validate allowed sort fields
      if (paginationConfig.allowedSortFields && query.sortBy) {
        if (!paginationConfig.allowedSortFields.includes(query.sortBy)) {
          throw new ForbiddenException(
            `Invalid sort field: ${query.sortBy}. Allowed fields: ${paginationConfig.allowedSortFields.join(', ')}`
          );
        }
      }
  
      // Validate allowed filter fields
      if (paginationConfig.allowedFilterFields && query.filters) {
        const filterFields = Object.keys(query.filters);
        const invalidFields = filterFields.filter(
          field => !paginationConfig.allowedFilterFields.includes(field)
        );
  
        if (invalidFields.length > 0) {
          throw new ForbiddenException(
            `Invalid filter fields: ${invalidFields.join(', ')}. ` +
            `Allowed fields: ${paginationConfig.allowedFilterFields.join(', ')}`
          );
        }
      }
  
      return true;
    }
  }