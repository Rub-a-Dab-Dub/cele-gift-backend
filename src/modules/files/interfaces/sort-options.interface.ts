import { SortBy } from '../enums/sort-by.enum';
import { SortOrder } from '../enums/sort-order.enum';

export interface SortOptions {
  sortBy: SortBy;
  sortOrder: SortOrder;
  foldersFirst?: boolean;
  caseSensitive?: boolean;
}