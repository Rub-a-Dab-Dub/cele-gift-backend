import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { User } from "./entities/user.entity"
import type { LifecycleService, LifecycleContext } from "../lifecycle/services/lifecycle.service"

export interface CreateUserDto {
  email: string
  firstName: string
  lastName: string
  phone?: string
  preferences?: Record<string, any>
}

export interface UpdateUserDto {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  isActive?: boolean
  preferences?: Record<string, any>
}

@Injectable()
export class UserService {
  constructor(
    private userRepository: Repository<User>,
    private lifecycleService: LifecycleService,
  ) {}

  async create(createUserDto: CreateUserDto, context: LifecycleContext = {}): Promise<User> {
    return this.lifecycleService.create(User, createUserDto, {
      ...context,
      reason: "User registration",
      isMajorVersion: true,
    })
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      where: { archivedAt: null },
    })
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, archivedAt: null },
    })
  }

  async update(id: string, updateUserDto: UpdateUserDto, context: LifecycleContext = {}): Promise<User> {
    return this.lifecycleService.update(User, id, updateUserDto, {
      ...context,
      reason: context.reason || "User profile update",
    })
  }

  async softDelete(id: string, context: LifecycleContext = {}): Promise<User> {
    return this.lifecycleService.softDelete(User, id, {
      ...context,
      reason: context.reason || "User account deletion",
    })
  }

  async restore(id: string, context: LifecycleContext = {}): Promise<User> {
    return this.lifecycleService.restore(User, id, {
      ...context,
      reason: context.reason || "User account restoration",
    })
  }

  async archive(id: string, context: LifecycleContext = {}): Promise<User> {
    return this.lifecycleService.archive(User, id, {
      ...context,
      reason: context.reason || "User account archival",
    })
  }

  async lock(id: string, reason: string, context: LifecycleContext = {}): Promise<User> {
    return this.lifecycleService.lock(User, id, reason, context)
  }

  async unlock(id: string, context: LifecycleContext = {}): Promise<User> {
    return this.lifecycleService.unlock(User, id, context)
  }

  async bulkCreate(users: CreateUserDto[], context: LifecycleContext = {}) {
    return this.lifecycleService.bulkCreate(User, users, context)
  }

  async getDeletedUsers(): Promise<User[]> {
    return this.userRepository
      .find({
        where: {},
        withDeleted: true,
      })
      .then((users) => users.filter((user) => user.deletedAt))
  }

  async getArchivedUsers(): Promise<User[]> {
    return this.userRepository
      .find({
        where: { archivedAt: null },
      })
      .then((users) => users.filter((user) => user.archivedAt))
  }
}
