import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsService } from '../services/analytics.service';

@Injectable()
export class AnalyticsJob {
  private readonly logger = new Logger(AnalyticsJob.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async updateHourlyAggregates() {
    try {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      this.logger.log('Starting hourly analytics update');
      await this.analyticsService.updateDailyAggregates(yesterday);
      await this.analyticsService.updateDailyAggregates(now);
      this.logger.log('Completed hourly analytics update');
    } catch (error) {
      this.logger.error('Failed to update hourly aggregates', error);
    }
  }

  @Cron('0 1 * * *') // Daily at 1 AM
  async updateDailyAggregates() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      this.logger.log('Starting daily analytics update');
      await this.analyticsService.updateDailyAggregates(yesterday);
      this.logger.log('Completed daily analytics update');
    } catch (error) {
      this.logger.error('Failed to update daily aggregates', error);
    }
  }

  @Cron('0 2 * * 0') // Weekly on Sunday at 2 AM
  async updateWeeklyAggregates() {
    try {
      this.logger.log('Starting weekly analytics update');

      // Update aggregates for the past 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        await this.analyticsService.updateDailyAggregates(date);
      }

      this.logger.log('Completed weekly analytics update');
    } catch (error) {
      this.logger.error('Failed to update weekly aggregates', error);
    }
  }
}
