import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Services
import { RelationshipCacheService } from './services/relationship-cache.service';
import { RelationshipLoaderService } from './services/relationship-loader.service';
import { RelationshipMetadataService } from './services/relationship-metadata.service';
import { RelationshipValidatorService } from './services/relationship-validator.service';
import { CascadeManagerService } from './services/cascade-manager.service';

// Testing
import { PerformanceTestingService } from './testing/performance-testing.service';

// Configuration
import relationshipManagementConfig from './config/relationship-management.config';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(relationshipManagementConfig),
    TypeOrmModule,
  ],
  providers: [
    RelationshipCacheService,
    RelationshipMetadataService,
    RelationshipLoaderService,
    RelationshipValidatorService,
    CascadeManagerService,
    PerformanceTestingService,
    {
      provide: 'RELATIONSHIP_MANAGEMENT_CONFIG',
      useFactory: (configService: any) => {
        return configService.get('relationshipManagement');
      },
      inject: ['ConfigService'],
    },
  ],
  exports: [
    RelationshipCacheService,
    RelationshipLoaderService,
    RelationshipMetadataService,
    RelationshipValidatorService,
    CascadeManagerService,
    PerformanceTestingService,
  ],
})
export class RelationshipManagementModule {
  static forRoot(config?: any) {
    return {
      module: RelationshipManagementModule,
      providers: [
        {
          provide: 'RELATIONSHIP_MANAGEMENT_OPTIONS',
          useValue: config || {},
        },
      ],
    };
  }

  static forFeature(entities: any[]) {
    return {
      module: RelationshipManagementModule,
      imports: [TypeOrmModule.forFeature(entities)],
    };
  }
} 