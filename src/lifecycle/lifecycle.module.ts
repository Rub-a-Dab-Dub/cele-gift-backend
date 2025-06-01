import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';

// Services
import { LifecycleEventService } from './services/lifecycle-event.service';
import { AuditService } from './services/audit.service';
import { VersioningService } from './services/versioning.service';
import { LifecycleManagerService } from './services/lifecycle-manager.service';
import { LifecycleCacheService } from './performance/cache.service';
import { BatchProcessorService } from './performance/batch-processor.service';

// Validators
import { DataConsistencyValidator } from './validators/data-consistency.validator';

// Entities
import { AuditLog } from './entities/audit-log.entity';
import { EntityVersion } from './entities/entity-version.entity';

// Controllers
import { LifecycleController } from './controllers/lifecycle.controller';

// Examples
import { User } from './examples/user.entity';
import { UserService } from './examples/user.service';
import { UserLifecycleSubscriber } from './examples/user-lifecycle.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      EntityVersion,
      User
    ]),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 1000, // maximum number of items in cache
    }),
  ],
  providers: [
    // Core services
    LifecycleEventService,
    AuditService,
    VersioningService,
    LifecycleManagerService,
    
    // Performance services
    LifecycleCacheService,
    BatchProcessorService,
    
    // Validators
    DataConsistencyValidator,
    
    // Example services
    UserService,
    UserLifecycleSubscriber,
  ],
  controllers: [
    LifecycleController,
  ],
  exports: [
    LifecycleEventService,
    AuditService,
    VersioningService,
    LifecycleManagerService,
    DataConsistencyValidator,
    LifecycleCacheService,
    BatchProcessorService,
  ],
})
export class LifecycleModule {}