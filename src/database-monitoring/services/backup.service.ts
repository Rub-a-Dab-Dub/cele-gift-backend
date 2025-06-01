import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupRecord, BackupType, BackupStatus } from '../entities/backup-record.entity';
import { AlertingService } from './alerting.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface BackupConfig {
  type: BackupType;
  databases: string[];
  compression: boolean;
  encryption: boolean;
  retentionDays: number;
  destination: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    @InjectRepository(BackupRecord)
    private backupRepository: Repository<BackupRecord>,
    private alertingService: AlertingService,
  ) {}

  async createBackup(config: BackupConfig): Promise<BackupRecord> {
    const backupRecord = this.backupRepository.create({
      databaseName: config.databases[0], // For simplicity, handle one database
      type: config.type,
      status: BackupStatus.INITIATED,
      startTime: new Date(),
      filePath: this.generateBackupPath(config),
    });

    const savedRecord = await this.backupRepository.save(backupRecord);

    // Execute backup asynchronously
    this.executeBackup(savedRecord.id, config).catch(error => {
      this.logger.error('Backup execution failed', error);
    });

    return savedRecord;
  }

  private async executeBackup(backupId: string, config: BackupConfig): Promise<void> {
    const backupRecord = await this.backupRepository.findOne({ where: { id: backupId } });
    if (!backupRecord) return;

    try {
      // Update status to in progress
      await this.backupRepository.update(backupId, {
        status: BackupStatus.IN_PROGRESS,
      });

      // Simulate backup process (replace with actual backup logic)
      const backupData = await this.performBackup(config);
      
      // Calculate checksum
      const checksum = this.calculateChecksum(backupData);
      
      // Write backup file
      await this.writeBackupFile(backupRecord.filePath, backupData);
      
      // Get file size
      const stats = await fs.promises.stat(backupRecord.filePath);

      // Update record with completion details
      await this.backupRepository.update(backupId, {
        status: BackupStatus.COMPLETED,
        endTime: new Date(),
        duration: Math.floor((Date.now() - backupRecord.startTime.getTime()) / 1000),
        fileSize: stats.size,
        checksum,
      });

      this.logger.log(`Backup completed successfully: ${backupRecord.filePath}`);

    } catch (error) {
      await this.backupRepository.update(backupId, {
        status: BackupStatus.FAILED,
        endTime: new Date(),
        error: error.message,
      });

      await this.alertingService.sendAlert({
        type: 'backup_failed',
        severity: 'high',
        message: `Backup failed for database ${backupRecord.databaseName}: ${error.message}`,
        value: 1,
        metadata: { backupId, databaseName: backupRecord.databaseName },
      });

      throw error;
    }
  }

  private async performBackup(config: BackupConfig): Promise<Buffer> {
    // This is a simplified simulation
    // In a real implementation, you would use pg_dump, mysqldump, etc.
    const backupContent = JSON.stringify({
      timestamp: new Date().toISOString(),
      type: config.type,
      databases: config.databases,
      metadata: {
        version: '1.0',
        compression: config.compression,
        encryption: config.encryption,
      },
    });

    return Buffer.from(backupContent);
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async writeBackupFile(filePath: string, data: Buffer): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, data);
  }

  private generateBackupPath(config: BackupConfig): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${config.databases[0]}_${config.type}_${timestamp}.backup`;
    return path.join(config.destination || '/backups', filename);
  }

  async verifyBackup(backupId: string): Promise<{ isValid: boolean; details: any }> {
    const backup = await this.backupRepository.findOne({ where: { id: backupId } });
    if (!backup) {
      throw new Error('Backup not found');
    }

    try {
      // Verify file exists
      await fs.promises.access(backup.filePath);
      
      // Verify checksum
      const fileData = await fs.promises.readFile(backup.filePath);
      const calculatedChecksum = this.calculateChecksum(fileData);
      const checksumValid = calculatedChecksum === backup.checksum;

      // Update verification status
      await this.backupRepository.update(backupId, {
        status: checksumValid ? BackupStatus.VERIFIED : BackupStatus.VERIFICATION_FAILED,
        verificationDate: new Date(),
      });

      return {
        isValid: checksumValid,
        details: {
          fileExists: true,
          checksumValid,
          originalChecksum: backup.checksum,
          calculatedChecksum,
          fileSize: fileData.length,
        },
      };
    } catch (error) {
      await this.backupRepository.update(backupId, {
        status: BackupStatus.VERIFICATION_FAILED,
        verificationDate: new Date(),
      });

      return {
        isValid: false,
        details: {
          error: error.message,
        },
      };
    }
  }

  async getBackupHistory(limit: number = 50, offset: number = 0): Promise<BackupRecord[]> {
    return await this.backupRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async deleteBackup(backupId: string): Promise<void> {
    const backup = await this.backupRepository.findOne({ where: { id: backupId } });
    if (!backup) {
      throw new Error('Backup not found');
    }

    try {
      // Delete physical file
      await fs.promises.unlink(backup.filePath);
    } catch (error) {
      this.logger.warn(`Failed to delete backup file: ${backup.filePath}`, error);
    }

    // Delete record
    await this.backupRepository.delete(backupId);
  }
}