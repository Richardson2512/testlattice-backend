// IMPORTANT: Load environment variables FIRST before any validation
// This ensures .env file is loaded before we try to access process.env
const dotenv = require("dotenv");
const path = require("path");

// Load .env file from worker directory
const envPath = path.resolve(process.cwd(), ".env");
const result = dotenv.config({ path: envPath });

// Log for debugging in development
if (process.env.NODE_ENV === "development" && result.error) {
  console.warn("⚠️  Warning: Could not load .env file:", result.error.message);
  console.warn("   Looking for .env at:", envPath);
}

/**
 * Environment Variable Validation Utility
 * Throws error at startup if required variables are missing
 */
function requireEnv(key: string, description?: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}${
        description ? ` (${description})` : ""
      }`
    );
  }
  return value;
}

/**
 * Optional environment variable with default value
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Worker Environment Configuration
 * Validates required variables at startup to fail fast
 */
export const config = {
  redis: {
    url: requireEnv("REDIS_URL", "Redis connection URL for job queue"),
  },

  supabase: {
    url: requireEnv('SUPABASE_URL', 'Supabase project URL'),
    // Relaxed requirement: Allow empty string if user is using Wasabi or only Service Role Key
    storageKey: process.env.SUPABASE_KEY || process.env.SUPABASE_STORAGE_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role key'),
  },

  // Unified Brain Service - GPT-5 Mini for text/reasoning
  // GPT-4o is used separately for visual analysis (see vision config)
  openai: {
    apiUrl: optionalEnv("OPENAI_API_URL", "https://api.openai.com/v1"),
    apiKey: optionalEnv("OPENAI_API_KEY", ""),
    model: optionalEnv("OPENAI_MODEL", "gpt-4o"),
    temperature: parseFloat(optionalEnv("OPENAI_TEMPERATURE", "0.3")),
    maxTokens: parseInt(optionalEnv("OPENAI_MAX_TOKENS", "4096"), 10),
    orgId: optionalEnv("OPENAI_ORG_ID", ""),
  },

  pinecone: {
    apiKey: optionalEnv("PINECONE_API_KEY", ""),
    indexName: optionalEnv("PINECONE_INDEX_NAME", "Rihario"),
  },

  testRunners: {
    playwrightGridUrl: optionalEnv(
      "PLAYWRIGHT_GRID_URL",
      "http://localhost:4444"
    ),
    appiumUrl: optionalEnv("APPIUM_URL", "http://localhost:4723"),
    appiumEnabled: process.env.ENABLE_APPIUM === "true", // Disabled by default
  },

  worker: {
    // Default concurrency increased for production workloads
    // Each job uses browser pool (limited by MAX_BROWSER_SESSIONS)
    concurrency: parseInt(optionalEnv("WORKER_CONCURRENCY", "10"), 10),
    maxTestDurationMinutes: parseInt(
      optionalEnv("MAX_TEST_DURATION_MINUTES", "30"),
      10
    ),
    blockUnnecessaryResources:
      process.env.BLOCK_UNNECESSARY_RESOURCES === "true",
  },

  // Optional monitoring
  sentry: {
    dsn: optionalEnv("SENTRY_DSN", ""),
  },

  api: {
    // Optional: Defaults to localhost API server
    url: optionalEnv("API_URL", "http://localhost:3001"),
  },

  logging: {
    level: optionalEnv("LOG_LEVEL", "info"),
  },

  diagnosis: {
    maxPages: parseInt(optionalEnv("DIAGNOSIS_MAX_PAGES", "4"), 10),
    navigationDelayMs: parseInt(
      optionalEnv("DIAGNOSIS_NAVIGATION_DELAY_MS", "500"),
      10
    ),
  },

  notifications: {
    slackWebhook: optionalEnv("SLACK_WEBHOOK_URL", ""),
    frontendBaseUrl: optionalEnv(
      "FRONTEND_URL",
      "https://Rihario-7ip77vn43-pricewises-projects.vercel.app"
    ),
  },

  vision: {
    validatorInterval: parseInt(
      optionalEnv("VISION_VALIDATOR_INTERVAL", "0"),
      10
    ),
    model: optionalEnv("VISION_MODEL", "gpt-4o"), // Updated to GPT-4o
    interval: parseInt(optionalEnv("VISION_INTERVAL", "5"), 10), // Legacy: Every N steps (deprecated - Phase 1 optimization)
    onError: process.env.VISION_ON_ERROR !== "false", // Use on errors
    onIRLFallback: process.env.VISION_ON_IRL !== "false", // Use when IRL fails
    // Phase 1: Optimized usage
    onFinalStep: process.env.VISION_ON_FINAL_STEP !== "false", // Use on final assertion (default: true)
    onLayoutShift: process.env.VISION_ON_LAYOUT_SHIFT !== "false", // Use on layout shifts (default: true)
  },

  heuristics: {
    loginUsername:
      optionalEnv("TEST_USERNAME", "") ||
      optionalEnv("TEST_EMAIL", "demo@example.com"),
    loginPassword: optionalEnv("TEST_PASSWORD", "Rihario!123"),
  },

  // WebRTC/LiveKit streaming (optional)
  streaming: {
    enabled: process.env.ENABLE_STREAMING !== "false", // Default to true for Guest Vibe
    frameServerPort: parseInt(optionalEnv("FRAME_SERVER_PORT", "0"), 10), // 0 = ephemeral (avoids EADDRINUSE)
    livekitUrl: optionalEnv("LIVEKIT_URL", ""),
    livekitApiKey: optionalEnv("LIVEKIT_API_KEY", ""),
    livekitApiSecret: optionalEnv("LIVEKIT_API_SECRET", ""),
  },

  // Wasabi S3 Storage (for heavy artifacts: videos, screenshots, traces)
  wasabi: {
    accessKey: optionalEnv("WASABI_ACCESS_KEY", ""),
    secretKey: optionalEnv("WASABI_SECRET_KEY", ""),
    bucket: optionalEnv("WASABI_BUCKET", "livestreamvideo"),
    region: optionalEnv("WASABI_REGION", "us-central-1"),
    endpoint: optionalEnv(
      "WASABI_ENDPOINT",
      "https://s3.us-central-1.wasabisys.com"
    ),
    enabled: !!(process.env.WASABI_ACCESS_KEY && process.env.WASABI_SECRET_KEY),
  },

  // Intelligent Retry Layer (IRL) configuration
  irl: {
    maxRetries: parseInt(optionalEnv("IRL_MAX_RETRIES", "2"), 10),
    initialDelay: parseInt(optionalEnv("IRL_INITIAL_DELAY", "500"), 10),
    maxDelay: parseInt(optionalEnv("IRL_MAX_DELAY", "5000"), 10),
    enableVisionMatching: process.env.IRL_ENABLE_VISION_MATCHING !== "false",
    enableAIAlternatives: process.env.IRL_ENABLE_AI_ALTERNATIVES !== "false",
  },
};
