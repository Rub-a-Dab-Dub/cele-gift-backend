import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestReport, ReportType } from '../entities/test-report.entity';
import { TestExecution } from '../entities/test-execution.entity';
import { PerformanceResult } from './performance-test-runner.service';
import { AssertionResult } from './database-assertions.service';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ReportConfig {
  type: ReportType;
  testSuite: string;
  includeVisuals?: boolean;
  includeDetails?: boolean;
  format?: 'html' | 'json' | 'markdown';
  outputDir?: string;
}

export interface TestSuiteReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    successRate: number;
  };
  tests: TestExecutionSummary[];
  performance?: PerformanceReport;
  coverage?: CoverageReport;
  trends?: TrendReport;
}

export interface TestExecutionSummary {
  testName: string;
  status: string;
  duration: number;
  assertions: any;
  fixtures: string[];
  error?: string;
}

export interface PerformanceReport {
  baseline: string;
  improvements: number;
  regressions: number;
  slowestTests: { name: string; duration: number }[];
  memoryUsage: { test: string; peak: number }[];
  trends: any[];
}

export interface CoverageReport {
  tables: string[];
  operations: string[];
  coverage: number;
  uncoveredAreas: string[];
  heatmap: { table: string; operations: number; coverage: number }[];
}

export interface TrendReport {
  timeRange: { from: Date; to: Date };
  metrics: {
    successRate: { current: number; previous: number; trend: string };
    avgDuration: { current: number; previous: number; trend: string };
    testCount: { current: number; previous: number; trend: string };
  };
  charts: any[];
}

@Injectable()
export class TestReportGenerator {
  private readonly logger = new Logger(TestReportGenerator.name);

  constructor(
    @InjectRepository(TestReport)
    private reportRepository: Repository<TestReport>,
    @InjectRepository(TestExecution)
    private executionRepository: Repository<TestExecution>,
  ) {}

  async generateReport(config: ReportConfig): Promise<TestReport> {
    this.logger.log(`Generating ${config.type} report for test suite: ${config.testSuite}`);

    const reportData = await this.collectReportData(config);
    const visualData = config.includeVisuals ? await this.generateVisuals(reportData) : null;

    const report = this.reportRepository.create({
      reportType: config.type,
      testSuite: config.testSuite,
      reportName: `${config.testSuite}_${config.type}_${new Date().toISOString()}`,
      summaryData: reportData.summary,
      detailedResults: config.includeDetails ? reportData.tests : [],
      coverageData: reportData.coverage,
      performanceData: reportData.performance,
      visualData: visualData,
      metadata: {
        environment: process.env.NODE_ENV || 'test',
        databaseVersion: await this.getDatabaseVersion(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
        executionId: `exec_${Date.now()}`,
      },
    });

    const savedReport = await this.reportRepository.save(report);

    // Generate output files if requested
    if (config.format && config.outputDir) {
      await this.generateOutputFiles(savedReport, config);
    }

    return savedReport;
  }

  private async collectReportData(config: ReportConfig): Promise<TestSuiteReport> {
    const executions = await this.executionRepository.find({
      where: { testSuite: config.testSuite },
      order: { createdAt: 'DESC' },
      take: 1000, // Limit for performance
    });

    const summary = this.calculateSummary(executions);
    const tests = executions.map(exec => this.mapExecutionToSummary(exec));
    
    let performance: PerformanceReport | undefined;
    let coverage: CoverageReport | undefined;
    let trends: TrendReport | undefined;

    if (config.type === ReportType.PERFORMANCE || config.type === ReportType.SUITE) {
      performance = await this.generatePerformanceReport(executions);
    }

    if (config.type === ReportType.COVERAGE || config.type === ReportType.SUITE) {
      coverage = await this.generateCoverageReport(executions);
    }

    if (config.type === ReportType.REGRESSION || config.type === ReportType.SUITE) {
      trends = await this.generateTrendReport(config.testSuite);
    }

    return {
      summary,
      tests,
      performance,
      coverage,
      trends,
    };
  }

  private calculateSummary(executions: TestExecution[]): TestSuiteReport['summary'] {
    const total = executions.length;
    const passed = executions.filter(e => e.status === 'passed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const skipped = executions.filter(e => e.status === 'skipped').length;
    const duration = executions.reduce((sum, e) => sum + (e.duration || 0), 0);

    return {
      total,
      passed,
      failed,
      skipped,
      duration,
      successRate: total > 0 ? (passed / total) * 100 : 0,
    };
  }

  private mapExecutionToSummary(execution: TestExecution): TestExecutionSummary {
    return {
      testName: execution.testName,
      status: execution.status,
      duration: execution.duration || 0,
      assertions: execution.assertions || { total: 0, passed: 0, failed: 0 },
      fixtures: execution.fixtures || [],
      error: execution.error,
    };
  }

  private async generatePerformanceReport(executions: TestExecution[]): Promise<PerformanceReport> {
    const performanceExecutions = executions.filter(e => e.performanceMetrics);
    
    const slowestTests = performanceExecutions
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10)
      .map(e => ({ name: e.testName, duration: e.duration || 0 }));

    const memoryUsage = performanceExecutions
      .filter(e => e.performanceMetrics?.memory)
      .sort((a, b) => (b.performanceMetrics.memory.peak || 0) - (a.performanceMetrics.memory.peak || 0))
      .slice(0, 10)
      .map(e => ({ test: e.testName, peak: e.performanceMetrics.memory.peak || 0 }));

    return {
      baseline: 'latest',
      improvements: 0, // Would be calculated from baseline comparison
      regressions: 0,   // Would be calculated from baseline comparison
      slowestTests,
      memoryUsage,
      trends: [], // Would include performance trends over time
    };
  }

  private async generateCoverageReport(executions: TestExecution[]): Promise<CoverageReport> {
    // Analyze which tables and operations were covered
    const tables = new Set<string>();
    const operations = new Set<string>();
    
    // This would be enhanced to actually analyze the test coverage
    // For now, providing a basic structure
    
    return {
      tables: Array.from(tables),
      operations: Array.from(operations),
      coverage: 0, // Would be calculated based on actual coverage
      uncoveredAreas: [],
      heatmap: [],
    };
  }

  private async generateTrendReport(testSuite: string): Promise<TrendReport> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const currentExecutions = await this.executionRepository.find({
      where: { testSuite, createdAt: { $gte: thirtyDaysAgo } as any },
      order: { createdAt: 'DESC' },
    });

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const previousExecutions = await this.executionRepository.find({
      where: { 
        testSuite, 
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } as any 
      },
      order: { createdAt: 'DESC' },
    });

    const currentSummary = this.calculateSummary(currentExecutions);
    const previousSummary = this.calculateSummary(previousExecutions);

    return {
      timeRange: { from: thirtyDaysAgo, to: new Date() },
      metrics: {
        successRate: {
          current: currentSummary.successRate,
          previous: previousSummary.successRate,
          trend: this.calculateTrend(currentSummary.successRate, previousSummary.successRate),
        },
        avgDuration: {
          current: currentSummary.duration / (currentSummary.total || 1),
          previous: previousSummary.duration / (previousSummary.total || 1),
          trend: this.calculateTrend(
            currentSummary.duration / (currentSummary.total || 1),
            previousSummary.duration / (previousSummary.total || 1)
          ),
        },
        testCount: {
          current: currentSummary.total,
          previous: previousSummary.total,
          trend: this.calculateTrend(currentSummary.total, previousSummary.total),
        },
      },
      charts: [], // Would include actual chart data
    };
  }

  private calculateTrend(current: number, previous: number): string {
    if (previous === 0) return 'stable';
    const change = ((current - previous) / previous) * 100;
    
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  private async generateVisuals(reportData: TestSuiteReport): Promise<any> {
    return {
      charts: [
        {
          type: 'pie',
          title: 'Test Results Distribution',
          data: {
            labels: ['Passed', 'Failed', 'Skipped'],
            values: [
              reportData.summary.passed,
              reportData.summary.failed,
              reportData.summary.skipped,
            ],
          },
        },
        {
          type: 'bar',
          title: 'Test Duration Distribution',
          data: {
            labels: reportData.tests.map(t => t.testName),
            values: reportData.tests.map(t => t.duration),
          },
        },
      ],
      graphs: [],
      heatmaps: [],
    };
  }

  private async generateOutputFiles(report: TestReport, config: ReportConfig): Promise<void> {
    const outputDir = config.outputDir || './test-reports';
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `${config.testSuite}_${config.type}_${timestamp}`;

    switch (config.format) {
      case 'html':
        await this.generateHtmlReport(report, path.join(outputDir, `${baseFilename}.html`));
        break;
      case 'json':
        await this.generateJsonReport(report, path.join(outputDir, `${baseFilename}.json`));
        break;
      case 'markdown':
        await this.generateMarkdownReport(report, path.join(outputDir, `${baseFilename}.md`));
        break;
    }

    // Update report with file paths
    await this.reportRepository.update(report.id, {
      reportPath: outputDir,
      htmlReportPath: config.format === 'html' ? `${baseFilename}.html` : undefined,
      jsonReportPath: config.format === 'json' ? `${baseFilename}.json` : undefined,
    });
  }

  private async generateHtmlReport(report: TestReport, filePath: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Test Report - ${report.testSuite}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px; text-align: center; }
        .passed { border-left: 5px solid #28a745; }
        .failed { border-left: 5px solid #dc3545; }
        .skipped { border-left: 5px solid #ffc107; }
        .test-results { margin: 20px 0; }
        .test-item { padding: 10px; border-bottom: 1px solid #eee; }
        .test-item.passed { background: #f8f9fa; }
        .test-item.failed { background: #fff5f5; }
        .charts { margin: 20px 0; }
        .chart { margin: 10px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Database Test Report</h1>
        <p><strong>Test Suite:</strong> ${report.testSuite}</p>
        <p><strong>Generated:</strong> ${report.createdAt}</p>
        <p><strong>Environment:</strong> ${report.metadata.environment}</p>
    </div>

    <div class="summary">
        <div class="metric passed">
            <h3>${report.summaryData.passed}</h3>
            <p>Passed</p>
        </div>
        <div class="metric failed">
            <h3>${report.summaryData.failed}</h3>
            <p>Failed</p>
        </div>
        <div class="metric skipped">
            <h3>${report.summaryData.skipped}</h3>
            <p>Skipped</p>
        </div>
        <div class="metric">
            <h3>${report.summaryData.successRate.toFixed(1)}%</h3>
            <p>Success Rate</p>
        </div>
        <div class="metric">
            <h3>${(report.summaryData.duration / 1000).toFixed(2)}s</h3>
            <p>Duration</p>
        </div>
    </div>

    <div class="test-results">
        <h2>Test Results</h2>
        ${report.detailedResults.map(test => `
            <div class="test-item ${test.status}">
                <h4>${test.testName}</h4>
                <p><strong>Status:</strong> ${test.status}</p>
                <p><strong>Duration:</strong> ${test.duration}ms</p>
                ${test.error ? `<p><strong>Error:</strong> ${test.error}</p>` : ''}
            </div>
        `).join('')}
    </div>

    ${report.performanceData ? `
    <div class="performance">
        <h2>Performance Analysis</h2>
        <div class="charts">
            <div class="chart">
                <h3>Slowest Tests</h3>
                ${report.performanceData.slowestTests.map(test => `
                    <p>${test.name}: ${test.duration}ms</p>
                `).join('')}
            </div>
        </div>
    </div>
    ` : ''}

    ${report.coverageData ? `
    <div class="coverage">
        <h2>Coverage Report</h2>
        <p><strong>Overall Coverage:</strong> ${report.coverageData.coverage}%</p>
        <p><strong>Tables Covered:</strong> ${report.coverageData.tables.length}</p>
        <p><strong>Operations Covered:</strong> ${report.coverageData.operations.length}</p>
    </div>
    ` : ''}
</body>
</html>
    `;

    await fs.writeFile(filePath, html, 'utf8');
    this.logger.log(`HTML report generated: ${filePath}`);
  }

  private async generateJsonReport(report: TestReport, filePath: string): Promise<void> {
    const jsonReport = {
      testSuite: report.testSuite,
      reportType: report.reportType,
      timestamp: report.createdAt,
      summary: report.summaryData,
      tests: report.detailedResults,
      performance: report.performanceData,
      coverage: report.coverageData,
      metadata: report.metadata,
      visuals: report.visualData,
    };

    await fs.writeFile(filePath, JSON.stringify(jsonReport, null, 2), 'utf8');
    this.logger.log(`JSON report generated: ${filePath}`);
  }

  private async generateMarkdownReport(report: TestReport, filePath: string): Promise<void> {
    const markdown = `# Database Test Report - ${report.testSuite}

## Summary

- **Test Suite:** ${report.testSuite}
- **Generated:** ${report.createdAt}
- **Environment:** ${report.metadata.environment}
- **Database Version:** ${report.metadata.databaseVersion}

## Results Overview

| Metric | Value |
|--------|-------|
| Total Tests | ${report.summaryData.total} |
| Passed | ${report.summaryData.passed} |
| Failed | ${report.summaryData.failed} |
| Skipped | ${report.summaryData.skipped} |
| Success Rate | ${report.summaryData.successRate.toFixed(1)}% |
| Total Duration | ${(report.summaryData.duration / 1000).toFixed(2)}s |

## Test Results

${report.detailedResults.map(test => `
### ${test.testName}

- **Status:** ${test.status}
- **Duration:** ${test.duration}ms
- **Assertions:** ${test.assertions.passed}/${test.assertions.total} passed
${test.fixtures?.length ? `- **Fixtures:** ${test.fixtures.join(', ')}` : ''}
${test.error ? `- **Error:** \`${test.error}\`` : ''}
`).join('')}

${report.performanceData ? `
## Performance Analysis

### Slowest Tests
${report.performanceData.slowestTests.map(test => `- ${test.name}: ${test.duration}ms`).join('\n')}

### Memory Usage
${report.performanceData.memoryUsage.map(test => `- ${test.test}: ${(test.peak / 1024 / 1024).toFixed(2)}MB`).join('\n')}
` : ''}

${report.coverageData ? `
## Coverage Report

- **Overall Coverage:** ${report.coverageData.coverage}%
- **Tables Covered:** ${report.coverageData.tables.length}
- **Operations Covered:** ${report.coverageData.operations.length}

${report.coverageData.uncoveredAreas.length ? `
### Uncovered Areas
${report.coverageData.uncoveredAreas.map(area => `- ${area}`).join('\n')}
` : ''}
` : ''}

---
*Report generated by Database Testing Framework*
`;

    await fs.writeFile(filePath, markdown, 'utf8');
    this.logger.log(`Markdown report generated: ${filePath}`);
  }

  private async getDatabaseVersion(): Promise<string> {
    try {
      // This would be injected from the DataSource
      return 'PostgreSQL 14.0'; // Placeholder
    } catch (error) {
      return 'unknown';
    }
  }

  // Additional utility methods
  async getRecentReports(testSuite?: string, limit: number = 10): Promise<TestReport[]> {
    const whereCondition = testSuite ? { testSuite } : {};
    
    return await this.reportRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async compareReports(reportId1: string, reportId2: string): Promise<any> {
    const [report1, report2] = await Promise.all([
      this.reportRepository.findOne({ where: { id: reportId1 } }),
      this.reportRepository.findOne({ where: { id: reportId2 } }),
    ]);

    if (!report1 || !report2) {
      throw new Error('One or both reports not found');
    }

    return {
      summary: {
        successRate: {
          report1: report1.summaryData.successRate,
          report2: report2.summaryData.successRate,
          difference: report1.summaryData.successRate - report2.summaryData.successRate,
        },
        duration: {
          report1: report1.summaryData.duration,
          report2: report2.summaryData.duration,
          difference: report1.summaryData.duration - report2.summaryData.duration,
        },
        testCount: {
          report1: report1.summaryData.total,
          report2: report2.summaryData.total,
          difference: report1.summaryData.total - report2.summaryData.total,
        },
      },
      trends: this.calculateReportTrends(report1, report2),
    };
  }

  private calculateReportTrends(report1: TestReport, report2: TestReport): any {
    // Calculate trends between two reports
    return {
      performance: 'stable', // Would implement actual trend calculation
      reliability: 'improving',
      coverage: 'stable',
    };
  }

  async deleteOldReports(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await this.reportRepository.delete({
      createdAt: { $lt: cutoffDate } as any,
    });

    this.logger.log(`Deleted ${result.affected || 0} old reports`);
    return result.affected || 0;
  }
}