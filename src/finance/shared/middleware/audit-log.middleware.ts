import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const log = {
      method: req.method,
      path: req.originalUrl,
      user: req.user?.userId || 'anonymous',
      ip: req.ip,
      timestamp: new Date().toISOString(),
    };

    const logPath = path.join(__dirname, '../../../logs/audit.log');
    fs.appendFileSync(logPath, JSON.stringify(log) + '\n');
    next();
  }
}
