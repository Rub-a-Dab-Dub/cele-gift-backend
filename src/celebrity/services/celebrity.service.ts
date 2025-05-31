import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In } from 'typeorm';
import {
  Celebrity,
  VerificationStatus,
  CelebrityCategory,
} from '../entities/celebrity.entity';
import { CelebrityVersionHistory } from '../entities/celebrity-version-history.entity';
import { CelebrityAnalytics } from '../entities/celebrity-analytics.entity';
import { CelebritySearchDto } from '../dto/celebrity-search.dto';
import { CreateCelebrityDto } from '../dto/create-celebrity.dto';
import { UpdateCelebrityDto } from '../dto/update-celebrity.dto';
import { SearchService } from './ search.service';
import { CacheService } from './cache.service';

@Injectable()
export class CelebrityService {
  constructor(
    @InjectRepository(Celebrity)
    private celebrityRepository: Repository<Celebrity>,
    @InjectRepository(CelebrityVersionHistory)
    private versionHistoryRepository: Repository<CelebrityVersionHistory>,
    @InjectRepository(CelebrityAnalytics)
    private analyticsRepository: Repository<CelebrityAnalytics>,
    private cacheService: CacheService,
    private searchService: SearchService,
  ) {}

  async create(
    createCelebrityDto: CreateCelebrityDto,
    createdBy: string,
  ): Promise<Celebrity> {
    // Check if username already exists
    const existingCelebrity = await this.celebrityRepository.findOne({
      where: { username: createCelebrityDto.username },
    });

    if (existingCelebrity) {
      throw new ConflictException('Username already exists');
    }

    // Create search vector for full-text search
    const searchVector = this.createSearchVector(createCelebrityDto);

    const celebrity = this.celebrityRepository.create({
      ...createCelebrityDto,
      searchVector,
    });

    const savedCelebrity = await this.celebrityRepository.save(celebrity);

    // Index for search
    await this.searchService.indexCelebrity(savedCelebrity);

    // Clear relevant caches
    await this.cacheService.del('celebrities:*');

    return savedCelebrity;
  }

  async findAll(
    searchDto: CelebritySearchDto,
  ): Promise<{ celebrities: Celebrity[]; total: number }> {
    const cacheKey = `celebrities:search:${JSON.stringify(searchDto)}`;
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      return cached;
    }

    const queryBuilder = this.buildSearchQuery(searchDto);

    const [celebrities, total] = await queryBuilder.getManyAndCount();

    // Cache results for 5 minutes
    const result = { celebrities, total };
    await this.cacheService.set(cacheKey, result, 300);

    return result;
  }

  async findOne(id: string): Promise<Celebrity> {
    const cacheKey = `celebrity:${id}`;
    let celebrity = await this.cacheService.get(cacheKey);

    if (!celebrity) {
      celebrity = await this.celebrityRepository.findOne({
        where: { id },
        relations: ['content', 'analytics'],
      });

      if (!celebrity) {
        throw new NotFoundException('Celebrity not found');
      }

      await this.cacheService.set(cacheKey, celebrity, 600); // Cache for 10 minutes
    }

    // Track profile view
    await this.trackAnalytics(id, 'profile_view');

    return celebrity;
  }

  async update(
    id: string,
    updateCelebrityDto: UpdateCelebrityDto,
    updatedBy: string,
  ): Promise<Celebrity> {
    const celebrity = await this.findOne(id);
    const previousData = { ...celebrity };

    // Check username uniqueness if username is being updated
    if (
      updateCelebrityDto.username &&
      updateCelebrityDto.username !== celebrity.username
    ) {
      const existingCelebrity = await this.celebrityRepository.findOne({
        where: { username: updateCelebrityDto.username },
      });

      if (existingCelebrity) {
        throw new ConflictException('Username already exists');
      }
    }

    // Create version history entry
    const changedFields = Object.keys(updateCelebrityDto);
    await this.versionHistoryRepository.save({
      celebrityId: id,
      previousData,
      changedFields,
      changedBy: updatedBy,
    });

    // Update search vector if relevant fields changed
    if (
      changedFields.some((field) =>
        ['displayName', 'bio', 'category'].includes(field),
      )
    ) {
      updateCelebrityDto.searchVector = this.createSearchVector({
        ...celebrity,
        ...updateCelebrityDto,
      });
    }

    Object.assign(celebrity, updateCelebrityDto);
    const updatedCelebrity = await this.celebrityRepository.save(celebrity);

    // Update search index
    await this.searchService.indexCelebrity(updatedCelebrity);

    // Clear caches
    await this.cacheService.del(`celebrity:${id}`);
    await this.cacheService.del('celebrities:*');

    return updatedCelebrity;
  }

  async verify(
    id: string,
    status: VerificationStatus,
    notes?: string,
    verifiedBy?: string,
  ): Promise<Celebrity> {
    const celebrity = await this.findOne(id);

    celebrity.verificationStatus = status;
    celebrity.verificationNotes = notes;

    const updatedCelebrity = await this.celebrityRepository.save(celebrity);

    // Log verification change
    await this.versionHistoryRepository.save({
      celebrityId: id,
      previousData: { verificationStatus: celebrity.verificationStatus },
      changedFields: ['verificationStatus'],
      changedBy: verifiedBy,
      changeReason: `Verification status changed to ${status}`,
    });

    // Clear caches
    await this.cacheService.del(`celebrity:${id}`);
    await this.cacheService.del('celebrities:*');

    return updatedCelebrity;
  }

  async getTopCelebrities(
    category?: CelebrityCategory,
    limit: number = 10,
  ): Promise<Celebrity[]> {
    const cacheKey = `celebrities:top:${category || 'all'}:${limit}`;
    let celebrities = await this.cacheService.get(cacheKey);

    if (!celebrities) {
      const queryBuilder = this.celebrityRepository
        .createQueryBuilder('celebrity')
        .where('celebrity.isActive = :isActive', { isActive: true })
        .andWhere('celebrity.verificationStatus = :status', {
          status: VerificationStatus.VERIFIED,
        })
        .orderBy('celebrity.followerCount', 'DESC')
        .limit(limit);

      if (category) {
        queryBuilder.andWhere('celebrity.category = :category', { category });
      }

      celebrities = await queryBuilder.getMany();
      await this.cacheService.set(cacheKey, celebrities, 1800); // Cache for 30 minutes
    }

    return celebrities;
  }

  private buildSearchQuery(
    searchDto: CelebritySearchDto,
  ): SelectQueryBuilder<Celebrity> {
    const queryBuilder =
      this.celebrityRepository.createQueryBuilder('celebrity');

    // Text search
    if (searchDto.query) {
      queryBuilder.andWhere(
        '(celebrity.searchVector ILIKE :query OR celebrity.username ILIKE :query)',
        { query: `%${searchDto.query}%` },
      );
    }

    // Filters
    if (searchDto.category) {
      queryBuilder.andWhere('celebrity.category = :category', {
        category: searchDto.category,
      });
    }

    if (searchDto.verificationStatus) {
      queryBuilder.andWhere('celebrity.verificationStatus = :status', {
        status: searchDto.verificationStatus,
      });
    }

    if (searchDto.minFollowers !== undefined) {
      queryBuilder.andWhere('celebrity.followerCount >= :minFollowers', {
        minFollowers: searchDto.minFollowers,
      });
    }

    if (searchDto.maxFollowers !== undefined) {
      queryBuilder.andWhere('celebrity.followerCount <= :maxFollowers', {
        maxFollowers: searchDto.maxFollowers,
      });
    }

    // Always filter active celebrities
    queryBuilder.andWhere('celebrity.isActive = :isActive', { isActive: true });

    // Sorting
    switch (searchDto.sortBy) {
      case 'followers':
        queryBuilder.orderBy(
          'celebrity.followerCount',
          searchDto.sortOrder === 'asc' ? 'ASC' : 'DESC',
        );
        break;
      case 'engagement':
        queryBuilder.orderBy(
          'celebrity.engagementRate',
          searchDto.sortOrder === 'asc' ? 'ASC' : 'DESC',
        );
        break;
      case 'recent':
        queryBuilder.orderBy(
          'celebrity.createdAt',
          searchDto.sortOrder === 'asc' ? 'ASC' : 'DESC',
        );
        break;
      default: // relevance
        if (searchDto.query) {
          // Use text search relevance scoring
          queryBuilder.orderBy('celebrity.followerCount', 'DESC');
        } else {
          queryBuilder.orderBy('celebrity.followerCount', 'DESC');
        }
        break;
    }

    // Pagination
    queryBuilder.skip(searchDto.offset).take(searchDto.limit);

    return queryBuilder;
  }

  private createSearchVector(data: any): string {
    return [data.displayName, data.username, data.bio, data.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private async trackAnalytics(
    celebrityId: string,
    eventType: string,
  ): Promise<void> {
    // Implement async analytics tracking
    // This could be queued for batch processing
    setImmediate(async () => {
      const today = new Date().toISOString().split('T')[0];

      try {
        await this.analyticsRepository
          .createQueryBuilder()
          .insert()
          .values({
            celebrityId,
            date: new Date(today),
            profileViews: () => 'profile_views + 1',
          })
          .orUpdate(['profile_views'], ['celebrity_id', 'date'])
          .execute();
      } catch (error) {
        console.error('Analytics tracking error:', error);
      }
    });
  }
}
