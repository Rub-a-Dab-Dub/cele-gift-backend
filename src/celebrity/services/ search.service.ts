import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Celebrity, VerificationStatus } from '../entities/celebrity.entity';
import { CacheService } from './cache.service';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Celebrity)
    private celebrityRepository: Repository<Celebrity>,
    private cacheService: CacheService,
  ) {}

  async indexCelebrity(celebrity: Celebrity): Promise<void> {
    // Update search vector
    const searchVector = [
      celebrity.displayName,
      celebrity.username,
      celebrity.bio,
      celebrity.category,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    await this.celebrityRepository.update(celebrity.id, { searchVector });
  }

  async searchCelebrities(
    query: string,
    options: any = {},
  ): Promise<Celebrity[]> {
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    let results = await this.cacheService.get(cacheKey);

    if (!results) {
      const queryBuilder = this.celebrityRepository
        .createQueryBuilder('celebrity')
        .where('celebrity.isActive = :isActive', { isActive: true });

      // Full-text search with relevance scoring
      if (query) {
        queryBuilder
          .andWhere(
            `(
            celebrity.searchVector ILIKE :query OR
            celebrity.username ILIKE :exactQuery OR
            celebrity.displayName ILIKE :query
          )`,
            {
              query: `%${query}%`,
              exactQuery: query,
            },
          )
          .addSelect(
            `(
            CASE
              WHEN celebrity.username ILIKE :exactQuery THEN 100
              WHEN celebrity.displayName ILIKE :exactQuery THEN 90
              WHEN celebrity.username ILIKE :query THEN 80
              WHEN celebrity.displayName ILIKE :query THEN 70
              WHEN celebrity.bio ILIKE :query THEN 50
              ELSE 10
            END
          ) as relevance_score`,
          )
          .orderBy('relevance_score', 'DESC')
          .addOrderBy('celebrity.followerCount', 'DESC');
      } else {
        queryBuilder.orderBy('celebrity.followerCount', 'DESC');
      }

      // Apply filters
      if (options.category) {
        queryBuilder.andWhere('celebrity.category = :category', {
          category: options.category,
        });
      }

      if (options.verified) {
        queryBuilder.andWhere('celebrity.verificationStatus = :status', {
          status: VerificationStatus.VERIFIED,
        });
      }

      results = await queryBuilder
        .limit(options.limit || 20)
        .offset(options.offset || 0)
        .getMany();

      await this.cacheService.set(cacheKey, results, 300);
    }

    return results;
  }

  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    const cacheKey = `suggestions:${query}:${limit}`;
    let suggestions = await this.cacheService.get(cacheKey);

    if (!suggestions) {
      const results = await this.celebrityRepository
        .createQueryBuilder('celebrity')
        .select(['celebrity.displayName', 'celebrity.username'])
        .where('celebrity.isActive = :isActive', { isActive: true })
        .andWhere(
          `(
          celebrity.displayName ILIKE :query OR
          celebrity.username ILIKE :query
        )`,
          { query: `${query}%` },
        )
        .orderBy('celebrity.followerCount', 'DESC')
        .limit(limit)
        .getMany();

      suggestions = [
        ...new Set([
          ...results.map((r) => r.displayName),
          ...results.map((r) => r.username),
        ]),
      ].slice(0, limit);

      await this.cacheService.set(cacheKey, suggestions, 600);
    }

    return suggestions;
  }
}
