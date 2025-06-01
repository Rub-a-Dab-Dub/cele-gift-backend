export interface DatabaseCredential {
    id: string;
    environment: Environment;
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    connectionString?: string;
    createdAt: Date;
    expiresAt: Date;
    rotationSchedule: string;
    isActive: boolean;
    permissions: DatabasePermission[];
  }
  
  export interface DatabasePermission {
    resource: string;
    actions: DatabaseAction[];
    conditions?: Record<string, any>;
  }
  
  export interface CredentialRotationResult {
    success: boolean;
    oldCredentialId: string;
    newCredentialId: string;
    rotatedAt: Date;
    downtime: number;
  }
  
  export enum DatabaseAction {
    SELECT = 'SELECT',
    INSERT = 'INSERT',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    CREATE = 'CREATE',
    DROP = 'DROP',
    ALTER = 'ALTER',
    EXECUTE = 'EXECUTE'
  }
  
  export enum Environment {
    DEVELOPMENT = 'development',
    STAGING = 'staging',
    PRODUCTION = 'production'
  }