import { Module } from '@nestjs/common';
import { CelebrityService } from './services/celebrity.service';
import { CelebrityController } from './celebrity.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CelebrityAnalyticsController } from './celebrity-analytics.controller';
import { CelebrityAnalytics } from './entities/celebrity-analytics.entity';
import { CelebrityContent } from './entities/celebrity-content.entity';
import { CelebrityFollower } from './entities/celebrity-follower.entity';
import { CelebrityVersionHistory } from './entities/celebrity-version-history.entity';
import { Celebrity } from './entities/celebrity.entity';
import { SearchService } from './services/ search.service';
import { CacheService } from './services/cache.service';
import { CelebrityAnalyticsService } from './services/celebrity-analytics.service';
import { CelebrityFollowerService } from './services/celebrity-follower.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Celebrity,
      CelebrityFollower,
      CelebrityContent,
      CelebrityAnalytics,
      CelebrityVersionHistory,
    ]),
    CacheModule.register({
      ttl: 300, // 5 minutes default
      max: 1000, // maximum number of items in cache
    }),
  ],
  controllers: [CelebrityController, CelebrityAnalyticsController],
  providers: [
    CelebrityService,
    CelebrityFollowerService,
    CelebrityAnalyticsService,
    SearchService,
    CacheService,
  ],
  exports: [
    CelebrityService,
    CelebrityFollowerService,
    CelebrityAnalyticsService,
  ],
})
export class CelebrityModule {}
