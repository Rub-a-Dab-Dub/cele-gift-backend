export interface ISecretProvider {
    getSecret(path: string): Promise<DatabaseCredential>;
    setSecret(path: string, credential: DatabaseCredential): Promise<void>;
    rotateSecret(path: string): Promise<CredentialRotationResult>;
    deleteSecret(path: string): Promise<void>;
    listSecrets(prefix?: string): Promise<string[]>;
  }
  
  export interface SecretProviderConfig {
    type: 'vault' | 'aws-secrets' | 'azure-keyvault';
    endpoint?: string;
    region?: string;
    credentials?: Record<string, any>;
    encryption?: {
      enabled: boolean;
      algorithm: string;
      keyId?: string;
    };
  }