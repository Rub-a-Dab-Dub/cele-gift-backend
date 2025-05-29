export class SearchResultDto<T> {
    @ApiProperty({ description: 'Search results' })
    items: T[];
  
    @ApiProperty({ description: 'Total number of results' })
    total: number;
  
    @ApiProperty({ description: 'Search facets' })
    facets: SearchFacetsDto;
  
    @ApiProperty({ description: 'Search suggestions', type: [String] })
    suggestions: string[];
  
    @ApiProperty({ description: 'Query execution time in milliseconds' })
    executionTime: number;
  
    @ApiProperty({ description: 'Current page number' })
    page: number;
  
    @ApiProperty({ description: 'Total number of pages' })
    totalPages: number;
  }
  
  export class SearchFacetsDto {
    @ApiProperty({ description: 'Category facets' })
    categories: FacetItemDto[];
  
    @ApiProperty({ description: 'Price range facets' })
    priceRanges: FacetItemDto[];
  
    @ApiProperty({ description: 'Tag facets' })
    tags: FacetItemDto[];
  }
  
  export class FacetItemDto {
    @ApiProperty({ description: 'Facet value' })
    value: string;
  
    @ApiProperty({ description: 'Number of items with this value' })
    count: number;
  }
  