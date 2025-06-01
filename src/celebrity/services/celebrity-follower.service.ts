import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CelebrityFollower } from '../entities/celebrity-follower.entity';
import { Celebrity } from '../entities/celebrity.entity';
import { CacheService } from './cache.service';

@Injectable()
export class CelebrityFollowerService {
  constructor(
    @InjectRepository(CelebrityFollower)
    private followerRepository: Repository<CelebrityFollower>,
    @InjectRepository(Celebrity)
    private celebrityRepository: Repository<Celebrity>,
    private cacheService: CacheService,
  ) {}

  async follow(celebrityId: string, followerId: string): Promise<void> {
    // Check if already following
    const existingFollow = await this.followerRepository.findOne({
      where: { celebrityId, followerId },
    });

    if (existingFollow) {
      if (existingFollow.isActive) {
        throw new ConflictException('Already following this celebrity');
      } else {
        // Reactivate follow
        existingFollow.isActive = true;
        await this.followerRepository.save(existingFollow);
      }
    } else {
      // Create new follow relationship
      await this.followerRepository.save({
        celebrityId,
        followerId,
        isActive: true,
      });
    }

    // Update follower counts
    await this.updateFollowerCounts(celebrityId, followerId);

    // Clear caches
    await this.clearFollowerCaches(celebrityId, followerId);
  }

  async unfollow(celebrityId: string, followerId: string): Promise<void> {
    const followRelation = await this.followerRepository.findOne({
      where: { celebrityId, followerId, isActive: true },
    });

    if (!followRelation) {
      throw new NotFoundException('Follow relationship not found');
    }

    followRelation.isActive = false;
    await this.followerRepository.save(followRelation);

    // Update follower counts
    await this.updateFollowerCounts(celebrityId, followerId);

    // Clear caches
    await this.clearFollowerCaches(celebrityId, followerId);
  }

  async getFollowers(
    celebrityId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ followers: Celebrity[]; total: number }> {
    const cacheKey = `celebrity:${celebrityId}:followers:${limit}:${offset}`;
    let result = await this.cacheService.get(cacheKey);

    if (!result) {
      const queryBuilder = this.celebrityRepository
        .createQueryBuilder('celebrity')
        .innerJoin('celebrity_followers', 'cf', 'cf.follower_id = celebrity.id')
        .where('cf.celebrity_id = :celebrityId', { celebrityId })
        .andWhere('cf.is_active = :isActive', { isActive: true })
        .orderBy('cf.created_at', 'DESC')
        .skip(offset)
        .take(limit);

      const [followers, total] = await queryBuilder.getManyAndCount();
      result = { followers, total };

      await this.cacheService.set(cacheKey, result, 300); // Cache for 5 minutes
    }

    return result;
  }

  async getFollowing(
    followerId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ following: Celebrity[]; total: number }> {
    const cacheKey = `user:${followerId}:following:${limit}:${offset}`;
    let result = await this.cacheService.get(cacheKey);

    if (!result) {
      const queryBuilder = this.celebrityRepository
        .createQueryBuilder('celebrity')
        .innerJoin(
          'celebrity_followers',
          'cf',
          'cf.celebrity_id = celebrity.id',
        )
        .where('cf.follower_id = :followerId', { followerId })
        .andWhere('cf.is_active = :isActive', { isActive: true })
        .orderBy('cf.created_at', 'DESC')
        .skip(offset)
        .take(limit);

      const [following, total] = await queryBuilder.getManyAndCount();
      result = { following, total };

      await this.cacheService.set(cacheKey, result, 300);
    }

    return result;
  }

  async getMutualFollowings(
    userId1: string,
    userId2: string,
  ): Promise<Celebrity[]> {
    const cacheKey = `mutual:${userId1}:${userId2}`;
    let mutuals = await this.cacheService.get(cacheKey);

    if (!mutuals) {
      mutuals = await this.celebrityRepository
        .createQueryBuilder('celebrity')
        .innerJoin(
          'celebrity_followers',
          'cf1',
          'cf1.celebrity_id = celebrity.id',
        )
        .innerJoin(
          'celebrity_followers',
          'cf2',
          'cf2.celebrity_id = celebrity.id',
        )
        .where('cf1.follower_id = :userId1', { userId1 })
        .andWhere('cf2.follower_id = :userId2', { userId2 })
        .andWhere('cf1.is_active = :isActive', { isActive: true })
        .andWhere('cf2.is_active = :isActive', { isActive: true })
        .getMany();

      await this.cacheService.set(cacheKey, mutuals, 600);
    }

    return mutuals;
  }

  private async updateFollowerCounts(
    celebrityId: string,
    followerId: string,
  ): Promise<void> {
    // Update celebrity follower count
    const celebrityFollowerCount = await this.followerRepository.count({
      where: { celebrityId, isActive: true },
    });

    await this.celebrityRepository.update(celebrityId, {
      followerCount: celebrityFollowerCount,
    });

    // Update follower's following count
    const followerFollowingCount = await this.followerRepository.count({
      where: { followerId, isActive: true },
    });

    await this.celebrityRepository.update(followerId, {
      followingCount: followerFollowingCount,
    });
  }

  private async clearFollowerCaches(
    celebrityId: string,
    followerId: string,
  ): Promise<void> {
    await Promise.all([
      this.cacheService.del(`celebrity:${celebrityId}`),
      this.cacheService.del(`celebrity:${followerId}`),
      this.cacheService.del(`celebrity:${celebrityId}:followers:*`),
      this.cacheService.del(`user:${followerId}:following:*`),
      this.cacheService.del(`mutual:${celebrityId}:*`),
      this.cacheService.del(`mutual:*:${celebrityId}`),
      this.cacheService.del(`mutual:${followerId}:*`),
      this.cacheService.del(`mutual:*:${followerId}`),
    ]);
  }
}
