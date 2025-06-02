import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class QueryLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('QueryLogger');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = process.hrtime.bigint();
    const originalSend = res.send;

    res.send = function(body) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Log request details
      this.logger.log({
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration.toFixed(2)}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      return originalSend.call(this, body);
    }.bind(this);

    next();
  }
}