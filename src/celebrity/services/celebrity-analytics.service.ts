import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CelebrityAnalytics } from '../entities/celebrity-analytics.entity';
import { Celebrity } from '../entities/celebrity.entity';
import { CacheService } from './cache.service';

@Injectable()
export class CelebrityAnalyticsService {
  constructor(
    @InjectRepository(CelebrityAnalytics)
    private analyticsRepository: Repository<CelebrityAnalytics>,
    @InjectRepository(Celebrity)
    private celebrityRepository: Repository<Celebrity>,
    private cacheService: CacheService,
  ) {}

  async getAnalytics(
    celebrityId: string,
    startDate?: string,
    endDate?: string,
    granularity: 'day' | 'week' | 'month' = 'day',
  ): Promise<any> {
    const cacheKey = `analytics:${celebrityId}:${startDate}:${endDate}:${granularity}`;
    let analytics = await this.cacheService.get(cacheKey);

    if (!analytics) {
      const queryBuilder = this.analyticsRepository
        .createQueryBuilder('analytics')
        .where('analytics.celebrityId = :celebrityId', { celebrityId });

      if (startDate) {
        queryBuilder.andWhere('analytics.date >= :startDate', { startDate });
      }

      if (endDate) {
        queryBuilder.andWhere('analytics.date <= :endDate', { endDate });
      }

      queryBuilder.orderBy('analytics.date', 'ASC');

      const rawAnalytics = await queryBuilder.getMany();

      // Group by granularity
      analytics = this.groupAnalyticsByGranularity(rawAnalytics, granularity);

      await this.cacheService.set(cacheKey, analytics, 1800); // Cache for 30 minutes
    }

    return analytics;
  }

  async getSummary(celebrityId: string): Promise<any> {
    const cacheKey = `analytics:summary:${celebrityId}`;
    let summary = await this.cacheService.get(cacheKey);

    if (!summary) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const analytics = await this.analyticsRepository
        .createQueryBuilder('analytics')
        .where('analytics.celebrityId = :celebrityId', { celebrityId })
        .andWhere('analytics.date >= :startDate', { startDate: thirtyDaysAgo })
        .getMany();

      const celebrity = await this.celebrityRepository.findOne({
        where: { id: celebrityId },
      });

      summary = {
        totalFollowers: celebrity.followerCount,
        totalProfileViews: analytics.reduce(
          (sum, a) => sum + a.profileViews,
          0,
        ),
        totalNewFollowers: analytics.reduce(
          (sum, a) => sum + a.newFollowers,
          0,
        ),
        totalUnfollowers: analytics.reduce((sum, a) => sum + a.unfollowers, 0),
        averageEngagementScore:
          analytics.length > 0
            ? analytics.reduce((sum, a) => sum + Number(a.engagementScore), 0) /
              analytics.length
            : 0,
        growthRate: this.calculateGrowthRate(analytics),
        topPerformingDays: this.getTopPerformingDays(analytics),
      };

      await this.cacheService.set(cacheKey, summary, 3600); // Cache for 1 hour
    }

    return summary;
  }

  async getEngagementMetrics(
    celebrityId: string,
    period: string = '30d',
  ): Promise<any> {
    const cacheKey = `engagement:${celebrityId}:${period}`;
    let metrics = await this.cacheService.get(cacheKey);

    if (!metrics) {
      const startDate = this.getStartDateForPeriod(period);

      const analytics = await this.analyticsRepository
        .createQueryBuilder('analytics')
        .where('analytics.celebrityId = :celebrityId', { celebrityId })
        .andWhere('analytics.date >= :startDate', { startDate })
        .orderBy('analytics.date', 'ASC')
        .getMany();

      metrics = {
        engagementTrend: analytics.map((a) => ({
          date: a.date,
          score: Number(a.engagementScore),
          views: a.profileViews,
          interactions: a.contentLikes + a.contentShares,
        })),
        averageEngagement:
          analytics.length > 0
            ? analytics.reduce((sum, a) => sum + Number(a.engagementScore), 0) /
              analytics.length
            : 0,
        peakEngagement: Math.max(
          ...analytics.map((a) => Number(a.engagementScore)),
        ),
        engagementRate: this.calculateEngagementRate(analytics),
      };

      await this.cacheService.set(cacheKey, metrics, 1800);
    }

    return metrics;
  }

  async trackEvent(
    celebrityId: string,
    eventType: string,
    metadata?: any,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    try {
      // Use upsert to handle concurrent updates
      await this.analyticsRepository
        .createQueryBuilder()
        .insert()
        .into(CelebrityAnalytics)
        .values({
          celebrityId,
          date: new Date(today),
          profileViews: eventType === 'profile_view' ? 1 : 0,
          newFollowers: eventType === 'new_follower' ? 1 : 0,
          unfollowers: eventType === 'unfollow' ? 1 : 0,
          contentViews: eventType === 'content_view' ? 1 : 0,
          contentLikes: eventType === 'content_like' ? 1 : 0,
          contentShares: eventType === 'content_share' ? 1 : 0,
        })
        .orUpdate({
          conflict_target: ['celebrity_id', 'date'],
          overwrite: [
            eventType === 'profile_view' ? 'profile_views' : null,
            eventType === 'new_follower' ? 'new_followers' : null,
            eventType === 'unfollow' ? 'unfollowers' : null,
            eventType === 'content_view' ? 'content_views' : null,
            eventType === 'content_like' ? 'content_likes' : null,
            eventType === 'content_share' ? 'content_shares' : null,
          ].filter(Boolean),
        })
        .execute();

      // Clear analytics caches
      await this.cacheService.del(`analytics:*${celebrityId}*`);
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  private groupAnalyticsByGranularity(
    analytics: CelebrityAnalytics[],
    granularity: string,
  ): any[] {
    // Implementation for grouping analytics by day/week/month
    const grouped = new Map();

    analytics.forEach((item) => {
      let key: string;
      const date = new Date(item.date);

      switch (granularity) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default: // day
          key = item.date.toString();
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          profileViews: 0,
          newFollowers: 0,
          unfollowers: 0,
          contentViews: 0,
          contentLikes: 0,
          contentShares: 0,
          engagementScore: 0,
          count: 0,
        });
      }

      const group = grouped.get(key);
      group.profileViews += item.profileViews;
      group.newFollowers += item.newFollowers;
      group.unfollowers += item.unfollowers;
      group.contentViews += item.contentViews;
      group.contentLikes += item.contentLikes;
      group.contentShares += item.contentShares;
      group.engagementScore += Number(item.engagementScore);
      group.count += 1;
    });

    // Calculate average engagement score for each group
    return Array.from(grouped.values()).map((group) => ({
      ...group,
      engagementScore:
        group.count > 0 ? group.engagementScore / group.count : 0,
    }));
  }

  private calculateGrowthRate(analytics: CelebrityAnalytics[]): number {
    if (analytics.length < 2) return 0;

    const firstWeek = analytics.slice(0, 7);
    const lastWeek = analytics.slice(-7);

    const firstWeekFollowers = firstWeek.reduce(
      (sum, a) => sum + a.newFollowers,
      0,
    );
    const lastWeekFollowers = lastWeek.reduce(
      (sum, a) => sum + a.newFollowers,
      0,
    );

    if (firstWeekFollowers === 0) return lastWeekFollowers > 0 ? 100 : 0;

    return (
      ((lastWeekFollowers - firstWeekFollowers) / firstWeekFollowers) * 100
    );
  }

  private getTopPerformingDays(analytics: CelebrityAnalytics[]): any[] {
    return analytics
      .sort((a, b) => Number(b.engagementScore) - Number(a.engagementScore))
      .slice(0, 5)
      .map((a) => ({
        date: a.date,
        engagementScore: Number(a.engagementScore),
        profileViews: a.profileViews,
        interactions: a.contentLikes + a.contentShares,
      }));
  }

  private getStartDateForPeriod(period: string): Date {
    const date = new Date();
    const value = parseInt(period.slice(0, -1));
    const unit = period.slice(-1);

    switch (unit) {
      case 'd':
        date.setDate(date.getDate() - value);
        break;
      case 'w':
        date.setDate(date.getDate() - value * 7);
        break;
      case 'm':
        date.setMonth(date.getMonth() - value);
        break;
      default:
        date.setDate(date.getDate() - 30);
    }

    return date;
  }

  private calculateEngagementRate(analytics: CelebrityAnalytics[]): number {
    if (analytics.length === 0) return 0;

    const totalViews = analytics.reduce(
      (sum, a) => sum + a.profileViews + a.contentViews,
      0,
    );
    const totalInteractions = analytics.reduce(
      (sum, a) => sum + a.contentLikes + a.contentShares,
      0,
    );

    return totalViews > 0 ? (totalInteractions / totalViews) * 100 : 0;
  }
}
