export const config = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    storageKey: process.env.SUPABASE_KEY || process.env.SUPABASE_STORAGE_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
  },
  
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY || '',
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
  },
  
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY || '',
    indexName: process.env.PINECONE_INDEX_NAME || 'testlattice',
  },
  
  testRunners: {
    playwrightGridUrl: process.env.PLAYWRIGHT_GRID_URL || 'http://localhost:4444',
    appiumUrl: process.env.APPIUM_URL || 'http://localhost:4723',
  },
  
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    maxTestDurationMinutes: parseInt(process.env.MAX_TEST_DURATION_MINUTES || '30', 10),
  },
  
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },
  
  api: {
    url: process.env.API_URL || 'http://localhost:3001',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
}

