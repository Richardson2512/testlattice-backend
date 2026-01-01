// IMPORTANT: Load environment variables FIRST before any validation
// This ensures .env file is loaded before we try to access process.env
const dotenv = require('dotenv')
const path = require('path')

// Load .env file from api directory
const envPath = path.resolve(process.cwd(), '.env')
const result = dotenv.config({ path: envPath })

// Log for debugging in development
if (process.env.NODE_ENV === 'development' && result.error) {
  console.warn('⚠️  Warning: Could not load .env file:', result.error.message)
  console.warn('   Looking for .env at:', envPath)
}

/**
 * Environment Variable Validation Utility
 * Throws error at startup if required variables are missing
 */
function requireEnv(key: string, description?: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}${description ? ` (${description})` : ''}`
    )
  }
  return value
}

/**
 * Optional environment variable with default value
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

/**
 * Environment Configuration
 * Validates required variables at startup to fail fast
 */
export const config = {
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  host: optionalEnv('HOST', '0.0.0.0'),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),

  supabase: {
    url: requireEnv('SUPABASE_URL', 'Supabase project URL'),
    // Relaxed requirement: Allow empty string if user is using Wasabi or only Service Role Key
    key: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role key for admin operations'),
  },

  redis: {
    // Optional: Falls back to local Redis for development
    url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
  },

  // Optional AI/ML services (features degrade gracefully if missing)
  pinecone: {
    apiKey: optionalEnv('PINECONE_API_KEY', ''),
    indexName: optionalEnv('PINECONE_INDEX_NAME', 'Rihario'),
    host: optionalEnv('PINECONE_HOST', ''),
    region: optionalEnv('PINECONE_REGION', 'us-east-1'),
  },

  // Optional monitoring (graceful degradation)
  sentry: {
    dsn: optionalEnv('SENTRY_DSN', ''),
  },

  appUrl: optionalEnv('APP_URL', 'https://Rihario-7ip77vn43-pricewises-projects.vercel.app'),
  apiUrl: optionalEnv('API_URL', `http://${process.env.HOST || 'localhost'}:${parseInt(process.env.PORT || '3001', 10)}`),

  // OpenRouter for fix prompt generation
  openRouter: {
    apiKey: optionalEnv('OPENROUTER_API_KEY', ''),
  },
}

