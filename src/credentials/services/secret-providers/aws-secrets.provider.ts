import { Injectable, Logger } from '@nestjs/common';
import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand, DeleteSecretCommand, ListSecretsCommand } from '@aws-sdk/client-secrets-manager';
import { BaseSecretProvider } from './base-secret.provider';
import { DatabaseCredential } from '../../interfaces/credential.interface';
import * as mysql from 'mysql2/promise';

@Injectable()
export class AwsSecretsProvider extends BaseSecretProvider {
  private readonly logger = new Logger(AwsSecretsProvider.name);
  private client: SecretsManagerClient;

  constructor(config: any) {
    super(config);
    this.client = new SecretsManagerClient({
      region: config.region || 'us-east-1',
      credentials: config.credentials
    });
  }

  async getSecret(path: string): Promise<DatabaseCredential> {
    try {
      const command = new GetSecretValueCommand({ SecretId: path });
      const response = await this.client.send(command);
      
      if (!response.SecretString) {
        throw new Error('Secret value not found');
      }

      return JSON.parse(response.SecretString);
    } catch (error) {
      this.logger.error(`Failed to get secret from AWS: ${error.message}`);
      throw error;
    }
  }

  async setSecret(path: string, credential: DatabaseCredential): Promise<void> {
    try {
      const command = new PutSecretValueCommand({
        SecretId: path,
        SecretString: JSON.stringify(credential)
      });
      
      await this.client.send(command);
      this.logger.log(`Secret updated in AWS Secrets Manager: ${path}`);
    } catch (error) {
      this.logger.error(`Failed to set secret in AWS: ${error.message}`);
      throw error;
    }
  }

  async deleteSecret(path: string): Promise<void> {
    try {
      const command = new DeleteSecretCommand({ SecretId: path });
      await this.client.send(command);
      this.logger.log(`Secret deleted from AWS Secrets Manager: ${path}`);
    } catch (error) {
      this.logger.error(`Failed to delete secret from AWS: ${error.message}`);
      throw error;
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    try {
      const command = new ListSecretsCommand({});
      const response = await this.client.send(command);
      
      let secrets = response.SecretList?.map(secret => secret.Name || '') || [];
      
      if (prefix) {
        secrets = secrets.filter(name => name.startsWith(prefix));
      }
      
      return secrets;
    } catch (error) {
      this.logger.error(`Failed to list secrets from AWS: ${error.message}`);
      throw error;
    }
  }

  protected async validateCredential(credential: DatabaseCredential): Promise<void> {
    try {
      const connection = await mysql.createConnection({
        host: credential.host,
        port: credential.port,
        user: credential.username,
        password: credential.password,
        database: credential.database,
        ssl: { rejectUnauthorized: false }
      });
      
      await connection.execute('SELECT 1');
      await connection.end();
      
      this.logger.log('Credential validation successful');
    } catch (error) {
      this.logger.error(`Credential validation failed: ${error.message}`);
      throw new Error('Invalid database credential');
    }
  }
}