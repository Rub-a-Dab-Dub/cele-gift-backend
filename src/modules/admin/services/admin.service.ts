import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminEntity, AdminStatus } from '../entities/admin.entity';
import { AdminRole } from '../entities/admin-role.entity';
import { AdminPermission } from '../entities/admin-permission.entity';
import { AdminAuditLog, AuditAction, AuditLevel } from '../entities/admin-audit-log.entity';
import { CreateAdminDto, UpdateAdminDto, AdminLoginDto } from '../dto/admin.dto';
import { AdminAuditService } from '../audit/services/admin-audit.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminEntity)
    private adminRepository: Repository<AdminEntity>,
    @InjectRepository(AdminRole)
    private roleRepository: Repository<AdminRole>,
    @InjectRepository(AdminPermission)
    private permissionRepository: Repository<AdminPermission>,
    private auditService: AdminAuditService,
  ) {}

  async createAdmin(createAdminDto: CreateAdminDto, createdBy?: string): Promise<AdminEntity> {
    const existingAdmin = await this.adminRepository.findOne({
      where: { email: createAdminDto.email },
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createAdminDto.password, 12);

    const newAdmin = this.adminRepository.create({
      ...createAdminDto,
      password: hashedPassword,
      createdBy,
    });

    const savedAdmin = await this.adminRepository.save(newAdmin);

    // Assign default roles if specified
    if (createAdminDto.roleIds && createAdminDto.roleIds.length > 0) {
      await this.assignRoles(savedAdmin.id, createAdminDto.roleIds, createdBy);
    }

    // Log admin creation
    await this.auditService.logAction({
      adminId: createdBy,
      action: AuditAction.CREATE,
      resource: 'admin',
      resourceId: savedAdmin.id,
      description: `Created new admin: ${savedAdmin.email}`,
      level: AuditLevel.HIGH,
      newValues: { email: savedAdmin.email, status: savedAdmin.status },
    });

    return this.getAdminById(savedAdmin.id);
  }

  async updateAdmin(id: string, updateAdminDto: UpdateAdminDto, updatedBy?: string): Promise<AdminEntity> {
    const admin = await this.getAdminById(id);
    const oldValues = { ...admin };

    if (updateAdminDto.password) {
      updateAdminDto.password = await bcrypt.hash(updateAdminDto.password, 12);
    }

    Object.assign(admin, updateAdminDto, { updatedBy });
    const updatedAdmin = await this.adminRepository.save(admin);

    // Log admin update
    await this.auditService.logAction({
      adminId: updatedBy,
      action: AuditAction.UPDATE,
      resource: 'admin',
      resourceId: admin.id,
      description: `Updated admin: ${admin.email}`,
      level: AuditLevel.MEDIUM,
      oldValues: { status: oldValues.status, email: oldValues.email },
      newValues: { status: updatedAdmin.status, email: updatedAdmin.email },
    });

    return this.getAdminById(updatedAdmin.id);
  }

  async getAdminById(id: string): Promise<AdminEntity> {
    const admin = await this.adminRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions', 'directPermissions'],
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async getAdminByEmail(email: string): Promise<AdminEntity> {
    const admin = await this.adminRepository.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions', 'directPermissions'],
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async getAllAdmins(page = 1, limit = 10): Promise<{ admins: AdminEntity[]; total: number }> {
    const [admins, total] = await this.adminRepository.findAndCount({
      relations: ['roles'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { admins, total };
  }

  async validateAdmin(email: string, password: string, ipAddress?: string): Promise<AdminEntity> {
    const admin = await this.adminRepository.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions', 'directPermissions'],
    });

    if (!admin) {
      await this.auditService.logAction({
        action: AuditAction.FAILED_LOGIN,
        resource: 'admin',
        description: `Failed login attempt for non-existent admin: ${email}`,
        level: AuditLevel.HIGH,
        ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      await this.auditService.logAction({
        adminId: admin.id,
        action: AuditAction.FAILED_LOGIN,
        resource: 'admin',
        resourceId: admin.id,
        description: 'Login attempt on locked account',
        level: AuditLevel.CRITICAL,
        ipAddress,
      });
      throw new UnauthorizedException('Account is locked');
    }

    // Check if account is active
    if (admin.status !== AdminStatus.ACTIVE) {
      await this.auditService.logAction({
        adminId: admin.id,
        action: AuditAction.FAILED_LOGIN,
        resource: 'admin',
        resourceId: admin.id,
        description: `Login attempt on ${admin.status} account`,
        level: AuditLevel.HIGH,
        ipAddress,
      });
      throw new UnauthorizedException('Account is not active');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      await this.handleFailedLogin(admin, ipAddress);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login attempts and update last login
    await this.adminRepository.update(admin.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    });

    await this.auditService.logAction({
      adminId: admin.id,
      action: AuditAction.LOGIN,
      resource: 'admin',
      resourceId: admin.id,
      description: 'Successful admin login',
      level: AuditLevel.LOW,
      ipAddress,
    });

    return admin;
  }

  private async handleFailedLogin(admin: AdminEntity, ipAddress?: string): Promise<void> {
    const failedAttempts = admin.failedLoginAttempts + 1;
    const updateData: Partial<AdminEntity> = {
      failedLoginAttempts: failedAttempts,
    };

    // Lock account after 5 failed attempts for 30 minutes
    if (failedAttempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }

    await this.adminRepository.update(admin.id, updateData);

    await this.auditService.logAction({
      adminId: admin.id,
      action: AuditAction.FAILED_LOGIN,
      resource: 'admin',
      resourceId: admin.id,
      description: `Failed login attempt (${failedAttempts}/5)`,
      level: failedAttempts >= 5 ? AuditLevel.CRITICAL : AuditLevel.HIGH,
      ipAddress,
    });
  }

  async assignRoles(adminId: string, roleIds: string[], assignedBy?: string): Promise<void> {
    const admin = await this.getAdminById(adminId);
    const roles = await this.roleRepository.findBy({ id: In(roleIds) });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('Some roles not found');
    }

    admin.roles = roles;
    await this.adminRepository.save(admin);

    await this.auditService.logAction({
      adminId: assignedBy,
      action: AuditAction.ROLE_ASSIGN,
      resource: 'admin',
      resourceId: adminId,
      description: `Assigned roles to admin: ${admin.email}`,
      level: AuditLevel.HIGH,
      newValues: { roleIds },
    });
  }

  async revokeRoles(adminId: string, roleIds: string[], revokedBy?: string): Promise<void> {
    const admin = await this.getAdminById(adminId);
    admin.roles = admin.roles.filter(role => !roleIds.includes(role.id));
    await this.adminRepository.save(admin);

    await this.auditService.logAction({
      adminId: revokedBy,
      action: AuditAction.ROLE_UNASSIGN,
      resource: 'admin',
      resourceId: adminId,
      description: `Revoked roles from admin: ${admin.email}`,
      level: AuditLevel.HIGH,
      oldValues: { roleIds },
    });
  }

  async hasPermission(adminId: string, permission: string): Promise<boolean> {
    const admin = await this.getAdminById(adminId);

    if (admin.isSuperAdmin) {
      return true;
    }

    // Check direct permissions
    const hasDirectPermission = admin.directPermissions.some(p => p.name === permission);
    if (hasDirectPermission) {
      return true;
    }

    // Check role permissions
    const hasRolePermission = admin.roles.some(role =>
      role.permissions.some(p => p.name === permission)
    );

    return hasRolePermission;
  }

  async getAdminPermissions(adminId: string): Promise<string[]> {
    const admin = await this.getAdminById(adminId);

    if (admin.isSuperAdmin) {
      const allPermissions = await this.permissionRepository.find();
      return allPermissions.map(p => p.name);
    }

    const permissions = new Set<string>();

    // Add direct permissions
    admin.directPermissions.forEach(p => permissions.add(p.name));

    // Add role permissions
    admin.roles.forEach(role => {
      role.permissions.forEach(p => permissions.add(p.name));
    });

    return Array.from(permissions);
  }

  async suspendAdmin(adminId: string, suspendedBy?: string): Promise<void> {
    const admin = await this.getAdminById(adminId);
    admin.status = AdminStatus.SUSPENDED;
    await this.adminRepository.save(admin);

    await this.auditService.logAction({
      adminId: suspendedBy,
      action: AuditAction.UPDATE,
      resource: 'admin',
      resourceId: adminId,
      description: `Suspended admin: ${admin.email}`,
      level: AuditLevel.CRITICAL,
      newValues: { status: AdminStatus.SUSPENDED },
    });
  }

  async activateAdmin(adminId: string, activatedBy?: string): Promise<void> {
    const admin = await this.getAdminById(adminId);
    admin.status = AdminStatus.ACTIVE;
    await this.adminRepository.save(admin);

    await this.auditService.logAction({
      adminId: activatedBy,
      action: AuditAction.UPDATE,
      resource: 'admin',
      resourceId: adminId,
      description: `Activated admin: ${admin.email}`,
      level: AuditLevel.HIGH,
      newValues: { status: AdminStatus.ACTIVE },
    });
  }

  async deleteAdmin(adminId: string, deletedBy?: string): Promise<void> {
    const admin = await this.getAdminById(adminId);

    if (admin.isSuperAdmin) {
      throw new BadRequestException('Cannot delete super admin');
    }

    await this.auditService.logAction({
      adminId: deletedBy,
      action: AuditAction.DELETE,
      resource: 'admin',
      resourceId: adminId,
      description: `Deleted admin: ${admin.email}`,
      level: AuditLevel.CRITICAL,
      oldValues: { email: admin.email, status: admin.status },
    });

    await this.adminRepository.remove(admin);
  }
} 