export interface IAuditLog {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  userId?: string;
  previousData?: any;
  newData?: any;
  metadata?: Record<string, any>;
  timestamp: Date;
  transactionId?: string;
}