import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Celebrity } from '../../../celebrity/entities/celebrity.entity';
import { 
  SmartLoadingConfig, 
  LoadingStrategy, 
  RelationshipIntegrityConfig,
  CascadeOperation 
} from '../interfaces/relationship-management.interface';
import { RelationshipLoaderService } from '../services/relationship-loader.service';
import { RelationshipValidatorService } from '../services/relationship-validator.service';
import { CascadeManagerService } from '../services/cascade-manager.service';
import { PerformanceTestingService } from '../testing/performance-testing.service';

/**
 * Example service demonstrating how to use the relationship management system
 * with the Celebrity entity and its complex relationships
 */
@Injectable()
export class CelebrityRelationshipExampleService {
  constructor(
    @InjectRepository(Celebrity)
    private celebrityRepository: Repository<Celebrity>,
    private relationshipLoader: RelationshipLoaderService,
    private relationshipValidator: RelationshipValidatorService,
    private cascadeManager: CascadeManagerService,
    private performanceTesting: PerformanceTestingService,
  ) {}

  /**
   * Example 1: Smart Loading with Caching
   * Demonstrates how to load a celebrity with optimized relationship loading
   */
  async loadCelebrityWithSmartLoading(celebrityId: string): Promise<Celebrity> {
    // First, get the celebrity without relationships
    const celebrity = await this.celebrityRepository.findOne({
      where: { id: celebrityId }
    });

    if (!celebrity) {
      throw new Error('Celebrity not found');
    }

    // Configure smart loading with caching
    const smartLoadingConfig: SmartLoadingConfig = {
      strategy: LoadingStrategy.SMART,
      batchSize: 25,
      maxDepth: 2,
      selectFields: ['id', 'displayName', 'bio', 'followerCount'],
      cacheConfig: {
        ttl: 300, // 5 minutes
        maxSize: 1000,
        keyPrefix: 'celebrity:relations',
        compression: true,
        evictionPolicy: 'LRU',
      },
      conditions: {
        isActive: true, // Only load active related entities
      },
    };

    // Load relationships using smart loading
    const celebrityWithRelations = await this.relationshipLoader.loadRelationships(
      celebrity,
      smartLoadingConfig
    );

    return celebrityWithRelations;
  }

  /**
   * Example 2: Batch Loading for Multiple Celebrities
   * Demonstrates efficient loading of relationships for multiple entities
   */
  async loadMultipleCelebritiesWithFollowers(celebrityIds: string[]): Promise<Celebrity[]> {
    // Get celebrities without relationships
    const celebrities = await this.celebrityRepository.findByIds(celebrityIds);

    // Configure batch loading for followers
    const batchLoadingConfig: SmartLoadingConfig = {
      strategy: LoadingStrategy.BATCH,
      batchSize: 50,
      maxDepth: 1,
      cacheConfig: {
        ttl: 600, // 10 minutes for follower data
        maxSize: 500,
        keyPrefix: 'celebrity:followers',
        compression: true,
        evictionPolicy: 'LRU',
      },
    };

    // Batch load followers for all celebrities
    const celebritiesWithFollowers = await this.relationshipLoader.loadBatch(
      celebrities,
      'followers',
      batchLoadingConfig
    );

    return celebritiesWithFollowers;
  }

  /**
   * Example 3: Relationship Validation
   * Demonstrates how to validate celebrity relationships for integrity
   */
  async validateCelebrityRelationships(celebrity: Celebrity): Promise<boolean> {
    // Configure validation rules
    const validationConfig: RelationshipIntegrityConfig = {
      rules: [
        {
          name: 'follower-limit',
          condition: (entity: Celebrity, followers: any[]) => {
            return Array.isArray(followers) ? followers.length <= 10000 : true;
          },
          message: 'Celebrity cannot have more than 10,000 followers',
          severity: 'warning',
        },
        {
          name: 'content-author-match',
          condition: (celebrity: Celebrity, content: any) => {
            return content.celebrityId === celebrity.id;
          },
          message: 'Content must belong to the celebrity',
          severity: 'error',
        },
        {
          name: 'active-celebrity-content',
          condition: (celebrity: Celebrity, content: any[]) => {
            if (!celebrity.isActive) {
              return !Array.isArray(content) || content.length === 0;
            }
            return true;
          },
          message: 'Inactive celebrities should not have active content',
          severity: 'warning',
        },
      ],
      enforceOnInsert: true,
      enforceOnUpdate: true,
      enforceOnDelete: false,
      validateCircularReferences: true,
    };

    // Validate the celebrity and its relationships
    const validationResults = await this.relationshipValidator.validate(
      celebrity,
      validationConfig
    );

    // Check if validation passed
    const hasErrors = validationResults.some(result => 
      !result.isValid && result.errors.some(error => error.severity === 'error')
    );

    if (hasErrors) {
      console.error('Validation errors found:', validationResults);
      return false;
    }

    return true;
  }

  /**
   * Example 4: Cascade Operations
   * Demonstrates how to perform cascade operations on celebrity relationships
   */
  async deleteCelebrityWithCascade(celebrityId: string): Promise<void> {
    const celebrity = await this.celebrityRepository.findOne({
      where: { id: celebrityId },
      relations: ['content', 'analytics', 'versionHistory']
    });

    if (!celebrity) {
      throw new Error('Celebrity not found');
    }

    // Perform cascade delete operation
    await this.cascadeManager.executeCascadeOperation(
      CascadeOperation.SOFT_REMOVE,
      celebrity
    );
  }

  /**
   * Example 5: Performance Testing
   * Demonstrates how to run performance tests on celebrity relationships
   */
  async runCelebrityPerformanceTest(): Promise<void> {
    const testConfig = {
      entityName: 'Celebrity',
      sampleSize: 50,
      iterations: 3,
      loadingStrategies: [
        LoadingStrategy.EAGER,
        LoadingStrategy.LAZY,
        LoadingStrategy.SMART,
        LoadingStrategy.BATCH,
      ],
      maxDepth: 2,
      enableCaching: true,
      warmupRuns: 2,
    };

    // Run performance test
    const report = await this.performanceTesting.runPerformanceTest(testConfig);

    // Generate and log the report
    const reportText = this.performanceTesting.generatePerformanceReport(report);
    console.log('Celebrity Relationship Performance Report:');
    console.log(reportText);

    // Log recommendations
    console.log('\nRecommendations:');
    report.recommendations.forEach(rec => console.log(`- ${rec}`));
  }

  /**
   * Example 6: Handling Circular References
   * Demonstrates how to handle the circular reference between celebrities (followers/following)
   */
  async loadCelebrityWithCircularHandling(celebrityId: string): Promise<Celebrity> {
    const celebrity = await this.celebrityRepository.findOne({
      where: { id: celebrityId }
    });

    if (!celebrity) {
      throw new Error('Celebrity not found');
    }

    // Configure loading with circular reference handling
    const circularSafeConfig: SmartLoadingConfig = {
      strategy: LoadingStrategy.SMART,
      batchSize: 20,
      maxDepth: 2, // Limit depth to prevent infinite recursion
      cacheConfig: {
        ttl: 300,
        maxSize: 500,
        keyPrefix: 'celebrity:circular',
        compression: true,
        evictionPolicy: 'LRU',
      },
    };

    // Load with circular reference context
    const circularContext = {
      maxDepth: 2,
      strategy: 'truncate' as const,
      entityMap: new Map(),
    };

    const celebrityWithRelations = await this.relationshipLoader.loadRelationships(
      celebrity,
      circularSafeConfig,
      circularContext
    );

    return celebrityWithRelations;
  }

  /**
   * Example 7: Custom Loading Strategy Based on Usage Patterns
   * Demonstrates how to choose loading strategy based on specific use cases
   */
  async loadCelebrityForDifferentUseCases(
    celebrityId: string,
    useCase: 'profile-view' | 'admin-panel' | 'analytics' | 'public-api'
  ): Promise<Celebrity> {
    const celebrity = await this.celebrityRepository.findOne({
      where: { id: celebrityId }
    });

    if (!celebrity) {
      throw new Error('Celebrity not found');
    }

    let config: SmartLoadingConfig;

    switch (useCase) {
      case 'profile-view':
        // For profile views, we need basic info and some content
        config = {
          strategy: LoadingStrategy.SMART,
          batchSize: 10,
          maxDepth: 1,
          selectFields: ['id', 'displayName', 'bio', 'profileImageUrl', 'followerCount'],
          cacheConfig: {
            ttl: 600, // Cache longer for profile views
            maxSize: 1000,
            keyPrefix: 'celebrity:profile',
            compression: true,
            evictionPolicy: 'LRU',
          },
        };
        break;

      case 'admin-panel':
        // For admin, we need everything
        config = {
          strategy: LoadingStrategy.EAGER,
          batchSize: 5,
          maxDepth: 3,
          cacheConfig: {
            ttl: 60, // Short cache for admin data
            maxSize: 100,
            keyPrefix: 'celebrity:admin',
            compression: false,
            evictionPolicy: 'TTL',
          },
        };
        break;

      case 'analytics':
        // For analytics, we need specific metrics data
        config = {
          strategy: LoadingStrategy.BATCH,
          batchSize: 100,
          maxDepth: 1,
          selectFields: ['id', 'followerCount', 'engagementRate', 'contentCount'],
          conditions: {
            isActive: true,
          },
        };
        break;

      case 'public-api':
        // For public API, minimal data with aggressive caching
        config = {
          strategy: LoadingStrategy.LAZY,
          batchSize: 50,
          maxDepth: 1,
          selectFields: ['id', 'displayName', 'category', 'verificationStatus'],
          cacheConfig: {
            ttl: 1800, // 30 minutes cache
            maxSize: 2000,
            keyPrefix: 'celebrity:public',
            compression: true,
            evictionPolicy: 'LRU',
          },
        };
        break;

      default:
        throw new Error(`Unknown use case: ${useCase}`);
    }

    return await this.relationshipLoader.loadRelationships(celebrity, config);
  }

  /**
   * Example 8: Monitoring and Metrics
   * Demonstrates how to monitor relationship loading performance
   */
  async monitorRelationshipPerformance(): Promise<void> {
    // This would typically be called periodically or triggered by events
    const celebrities = await this.celebrityRepository.find({ take: 10 });

    for (const celebrity of celebrities) {
      const startTime = Date.now();
      
      try {
        await this.loadCelebrityWithSmartLoading(celebrity.id);
        const executionTime = Date.now() - startTime;
        
        // Log performance metrics
        console.log(`Celebrity ${celebrity.id} loaded in ${executionTime}ms`);
        
        // Alert if performance is poor
        if (executionTime > 1000) {
          console.warn(`Slow relationship loading detected for celebrity ${celebrity.id}: ${executionTime}ms`);
        }
      } catch (error) {
        console.error(`Error loading relationships for celebrity ${celebrity.id}:`, error);
      }
    }
  }
} 