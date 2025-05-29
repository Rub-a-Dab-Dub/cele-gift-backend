export interface SearchConfigOptions {
    defaultLanguage: string;
    maxResultsPerPage: number;
    defaultResultsPerPage: number;
    highlightMaxWords: number;
    highlightMinWords: number;
    suggestionThreshold: number;
    cacheTimeout: number;
    slowQueryThreshold: number;
    enableQueryLogging: boolean;
    enablePerformanceMonitoring: boolean;
  }
  
  export const searchConfig: SearchConfigOptions = {
    defaultLanguage: 'english',
    maxResultsPerPage: 100,
    defaultResultsPerPage: 20,
    highlightMaxWords: 35,
    highlightMinWords: 10,
    suggestionThreshold: 0.3,
    cacheTimeout: 300000, // 5 minutes
    slowQueryThreshold: 1000, // 1 second
    enableQueryLogging: true,
    enablePerformanceMonitoring: true,
  };
  