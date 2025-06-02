import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TestTransactionManager } from '../services/test-transaction-manager.service';
import { TestFixtureManager } from '../services/test-fixture-manager.service';
import { DatabaseAssertions } from '../services/database-assertions.service';
import { TestDataGenerator } from '../services/test-data-generator.service';
import { PerformanceTestRunner } from '../services/performance-test-runner.service';
import { TestReportGenerator } from '../services/test-report-generator.service';
import { TestEnvironmentManager } from '../services/test-environment-manager.service';

@ApiTags('Database Testing')
@Controller('api/database-testing')
export class DatabaseTestController {
  constructor(
    private readonly transactionManager: TestTransactionManager,
    private readonly fixtureManager: TestFixtureManager,
    private readonly assertions: DatabaseAssertions,
    private readonly dataGenerator: TestDataGenerator,
    private readonly performanceRunner: PerformanceTestRunner,
    private readonly reportGenerator: TestReportGenerator,
    private readonly environmentManager: TestEnvironmentManager,
  ) {}

  // Environment Management
  @Post('environments')
  @ApiOperation({ summary: 'Create test environment' })
  async createEnvironment(@Body() options: any) {
    return await this.environmentManager.createTestEnvironment(options);
  }

  @Get('environments')
  @ApiOperation({ summary: 'Get active test environments' })
  async getEnvironments() {
    return await this.environmentManager.getActiveEnvironments();
  }

  @Delete('environments/:id')
  @ApiOperation({ summary: 'Destroy test environment' })
  async destroyEnvironment(@Param('id') id: string) {
    await this.environmentManager.destroyEnvironment(id);
    return { message: 'Environment destroyed successfully' };
  }

  @Get('environments/stats')
  @ApiOperation({ summary: 'Get environment statistics' })
  async getEnvironmentStats() {
    return await this.environmentManager.getEnvironmentStats();
  }

  // Transaction Management
  @Post('transactions')
  @ApiOperation({ summary: 'Start test transaction' })
  async startTransaction(@Body() options: any) {
    const transactionId = await this.transactionManager.startTransaction(options);
    return { transactionId };
  }

  @Post('transactions/:id/commit')
  @ApiOperation({ summary: 'Commit test transaction' })
  async commitTransaction(@Param('id') id: string) {
    await this.transactionManager.commitTransaction(id);
    return { message: 'Transaction committed successfully' };
  }

  @Post('transactions/:id/rollback')
  @ApiOperation({ summary: 'Rollback test transaction' })
  async rollbackTransaction(@Param('id') id: string) {
    await this.transactionManager.rollbackTransaction(id);
    return { message: 'Transaction rolled back successfully' };
  }

  @Get('transactions/:id/info')
  @ApiOperation({ summary: 'Get transaction information' })
  async getTransactionInfo(@Param('id') id: string) {
    return await this.transactionManager.getTransactionInfo(id);
  }

  // Fixture Management
  @Get('fixtures')
  @ApiOperation({ summary: 'Get all fixtures' })
  async getFixtures() {
    return await this.fixtureManager.getAllFixtures();
  }

  @Post('fixtures')
  @ApiOperation({ summary: 'Create fixture' })
  async createFixture(@Body() fixtureData: any) {
    return await this.fixtureManager.createFixture(
      fixtureData.name,
      fixtureData.filePath,
      fixtureData.options
    );
  }

  @Post('fixtures/:name/load')
  @ApiOperation({ summary: 'Load fixture' })
  async loadFixture(@Param('name') name: string, @Body() options: any = {}) {
    return await this.fixtureManager.loadFixture(name, undefined, options);
  }

  @Post('fixtures/:name/validate')
  @ApiOperation({ summary: 'Validate fixture' })
  async validateFixture(@Param('name') name: string) {
    return await this.fixtureManager.validateFixture(name);
  }

  @Delete('fixtures/:name')
  @ApiOperation({ summary: 'Delete fixture' })
  async deleteFixture(@Param('name') name: string) {
    await this.fixtureManager.deleteFixture(name);
    return { message: 'Fixture deleted successfully' };
  }

  // Data Generation
  @Post('data/generate')
  @ApiOperation({ summary: 'Generate test data' })
  async generateTestData(@Body() config: any) {
    return await this.dataGenerator.generateTestData(config);
  }

  @Post('data/insert')
  @ApiOperation({ summary: 'Insert generated data' })
  async insertTestData(@Body() { tableName, data, options }: any) {
    return await this.dataGenerator.insertGeneratedData(tableName, data, options);
  }

  @Post('data/cleanup')
  @ApiOperation({ summary: 'Cleanup test data' })
  async cleanupTestData(@Body() { tableNames }: { tableNames: string[] }) {
    await this.dataGenerator.cleanupTestData(tableNames);
    return { message: 'Test data cleaned up successfully' };
  }

  // Performance Testing
  @Post('performance/run')
  @ApiOperation({ summary: 'Run performance test' })
  async runPerformanceTest(@Body() { testName, testFunction, options }: any) {
    // Note: This endpoint would need special handling for function execution
    return { message: 'Performance test endpoint - use SDK for function execution' };
  }

  @Get('performance/baselines')
  @ApiOperation({ summary: 'Get performance baselines' })
  async getPerformanceBaselines() {
    return await this.performanceRunner.getActiveBaselines();
  }

  @Post('performance/baselines')
  @ApiOperation({ summary: 'Create performance baseline' })
  async createPerformanceBaseline(@Body() baselineData: any) {
    return await this.performanceRunner.createBaseline(
      baselineData.name,
      baselineData.version,
      baselineData.testSuite,
      baselineData.testName,
      baselineData.result,
      baselineData.thresholds
    );
  }

  // Assertions (for reporting/validation)
  @Get('assertions/results')
  @ApiOperation({ summary: 'Get assertion results' })
  async getAssertionResults() {
    return this.assertions.getAssertionResults();
  }

  @Get('assertions/summary')
  @ApiOperation({ summary: 'Get assertion summary' })
  async getAssertionSummary() {
    return this.assertions.getAssertionSummary();
  }

  @Delete('assertions/results')
  @ApiOperation({ summary: 'Clear assertion results' })
  async clearAssertionResults() {
    this.assertions.clearAssertionResults();
    return { message: 'Assertion results cleared' };
  }

  // Reporting
  @Post('reports/generate')
  @ApiOperation({ summary: 'Generate test report' })
  async generateReport(@Body() config: any) {
    return await this.reportGenerator.generateReport(config);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get recent reports' })
  async getReports(
    @Query('testSuite') testSuite?: string,
    @Query('limit') limit?: number
  ) {
    return await this.reportGenerator.getRecentReports(testSuite, limit);
  }

  @Post('reports/compare')
  @ApiOperation({ summary: 'Compare two reports' })
  async compareReports(@Body() { reportId1, reportId2 }: any) {
    return await this.reportGenerator.compareReports(reportId1, reportId2);
  }

  @Delete('reports/cleanup')
  @ApiOperation({ summary: 'Delete old reports' })
  async cleanupOldReports(@Query('days') days: number = 30) {
    const deleted = await this.reportGenerator.deleteOldReports(days);
    return { message: `Deleted ${deleted} old reports` };
  }

  // Health Check
  @Get('health')
  @ApiOperation({ summary: 'Database testing framework health check' })
  async healthCheck() {
    const [envHealth, transactionCount, fixtureCount] = await Promise.all([
      this.environmentManager.healthCheck(),
      this.transactionManager.getActiveTransactions(),
      this.fixtureManager.getAllFixtures(),
    ]);

    return {
      status: envHealth.healthy ? 'healthy' : 'warning',
      timestamp: new Date().toISOString(),
      environment: envHealth,
      activeTransactions: transactionCount.length,
      availableFixtures: fixtureCount.length,
      version: '1.0.0',
    };
  }
}