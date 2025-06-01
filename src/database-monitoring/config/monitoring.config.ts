export interface DatabaseMonitoringConfig {
    metrics: {
      collectionInterval: number;
      retentionDays: number;
      aggregationIntervals: string[];
    };
    alerts: {
      emailConfig: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
      slackConfig: {
        webhookUrl: string;
        channel: string;
      };
      thresholds: {
        connectionUtilization: number;
        storageUtilization: number;
        slowQueryThreshold: number;
        errorRateThreshold: number;
      };
    };
    backup: {
      schedule: string;
      retentionDays: number;
      destination: string;
      compression: boolean;
      encryption: boolean;
    };
    maintenance: {
      vacuumSchedule: string;
      analyzeSchedule: string;
      indexRebuildSchedule: string;
      cleanupSchedule: string;
    };
    capacity: {
      forecastDays: number;
      warningThreshold: number;
      criticalThreshold: number;
    };
  }
  
  export const defaultMonitoringConfig: DatabaseMonitoringConfig = {
    metrics: {
      collectionInterval: 60000, // 1 minute
      retentionDays: 90,
      aggregationIntervals: ['1m', '5m', '1h', '1d'],
    },
    alerts: {
      emailConfig: {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      },
      slackConfig: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channel: process.env.SLACK_CHANNEL || '#alerts',
      },
      thresholds: {
        connectionUtilization: 80,
        storageUtilization: 85,
        slowQueryThreshold: 1000,
        errorRateThreshold: 10,
      },
    },
    backup: {
      schedule: '0 2 * * *', // Daily at 2 AM
      retentionDays: 30,
      destination: '/backups',
      compression: true,
      encryption: false,
    },
    maintenance: {
      vacuumSchedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
      analyzeSchedule: '0 4 * * *', // Daily at 4 AM
      indexRebuildSchedule: '0 5 * * 0', // Weekly on Sunday at 5 AM
      cleanupSchedule: '0 6 * * *', // Daily at 6 AM
    },
    capacity: {
      forecastDays: 30,
      warningThreshold: 80,
      criticalThreshold: 95,
    },
  };
  