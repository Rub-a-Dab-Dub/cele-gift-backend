import { Controller, Get, Post, Put, Param, Body } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger"
import type { DashboardService } from "./dashboard.service"
import type { ExportService } from "../export/export.service"
import type { DashboardQueryDto } from "./dto/dashboard-query.dto"

@ApiTags("Dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private exportService: ExportService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get dashboard data with aggregated metrics" })
  @ApiResponse({ status: 200, description: "Dashboard data retrieved successfully" })
  async getDashboard(query: DashboardQueryDto) {
    return this.dashboardService.getDashboardData(query)
  }

  @Get("custom/:configId")
  @ApiOperation({ summary: "Get custom dashboard based on configuration" })
  @ApiResponse({ status: 200, description: "Custom dashboard data retrieved successfully" })
  async getCustomDashboard(@Param('configId') configId: string, query: DashboardQueryDto) {
    return this.dashboardService.getCustomDashboard(configId, query)
  }

  @Post('export')
  @ApiOperation({ summary: 'Request dashboard data export' })
  @ApiResponse({ status: 202, description: 'Export request accepted' })
  async exportDashboard(
    @Body() exportRequest: { format: 'excel' | 'pdf' | 'csv'; query: DashboardQueryDto },
  ) {
    const jobId = await this.exportService.requestExport({
      ...exportRequest,
      userId: 'current-user', // In real app, get from auth context
    });
    
    return { jobId, message: 'Export request submitted successfully' };
  }

  @Post('config')
  @ApiOperation({ summary: 'Create dashboard configuration' })
  @ApiResponse({ status: 201, description: 'Dashboard configuration created' })
  async createDashboardConfig(@Body() configData: any) {
    return this.dashboardService.createDashboardConfig(configData);
  }

  @Put("config/:id")
  @ApiOperation({ summary: "Update dashboard configuration" })
  @ApiResponse({ status: 200, description: "Dashboard configuration updated" })
  async updateDashboardConfig(@Param('id') id: string, @Body() configData: any) {
    return this.dashboardService.updateDashboardConfig(id, configData)
  }
}
