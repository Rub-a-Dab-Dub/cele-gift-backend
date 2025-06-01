import { Injectable, Logger } from '@nestjs/common';
import { ILifecycleEntity } from '../interfaces/lifecycle-entity.interface';

export interface ValidationRule<T> {
  name: string;
  validate: (entity: T, context?: any) => Promise<boolean> | boolean;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class DataConsistencyValidator {
  private readonly logger = new Logger(DataConsistencyValidator.name);
  private rules = new Map<string, ValidationRule<any>[]>();

  registerRule<T>(entityType: string, rule: ValidationRule<T>): void {
    if (!this.rules.has(entityType)) {
      this.rules.set(entityType, []);
    }
    this.rules.get(entityType)!.push(rule);
  }

  async validate<T extends ILifecycleEntity>(
    entityType: string,
    entity: T,
    context?: any
  ): Promise<ValidationResult> {
    const rules = this.rules.get(entityType) || [];
    const errors: string[] = [];

    for (const rule of rules) {
      try {
        const isValid = await rule.validate(entity, context);
        if (!isValid) {
          errors.push(rule.message);
        }
      } catch (error) {
        this.logger.error(`Validation rule ${rule.name} failed:`, error);
        errors.push(`Validation rule ${rule.name} failed: ${error.message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async validateBatch<T extends ILifecycleEntity>(
    entityType: string,
    entities: T[],
    context?: any
  ): Promise<ValidationResult[]> {
    return Promise.all(
      entities.map(entity => this.validate(entityType, entity, context))
    );
  }
}