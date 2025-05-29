import { SearchQuery } from '../types'; // Adjust the path to where SearchQuery is defined
import { SearchService } from '../../services/search.service'; // Adjusted the path to the correct location

describe('SearchService Performance', () => {
    let service: SearchService;
    
    let mockQueryBuilder: any;

    beforeEach(async () => {
      // Setup similar to above
      mockQueryBuilder = {
        getRawAndEntities: jest.fn(),
      };
    });
  
    it('should execute search within acceptable time limits', async () => {
      const searchQuery: SearchQuery = {
        q: 'test query',
        filters: {},
        facets: ['categories'],
        sort: { field: 'relevance', direction: 'desc' },
        pagination: { page: 1, limit: 20 },
        highlight: true,
        suggestions: true,
      };
  
      const startTime = Date.now();
      await service.searchGifts(searchQuery);
      const executionTime = Date.now() - startTime;
  
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  
    it('should handle large result sets efficiently', async () => {
      const searchQuery: SearchQuery = {
        q: 'popular',
        filters: {},
        facets: ['categories', 'priceRanges', 'tags'],
        sort: { field: 'relevance', direction: 'desc' },
        pagination: { page: 1, limit: 100 },
        highlight: true,
        suggestions: true,
      };
  
      // Mock large dataset
      const largeResultSet = Array.from({ length: 100 }, (_, i) => ({
        id: `gift-${i}`,
        title: `Gift ${i}`,
        description: `Description for gift ${i}`,
      }));
  
      mockQueryBuilder.getRawAndEntities.mockResolvedValue({
        entities: largeResultSet,
        raw: largeResultSet.map((_, i) => ({
          title_highlight: `Gift ${i}`,
          description_highlight: `Description for gift ${i}`,
          search_rank: Math.random(),
        })),
      });
  
      const result = await service.searchGifts(searchQuery);
      expect(result.items).toHaveLength(100);
    });
  });
  