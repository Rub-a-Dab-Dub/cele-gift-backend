export interface PostgreSQLTypeConfig {
  name: string;
  pgType: string;
  transformer?: string;
  validator?: string;
  nullable?: boolean;
  default?: any;
  array?: boolean;
  metadata?: Record<string, any>;
}

export interface BinaryTypeConfig extends PostgreSQLTypeConfig {
  encoding?: 'base64' | 'hex' | 'binary';
  maxSize?: number;
}

export interface JSONTypeConfig extends PostgreSQLTypeConfig {
  schema?: any;
  indexed?: boolean;
  paths?: string[];
}

export interface ArrayTypeConfig extends PostgreSQLTypeConfig {
  elementType: string;
  dimensions?: number;
  indexed?: boolean;
}

export interface UserDefinedTypeConfig extends PostgreSQLTypeConfig {
  definition: string;
  version: string;
  dependencies?: string[];
}

export enum PostgreSQLDataType {
  BIGINT = 'bigint',
  BOOLEAN = 'boolean',
  BYTEA = 'bytea',
  CHARACTER = 'character',
  DATE = 'date',
  DOUBLE_PRECISION = 'double precision',
  INTEGER = 'integer',
  JSON = 'json',
  JSONB = 'jsonb',
  NUMERIC = 'numeric',
  REAL = 'real',
  SMALLINT = 'smallint',
  TEXT = 'text',
  TIME = 'time',
  TIMESTAMP = 'timestamp',
  UUID = 'uuid',
  ARRAY = 'array',
  COMPOSITE = 'composite',
  ENUM = 'enum',
  RANGE = 'range',
  GEOMETRY = 'geometry',
  POINT = 'point',
  INET = 'inet',
  CIDR = 'cidr',
  MACADDR = 'macaddr',
  TSVECTOR = 'tsvector',
  TSQUERY = 'tsquery'
}

export interface TypeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  transformedValue?: any;
}

export interface QueryContext {
  entityName: string;
  propertyName: string;
  dataType: PostgreSQLDataType;
  config: PostgreSQLTypeConfig;
}
