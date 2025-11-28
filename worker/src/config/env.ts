// IMPORTANT: Load environment variables FIRST before any validation
// This ensures .env file is loaded before we try to access process.env
const dotenv = require('dotenv')
const path = require('path')

// Load .env file from worker directory
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
 * Worker Environment Configuration
 * Validates required variables at startup to fail fast
 */
export const config = {
  redis: {
    url: requireEnv('REDIS_URL', 'Redis connection URL for job queue'),
  },
  
  supabase: {
    url: requireEnv('SUPABASE_URL', 'Supabase project URL'),
    storageKey: requireEnv('SUPABASE_KEY', 'Supabase storage key') || optionalEnv('SUPABASE_STORAGE_KEY', ''),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role key') || optionalEnv('SUPABASE_SERVICE_KEY', ''),
  },
  
  // Optional AI services (features degrade gracefully if missing)
  // Llama and Qwen default to local Ollama (no API key required)
  llama: {
    apiKey: optionalEnv('LLAMA_API_KEY', ''), // Optional for local Ollama
    apiUrl: optionalEnv('LLAMA_API_URL', 'http://localhost:11434/v1'), // Default to local Ollama
    model: optionalEnv('LLAMA_MODEL', 'llama3.2:latest'),
  },
  qwen: {
    apiKey: optionalEnv('QWEN_API_KEY', ''), // Optional for local Ollama
    apiUrl: optionalEnv('QWEN_API_URL', 'http://localhost:11434/v1'), // Default to local Ollama
    model: optionalEnv('QWEN_MODEL', 'qwen2.5:latest'),
  },
  // Qwen-Coder models (Ollama)
  qwenCoder: {
    // Mid-reasoning model - Qwen-Coder-7B (replaces Qwen 32B)
    apiUrl7b: optionalEnv('QWEN_CODER_7B_API_URL', 'http://localhost:11434/v1'),
    apiKey7b: optionalEnv('QWEN_CODER_7B_API_KEY', 'ollama'),
    model7b: optionalEnv('QWEN_CODER_7B_MODEL', 'qwen2.5-coder:7b'),
    // Heavy reasoning model - Qwen-Coder-14B (replaces Llama 4 Scout)
    apiUrl14b: optionalEnv('QWEN_CODER_14B_API_URL', 'http://localhost:11434/v1'),
    apiKey14b: optionalEnv('QWEN_CODER_14B_API_KEY', 'ollama'),
    model14b: optionalEnv('QWEN_CODER_14B_MODEL', 'qwen2.5-coder:14b'),
  },
  
  pinecone: {
    apiKey: optionalEnv('PINECONE_API_KEY', ''),
    indexName: optionalEnv('PINECONE_INDEX_NAME', 'testlattice'),
  },
  
  testRunners: {
    playwrightGridUrl: optionalEnv('PLAYWRIGHT_GRID_URL', 'http://localhost:4444'),
    appiumUrl: optionalEnv('APPIUM_URL', 'http://localhost:4723'),
  },
  
  worker: {
    concurrency: parseInt(optionalEnv('WORKER_CONCURRENCY', '5'), 10),
    maxTestDurationMinutes: parseInt(optionalEnv('MAX_TEST_DURATION_MINUTES', '30'), 10),
    blockUnnecessaryResources: process.env.BLOCK_UNNECESSARY_RESOURCES === 'true',
  },
  
  // Optional monitoring
  sentry: {
    dsn: optionalEnv('SENTRY_DSN', ''),
  },
  
  api: {
    // Optional: Defaults to localhost API server
    url: optionalEnv('API_URL', 'http://localhost:3001'),
  },
  
  logging: {
    level: optionalEnv('LOG_LEVEL', 'info'),
  },

  diagnosis: {
    maxPages: parseInt(optionalEnv('DIAGNOSIS_MAX_PAGES', '4'), 10),
    navigationDelayMs: parseInt(optionalEnv('DIAGNOSIS_NAVIGATION_DELAY_MS', '500'), 10),
  },

  notifications: {
    slackWebhook: optionalEnv('SLACK_WEBHOOK_URL', ''),
    frontendBaseUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),
  },

  vision: {
    validatorInterval: parseInt(optionalEnv('VISION_VALIDATOR_INTERVAL', '0'), 10),
    model: optionalEnv('VISION_MODEL', 'gpt-4-vision-preview'),
  },

  heuristics: {
    loginUsername: optionalEnv('TEST_USERNAME', '') || optionalEnv('TEST_EMAIL', 'demo@example.com'),
    loginPassword: optionalEnv('TEST_PASSWORD', 'TestLattice!123'),
  },

  // WebRTC/LiveKit streaming (optional)
  streaming: {
    enabled: process.env.ENABLE_STREAMING === 'true',
    frameServerPort: parseInt(optionalEnv('FRAME_SERVER_PORT', '8080'), 10),
    livekitUrl: optionalEnv('LIVEKIT_URL', ''),
    livekitApiKey: optionalEnv('LIVEKIT_API_KEY', ''),
    livekitApiSecret: optionalEnv('LIVEKIT_API_SECRET', ''),
  },

  // Intelligent Retry Layer (IRL) configuration
  irl: {
    maxRetries: parseInt(optionalEnv('IRL_MAX_RETRIES', '3'), 10),
    initialDelay: parseInt(optionalEnv('IRL_INITIAL_DELAY', '500'), 10),
    maxDelay: parseInt(optionalEnv('IRL_MAX_DELAY', '5000'), 10),
    enableVisionMatching: process.env.IRL_ENABLE_VISION_MATCHING !== 'false',
    enableAIAlternatives: process.env.IRL_ENABLE_AI_ALTERNATIVES !== 'false',
  },
}

