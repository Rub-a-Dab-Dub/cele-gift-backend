import { Injectable } from '@nestjs/common';
import { DatabaseCredential, CredentialRotationResult } from '../../interfaces/credential.interface';
import { ISecretProvider, SecretProviderConfig } from '../../interfaces/secret-provider.interface';

@Injectable()
export abstract class BaseSecretProvider implements ISecretProvider {
  protected config: SecretProviderConfig;

  constructor(config: SecretProviderConfig) {
    this.config = config;
  }

  abstract getSecret(path: string): Promise<DatabaseCredential>;
  abstract setSecret(path: string, credential: DatabaseCredential): Promise<void>;
  abstract deleteSecret(path: string): Promise<void>;
  abstract listSecrets(prefix?: string): Promise<string[]>;

  async rotateSecret(path: string): Promise<CredentialRotationResult> {
    const startTime = Date.now();
    const oldCredential = await this.getSecret(path);
    
    try {
      const newCredential = await this.generateNewCredential(oldCredential);
      await this.setSecret(path, newCredential);
      
      // Test new credential before deactivating old one
      await this.validateCredential(newCredential);
      
      const endTime = Date.now();
      
      return {
        success: true,
        oldCredentialId: oldCredential.id,
        newCredentialId: newCredential.id,
        rotatedAt: new Date(),
        downtime: endTime - startTime
      };
    } catch (error) {
      throw new Error(`Credential rotation failed: ${error.message}`);
    }
  }

  protected async generateNewCredential(oldCredential: DatabaseCredential): Promise<DatabaseCredential> {
    const newPassword = this.generateSecurePassword();
    
    return {
      ...oldCredential,
      id: this.generateCredentialId(),
      password: newPassword,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
  }

  protected generateSecurePassword(length: number = 32): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  protected generateCredentialId(): string {
    return `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected abstract validateCredential(credential: DatabaseCredential): Promise<void>;
}