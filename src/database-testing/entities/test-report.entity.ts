import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum ReportType {
  SUITE = 'suite',
  PERFORMANCE = 'performance',
  COVERAGE = 'coverage',
  REGRESSION = 'regression',
}

@Entity('test_reports')
@Index(['reportType', 'testSuite'])
@Index(['createdAt'])
export class TestReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ReportType,
    name: 'report_type',
  })
  reportType: ReportType;

  @Column({ name: 'test_suite' })
  testSuite: string;

  @Column({ name: 'report_name' })
  reportName: string;

  @Column('json', { name: 'summary_data' })
  summaryData: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };

  @Column('json', { name: 'detailed_results' })
  detailedResults: any[];

  @Column('json', { name: 'coverage_data', nullable: true })
  coverageData: {
    tables: string[];
    operations: string[];
    coverage: number;
    uncoveredAreas: string[];
  };

  @Column('json', { name: 'performance_data', nullable: true })
  performanceData: {
    baseline: string;
    improvements: number;
    regressions: number;
    trends: any[];
  };

  @Column('json', { name: 'visual_data', nullable: true })
  visualData: {
    charts: any[];
    graphs: any[];
    heatmaps: any[];
  };

  @Column({ name: 'report_path', nullable: true })
  reportPath: string;

  @Column({ name: 'html_report_path', nullable: true })
  htmlReportPath: string;

  @Column({ name: 'json_report_path', nullable: true })
  jsonReportPath: string;

  @Column('json', { name: 'metadata' })
  metadata: {
    environment: string;
    databaseVersion: string;
    nodeVersion: string;
    timestamp: string;
    executionId: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}