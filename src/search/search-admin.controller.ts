import { Controller, Get, Post, Put, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchAdminService } from './search-admin.service';

@ApiTags('Search Admin')
@Controller('admin/search')
@ApiBearerAuth()
// @UseGuards(AdminGuard) // Uncomment when you have admin guard
export class SearchAdminController {
  constructor(private searchAdminService: SearchAdminService) {}

  @Get('health')
  @ApiOperation({ summary: 'Get search system health status' })
  async getSearchHealth() {
    return this.searchAdminService.getSearchHealth();
  }

  @Post('rebuild-indexes')
  @ApiOperation({ summary: 'Rebuild all search indexes' })
  async rebuildIndexes() {
    await this.searchAdminService.rebuildAllIndexes();
    return { message: 'Index rebuild completed successfully' };
  }

  @Put('weights/:entityName')
  @ApiOperation({ summary: 'Update search field weights for an entity' })
  async updateWeights(
    @Param('entityName') entityName: string,
    @Body() weights: Record<string, number>,
  ) {
    await this.searchAdminService.updateSearchWeights(entityName, weights);
    return { message: 'Search weights updated successfully' };
  }
}