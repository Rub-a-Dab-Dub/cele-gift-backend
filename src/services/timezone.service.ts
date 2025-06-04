export class TimezoneService {
    private static readonly DEFAULT_TIMEZONE = 'UTC';
  
    static setDatabaseTimezone(dataSource: DataSource, timezone: string = this.DEFAULT_TIMEZONE): Promise<void> {
      return dataSource.query(`SET timezone TO '${timezone}'`);
    }
  
    static async getCurrentTimezone(dataSource: DataSource): Promise<string> {
      const result = await dataSource.query('SHOW timezone');
      return result[0].TimeZone;
    }
  
    static convertToTimezone(date: Date, timezone: string): Date {
      // Use with AT TIME ZONE in queries for proper conversion
      return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    }
  
    static createTimezoneAwareQuery(field: string, timezone: string): string {
      return `${field} AT TIME ZONE '${timezone}'`;
    }
  }
  
  // main integration service
  export class PostgreSQLIntegrationService {
    private dataSource: DataSource;
    private notificationService: PostgreSQLNotificationService;
    private utilitiesService: PostgreSQLUtilitiesService;
    private monitoringService: PostgreSQLMonitoringService;
  
    constructor(private config: PostgreSQLConfig) {}
  
    async initialize(): Promise<void> {
      // Initialize database connection
      this.dataSource = await DatabaseConfig.createConnection(this.config);
      
      // Set timezone
      await TimezoneService.setDatabaseTimezone(this.dataSource, this.config.timezone);
      
      // Initialize services
      this.notificationService = new PostgreSQLNotificationService({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database
      });
      
      this.utilitiesService = new PostgreSQLUtilitiesService(this.dataSource);
      this.monitoringService = new PostgreSQLMonitoringService(this.dataSource);
      
      await this.notificationService.connect();
    }
  
    getDataSource(): DataSource {
      return this.dataSource;
    }
  
    getNotificationService(): PostgreSQLNotificationService {
      return this.notificationService;
    }
  
    getUtilitiesService(): PostgreSQLUtilitiesService {
      return this.utilitiesService;
    }
  
    getMonitoringService(): PostgreSQLMonitoringService {
      return this.monitoringService;
    }
  
    async healthCheck(): Promise<boolean> {
      try {
        await this.dataSource.query('SELECT 1');
        return true;
      } catch (error) {
        console.error('Health check failed:', error);
        return false;
      }
    }
  
    async shutdown(): Promise<void> {
      await this.notificationService.disconnect();
      await this.dataSource.destroy();
    }
  }
  
  // Example usage and setup
  export const setupPostgreSQL = async (config: PostgreSQLConfig) => {
    const integration = new PostgreSQLIntegrationService(config);
    await integration.initialize();
    return integration;
  };
  
  // Export everything
  export * from './types/postgres.types';
  export * from './decorators/postgres-column.decorator';
  export * from './repositories/base-postgres.repository';
  export * from './services/postgres-notification.service';
  export * from './services/postgres-utilities.service';
  export * from './services/postgres-monitoring.service';
  export * from './services/timezone.service';