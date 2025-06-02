import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository, QueryRunner } from 'typeorm';

export interface MockRepository<T = any> {
  find: jest.MockedFunction<Repository<T>['find']>;
  findOne: jest.MockedFunction<Repository<T>['findOne']>;
  save: jest.MockedFunction<Repository<T>['save']>;
  update: jest.MockedFunction<Repository<T>['update']>;
  delete: jest.MockedFunction<Repository<T>['delete']>;
  count: jest.MockedFunction<Repository<T>['count']>;
  query: jest.MockedFunction<Repository<T>['query']>;
  createQueryBuilder: jest.MockedFunction<Repository<T>['createQueryBuilder']>;
}

export interface MockQueryRunner {
  connect: jest.MockedFunction<QueryRunner['connect']>;
  startTransaction: jest.MockedFunction<QueryRunner['startTransaction']>;
  commitTransaction: jest.MockedFunction<QueryRunner['commitTransaction']>;
  rollbackTransaction: jest.MockedFunction<QueryRunner['rollbackTransaction']>;
  release: jest.MockedFunction<QueryRunner['release']>;
  query: jest.MockedFunction<QueryRunner['query']>;
}

export interface MockDataSource {
  createQueryRunner: jest.MockedFunction<DataSource['createQueryRunner']>;
  getRepository: jest.MockedFunction<DataSource['getRepository']>;
  query: jest.MockedFunction<DataSource['query']>;
  transaction: jest.MockedFunction<DataSource['transaction']>;
}

@Injectable()
export class DatabaseMockFactory {
  private readonly logger = new Logger(DatabaseMockFactory.name);

  createMockRepository<T = any>(): MockRepository<T> {
    return {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      query: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
        getOne: jest.fn(),
        getRawMany: jest.fn(),
        getRawOne: jest.fn(),
        getCount: jest.fn(),
      })),
    };
  }

  createMockQueryRunner(): MockQueryRunner {
    return {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    };
  }

  createMockDataSource(): MockDataSource {
    const mockQueryRunner = this.createMockQueryRunner();
    
    return {
      createQueryRunner: jest.fn(() => mockQueryRunner),
      getRepository: jest.fn(() => this.createMockRepository()),
      query: jest.fn(),
      transaction: jest.fn(),
    };
  }

  setupRepositoryMocks<T>(
    mockRepository: MockRepository<T>,
    entityClass: new () => T,
    mockData: Partial<T>[] = []
  ): void {
    // Setup common repository method mocks
    mockRepository.find.mockResolvedValue(mockData as T[]);
    mockRepository.findOne.mockResolvedValue(mockData[0] as T);
    mockRepository.count.mockResolvedValue(mockData.length);
    
    mockRepository.save.mockImplementation(async (entity: any) => {
      if (Array.isArray(entity)) {
        return entity.map(e => ({ ...e, id: this.generateMockId() }));
      }
      return { ...entity, id: this.generateMockId() };
    });
    
    mockRepository.update.mockResolvedValue({
      affected: 1,
      generatedMaps: [],
      raw: {},
    });
    
    mockRepository.delete.mockResolvedValue({
      affected: 1,
      raw: {},
    });

    // Setup query builder mocks
    const mockQueryBuilder = mockRepository.createQueryBuilder();
    mockQueryBuilder.getMany.mockResolvedValue(mockData as T[]);
    mockQueryBuilder.getOne.mockResolvedValue(mockData[0] as T);
    mockQueryBuilder.getCount.mockResolvedValue(mockData.length);
    mockQueryBuilder.getRawMany.mockResolvedValue(mockData);
    mockQueryBuilder.getRawOne.mockResolvedValue(mockData[0]);
  }

  setupQueryRunnerMocks(
    mockQueryRunner: MockQueryRunner,
    queryResults: Record<string, any> = {}
  ): void {
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);
    
    mockQueryRunner.query.mockImplementation(async (query: string) => {
      // Return predefined results based on query patterns
      for (const [pattern, result] of Object.entries(queryResults)) {
        if (query.toLowerCase().includes(pattern.toLowerCase())) {
          return Array.isArray(result) ? result : [result];
        }
      }
      
      // Default responses for common queries
      if (query.toLowerCase().includes('select count')) {
        return [{ count: '10' }];
      }
      
      if (query.toLowerCase().includes('select') && query.toLowerCase().includes('limit 1')) {
        return [{ id: this.generateMockId(), name: 'Mock Record' }];
      }
      
      if (query.toLowerCase().includes('insert')) {
        return { affectedRows: 1, insertId: this.generateMockId() };
      }
      
      if (query.toLowerCase().includes('update') || query.toLowerCase().includes('delete')) {
        return { affectedRows: 1 };
      }
      
      return [];
    });
  }

  setupDataSourceMocks(
    mockDataSource: MockDataSource,
    repositoryMocks: Record<string, MockRepository> = {},
    queryResults: Record<string, any> = {}
  ): void {
    const mockQueryRunner = this.createMockQueryRunner();
    this.setupQueryRunnerMocks(mockQueryRunner, queryResults);
    
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    
    mockDataSource.getRepository.mockImplementation((entityClass: any) => {
      const entityName = entityClass.name || entityClass;
      return repositoryMocks[entityName] || this.createMockRepository();
    });
    
    mockDataSource.query.mockImplementation(async (query: string) => {
      return mockQueryRunner.query(query);
    });
    
    mockDataSource.transaction.mockImplementation(async (callback: any) => {
      return await callback(mockQueryRunner);
    });
  }

  private generateMockId(): string {
    return `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Factory methods for common test scenarios
  createDatabaseTestMocks(): {
    dataSource: MockDataSource;
    queryRunner: MockQueryRunner;
    repositories: Record<string, MockRepository>;
  } {
    const dataSource = this.createMockDataSource();
    const queryRunner = this.createMockQueryRunner();
    const repositories: Record<string, MockRepository> = {};
    
    this.setupQueryRunnerMocks(queryRunner);
    this.setupDataSourceMocks(dataSource, repositories);
    
    return { dataSource, queryRunner, repositories };
  }

  createTransactionMocks(shouldFail: boolean = false): {
    dataSource: MockDataSource;
    queryRunner: MockQueryRunner;
  } {
    const { dataSource, queryRunner } = this.createDatabaseTestMocks();
    
    if (shouldFail) {
      queryRunner.commitTransaction.mockRejectedValue(new Error('Transaction failed'));
    }
    
    return { dataSource, queryRunner };
  }

  createSlowQueryMocks(delay: number = 1000): {
    dataSource: MockDataSource;
    queryRunner: MockQueryRunner;
  } {
    const { dataSource, queryRunner } = this.createDatabaseTestMocks();
    
    queryRunner.query.mockImplementation(async (query: string) => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return [{ id: this.generateMockId(), result: 'slow query result' }];
    });
    
    return { dataSource, queryRunner };
  }

  createConnectionPoolMocks(maxConnections: number = 10): {
    dataSource: MockDataSource;
    queryRunners: MockQueryRunner[];
  } {
    const dataSource = this.createMockDataSource();
    const queryRunners: MockQueryRunner[] = [];
    
    for (let i = 0; i < maxConnections; i++) {
      const queryRunner = this.createMockQueryRunner();
      this.setupQueryRunnerMocks(queryRunner);
      queryRunners.push(queryRunner);
    }
    
    let connectionCount = 0;
    dataSource.createQueryRunner.mockImplementation(() => {
      if (connectionCount >= maxConnections) {
        throw new Error('Connection pool exhausted');
      }
      return queryRunners[connectionCount++];
    });
    
    return { dataSource, queryRunners };
  }

  // Helper methods for assertion verification
  verifyRepositoryCall(
    mockRepository: MockRepository,
    method: keyof MockRepository,
    times: number = 1
  ): void {
    expect(mockRepository[method]).toHaveBeenCalledTimes(times);
  }

  verifyQueryRunnerCall(
    mockQueryRunner: MockQueryRunner,
    method: keyof MockQueryRunner,
    times: number = 1
  ): void {
    expect(mockQueryRunner[method]).toHaveBeenCalledTimes(times);
  }

  verifyTransactionFlow(mockQueryRunner: MockQueryRunner): void {
    expect(mockQueryRunner.connect).toHaveBeenCalled();
    expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
  }

  verifyRollbackFlow(mockQueryRunner: MockQueryRunner): void {
    expect(mockQueryRunner.connect).toHaveBeenCalled();
    expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
  }

  getQueryCallHistory(mockQueryRunner: MockQueryRunner): string[] {
    return mockQueryRunner.query.mock.calls.map(call => call[0]);
  }

  getRepositoryCallHistory(
    mockRepository: MockRepository,
    method: keyof MockRepository
  ): any[][] {
    return (mockRepository[method] as jest.MockedFunction<any>).mock.calls;
  }

  resetAllMocks(mocks: {
    dataSource?: MockDataSource;
    queryRunner?: MockQueryRunner;
    repositories?: Record<string, MockRepository>;
  }): void {
    if (mocks.dataSource) {
      Object.values(mocks.dataSource).forEach(mock => {
        if (jest.isMockFunction(mock)) {
          mock.mockReset();
        }
      });
    }
    
    if (mocks.queryRunner) {
      Object.values(mocks.queryRunner).forEach(mock => {
        if (jest.isMockFunction(mock)) {
          mock.mockReset();
        }
      });
    }
    
    if (mocks.repositories) {
      Object.values(mocks.repositories).forEach(repo => {
        Object.values(repo).forEach(mock => {
          if (jest.isMockFunction(mock)) {
            mock.mockReset();
          }
        });
      });
    }
  }
}