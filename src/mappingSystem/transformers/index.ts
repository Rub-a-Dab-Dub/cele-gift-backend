import { Transform, TransformFnParams } from 'class-transformer';
import { PostgreSQLDataType } from '../types';

export class TypeTransformers {
  static binary(encoding: 'base64' | 'hex' | 'binary' = 'base64') {
    return Transform(({ value }: TransformFnParams) => {
      if (!value) return value;
      
      if (Buffer.isBuffer(value)) {
        return encoding === 'binary' ? value : value.toString(encoding);
      }
      
      if (typeof value === 'string') {
        return Buffer.from(value, encoding);
      }
      
      return value;
    });
  }

  static json() {
    return Transform(({ value }: TransformFnParams) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    });
  }

  static array(elementTransformer?: (item: any) => any) {
    return Transform(({ value }: TransformFnParams) => {
      if (!Array.isArray(value)) {
        if (typeof value === 'string') {
          value = value.split(',').map(v => v.trim());
        } else {
          return [];
        }
      }
      
      return elementTransformer 
        ? value.map(elementTransformer)
        : value;
    });
  }

  static point() {
    return Transform(({ value }: TransformFnParams) => {
      if (typeof value === 'string') {
        const match = value.match(/\(([^,]+),([^)]+)\)/);
        if (match) {
          return {
            x: parseFloat(match[1]),
            y: parseFloat(match[2])
          };
        }
      }
      
      if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
        return `(${value.x},${value.y})`;
      }
      
      return value;
    });
  }

  static timestamp() {
    return Transform(({ value }: TransformFnParams) => {
      if (typeof value === 'string') {
        return new Date(value);
      }
      
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      return value;
    });
  }

  static bigint() {
    return Transform(({ value }: TransformFnParams) => {
      if (typeof value === 'string') {
        return BigInt(value);
      }
      
      if (typeof value === 'bigint') {
        return value.toString();
      }
      
      return value;
    });
  }

  static inet() {
    return Transform(({ value }: TransformFnParams) => {
      if (typeof value === 'string') {
        // Validate IP address format
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;
        if (ipRegex.test(value)) {
          return value;
        }
      }
      return value;
    });
  }

  static tsvector() {
    return Transform(({ value }: TransformFnParams) => {
      if (typeof value === 'string') {
        return value;
      }
      
      if (Array.isArray(value)) {
        return value.join(' ');
      }
      
      return value;
    });
  }

  static composite(schema: Record<string, any>) {
    return Transform(({ value }: TransformFnParams) => {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return this.validateComposite(parsed, schema);
        } catch {
          return value;
        }
      }
      
      if (typeof value === 'object') {
        return this.validateComposite(value, schema);
      }
      
      return value;
    });
  }

  private static validateComposite(value: any, schema: Record<string, any>): any {
    const result: any = {};
    
    for (const [key, type] of Object.entries(schema)) {
      if (key in value) {
        result[key] = value[key];
      }
    }
    
    return result;
  }
}

export function createCustomTransformer(
  name: string,
  transformFunction: (value: any) => any
): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) => transformFunction(value));
}
