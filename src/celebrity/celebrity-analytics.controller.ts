import { Controller, UseGuards, Get, Param, Query } from '@nestjs/common';

// @ApiTags('celebrity-analytics')
@Controller('celebrities/:celebrityId/analytics')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class CelebrityAnalyticsController {
  constructor(private readonly analyticsService: CelebrityAnalyticsService) {}

  @Get()
//   @ApiOperation({ summary: 'Get celebrity analytics' })
  getAnalytics(
    @Param('celebrityId') celebrityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('granularity') granularity?: 'day' | 'week' | 'month',
  ) {
    return this.analyticsService.getAnalytics(
      celebrityId,
      startDate,
      endDate,
      granularity,
    );
  }

  @Get('summary')
//   @ApiOperation({ summary: 'Get analytics summary' })
  getSummary(@Param('celebrityId') celebrityId: string) {
    return this.analyticsService.getSummary(celebrityId);
  }

  @Get('engagement')
//   @ApiOperation({ summary: 'Get engagement metrics' })
  getEngagement(
    @Param('celebrityId') celebrityId: string,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getEngagementMetrics(celebrityId, period);
  }
}
