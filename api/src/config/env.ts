export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  
  // Stripe removed - not needed
  
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY || '',
  },
  
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY || '',
    indexName: process.env.PINECONE_INDEX_NAME || 'testlattice',
    host: process.env.PINECONE_HOST || '',
    region: process.env.PINECONE_REGION || 'us-east-1',
  },
  
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },
  
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || `http://${process.env.HOST || 'localhost'}:${parseInt(process.env.PORT || '3001', 10)}`,
}

