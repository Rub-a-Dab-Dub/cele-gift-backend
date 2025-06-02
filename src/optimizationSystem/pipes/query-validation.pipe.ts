import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';

@Injectable()
export class QueryValidationPipe implements PipeTransform {
  private readonly dangerousPatterns = [
    /drop\s+table/i,
    /delete\s+from/i,
    /truncate/i,
    /alter\s+table/i,
    /create\s+table/i,
    /grant/i,
    /revoke/i,
  ];

  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'body' && value?.sql) {
      const sql = value.sql.toLowerCase().trim();
      
      // Check for dangerous SQL patterns
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(sql)) {
          throw new BadRequestException('Potentially dangerous SQL query detected');
        }
      }

      // Basic SQL injection protection
      if (this.containsSuspiciousPatterns(sql)) {
        throw new BadRequestException('Query contains suspicious patterns');
      }
    }

    return value;
  }

  private containsSuspiciousPatterns(sql: string): boolean {
    const suspiciousPatterns = [
      /union\s+select/i,
      /1\s*=\s*1/,
      /'\s*or\s*'1'\s*=\s*'1/i,
      /;\s*drop/i,
      /;\s*delete/i,
      /'\s*;\s*/,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(sql));
  }
}
