@Injectable()
export class EnhancedSearchService extends SearchService {
  constructor(
    @InjectRepository(Gift)
    giftRepository: Repository<Gift>,
    searchIndexService: SearchIndexService,
    monitoringService: SearchMonitoringService,
    private cacheService: SearchCacheService,
  ) {
    super(giftRepository, searchIndexService, monitoringService);
  }

  async searchGifts(searchQuery: SearchQuery): Promise<SearchResult<HighlightedResult<Gift>>> {
    // Try cache first for non-personalized queries
    const cacheKey = this.cacheService.generateCacheKey(searchQuery);
    const cached = await this.cacheService.get<SearchResult<HighlightedResult<Gift>>>(cacheKey);
    
    if (cached) {
      this.logger.debug('Returning cached search results');
      return cached;
    }

    // Execute search
    const result = await super.searchGifts(searchQuery);

    // Cache the result if it's cacheable
    if (this.isCacheable(searchQuery)) {
      await this.cacheService.set(cacheKey, result);
    }

    return result;
  }

  private isCacheable(searchQuery: SearchQuery): boolean {
    // Don't cache personalized or very specific queries
    return !searchQuery.filters.users?.length && 
           searchQuery.pagination.page <= 3 && 
           searchQuery.q.length >= 2;
  }
}
