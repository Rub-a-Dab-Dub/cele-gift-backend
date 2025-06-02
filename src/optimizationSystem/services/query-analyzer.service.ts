import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QueryPlan, IndexSuggestion } from '../interfaces/performance.interface';

@Injectable()
export class QueryAnalyzerService {
  private readonly logger = new Logger(QueryAnalyzerService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async analyzeQuery(sql: string, parameters?: any[]): Promise<QueryPlan> {
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
      const result = await this.dataSource.query(explainQuery, parameters);
      
      const plan = result[0]['QUERY PLAN'][0];
      
      return {
        query: sql,
        plan: plan.Plan,
        cost: plan.Plan['Total Cost'],
        planningTime: plan['Planning Time'],
        executionTime: plan['Execution Time'],
      };
    } catch (error) {
      this.logger.error(`Failed to analyze query: ${error.message}`, error.stack);
      throw error;
    }
  }

  async suggestIndexes(queries: string[]): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];
    
    for (const query of queries) {
      try {
        const plan = await this.analyzeQuery(query);
        const indexSuggestions = this.extractIndexSuggestions(plan);
        suggestions.push(...indexSuggestions);
      } catch (error) {
        this.logger.warn(`Could not analyze query for index suggestions: ${error.message}`);
      }
    }
    
    return this.deduplicateAndPrioritize(suggestions);
  }

  private extractIndexSuggestions(plan: QueryPlan): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];
    
    // Analyze plan for sequential scans on large tables
    this.analyzePlanNode(plan.plan, suggestions);
    
    return suggestions;
  }

  private analyzePlanNode(node: any, suggestions: IndexSuggestion[]): void {
    if (!node) return;
    
    // Check for sequential scans
    if (node['Node Type'] === 'Seq Scan' && node['Actual Rows'] > 1000) {
      const tableName = node['Relation Name'];
      const filterConditions = this.extractFilterConditions(node);
      
      if (filterConditions.length > 0) {
        suggestions.push({
          table: tableName,
          columns: filterConditions,
          type: 'btree',
          reason: `Sequential scan on large table (${node['Actual Rows']} rows)`,
          priority: 'high',
          estimatedImprovement: this.calculateEstimatedImprovement(node),
        });
      }
    }
    
    // Check for sort operations
    if (node['Node Type'] === 'Sort' && node['Sort Key']) {
      const sortColumns = node['Sort Key'];
      suggestions.push({
        table: this.extractTableFromSort(node),
        columns: sortColumns,
        type: 'btree',
        reason: 'Sort operation detected',
        priority: 'medium',
        estimatedImprovement: 0.3,
      });
    }
    
    // Recursively analyze child nodes
    if (node['Plans']) {
      for (const childNode of node['Plans']) {
        this.analyzePlanNode(childNode, suggestions);
      }
    }
  }

  private extractFilterConditions(node: any): string[] {
    const conditions: string[] = [];
    
    if (node['Filter']) {
      // Parse filter conditions to extract column names
      const filter = node['Filter'];
      const columnMatches = filter.match(/\b\w+\.\w+\b/g) || [];
      conditions.push(...columnMatches.map(match => match.split('.')[1]));
    }
    
    return [...new Set(conditions)]; // Remove duplicates
  }

  private extractTableFromSort(node: any): string {
    // This is a simplified extraction - in reality, you'd need more sophisticated parsing
    return 'unknown_table';
  }

  private calculateEstimatedImprovement(node: any): number {
    // Simple heuristic based on rows and cost
    const rows = node['Actual Rows'] || 0;
    const cost = node['Total Cost'] || 0;
    
    if (rows > 10000) return 0.8;
    if (rows > 1000) return 0.6;
    if (cost > 1000) return 0.4;
    
    return 0.2;
  }

  private deduplicateAndPrioritize(suggestions: IndexSuggestion[]): IndexSuggestion[] {
    const uniqueSuggestions = new Map<string, IndexSuggestion>();
    
    for (const suggestion of suggestions) {
      const key = `${suggestion.table}.${suggestion.columns.join(',')}`;
      
      if (!uniqueSuggestions.has(key) || 
          this.getPriorityWeight(suggestion.priority) > 
          this.getPriorityWeight(uniqueSuggestions.get(key)!.priority)) {
        uniqueSuggestions.set(key, suggestion);
      }
    }
    
    return Array.from(uniqueSuggestions.values())
      .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
}