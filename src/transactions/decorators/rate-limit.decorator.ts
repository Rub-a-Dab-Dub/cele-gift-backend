import { SetMetadata } from '@nestjs/common';

export const RateLimit = (limit: number, windowMs: number = 60000) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata('rateLimit', limit)(target, propertyKey, descriptor);
    SetMetadata('rateLimitWindow', windowMs)(target, propertyKey, descriptor);
  };
};
