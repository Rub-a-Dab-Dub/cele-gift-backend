import { SelectQueryBuilder, Repository } from 'typeorm';
import { QueryContext, PostgreSQLDataType } from '../types';

export class PostgreSQLQueryUtilities {
  static addJSONQuery<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    column: string,
    path: string,
    value: any,
    operator: '->' | '->>' | '#>' | '#>>' | '@>' | '<@' | '?' | '?&' | '?|' = '->>'
  ): SelectQueryBuilder<T> {
    const paramName = `json_param_${Date.now()}`;
    
    switch (operator) {
      case '->':
      case '->>':
        return qb.andWhere(`${alias}.${column} ${operator} :${paramName} = :value`, {
          [paramName]: path,
          value
        });
      case '#>':
      case '#>>':
        return qb.andWhere(`${alias}.${column} ${operator} :${paramName} = :value`, {
          [paramName]: `{${path}}`,
          value
        });
      case '@>':
        return qb.andWhere(`${alias}.${column} @> :${paramName}`, {
          [paramName]: JSON.stringify({ [path]: value })
        });
      case '<@':
        return qb.andWhere(`${alias}.${column} <@ :${paramName}`, {
          [paramName]: JSON.stringify(value)
        });
      case '?':
        return qb.andWhere(`${alias}.${column} ? :${paramName}`, {
          [paramName]: path
        });
      case '?&':
        return qb.andWhere(`${alias}.${column} ?& :${paramName}`, {
          [paramName]: Array.isArray(path) ? path : [path]
        });
      case '?|':
        return qb.andWhere(`${alias}.${column} ?| :${paramName}`, {
          [paramName]: Array.isArray(path) ? path : [path]
        });
      default:
        return qb;
    }
  }

  static addArrayQuery<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    column: string,
    value: any,
    operator: '@>' | '<@' | '&&' | '=' | 'ANY' | 'ALL' = '@>'
  ): SelectQueryBuilder<T> {
    const paramName = `array_param_${Date.now()}`;
    
    switch (operator) {
      case '@>':
        return qb.andWhere(`${alias}.${column} @> :${paramName}`, {
          [paramName]: Array.isArray(value) ? value : [value]
        });
      case '<@':
        return qb.andWhere(`${alias}.${column} <@ :${paramName}`, {
          [paramName]: Array.isArray(value) ? value : [value]
        });
      case '&&':
        return qb.andWhere(`${alias}.${column} && :${paramName}`, {
          [paramName]: Array.isArray(value) ? value : [value]
        });
      case '=':
        return qb.andWhere(`${alias}.${column} = :${paramName}`, {
          [paramName]: value
        });
      case 'ANY':
        return qb.andWhere(`${alias}.${column} = ANY(:${paramName})`, {
          [paramName]: Array.isArray(value) ? value : [value]
        });
      case 'ALL':
        return qb.andWhere(`${alias}.${column} = ALL(:${paramName})`, {
          [paramName]: Array.isArray(value) ? value : [value]
        });
      default:
        return qb;
    }
  }

  static addGeometryQuery<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    column: string,
    geometry: any,
    operator: 'ST_Contains' | 'ST_Within' | 'ST_Intersects' | 'ST_Distance' | 'ST_DWithin' = 'ST_Contains'
  ): SelectQueryBuilder<T> {
    const paramName = `geom_param_${Date.now()}`;
    
    switch (operator) {
      case 'ST_Contains':
      case 'ST_Within':
      case 'ST_Intersects':
        return qb.andWhere(`${operator}(${alias}.${column}, ST_GeomFromText(:${paramName}))`, {
          [paramName]: this.geometryToWKT(geometry)
        });
      case 'ST_Distance':
        return qb.andWhere(`${operator}(${alias}.${column}, ST_GeomFromText(:${paramName})) < :distance`, {
          [paramName]: this.geometryToWKT(geometry.point),
          distance: geometry.distance || 1000
        });
      case 'ST_DWithin':
        return qb.andWhere(`${operator}(${alias}.${column}, ST_GeomFromText(:${paramName}), :distance)`, {
          [paramName]: this.geometryToWKT(geometry.point),
          distance: geometry.distance || 1000
        });
      default:
        return qb;
    }
  }
