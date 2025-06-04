import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AdminRole } from '../../entities/admin-role.entity';
import { AdminPermission, PermissionType, PermissionScope } from '../../entities/admin-permission.entity';

export interface CreateRoleDto {
  name: string;
  description?: string;
  priority?: number;
  permissionIds?: string[];
  restrictions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
  restrictions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CreatePermissionDto {
  name: string;
  description?: string;
  type?: PermissionType;
  scope?: PermissionScope;
  resource?: string;
  action?: string;
  conditions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdatePermissionDto {
  name?: string;
  description?: string;
  type?: PermissionType;
  scope?: PermissionScope;
  resource?: string;
  action?: string;
  conditions?: Record<string, any>;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export class AdminPermissionsService {
  constructor(
    @InjectRepository(AdminRole)
    private roleRepository: Repository<AdminRole>,
    @InjectRepository(AdminPermission)
    private permissionRepository: Repository<AdminPermission>,
  ) {}

  // Role Management
  async createRole(createRoleDto: CreateRoleDto, createdBy?: string): Promise<AdminRole> {
    const existingRole = await this.roleRepository.findOne({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new BadRequestException('Role with this name already exists');
    }

    const newRole = this.roleRepository.create({
      ...createRoleDto,
      createdBy,
    });

    const savedRole = await this.roleRepository.save(newRole);

    // Assign permissions if specified
    if (createRoleDto.permissionIds && createRoleDto.permissionIds.length > 0) {
      await this.assignPermissionsToRole(savedRole.id, createRoleDto.permissionIds);
    }

    return this.getRoleById(savedRole.id);
  }

  async updateRole(id: string, updateRoleDto: UpdateRoleDto, updatedBy?: string): Promise<AdminRole> {
    const role = await this.getRoleById(id);
    
    if (role.isSystemRole && updateRoleDto.name) {
      throw new BadRequestException('Cannot modify system role name');
    }

    Object.assign(role, updateRoleDto, { updatedBy });
    await this.roleRepository.save(role);

    return this.getRoleById(id);
  }

  async getRoleById(id: string): Promise<AdminRole> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async getAllRoles(page = 1, limit = 10): Promise<{ roles: AdminRole[]; total: number }> {
    const [roles, total] = await this.roleRepository.findAndCount({
      relations: ['permissions'],
      skip: (page - 1) * limit,
      take: limit,
      order: { priority: 'DESC', createdAt: 'DESC' },
    });

    return { roles, total };
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.getRoleById(id);

    if (role.isSystemRole) {
      throw new BadRequestException('Cannot delete system role');
    }

    await this.roleRepository.remove(role);
  }

  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    const role = await this.getRoleById(roleId);
    const permissions = await this.permissionRepository.findBy({ id: In(permissionIds) });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('Some permissions not found');
    }

    role.permissions = permissions;
    await this.roleRepository.save(role);
  }

  async revokePermissionsFromRole(roleId: string, permissionIds: string[]): Promise<void> {
    const role = await this.getRoleById(roleId);
    role.permissions = role.permissions.filter(permission => !permissionIds.includes(permission.id));
    await this.roleRepository.save(role);
  }

  // Permission Management
  async createPermission(createPermissionDto: CreatePermissionDto, createdBy?: string): Promise<AdminPermission> {
    const existingPermission = await this.permissionRepository.findOne({
      where: { name: createPermissionDto.name },
    });

    if (existingPermission) {
      throw new BadRequestException('Permission with this name already exists');
    }

    const newPermission = this.permissionRepository.create({
      ...createPermissionDto,
      createdBy,
    });

    return await this.permissionRepository.save(newPermission);
  }

  async updatePermission(id: string, updatePermissionDto: UpdatePermissionDto, updatedBy?: string): Promise<AdminPermission> {
    const permission = await this.getPermissionById(id);

    if (permission.isSystemPermission && updatePermissionDto.name) {
      throw new BadRequestException('Cannot modify system permission name');
    }

    Object.assign(permission, updatePermissionDto, { updatedBy });
    return await this.permissionRepository.save(permission);
  }

  async getPermissionById(id: string): Promise<AdminPermission> {
    const permission = await this.permissionRepository.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  async getAllPermissions(page = 1, limit = 50): Promise<{ permissions: AdminPermission[]; total: number }> {
    const [permissions, total] = await this.permissionRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { type: 'ASC', name: 'ASC' },
    });

    return { permissions, total };
  }

  async getPermissionsByType(type: PermissionType): Promise<AdminPermission[]> {
    return await this.permissionRepository.find({
      where: { type, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getPermissionsByResource(resource: string): Promise<AdminPermission[]> {
    return await this.permissionRepository.find({
      where: { resource, isActive: true },
      order: { action: 'ASC' },
    });
  }

  async deletePermission(id: string): Promise<void> {
    const permission = await this.getPermissionById(id);

    if (permission.isSystemPermission) {
      throw new BadRequestException('Cannot delete system permission');
    }

    await this.permissionRepository.remove(permission);
  }

  // Utility Methods
  async initializeDefaultRolesAndPermissions(): Promise<void> {
    // Create default permissions
    const defaultPermissions = [
      // Admin management
      { name: 'admin:create', description: 'Create new admins', resource: 'admin', action: 'create' },
      { name: 'admin:read', description: 'View admin details', resource: 'admin', action: 'read' },
      { name: 'admin:update', description: 'Update admin details', resource: 'admin', action: 'update' },
      { name: 'admin:delete', description: 'Delete admins', resource: 'admin', action: 'delete' },
      { name: 'admin:suspend', description: 'Suspend admin accounts', resource: 'admin', action: 'suspend' },
      { name: 'admin:activate', description: 'Activate admin accounts', resource: 'admin', action: 'activate' },
      { name: 'admin:manage-roles', description: 'Manage admin roles', resource: 'admin', action: 'manage-roles' },
      
      // User management
      { name: 'user:create', description: 'Create new users', resource: 'user', action: 'create' },
      { name: 'user:read', description: 'View user details', resource: 'user', action: 'read' },
      { name: 'user:update', description: 'Update user details', resource: 'user', action: 'update' },
      { name: 'user:delete', description: 'Delete users', resource: 'user', action: 'delete' },
      { name: 'user:suspend', description: 'Suspend user accounts', resource: 'user', action: 'suspend' },
      
      // System management
      { name: 'system:config', description: 'Manage system configuration', resource: 'system', action: 'config' },
      { name: 'audit:read', description: 'View audit logs', resource: 'audit', action: 'read' },
      { name: 'security:read', description: 'View security alerts', resource: 'security', action: 'read' },
      { name: 'dashboard:read', description: 'View dashboard metrics', resource: 'dashboard', action: 'read' },
      { name: 'reports:read', description: 'View reports', resource: 'reports', action: 'read' },
      { name: 'reports:export', description: 'Export reports', resource: 'reports', action: 'export' },
    ];

    for (const permData of defaultPermissions) {
      const existing = await this.permissionRepository.findOne({
        where: { name: permData.name },
      });

      if (!existing) {
        await this.permissionRepository.save(
          this.permissionRepository.create({
            ...permData,
            type: PermissionType.ACTION,
            scope: PermissionScope.GLOBAL,
            isSystemPermission: true,
          })
        );
      }
    }

    // Create default roles
    const defaultRoles = [
      {
        name: 'Super Admin',
        description: 'Full system access',
        priority: 100,
        isSystemRole: true,
        permissions: defaultPermissions.map(p => p.name),
      },
      {
        name: 'Admin',
        description: 'Standard admin access',
        priority: 80,
        isSystemRole: true,
        permissions: [
          'admin:read', 'user:create', 'user:read', 'user:update', 'user:suspend',
          'audit:read', 'dashboard:read', 'reports:read'
        ],
      },
      {
        name: 'Moderator',
        description: 'Content moderation access',
        priority: 60,
        isSystemRole: true,
        permissions: [
          'user:read', 'user:suspend', 'audit:read', 'dashboard:read'
        ],
      },
      {
        name: 'Support',
        description: 'Customer support access',
        priority: 40,
        isSystemRole: true,
        permissions: [
          'user:read', 'dashboard:read', 'reports:read'
        ],
      },
    ];

    for (const roleData of defaultRoles) {
      const existing = await this.roleRepository.findOne({
        where: { name: roleData.name },
      });

      if (!existing) {
        const permissions = await this.permissionRepository.find({
          where: { name: In(roleData.permissions) },
        });

        const role = this.roleRepository.create({
          name: roleData.name,
          description: roleData.description,
          priority: roleData.priority,
          isSystemRole: roleData.isSystemRole,
          permissions,
        });

        await this.roleRepository.save(role);
      }
    }
  }
} 