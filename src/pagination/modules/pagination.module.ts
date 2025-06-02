import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PaginationService } from '../services/pagination.service';
import { FilterBuilder } from '../services/filter.builder';
import { SortBuilder } from '../services/sort.builder';
import { CacheService } from '../services/cache.service';
import { TransformService } from '../services/transform.service';
import { PaginationInterceptor } from '../interceptors/pagination.interceptor';
import { PaginationValidationPipe } from '../pipes/pagination-validation.pipe';
import { FilterValidationPipe } from '../pipes/filter-validation.pipe';
import { PaginationAuthGuard } from '../guards/pagination-auth.guard';

@Global()
@Module({
  imports: [CacheModule],
  providers: [
    PaginationService,
    FilterBuilder,
    SortBuilder,
    CacheService,
    TransformService,
    PaginationInterceptor,
    PaginationValidationPipe,
    FilterValidationPipe,
    PaginationAuthGuard,
  ],
  exports: [
    PaginationService,
    FilterBuilder,
    SortBuilder,
    CacheService,
    TransformService,
    PaginationInterceptor,
    PaginationValidationPipe,
    FilterValidationPipe,
    PaginationAuthGuard,
  ],
})
export class PaginationModule {}