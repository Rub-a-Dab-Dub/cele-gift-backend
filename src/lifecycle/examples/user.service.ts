import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { LifecycleManagerService, LifecycleOptions } from '../services/lifecycle-manager.service';
import { BaseLifecycleRepository } from '../repositories/base-lifecycle.repository';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: BaseLifecycleRepository<User>,
    private lifecycleManager: LifecycleManagerService
  ) {}

  async createUser(userData: Partial<User>, options?: LifecycleOptions): Promise<User> {
    return this.lifecycleManager.create(this.userRepository, userData, options);
  }

  async updateUser(id: string, updateData: Partial<User>, options?: LifecycleOptions): Promise<User> {
    return this.lifecycleManager.update(this.userRepository, id, updateData, options);
  }

  async deleteUser(id: string, options?: LifecycleOptions): Promise<User> {
    return this.lifecycleManager.softDelete(this.userRepository, id, options);
  }

  async restoreUser(id: string, options?: LifecycleOptions): Promise<User> {
    return this.lifecycleManager.restore(this.userRepository, id, options);
  }

  async archiveUser(id: string, options?: LifecycleOptions): Promise<User> {
    return this.lifecycleManager.archive(this.userRepository, id, options);
  }

  async findActiveUsers(): Promise<User[]> {
    return this.userRepository.find({ where: { isActive: true } });
  }

  async findDeletedUsers(): Promise<User[]> {
    return this.userRepository.findDeleted();
  }

  async findArchivedUsers(): Promise<User[]> {
    return this.userRepository.findArchived();
  }

  // Bulk operations
  async bulkCreateUsers(usersData: Partial<User>[], options?: LifecycleOptions): Promise<User[]> {
    return this.lifecycleManager.bulkCreate(this.userRepository, usersData, options);
  }

  async bulkDeleteUsers(ids: string[], options?: LifecycleOptions): Promise<User[]> {
    return this.lifecycleManager.bulkSoftDelete(this.userRepository, ids, options);
  }
}