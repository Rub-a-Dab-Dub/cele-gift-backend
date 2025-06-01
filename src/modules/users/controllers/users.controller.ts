import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Tenant } from '../../../common/decorators/tenant.decorator';

@Controller('users')
@UseGuards(TenantGuard)
export class UsersController {
  @Get()
  async getUsers(@Tenant() tenantId: string) {
    return { tenantId, message: 'Get users for tenant' };
  }
  
  @Post()
  async createUser(@Tenant() tenantId: string, @Body() userData: any) {
    return { tenantId, userData, message: 'User created for tenant' };
  }
}