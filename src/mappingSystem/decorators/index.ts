import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Column, ColumnOptions } from 'typeorm';
import { Type, Transform } from 'class-transformer';
import { IsOptional, ValidateNested, ValidationOptions } from 'class-validator';
import { PostgreSQLDataType, PostgreSQLTypeConfig } from '../types';

export const POSTGRESQL_TYPE_KEY = 'postgresql:type';
export const POSTGRESQL_CONFIG_KEY = 'postgresql:config';

export function PostgreSQLType(
  type: PostgreSQLDataType,
  config?: Partial<PostgreSQLTypeConfig>
) {
  return (target: any, propertyKey: string) => {
    const typeConfig: PostgreSQLTypeConfig = {
      name: propertyKey,
      pgType: type,
      ...config
    };
    
    Reflect.defineMetadata(POSTGRESQL_TYPE_KEY, type, target, propertyKey);
    Reflect.defineMetadata(POSTGRESQL_CONFIG_KEY, typeConfig, target, propertyKey);
  };
}

export function BinaryType(options?: {
  encoding?: 'base64' | 'hex' | 'binary';
  maxSize?: number;
  nullable?: boolean;
}) {
  return applyDecorators(
    PostgreSQLType(PostgreSQLDataType.BYTEA, options),
    Column({ type: 'bytea', nullable: options?.nullable }),
    Transform(({ value }) => {
      if (!value) return value;
      if (Buffer.isBuffer(value)) {
        return options?.encoding === 'base64' 
          ? value.toString('base64')
          : options?.encoding === 'hex'
          ? value.toString('hex')
          : value;
      }
      return value;
    })
  );
}

export function JSONType(options?: {
  schema?: any;
  indexed?: boolean;
  nullable?: boolean;
  type?: 'json' | 'jsonb';
}) {
  const pgType = options?.type === 'json' ? PostgreSQLDataType.JSON : PostgreSQLDataType.JSONB;
  
  return applyDecorators(
    PostgreSQLType(pgType, options),
    Column({ 
      type: options?.type || 'jsonb', 
      nullable: options?.nullable 
    }),
    Transform(({ value }) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    })
  );
}

export function ArrayType(elementType: string, options?: {
  dimensions?: number;
  indexed?: boolean;
  nullable?: boolean;
}) {
  return applyDecorators(
    PostgreSQLType(PostgreSQLDataType.ARRAY, { elementType, ...options }),
    Column({ 
      type: 'simple-array',
      nullable: options?.nullable 
    }),
    Transform(({ value }) => {
      if (typeof value === 'string') {
        return value.split(',').map(v => v.trim());
      }
      return Array.isArray(value) ? value : [];
    })
  );
}

export function UUIDType(options?: { nullable?: boolean; version?: 4 | 5 }) {
  return applyDecorators(
    PostgreSQLType(PostgreSQLDataType.UUID, options),
    Column({ type: 'uuid', nullable: options?.nullable })
  );
}

export function PointType(options?: { nullable?: boolean; srid?: number }) {
  return applyDecorators(
    PostgreSQLType(PostgreSQLDataType.POINT, options),
    Column({ type: 'point', nullable: options?.nullable }),
    Transform(({ value }) => {
      if (typeof value === 'string') {
        const match = value.match(/\(([^,]+),([^)]+)\)/);
        if (match) {
          return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        }
      }
      return value;
    })
  );
}

export function UserDefinedType(
  typeName: string,
  definition: string,
  options?: { nullable?: boolean; version?: string }
) {
  return (target: any, propertyKey: string) => {
    const config: PostgreSQLTypeConfig = {
      name: propertyKey,
      pgType: typeName,
      metadata: { definition, version: options?.version || '1.0.0' },
      nullable: options?.nullable
    };
    
    Reflect.defineMetadata(POSTGRESQL_TYPE_KEY, 'composite', target, propertyKey);
    Reflect.defineMetadata(POSTGRESQL_CONFIG_KEY, config, target, propertyKey);
  };
}
