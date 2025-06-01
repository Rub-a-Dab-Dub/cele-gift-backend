import { Injectable } from '@nestjs/common';
import { FileType } from '../enums/file-type.enum';
import { SortBy } from '../enums/sort-by.enum';
import { SortOrder } from '../enums/sort-order.enum';
import { SortOptions } from '../interfaces/sort-options.interface';

export interface FileSystemItem {
  id: string;
  name: string;
  type: FileType;
  size: number;
  extension?: string;
  mimeType?: string;
  path: string;
  parentId?: string;
  createdAt: Date;
  modifiedAt: Date;
  metadata?: Record<string, any>;
  children?: FileSystemItem[];
  sortOrder: number;
}

@Injectable()
export class FileSortingService {
  sortItems(items: FileSystemItem[], options: SortOptions): FileSystemItem[] {
    const { sortBy, sortOrder, foldersFirst = true, caseSensitive = false } = options;
    
    return items.sort((a, b) => {
      // Folders first logic
      if (foldersFirst) {
        if (a.type === FileType.FOLDER && b.type === FileType.FILE) return -1;
        if (a.type === FileType.FILE && b.type === FileType.FOLDER) return 1;
      }
      
      let comparison = 0;
      
      switch (sortBy) {
        case SortBy.NAME:
          comparison = this.compareNames(a.name, b.name, caseSensitive);
          break;
        case SortBy.SIZE:
          comparison = this.compareSizes(a.size, b.size);
          break;
        case SortBy.CREATED_AT:
          comparison = this.compareDates(a.createdAt, b.createdAt);
          break;
        case SortBy.MODIFIED_AT:
          comparison = this.compareDates(a.modifiedAt, b.modifiedAt);
          break;
        case SortBy.TYPE:
          comparison = this.compareTypes(a, b);
          break;
        case SortBy.EXTENSION:
          comparison = this.compareExtensions(a.extension || '', b.extension || '', caseSensitive);
          break;
        default:
          comparison = this.compareNames(a.name, b.name, caseSensitive);
      }
      
      return sortOrder === SortOrder.ASC ? comparison : -comparison;
    });
  }
  
  private compareNames(a: string, b: string, caseSensitive: boolean): number {
    const nameA = caseSensitive ? a : a.toLowerCase();
    const nameB = caseSensitive ? b : b.toLowerCase();
    return nameA.localeCompare(nameB);
  }
  
  private compareSizes(a: number, b: number): number {
    return a - b;
  }
  
  private compareDates(a: Date, b: Date): number {
    return a.getTime() - b.getTime();
  }
  
  private compareTypes(a: FileSystemItem, b: FileSystemItem): number {
    return a.type.localeCompare(b.type);
  }
  
  private compareExtensions(a: string, b: string, caseSensitive: boolean): number {
    const extA = caseSensitive ? a : a.toLowerCase();
    const extB = caseSensitive ? b : b.toLowerCase();
    return extA.localeCompare(extB);
  }
}