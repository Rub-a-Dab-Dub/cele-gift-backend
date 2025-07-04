import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from "@nestjs/common"
import type { UserService, CreateUserDto, UpdateUserDto } from "./user.service"
import type { AuditService } from "../lifecycle/services/audit.service"
import type { VersioningService } from "../lifecycle/services/versioning.service"

@Controller("users")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly auditService: AuditService,
    private readonly versioningService: VersioningService,
  ) {}

  create(createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto, {
      userId: "system", // In real app, get from JWT token
      reason: "User registration via API",
    })
  }

  @Get()
  findAll() {
    return this.userService.findAll()
  }

  @Get("deleted")
  getDeletedUsers() {
    return this.userService.getDeletedUsers()
  }

  @Get("archived")
  getArchivedUsers() {
    return this.userService.getArchivedUsers()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Get(':id/audit-trail')
  getAuditTrail(@Param('id') id: string) {
    return this.auditService.getAuditTrail('User', id);
  }

  @Get(':id/versions')
  getVersionHistory(@Param('id') id: string) {
    return this.versioningService.getVersionHistory('User', id);
  }

  @Get(":id/versions/:version")
  getVersion(@Param('id') id: string, @Param('version') version: number) {
    return this.versioningService.getVersion("User", id, version)
  }

  @Patch(":id")
  update(@Param('id') id: string, updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto, {
      userId: "system",
      reason: "User profile update via API",
    })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(@Param('id') id: string) {
    return this.userService.softDelete(id, {
      userId: 'system',
      reason: 'User deletion via API',
    });
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.userService.restore(id, {
      userId: 'system',
      reason: 'User restoration via API',
    });
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.userService.archive(id, {
      userId: 'system',
      reason: 'User archival via API',
    });
  }

  @Post(":id/lock")
  lock(@Param('id') id: string, @Body('reason') reason: string) {
    return this.userService.lock(id, reason, {
      userId: "system",
    })
  }

  @Post(':id/unlock')
  unlock(@Param('id') id: string) {
    return this.userService.unlock(id, {
      userId: 'system',
    });
  }

  @Post("bulk")
  bulkCreate(users: CreateUserDto[]) {
    return this.userService.bulkCreate(users, {
      userId: "system",
      reason: "Bulk user creation via API",
    })
  }
}
