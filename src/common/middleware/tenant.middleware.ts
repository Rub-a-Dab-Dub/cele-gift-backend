mport { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let tenantId = this.extractTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant identification required' });
    }
    
    req['tenantId'] = tenantId;
    next();
  }
  
  private extractTenantId(req: Request): string | null {
    // Strategy 1: Subdomain
    const subdomain = req.headers.host?.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      return subdomain;
    }
    
    // Strategy 2: Header
    const headerTenant = req.headers['x-tenant-id'] as string;
    if (headerTenant) return headerTenant;
    
    // Strategy 3: Path prefix
    const pathMatch = req.path.match(/^\/tenant\/([^\/]+)/);
    if (pathMatch) return pathMatch[1];
    
    return null;
  }
}