import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { FileSortingService } from '../services/file-sorting.service';
import { SortBy } from '../enums/sort-by.enum';
import { SortOrder } from '../enums/sort-order.enum';

@Controller('files')
@UseGuards(TenantGuard)
export class FilesController {
  constructor(private fileSortingService: FileSortingService) {}
  
  @Get()
  async getFiles(
    @Tenant() tenantId: string,
    @Query('sortBy') sortBy: SortBy = SortBy.NAME,
    @Query('sortOrder') sortOrder: SortOrder = SortOrder.ASC,
    @Query('foldersFirst') foldersFirst: boolean = true
  ) {
    // Get files from repository (implementation needed)
    const files = []; // Replace with actual file retrieval
    
    return this.fileSortingService.sortItems(files, {
      sortBy,
      sortOrder,
      foldersFirst,
      caseSensitive: false
    });
  }
}