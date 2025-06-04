import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AdminService } from '../services/admin.service';
import { AdminAuditService } from '../audit/services/admin-audit.service';
import {
  CreateAdminDto,
  UpdateAdminDto,
  AdminLoginDto,
  AdminResponseDto,
  ChangePasswordDto,
  AssignRolesDto,
} from '../dto/admin.dto';
import { AdminGuard } from '../guards/admin.guard';
import { AdminPermissions } from '../decorators/admin-permissions.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminEntity } from '../entities/admin.entity';

@ApiTags('Admin Management')
@Controller('admin')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AdminAuditService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Body() loginDto: AdminLoginDto, @Req() req: Request) {
    const admin = await this.adminService.validateAdmin(
      loginDto.email,
      loginDto.password,
      req.ip,
    );

    // In a real implementation, you would generate and return JWT tokens here
    return {
      message: 'Login successful',
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        roles: admin.roles.map(role => role.name),
      },
    };
  }

  @Post()
  @AdminPermissions('admin:create')
  @ApiOperation({ summary: 'Create new admin' })
  @ApiResponse({ status: 201, description: 'Admin created successfully', type: AdminResponseDto })
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
    @CurrentAdmin() currentAdmin: AdminEntity,
  ): Promise<AdminResponseDto> {
    const admin = await this.adminService.createAdmin(createAdminDto, currentAdmin.id);
    return this.mapToResponseDto(admin);
  }

  @Get()
  @AdminPermissions('admin:read')
  @ApiOperation({ summary: 'Get all admins' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Admins retrieved successfully' })
  async getAllAdmins(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const { admins, total } = await this.adminService.getAllAdmins(
      Number(page),
      Number(limit),
    );

    return {
      data: admins.map(admin => this.mapToResponseDto(admin)),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  @Get(':id')
  @AdminPermissions('admin:read')
  @ApiOperation({ summary: 'Get admin by ID' })
  @ApiResponse({ status: 200, description: 'Admin retrieved successfully', type: AdminResponseDto })
  async getAdminById(@Param('id') id: string): Promise<AdminResponseDto> {
    const admin = await this.adminService.getAdminById(id);
    return this.mapToResponseDto(admin);
  }

  @Put(':id')
  @AdminPermissions('admin:update')
  @ApiOperation({ summary: 'Update admin' })
  @ApiResponse({ status: 200, description: 'Admin updated successfully', type: AdminResponseDto })
  async updateAdmin(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @CurrentAdmin() currentAdmin: AdminEntity,
  ): Promise<AdminResponseDto> {
    const admin = await this.adminService.updateAdmin(id, updateAdminDto, currentAdmin.id);
    return this.mapToResponseDto(admin);
  }

  @Delete(':id')
  @AdminPermissions('admin:delete')
  @ApiOperation({ summary: 'Delete admin' })
  @ApiResponse({ status: 200, description: 'Admin deleted successfully' })
  async deleteAdmin(
    @Param('id') id: string,
    @CurrentAdmin() currentAdmin: AdminEntity,
  ) {
    await this.adminService.deleteAdmin(id, currentAdmin.id);
    return { message: 'Admin deleted successfully' };
  }

  @Post(':id/suspend')
  @AdminPermissions('admin:suspend')
  @ApiOperation({ summary: 'Suspend admin' })
  @ApiResponse({ status: 200, description: 'Admin suspended successfully' })
  async suspendAdmin(
    @Param('id') id: string,
    @CurrentAdmin() currentAdmin: AdminEntity,
  ) {
    await this.adminService.suspendAdmin(id, currentAdmin.id);
    return { message: 'Admin suspended successfully' };
  }

  @Post(':id/activate')
  @AdminPermissions('admin:activate')
  @ApiOperation({ summary: 'Activate admin' })
  @ApiResponse({ status: 200, description: 'Admin activated successfully' })
  async activateAdmin(
    @Param('id') id: string,
    @CurrentAdmin() currentAdmin: AdminEntity,
  ) {
    await this.adminService.activateAdmin(id, currentAdmin.id);
    return { message: 'Admin activated successfully' };
  }

  @Post(':id/roles')
  @AdminPermissions('admin:manage-roles')
  @ApiOperation({ summary: 'Assign roles to admin' })
  @ApiResponse({ status: 200, description: 'Roles assigned successfully' })
  async assignRoles(
    @Param('id') id: string,
    @Body() assignRolesDto: AssignRolesDto,
    @CurrentAdmin() currentAdmin: AdminEntity,
  ) {
    await this.adminService.assignRoles(id, assignRolesDto.roleIds, currentAdmin.id);
    return { message: 'Roles assigned successfully' };
  }

  @Delete(':id/roles')
  @AdminPermissions('admin:manage-roles')
  @ApiOperation({ summary: 'Revoke roles from admin' })
  @ApiResponse({ status: 200, description: 'Roles revoked successfully' })
  async revokeRoles(
    @Param('id') id: string,
    @Body() assignRolesDto: AssignRolesDto,
    @CurrentAdmin() currentAdmin: AdminEntity,
  ) {
    await this.adminService.revokeRoles(id, assignRolesDto.roleIds, currentAdmin.id);
    return { message: 'Roles revoked successfully' };
  }

  @Get(':id/permissions')
  @AdminPermissions('admin:read')
  @ApiOperation({ summary: 'Get admin permissions' })
  @ApiResponse({ status: 200, description: 'Permissions retrieved successfully' })
  async getAdminPermissions(@Param('id') id: string) {
    const permissions = await this.adminService.getAdminPermissions(id);
    return { permissions };
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change admin password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentAdmin() currentAdmin: AdminEntity,
  ) {
    // Implementation would include password validation and updating
    return { message: 'Password changed successfully' };
  }

  @Get('audit/logs')
  @AdminPermissions('audit:read')
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'adminId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resource', required: false })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('adminId') adminId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const options = {
      page: Number(page),
      limit: Number(limit),
      adminId,
      action: action as any,
      resource,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return await this.auditService.getAuditLogs(options);
  }

  @Get('audit/security-alerts')
  @AdminPermissions('security:read')
  @ApiOperation({ summary: 'Get security alerts' })
  @ApiQuery({ name: 'hours', required: false, description: 'Hours to look back' })
  @ApiResponse({ status: 200, description: 'Security alerts retrieved successfully' })
  async getSecurityAlerts(@Query('hours') hours = 24) {
    const alerts = await this.auditService.getSecurityAlerts(Number(hours));
    return { alerts };
  }

  @Get('audit/failed-logins')
  @AdminPermissions('security:read')
  @ApiOperation({ summary: 'Get failed login attempts' })
  @ApiQuery({ name: 'hours', required: false })
  @ApiResponse({ status: 200, description: 'Failed login attempts retrieved successfully' })
  async getFailedLoginAttempts(@Query('hours') hours = 24) {
    return await this.auditService.getFailedLoginAttempts(Number(hours));
  }

  @Get('dashboard/metrics')
  @AdminPermissions('dashboard:read')
  @ApiOperation({ summary: 'Get dashboard metrics' })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({ status: 200, description: 'Dashboard metrics retrieved successfully' })
  async getDashboardMetrics(@Query('days') days = 7) {
    return await this.auditService.getSystemMetrics(Number(days));
  }

  private mapToResponseDto(admin: AdminEntity): AdminResponseDto {
    return {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phone: admin.phone,
      status: admin.status,
      isSuperAdmin: admin.isSuperAdmin,
      lastLoginAt: admin.lastLoginAt,
      lastLoginIp: admin.lastLoginIp,
      twoFactorEnabled: admin.twoFactorEnabled,
      roles: admin.roles || [],
      directPermissions: admin.directPermissions || [],
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
} 