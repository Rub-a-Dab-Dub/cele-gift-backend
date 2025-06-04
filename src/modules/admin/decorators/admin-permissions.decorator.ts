import { SetMetadata } from '@nestjs/common';

export const ADMIN_PERMISSIONS_KEY = 'admin_permissions';
export const AdminPermissions = (...permissions: string[]) => 
  SetMetadata(ADMIN_PERMISSIONS_KEY, permissions); 