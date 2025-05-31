import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private requestCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientIp = request.ip || request.connection.remoteAddress;

    const limit =
      this.reflector.get<number>('rateLimit', context.getHandler()) || 100;
    const windowMs =
      this.reflector.get<number>('rateLimitWindow', context.getHandler()) ||
      60000; // 1 minute

    const now = Date.now();
    const clientData = this.requestCounts.get(clientIp);

    if (!clientData || now > clientData.resetTime) {
      this.requestCounts.set(clientIp, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (clientData.count >= limit) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    clientData.count++;
    return true;
  }
}
