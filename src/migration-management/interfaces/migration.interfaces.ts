import { MigrationStatus, MigrationType } from '../entities/migration.entity';

export interface MigrationPlan {
  migrations: PendingMigration[];
  totalSteps: number;
  estimatedTime: number;
  risks: MigrationRisk[];
}

export interface PendingMigration {
  id: string;
  name: string;
  version: string;
  type: MigrationType;
  dependencies: string[];
  estimatedTime: number;
}

export interface MigrationRisk {
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
}

export interface MigrationResult {
  success: boolean;
  executionId: string;
  executionTime: number;
  message?: string;
  rollbackRequired?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  recommendation: string;
}

export interface DashboardStats {
  totalMigrations: number;
  pendingMigrations: number;
  failedMigrations: number;
  environments: EnvironmentStatus[];
  recentActivity: RecentActivity[];
}

export interface EnvironmentStatus {
  environmentId: string;
  environmentName: string;
  currentVersion: string;
  status: 'up-to-date' | 'behind' | 'ahead' | 'unknown';
  lastMigration: Date;
  pendingCount: number;
}

export interface RecentActivity {
  id: string;
  migrationName: string;
  environmentName: string;
  status: MigrationStatus;
  timestamp: Date;
  executedBy: string;
}