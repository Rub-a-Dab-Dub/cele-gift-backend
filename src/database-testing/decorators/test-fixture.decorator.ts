export interface FixtureOptions {
    name: string;
    dependencies?: string[];
    order?: number;
    cleanup?: boolean;
  }
  
  export const FIXTURE_METADATA = 'fixture-metadata';
  
  export const TestFixture = (options: FixtureOptions) => {
    return SetMetadata(FIXTURE_METADATA, options);
  };