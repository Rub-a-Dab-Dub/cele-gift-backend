import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';

// Services
import { QueryMonitorService } from './services/query-monitor.service';
import { QueryAnalyzerService } from './services/query-analyzer.service';
import { QueryCacheService } from './services/cache.service';
import { PerformanceRegressionService } from './services/performance-regression.service';
import { PerformanceReportService } from './services/performance-report.service';

// Controllers
import { PerformanceDashboardController } from './controllers/performance-dashboard.controller';

// Interceptors
import { PerformanceInterceptor } from './interceptors/performance.interceptor';

// Guards
import { PerformanceThresholdGuard } from './guards/performance-threshold.guard';

// Middleware
import { QueryLoggerMiddleware } from './middleware/query-logger.middleware';

// Health
import { PerformanceHealthIndicator } from './health/performance.health';

// Schedulers
import { PerformanceCleanupScheduler } from './schedulers/performance-cleanup.scheduler';

// Pipes
import { QueryValidationPipe } from './pipes/query-validation.pipe';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TerminusModule,
  ],
  providers: [
    // Services
    QueryMonitorService,
    QueryAnalyzerService,
    QueryCacheService,
    PerformanceRegressionService,
    PerformanceReportService,
    
    // Health
    PerformanceHealthIndicator,
    
    // Schedulers
    PerformanceCleanupScheduler,
    
    // Pipes
    QueryValidationPipe,
    
    // Global interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    
    // Global guard
    {
      provide: APP_GUARD,
      useClass: PerformanceThresholdGuard,
    },
  ],
  controllers: [PerformanceDashboardController],
  exports: [
    QueryMonitorService,
    QueryAnalyzerService,
    QueryCacheService,
    PerformanceRegressionService,
    PerformanceReportService,
    PerformanceHealthIndicator,
    QueryValidationPipe,
  ],
})
export class OptimizationModule {}

// 📁 examples/
// examples/usage-examples.ts

// Example 1: Using the MonitorPerformance decorator
import { Injectable } from '@nestjs/common';
import { MonitorPerformance, Cache } from '../decorators/monitor-performance.decorator';

@Injectable()
export class UserService {
  
  @MonitorPerformance({ 
    name: 'getUserById', 
    threshold: 500,
    includeParams: true 
  })
  @Cache(300, ['user']) // Cache for 5 minutes with 'user' tag
  async getUserById(id: string) {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 100));
    return { id, name: 'John Doe', email: 'john@example.com' };
  }

  @MonitorPerformance({ threshold: 1000 })
  async getUsers() {
    // Simulate slow query
    await new Promise(resolve => setTimeout(resolve, 800));
    return [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Smith' },
    ];
  }
}


@Injectable()
export class UserRepository {
  private WrappedRepository: any;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private queryMonitor: QueryMonitorService,
    private regressionService: PerformanceRegressionService,
  ) {
    // Wrap the repository with performance monitoring
    this.WrappedRepository = withPerformanceMonitoring(
      Repository,
      this.queryMonitor,
      this.regressionService,
    );
  }

  async findUserById(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findUsersByRole(role: string): Promise<User[]> {
    return this.userRepository.find({ where: { role } });
  }
}

// Example 3: Health check usage
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PerformanceHealthIndicator } from '../health/performance.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private performanceHealthIndicator: PerformanceHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.performanceHealthIndicator.isHealthy('performance'),
    ]);
  }
}

@Injectable()
export class UserManagementService {
  constructor(private cacheService: QueryCacheService) {}

  async updateUser(id: string, data: any) {
    // Update user in database
    // ...

    // Invalidate related cache entries
    await this.cacheService.invalidateByTags(['user', `user:${id}`]);
    
    return { success: true };
  }

  async deleteUser(id: string) {
    // Delete user from database
    // ...

    // Clear all user-related cache
    await this.cacheService.invalidateByTag('user');
    
    return { success: true };
  }
}
