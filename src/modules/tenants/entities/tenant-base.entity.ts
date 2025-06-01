export abstract class TenantBaseEntity {
    tenantId?: string; // Only for row-level isolation
  }