import { 
  registerDecorator, 
  ValidationOptions, 
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';
import { TypeValidationResult } from '../types';

@ValidatorConstraint({ name: 'isBinaryData', async: false })
export class IsBinaryDataConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return true;
    
    return Buffer.isBuffer(value) || 
           (typeof value === 'string' && this.isValidBase64(value));
  }

  defaultMessage(args: ValidationArguments) {
    return 'Value must be binary data (Buffer or base64 string)';
  }

  private isValidBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }
}

@ValidatorConstraint({ name: 'isPostgreSQLArray', async: false })
export class IsPostgreSQLArrayConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return true;
    
    if (!Array.isArray(value)) return false;
    
    const [elementType] = args.constraints;
    if (elementType) {
      return value.every(item => this.validateElement(item, elementType));
    }
    
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Value must be a valid PostgreSQL array';
  }

  private validateElement(item: any, type: string): boolean {
    switch (type) {
      case 'string': return typeof item === 'string';
      case 'number': return typeof item === 'number';
      case 'boolean': return typeof item === 'boolean';
      case 'uuid': return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item);
      default: return true;
    }
  }
}

@ValidatorConstraint({ name: 'isPoint', async: false })
export class IsPointConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return true;
    
    if (typeof value === 'object' && 'x' in value && 'y' in value) {
      return typeof value.x === 'number' && typeof value.y === 'number';
    }
    
    if (typeof value === 'string') {
      const match = value.match(/^\(([^,]+),([^)]+)\)$/);
      if (match) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        return !isNaN(x) && !isNaN(y);
      }
    }
    
    return false;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Value must be a valid point (object with x,y or string "(x,y)")';
  }
}

@ValidatorConstraint({ name: 'isJSONB', async: false })
export class IsJSONBConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return true;
    
    if (typeof value === 'object') return true;
    
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    }
    
    return false;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Value must be valid JSON';
  }
}

@ValidatorConstraint({ name: 'isTSVector', async: false })
export class IsTSVectorConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return true;
    
    if (typeof value === 'string') {
      // Basic tsvector format validation
      return /^[\w\s':\d,]+$/.test(value);
    }
    
    return false;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Value must be a valid tsvector string';
  }
}

export function IsBinaryData(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBinaryDataConstraint,
    });
  };
}

export function IsPostgreSQLArray(elementType?: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [elementType],
      validator: IsPostgreSQLArrayConstraint,
    });
  };
}

export function IsPoint(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPointConstraint,
    });
  };
}

export function IsJSONB(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsJSONBConstraint,
    });
  };
}

export function IsTSVector(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsTSVectorConstraint,
    });
  };
}

export class TypeValidator {
  static validateType(value: any, type: string, config?: any): TypeValidationResult {
    const result: TypeValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      switch (type) {
        case 'bytea':
          this.validateBinary(value, result, config);
          break;
        case 'json':
        case 'jsonb':
          this.validateJSON(value, result, config);
          break;
        case 'array':
          this.validateArray(value, result, config);
          break;
        case 'point':
          this.validatePoint(value, result, config);
          break;
        case 'uuid':
          this.validateUUID(value, result, config);
          break;
        case 'inet':
          this.validateInet(value, result, config);
          break;
        case 'tsvector':
          this.validateTSVector(value, result, config);
          break;
        default:
          result.warnings.push(`Unknown type: ${type}`);
      }

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  private static validateBinary(value: any, result: TypeValidationResult, config?: any): void {
    if (!Buffer.isBuffer(value) && typeof value !== 'string') {
      result.errors.push('Binary data must be Buffer or string');
      return;
    }

    if (config?.maxSize && Buffer.byteLength(value) > config.maxSize) {
      result.errors.push(`Binary data exceeds maximum size of ${config.maxSize} bytes`);
    }
  }

  private static validateJSON(value: any, result: TypeValidationResult, config?: any): void {
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
      } catch {
        result.errors.push('Invalid JSON string');
      }
    } else if (typeof value !== 'object') {
      result.errors.push('JSON value must be object or valid JSON string');
    }
  }

  private static validateArray(value: any, result: TypeValidationResult, config?: any): void {
    if (!Array.isArray(value)) {
      result.errors.push('Value must be an array');
      return;
    }

    if (config?.elementType) {
      value.forEach((item, index) => {
        const elementResult = this.validateType(item, config.elementType);
        if (!elementResult.isValid) {
          result.errors.push(`Array element ${index}: ${elementResult.errors.join(', ')}`);
        }
      });
    }
  }

  private static validatePoint(value: any, result: TypeValidationResult, config?: any): void {
    const pointConstraint = new IsPointConstraint();
    if (!pointConstraint.validate(value, {} as ValidationArguments)) {
      result.errors.push('Invalid point format');
    }
  }

  private static validateUUID(value: any, result: TypeValidationResult, config?: any): void {
    if (typeof value !== 'string') {
      result.errors.push('UUID must be a string');
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      result.errors.push('Invalid UUID format');
    }
  }

  private static validateInet(value: any, result: TypeValidationResult, config?: any): void {
    if (typeof value !== 'string') {
      result.errors.push('INET value must be a string');
      return;
    }

    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;
    if (!ipRegex.test(value)) {
      result.errors.push('Invalid IP address format');
    }
  }

  private static validateTSVector(value: any, result: TypeValidationResult, config?: any): void {
    const tsvectorConstraint = new IsTSVectorConstraint();
    if (!tsvectorConstraint.validate(value, {} as ValidationArguments)) {
      result.errors.push('Invalid tsvector format');
    }
  }
}
