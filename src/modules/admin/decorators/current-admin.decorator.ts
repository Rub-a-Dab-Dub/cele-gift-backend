import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminEntity } from '../entities/admin.entity';

export const CurrentAdmin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AdminEntity => {
    const request = ctx.switchToHttp().getRequest();
    return request.admin;
  },
); 