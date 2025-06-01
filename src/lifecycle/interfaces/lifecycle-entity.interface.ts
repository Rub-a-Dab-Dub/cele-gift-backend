export interface ILifecycleEntity {
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  archivedAt?: Date;
  isDeleted: boolean;
  isArchived: boolean;
}