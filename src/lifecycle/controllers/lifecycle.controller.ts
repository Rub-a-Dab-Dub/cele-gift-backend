import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { VersioningService } from '../services/versioning.service';
import { LifecycleManagerService } from '../services/lifecycle-manager.service';

@ApiTags('Lifecycle Management')
@Controller('lifecycle')
export class LifecycleController {
  constructor(
    private auditService: AuditService,
    private versioningService: VersioningService,
    private lifecycleManager: LifecycleManagerService
  ) {}

  @Get('audit/:entityType/:entityId')
  @ApiOperation({ summary: 'Get audit history for an entity' })
  async getAuditHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string
  ) {
    return this.auditService.getAuditHistory(entityType, entityId);
  }

  @Get('versions/:entityType/:entityId')
  @ApiOperation({ summary: 'Get version history for an entity' })
  async getVersionHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string
  ) {
    return this.versioningService.getVersionHistory(entityType, entityId);
  }

  @Get('versions/:entityType/:entityId/:version')
  @ApiOperation({ summary: 'Get specific version of an entity' })
  async getVersion(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Param('version') version: number
  ) {
    return this.versioningService.getVersion(entityType, entityId, version);
  }

  @Get('audit/transaction/:transactionId')
  @ApiOperation({ summary: 'Get all audit logs for a transaction' })
  async getTransactionAudit(
    @Param('transactionId') transactionId: string
  ) {
    return this.auditService.getAuditByTransaction(transactionId);
  }
}