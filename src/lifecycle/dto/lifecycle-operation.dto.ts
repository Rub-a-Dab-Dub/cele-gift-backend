import { IsString, IsOptional, IsObject, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class LifecycleOperationDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  skipValidation?: boolean;

  @IsOptional()
  @IsBoolean()
  skipAudit?: boolean;

  @IsOptional()
  @IsBoolean()
  skipVersioning?: boolean;

  @IsOptional()
  @IsBoolean()
  cascadeOperations?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class BulkOperationDto extends LifecycleOperationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}

export class RestoreEntityDto extends LifecycleOperationDto {}

export class ArchiveEntityDto extends LifecycleOperationDto {}