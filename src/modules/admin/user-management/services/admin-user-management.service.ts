import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between } from 'typeorm';
import { UserEntity } from '../../../users/entities/user.entity';
import { AdminAuditService, AuditLogData } from '../../audit/services/admin-audit.service';
import { AuditAction, AuditLevel } from '../../entities/admin-audit-log.entity';

export interface UserSearchFilters {
  email?: string;
  name?: string;
  status?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastLoginAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface UserModerationAction {
  userId: string;
  action: 'suspend' | 'activate' | 'ban' | 'warn' | 'delete';
  reason: string;
  duration?: number; // in hours for temporary actions
  notes?: string;
}

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  userGrowthRate: number;
  averageSessionDuration: number;
  topUsersByActivity: Array<{ userId: string; activityScore: number }>;
  usersByRegion: Record<string, number>;
  usersByDevice: Record<string, number>;
}

@Injectable()
export class AdminUserManagementService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private auditService: AdminAuditService,
  ) {}

  async searchUsers(filters: UserSearchFilters): Promise<{
    users: UserEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      email,
      name,
      status,
      createdAfter,
      createdBefore,
      lastLoginAfter,
      lastLoginBefore,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Apply filters
    if (email) {
      queryBuilder.andWhere('user.email ILIKE :email', { email: `%${email}%` });
    }

    if (name) {
      queryBuilder.andWhere('user.name ILIKE :name', { name: `%${name}%` });
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    if (createdAfter && createdBefore) {
      queryBuilder.andWhere('user.createdAt BETWEEN :createdAfter AND :createdBefore', {
        createdAfter,
        createdBefore,
      });
    } else if (createdAfter) {
      queryBuilder.andWhere('user.createdAt >= :createdAfter', { createdAfter });
    } else if (createdBefore) {
      queryBuilder.andWhere('user.createdAt <= :createdBefore', { createdBefore });
    }

    if (lastLoginAfter && lastLoginBefore) {
      queryBuilder.andWhere('user.lastLoginAt BETWEEN :lastLoginAfter AND :lastLoginBefore', {
        lastLoginAfter,
        lastLoginBefore,
      });
    } else if (lastLoginAfter) {
      queryBuilder.andWhere('user.lastLoginAt >= :lastLoginAfter', { lastLoginAfter });
    } else if (lastLoginBefore) {
      queryBuilder.andWhere('user.lastLoginAt <= :lastLoginBefore', { lastLoginBefore });
    }

    // Apply sorting
    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);

    // Apply pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      total,
      page,
      limit,
    };
  }

  async getUserById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getUserByEmail(email: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async moderateUser(
    moderationAction: UserModerationAction,
    moderatorId: string,
    ipAddress?: string,
  ): Promise<void> {
    const user = await this.getUserById(moderationAction.userId);
    const oldStatus = user.status;

    switch (moderationAction.action) {
      case 'suspend':
        await this.suspendUser(user, moderationAction, moderatorId);
        break;
      case 'activate':
        await this.activateUser(user, moderationAction, moderatorId);
        break;
      case 'ban':
        await this.banUser(user, moderationAction, moderatorId);
        break;
      case 'warn':
        await this.warnUser(user, moderationAction, moderatorId);
        break;
      case 'delete':
        await this.deleteUser(user, moderationAction, moderatorId);
        break;
      default:
        throw new BadRequestException('Invalid moderation action');
    }

    // Log the moderation action
    await this.auditService.logAction({
      adminId: moderatorId,
      action: AuditAction.UPDATE,
      resource: 'user',
      resourceId: user.id,
      description: `User moderation: ${moderationAction.action} - ${moderationAction.reason}`,
      level: this.getModerationAuditLevel(moderationAction.action),
      oldValues: { status: oldStatus },
      newValues: { status: user.status, action: moderationAction.action },
      context: {
        reason: moderationAction.reason,
        duration: moderationAction.duration,
        notes: moderationAction.notes,
      },
      ipAddress,
    });
  }

  async getUserAnalytics(days = 30): Promise<UserAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { status: 'active' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newUsersToday = await this.userRepository.count({
      where: {
        createdAt: Between(today, new Date()),
      },
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const newUsersThisWeek = await this.userRepository.count({
      where: {
        createdAt: Between(weekAgo, new Date()),
      },
    });

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const newUsersThisMonth = await this.userRepository.count({
      where: {
        createdAt: Between(monthAgo, new Date()),
      },
    });

    const previousMonth = new Date();
    previousMonth.setDate(previousMonth.getDate() - 60);

    const newUsersPreviousMonth = await this.userRepository.count({
      where: {
        createdAt: Between(previousMonth, monthAgo),
      },
    });

    const userGrowthRate = newUsersPreviousMonth > 0 
      ? ((newUsersThisMonth - newUsersPreviousMonth) / newUsersPreviousMonth) * 100 
      : 0;

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      userGrowthRate,
      averageSessionDuration: await this.getAverageSessionDuration(),
      topUsersByActivity: await this.getTopUsersByActivity(),
      usersByRegion: await this.getUsersByRegion(),
      usersByDevice: await this.getUsersByDevice(),
    };
  }

  async exportUsers(filters: UserSearchFilters): Promise<UserEntity[]> {
    const { users } = await this.searchUsers({ ...filters, limit: 10000 });
    return users;
  }

  async bulkUpdateUsers(
    userIds: string[],
    updates: Partial<UserEntity>,
    updatedBy: string,
  ): Promise<void> {
    const users = await this.userRepository.findByIds(userIds);

    if (users.length !== userIds.length) {
      throw new BadRequestException('Some users not found');
    }

    await this.userRepository.update(userIds, updates);

    // Log bulk update
    await this.auditService.logAction({
      adminId: updatedBy,
      action: AuditAction.BULK_OPERATION,
      resource: 'user',
      description: `Bulk updated ${userIds.length} users`,
      level: AuditLevel.HIGH,
      newValues: updates,
      metadata: { userIds, updateCount: userIds.length },
    });
  }

  async getUserActivitySummary(userId: string, days = 30): Promise<{
    loginCount: number;
    lastLogin: Date;
    activityScore: number;
    sessionsCount: number;
    averageSessionDuration: number;
  }> {
    // Implementation would aggregate user activity data
    return {
      loginCount: 0,
      lastLogin: new Date(),
      activityScore: 0,
      sessionsCount: 0,
      averageSessionDuration: 0,
    };
  }

  // Private helper methods
  private async suspendUser(
    user: UserEntity,
    action: UserModerationAction,
    moderatorId: string,
  ): Promise<void> {
    user.status = 'suspended';
    if (action.duration) {
      // Set suspension end time
      const suspensionEnd = new Date();
      suspensionEnd.setHours(suspensionEnd.getHours() + action.duration);
      // user.suspensionEnd = suspensionEnd;
    }
    await this.userRepository.save(user);
  }

  private async activateUser(
    user: UserEntity,
    action: UserModerationAction,
    moderatorId: string,
  ): Promise<void> {
    user.status = 'active';
    // user.suspensionEnd = null;
    await this.userRepository.save(user);
  }

  private async banUser(
    user: UserEntity,
    action: UserModerationAction,
    moderatorId: string,
  ): Promise<void> {
    user.status = 'banned';
    await this.userRepository.save(user);
  }

  private async warnUser(
    user: UserEntity,
    action: UserModerationAction,
    moderatorId: string,
  ): Promise<void> {
    // Implementation would add warning to user record
    // This might involve a separate warnings table
  }

  private async deleteUser(
    user: UserEntity,
    action: UserModerationAction,
    moderatorId: string,
  ): Promise<void> {
    await this.userRepository.remove(user);
  }

  private getModerationAuditLevel(action: string): AuditLevel {
    switch (action) {
      case 'delete':
      case 'ban':
        return AuditLevel.CRITICAL;
      case 'suspend':
        return AuditLevel.HIGH;
      case 'warn':
        return AuditLevel.MEDIUM;
      case 'activate':
        return AuditLevel.LOW;
      default:
        return AuditLevel.MEDIUM;
    }
  }

  private async getAverageSessionDuration(): Promise<number> {
    // Implementation would calculate average session duration
    return 0;
  }

  private async getTopUsersByActivity(): Promise<Array<{ userId: string; activityScore: number }>> {
    // Implementation would get top users by activity
    return [];
  }

  private async getUsersByRegion(): Promise<Record<string, number>> {
    // Implementation would aggregate users by region
    return {};
  }

  private async getUsersByDevice(): Promise<Record<string, number>> {
    // Implementation would aggregate users by device type
    return {};
  }
} 