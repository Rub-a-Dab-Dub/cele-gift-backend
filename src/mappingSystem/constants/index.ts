export const POSTGRESQL_TYPE_MAPPINGS = {
  [PostgreSQLDataType.BIGINT]: {
    jsType: 'bigint',
    ormType: 'bigint',
    validation: 'isBigInt'
  },
  [PostgreSQLDataType.BOOLEAN]: {
    jsType: 'boolean',
    ormType: 'boolean',
    validation: 'isBoolean'
  },
  [PostgreSQLDataType.BYTEA]: {
    jsType: 'Buffer',
    ormType: 'bytea',
    validation: 'isBinary'
  },
  [PostgreSQLDataType.JSON]: {
    jsType: 'object',
    ormType: 'json',
    validation: 'isJSON'
  },
  [PostgreSQLDataType.JSONB]: {
    jsType: 'object',
    ormType: 'jsonb',
    validation: 'isJSON'
  },
  [PostgreSQLDataType.UUID]: {
    jsType: 'string',
    ormType: 'uuid',
    validation: 'isUUID'
  },
  [PostgreSQLDataType.ARRAY]: {
    jsType: 'Array',
    ormType: 'array',
    validation: 'isArray'
  },
  [PostgreSQLDataType.POINT]: {
    jsType: 'object',
    ormType: 'point',
    validation: 'isPoint'
  },
  [PostgreSQLDataType.INET]: {
    jsType: 'string',
    ormType: 'inet',
    validation: 'isIP'
  },
  [PostgreSQLDataType.TSVECTOR]: {
    jsType: 'string',
    ormType: 'tsvector',
    validation: 'isTSVector'
  }
};

export const TYPE_TRANSFORMER_REGISTRY = new Map<string, Function>();
export const TYPE_VALIDATOR_REGISTRY = new Map<string, Function>();
export const CUSTOM_TYPE_REGISTRY = new Map<string, PostgreSQLTypeConfig>();