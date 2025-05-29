import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchService } from '../search.service';
import { SearchIndexService } from '../search-index.service';
import { SearchMonitoringService } from '../search-monitoring.service';
import { Gift } from '../../gifts/entities/gift.entity';
import { SearchQuery } from '../types/search.types';

describe('SearchService', () => {
  let service: SearchService;
  let giftRepository: Repository<Gift>;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getCount: jest.fn(),
      getRawMany: jest.fn(),
      getRawAndEntities: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(Gift),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
            query: jest.fn(),
          },
        },
        {
          provide: SearchIndexService,
          useValue: {
            getConfiguration: jest.fn(),
          },
        },
        {
          provide: SearchMonitoringService,
          useValue: {
            logSearch: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    giftRepository = module.get<Repository<Gift>>(getRepositoryToken(Gift));
  });

  describe('searchGifts', () => {
    it('should execute full-text search with highlighting', async () => {
      const searchQuery: SearchQuery = {
        q: 'birthday gift',
        filters: {
          categories: ['toys'],
          priceRange: { min: 10, max: 100 },
        },
        facets: ['categories'],
        sort: { field: 'relevance', direction: 'desc' },
        pagination: { page: 1, limit: 20 },
        highlight: true,
        suggestions: false,
      };

      // Mock search configuration
      const mockConfig = {
        entityName: 'Gift',
        searchableFields: ['title', 'description'],
        weights: { title: 1.0, description: 0.8 },
        language: 'english',
      };

      jest.spyOn(service['searchIndexService'], 'getConfiguration')
        .mockResolvedValue(mockConfig as any);

      // Mock query results
      mockQueryBuilder.getRawAndEntities.mockResolvedValue({
        entities: [
          {
            id: '1',
            title: 'Birthday Cake Toy',
            description: 'A fun birthday toy',
            price: 25.99,
          },
        ],
        raw: [
          {
            title_highlight: '<b>Birthday</b> Cake Toy',
            description_highlight: 'A fun <b>birthday</b> toy',
            search_rank: 0.8,
          },
        ],
      });

      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { value: 'toys', count: 5 },
      ]);

      const result = await service.searchGifts(searchQuery);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]._highlights).toBeDefined();
      expect(result.items[0]._highlights.title).toContain('<b>Birthday</b>');
      expect(result.total).toBe(1);
      expect(result.facets).toBeDefined();
    });

    it('should handle search without query string', async () => {
      const searchQuery: SearchQuery = {
        q: '',
        filters: { categories: ['electronics'] },
        facets: [],
        sort: { field: 'date', direction: 'desc' },
        pagination: { page: 1, limit: 10 },
        highlight: false,
        suggestions: false,
      };

      mockQueryBuilder.getMany.mockResolvedValue([
        { id: '1', title: 'Smartphone', category: 'electronics' },
      ]);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const result = await service.searchGifts(searchQuery);

      expect(result.items).toHaveLength(1);
      expect(mockQueryBuilder.where).not.toHaveBeenCalledWith(
        expect.stringContaining('@@')
      );
    });
  });
});
