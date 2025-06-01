export interface AuditLog {
    id: string;
    timestamp: Date;
    userId?: string;
    serviceId: string;
    operation: AuditOperation;
    resource: string;
    environment: Environment;
    sourceIp: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
  
  export enum AuditOperation {
    CREDENTIAL_ACCESS = 'credential_access',
    CREDENTIAL_ROTATION = 'credential_rotation',
    CREDENTIAL_CREATION = 'credential_creation',
    CREDENTIAL_DELETION = 'credential_deletion',
    DATABASE_CONNECTION = 'database_connection',
    PERMISSION_GRANT = 'permission_grant',
    PERMISSION_REVOKE = 'permission_revoke',
    SECURITY_SCAN = 'security_scan'
  }