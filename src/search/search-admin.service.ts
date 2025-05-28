@Injectable()
export class SearchAdminService {
  private readonly logger = new Logger(SearchAdminService.name);

  constructor(
    @InjectRepository(SearchConfiguration)
    private configRepository: Repository<SearchConfiguration>,
    @InjectRepository(SearchQueryLog)
    private queryLogRepository: Repository<SearchQueryLog>,
    private searchIndexService: SearchIndexService,
    private monitoringService: SearchMonitoringService,
  ) {}

  async rebuildAllIndexes(): Promise<void> {
    this.logger.log('Starting index rebuild process...');
    
    try {
      await this.searchIndexService.optimizeIndexes();
      this.logger.log('Index rebuild completed successfully');
    } catch (error) {
      this.logger.error(`Index rebuild failed: ${error.message}`);
      throw error;
    }
  }

  async getSearchHealth(): Promise<any> {
    const [
      indexStats,
      cacheHitRatio,
      slowQueries,
      analytics
    ] = await Promise.all([
      this.getIndexStats(),
      this.getCacheHitRatio(),
      this.monitoringService.getSlowQueries(1000, 10),
      this.monitoringService.getSearchAnalytics(7),
    ]);

    return {
      indexStats,
      cacheHitRatio,
      slowQueries: slowQueries.length,
      analytics: analytics.slice(0, 7),
      status: this.determineHealthStatus(cacheHitRatio, slowQueries.length),
    };
  }

  private async getIndexStats(): Promise<any> {
    return this.configRepository.query(`
      SELECT 
        indexname,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes 
      WHERE tablename = 'gifts'
      ORDER BY idx_scan DESC
    `);
  }

  private async getCacheHitRatio(): Promise<number> {
    const result = await this.configRepository.query(`
      SELECT 
        round(
          sum(idx_blks_hit) * 100.0 / 
          nullif(sum(idx_blks_hit) + sum(idx_blks_read), 0), 
          2
        ) as hit_ratio
      FROM pg_statio_user_indexes
      WHERE indexrelname LIKE 'idx_gifts%'
    `);

    return result[0]?.hit_ratio || 0;
  }

  private determineHealthStatus(cacheHitRatio: number, slowQueryCount: number): string {
    if (cacheHitRatio < 90 || slowQueryCount > 5) return 'poor';
    if (cacheHitRatio < 95 || slowQueryCount > 2) return 'fair';
    return 'good';
  }

  async updateSearchWeights(entityName: string, weights: Record<string, number>): Promise<void> {
    await this.configRepository.update(
      { entityName },
      { weights, updatedAt: new Date() }
    );
    
    this.logger.log(`Updated search weights for ${entityName}`);
  }
}