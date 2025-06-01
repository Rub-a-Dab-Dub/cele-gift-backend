import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseCredential, Environment, CredentialRotationResult } from '../interfaces/credential.interface';
import { ISecretProvider } from '../interfaces/secret-provider.interface';
import { AwsSecretsProvider } from './secret-providers/aws-secrets.provider';
import { AuditLoggerService } from './audit-logger.service';
import { SecurityScannerService } from './security-scanner.service';

@Injectable()
export class CredentialManagerService implements OnModuleInit {
  private readonly logger = new Logger(CredentialManagerService.name);
  private secretProviders = new Map<Environment, ISecretProvider>();
  private credentialCache = new Map<string, { credential: DatabaseCredential; cachedAt: Date }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(
    private configService: ConfigService,
    private auditLogger: AuditLoggerService,
    private securityScanner: SecurityScannerService
  ) {}

  async onModuleInit() {
    await this.initializeSecretProviders();
    await this.securityScanner.scanForHardcodedCredentials();
  }

  private async initializeSecretProviders() {
    const environments = [Environment.DEVELOPMENT, Environment.STAGING, Environment.PRODUCTION];
    
    for (const env of environments) {
      const config = this.configService.get(`secrets.${env}`);
      
      if (config.type === 'aws-secrets') {
        this.secretProviders.set(env, new AwsSecretsProvider(config));
      }
      // Add other providers as needed
    }
  }

  async getCredential(environment: Environment, service: string): Promise<DatabaseCredential> {
    const cacheKey = `${environment}-${service}`;
    const cached = this.credentialCache.get(cacheKey);
    
    if (cached && Date.now() - cached.cachedAt.getTime() < this.cacheTimeout) {
      await this.auditLogger.log({
        operation: 'credential_access',
        resource: service,
        environment,
        success: true,
        metadata: { source: 'cache' }
      });
      
      return cached.credential;
    }

    try {
      const provider = this.secretProviders.get(environment);
      if (!provider) {
        throw new Error(`No secret provider configured for environment: ${environment}`);
      }

      const secretPath = this.buildSecretPath(environment, service);
      const credential = await provider.getSecret(secretPath);
      
      // Cache the credential
      this.credentialCache.set(cacheKey, {
        credential,
        cachedAt: new Date()
      });

      await this.auditLogger.log({
        operation: 'credential_access',
        resource: service,
        environment,
        success: true,
        metadata: { source: 'provider' }
      });

      return credential;
    } catch (error) {
      await this.auditLogger.log({
        operation: 'credential_access',
        resource: service,
        environment,
        success: false,
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  async rotateCredential(environment: Environment, service: string): Promise<CredentialRotationResult> {
    this.logger.log(`Starting credential rotation for ${service} in ${environment}`);
    
    try {
      const provider = this.secretProviders.get(environment);
      if (!provider) {
        throw new Error(`No secret provider configured for environment: ${environment}`);
      }

      const secretPath = this.buildSecretPath(environment, service);
      const result = await provider.rotateSecret(secretPath);
      
      // Clear cache after rotation
      const cacheKey = `${environment}-${service}`;
      this.credentialCache.delete(cacheKey);

      await this.auditLogger.log({
        operation: 'credential_rotation',
        resource: service,
        environment,
        success: true,
        metadata: {
          oldCredentialId: result.oldCredentialId,
          newCredentialId: result.newCredentialId,
          downtime: result.downtime
        }
      });

      this.logger.log(`Credential rotation completed for ${service} with ${result.downtime}ms downtime`);
      return result;
    } catch (error) {
      await this.auditLogger.log({
        operation: 'credential_rotation',
        resource: service,
        environment,
        success: false,
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  async createCredential(environment: Environment, service: string, credential: DatabaseCredential): Promise<void> {
    try {
      const provider = this.secretProviders.get(environment);
      if (!provider) {
        throw new Error(`No secret provider configured for environment: ${environment}`);
      }

      const secretPath = this.buildSecretPath(environment, service);
      await provider.setSecret(secretPath, credential);

      await this.auditLogger.log({
        operation: 'credential_creation',
        resource: service,
        environment,
        success: true
      });

    } catch (error) {
      await this.auditLogger.log({
        operation: 'credential_creation',
        resource: service,
        environment,
        success: false,
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  private buildSecretPath(environment: Environment, service: string): string {
    return `/${environment}/database/${service}`;
  }

  clearCache(): void {
    this.credentialCache.clear();
    this.logger.log('Credential cache cleared');
  }
}