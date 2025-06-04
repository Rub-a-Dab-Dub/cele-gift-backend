import { Injectable, Logger } from '@nestjs/common';
import { 
  IRelationshipValidator, 
  RelationshipIntegrityConfig, 
  ValidationResult, 
  ValidationRule 
} from '../interfaces/relationship-management.interface';
import { RelationshipMetadataService } from './relationship-metadata.service';

@Injectable()
export class RelationshipValidatorService implements IRelationshipValidator {
  private readonly logger = new Logger(RelationshipValidatorService.name);

  constructor(private metadataService: RelationshipMetadataService) {}

  async validate<T>(
    entity: T,
    config: RelationshipIntegrityConfig,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const entityName = (entity as any).constructor.name;

    this.logger.debug(`Validating relationships for ${entityName}`);

    // Validate circular references if enabled
    if (config.validateCircularReferences) {
      const circularValidation = await this.validateCircularReferences(entity, new Set(), 0);
      if (!circularValidation) {
        results.push({
          isValid: false,
          errors: [{
            rule: 'circular-reference',
            message: 'Circular reference detected in entity relationships',
            severity: 'error',
            path: entityName,
          }],
        });
      }
    }

    // Apply custom validation rules
    for (const rule of config.rules) {
      const ruleResult = await this.applyValidationRule(entity, rule);
      if (ruleResult) {
        results.push(ruleResult);
      }
    }

    // Validate relationship integrity
    const integrityResult = await this.validateRelationshipIntegrity(entity);
    if (integrityResult) {
      results.push(integrityResult);
    }

    return results;
  }

  async validateCircularReferences<T>(
    entity: T,
    visited: Set<string>,
    depth: number,
  ): Promise<boolean> {
    const entityName = (entity as any).constructor.name;
    const entityId = (entity as any).id;
    const entityKey = `${entityName}:${entityId}`;

    // Check if we've already visited this entity
    if (visited.has(entityKey)) {
      this.logger.warn(`Circular reference detected: ${entityKey}`);
      return false;
    }

    // Add current entity to visited set
    visited.add(entityKey);

    try {
      const metadata = this.metadataService.getEntityMetadata(entityName);
      
      // Check each relationship
      for (const relation of metadata.relations) {
        const relationValue = (entity as any)[relation.property];
        
        if (relationValue) {
          if (Array.isArray(relationValue)) {
            // Handle one-to-many and many-to-many relations
            for (const relatedEntity of relationValue) {
              if (relatedEntity && relatedEntity.id) {
                const isValid = await this.validateCircularReferences(
                  relatedEntity, 
                  new Set(visited), 
                  depth + 1
                );
                if (!isValid) return false;
              }
            }
          } else {
            // Handle one-to-one and many-to-one relations
            if (relationValue.id) {
              const isValid = await this.validateCircularReferences(
                relationValue, 
                new Set(visited), 
                depth + 1
              );
              if (!isValid) return false;
            }
          }
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Error validating circular references for ${entityKey}:`, error);
      return false;
    } finally {
      visited.delete(entityKey);
    }
  }

  private async applyValidationRule<T>(
    entity: T,
    rule: ValidationRule,
  ): Promise<ValidationResult | null> {
    try {
      const entityName = (entity as any).constructor.name;
      const metadata = this.metadataService.getEntityMetadata(entityName);

      // Check each relationship against the rule
      for (const relation of metadata.relations) {
        const relationValue = (entity as any)[relation.property];
        
        if (relationValue) {
          const isValid = await this.evaluateRule(entity, relationValue, rule);
          
          if (!isValid) {
            return {
              isValid: false,
              errors: [{
                rule: rule.name,
                message: rule.message,
                severity: rule.severity,
                path: `${entityName}.${relation.property}`,
              }],
            };
          }
        }
      }

      return null; // No validation errors
    } catch (error) {
      this.logger.error(`Error applying validation rule ${rule.name}:`, error);
      return {
        isValid: false,
        errors: [{
          rule: rule.name,
          message: `Validation rule execution failed: ${error.message}`,
          severity: 'error',
          path: (entity as any).constructor.name,
        }],
      };
    }
  }

  private async evaluateRule(entity: any, related: any, rule: ValidationRule): Promise<boolean> {
    try {
      if (Array.isArray(related)) {
        // For array relations, check each item
        return related.every(item => rule.condition(entity, item));
      } else {
        // For single relations
        return rule.condition(entity, related);
      }
    } catch (error) {
      this.logger.error(`Error evaluating rule ${rule.name}:`, error);
      return false;
    }
  }

  private async validateRelationshipIntegrity<T>(entity: T): Promise<ValidationResult | null> {
    const entityName = (entity as any).constructor.name;
    const errors: any[] = [];

    try {
      const metadata = this.metadataService.getEntityMetadata(entityName);

      for (const relation of metadata.relations) {
        const relationValue = (entity as any)[relation.property];

        // Check for required relationships
        if (relation.isRequired && !relationValue) {
          errors.push({
            rule: 'required-relationship',
            message: `Required relationship '${relation.property}' is missing`,
            severity: 'error',
            path: `${entityName}.${relation.property}`,
          });
        }

        // Check for orphaned relationships
        if (relationValue && relation.relationType === 'many-to-one') {
          const isOrphaned = await this.checkForOrphanedRelation(relationValue, relation);
          if (isOrphaned) {
            errors.push({
              rule: 'orphaned-relationship',
              message: `Orphaned relationship detected in '${relation.property}'`,
              severity: 'warning',
              path: `${entityName}.${relation.property}`,
            });
          }
        }

        // Check for duplicate relationships in many-to-many
        if (relationValue && Array.isArray(relationValue) && relation.relationType === 'many-to-many') {
          const duplicates = this.findDuplicateRelations(relationValue);
          if (duplicates.length > 0) {
            errors.push({
              rule: 'duplicate-relationship',
              message: `Duplicate relationships found in '${relation.property}': ${duplicates.join(', ')}`,
              severity: 'warning',
              path: `${entityName}.${relation.property}`,
            });
          }
        }
      }

      if (errors.length > 0) {
        return {
          isValid: false,
          errors,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Error validating relationship integrity for ${entityName}:`, error);
      return {
        isValid: false,
        errors: [{
          rule: 'integrity-check',
          message: `Integrity validation failed: ${error.message}`,
          severity: 'error',
          path: entityName,
        }],
      };
    }
  }

  private async checkForOrphanedRelation(relatedEntity: any, relation: any): Promise<boolean> {
    // Simple check: if related entity exists but doesn't have back-reference
    if (!relatedEntity || !relatedEntity.id) return false;

    try {
      // This would require database query to verify the relationship still exists
      // For now, we'll do a simple null check
      return false;
    } catch (error) {
      this.logger.error('Error checking for orphaned relation:', error);
      return false;
    }
  }

  private findDuplicateRelations(relations: any[]): string[] {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    relations.forEach(relation => {
      if (relation && relation.id) {
        if (seen.has(relation.id)) {
          duplicates.push(relation.id);
        } else {
          seen.add(relation.id);
        }
      }
    });

    return duplicates;
  }

  // Utility method to create common validation rules
  static createCommonValidationRules(): ValidationRule[] {
    return [
      {
        name: 'non-null-foreign-key',
        condition: (entity: any, related: any) => {
          return related !== null && related !== undefined;
        },
        message: 'Foreign key relationship cannot be null',
        severity: 'error',
      },
      {
        name: 'valid-entity-id',
        condition: (entity: any, related: any) => {
          return related.id && typeof related.id === 'string' && related.id.length > 0;
        },
        message: 'Related entity must have a valid ID',
        severity: 'error',
      },
      {
        name: 'max-relationship-count',
        condition: (entity: any, related: any) => {
          if (Array.isArray(related)) {
            return related.length <= 1000; // Configurable limit
          }
          return true;
        },
        message: 'Relationship count exceeds maximum allowed limit',
        severity: 'warning',
      },
      {
        name: 'no-self-reference',
        condition: (entity: any, related: any) => {
          return entity.id !== related.id;
        },
        message: 'Entity cannot reference itself',
        severity: 'error',
      },
    ];
  }

  // Method to validate specific relationship types
  async validateRelationshipType<T>(
    entity: T,
    relationName: string,
    expectedType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many',
  ): Promise<boolean> {
    try {
      const entityName = (entity as any).constructor.name;
      const relationMetadata = this.metadataService.getRelationshipMetadata(entityName, relationName);
      
      if (!relationMetadata) {
        this.logger.warn(`Relationship '${relationName}' not found for entity '${entityName}'`);
        return false;
      }

      return relationMetadata.relationType === expectedType;
    } catch (error) {
      this.logger.error(`Error validating relationship type:`, error);
      return false;
    }
  }

  // Batch validation for multiple entities
  async validateBatch<T>(
    entities: T[],
    config: RelationshipIntegrityConfig,
  ): Promise<Map<string, ValidationResult[]>> {
    const results = new Map<string, ValidationResult[]>();

    const validationPromises = entities.map(async (entity) => {
      const entityId = (entity as any).id;
      const validationResults = await this.validate(entity, config);
      return { entityId, validationResults };
    });

    const batchResults = await Promise.all(validationPromises);

    batchResults.forEach(({ entityId, validationResults }) => {
      results.set(entityId, validationResults);
    });

    return results;
  }
} 