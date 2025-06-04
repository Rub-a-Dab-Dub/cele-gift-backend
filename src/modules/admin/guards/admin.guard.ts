import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminService } from '../services/admin.service';
import { ADMIN_PERMISSIONS_KEY } from '../decorators/admin-permissions.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly adminService: AdminService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Extract token from header (in a real app, this would be JWT validation)
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // In a real implementation, you would validate JWT token here
    // For now, we'll simulate token validation
    const adminId = this.validateToken(token);
    if (!adminId) {
      throw new UnauthorizedException('Invalid token');
    }

    try {
      const admin = await this.adminService.getAdminById(adminId);
      request.admin = admin;

      // Check if specific permissions are required
      const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
        ADMIN_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (requiredPermissions) {
        const hasPermission = await this.checkPermissions(admin.id, requiredPermissions);
        if (!hasPermission) {
          throw new ForbiddenException('Insufficient permissions');
        }
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid admin credentials');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private validateToken(token: string): string | null {
    // In a real implementation, you would validate JWT token here
    // For demo purposes, we'll assume the token is the admin ID
    return token;
  }

  private async checkPermissions(adminId: string, requiredPermissions: string[]): Promise<boolean> {
    for (const permission of requiredPermissions) {
      const hasPermission = await this.adminService.hasPermission(adminId, permission);
      if (!hasPermission) {
        return false;
      }
    }
    return true;
  }
} 