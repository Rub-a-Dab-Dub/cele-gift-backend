import { BadRequestException } from '@nestjs/common';

export class CursorUtil {
  static encode(value: any): string {
    try {
      const data = {
        value,
        timestamp: Date.now(),
      };
      return Buffer.from(JSON.stringify(data)).toString('base64url');
    } catch (error) {
      throw new BadRequestException('Invalid cursor value');
    }
  }

  static decode(cursor: string): any {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const data = JSON.parse(decoded);
      return data.value;
    } catch (error) {
      throw new BadRequestException('Invalid cursor format');
    }
  }

  static createCursor(entity: any, sortField: string): string {
    const value = this.getNestedValue(entity, sortField);
    return this.encode(value);
  }

  static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  static isValidCursor(cursor: string): boolean {
    try {
      this.decode(cursor);
      return true;
    } catch {
      return false;
    }
  }

  static compareCursors(cursor1: string, cursor2: string, direction: 'ASC' | 'DESC'): number {
    const value1 = this.decode(cursor1);
    const value2 = this.decode(cursor2);

    if (value1 === value2) return 0;
    
    const comparison = value1 < value2 ? -1 : 1;
    return direction === 'DESC' ? -comparison : comparison;
  }
}