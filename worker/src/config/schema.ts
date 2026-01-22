/**
 * Configuration Schema - Zod Validation
 * Issue #3: Centralized config with validation
 * 
 * All environment variables validated at startup.
 * Worker fails to start if required vars missing.
 */

import { z } from 'zod'

// OpenAI Configuration
const OpenAIConfigSchema = z.object({
    apiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
    apiKeyRegistered: z.string().optional(),
    apiKeyBehavior: z.string().optional(),
    apiUrl: z.string().url().default('https://api.openai.com/v1'),
    model: z.string().default('gpt-5-mini'),
    temperature: z.number().min(0).max(2).default(0.3),
    maxTokens: z.number().int().positive().default(4096),
    orgId: z.string().optional(),
})

// Gemini Configuration
const GeminiConfigSchema = z.object({
    apiKey: z.string().optional(),
    model: z.string().default('gemini-1.5-flash'),
})

// Vision Configuration
const VisionConfigSchema = z.object({
    model: z.string().default('gpt-4o'),
    endpoint: z.string().url().default('https://api.openai.com/v1/chat/completions'),
    interval: z.number().int().default(5),
    onError: z.boolean().default(true),
    onIRLFallback: z.boolean().default(true),
})

// Redis Configuration
const RedisConfigSchema = z.object({
    url: z.string().default('redis://localhost:6379'),
    maxRetries: z.number().int().default(3),
})

// Supabase Configuration
const SupabaseConfigSchema = z.object({
    url: z.string().url({ message: 'SUPABASE_URL is required' }),
    anonKey: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
    serviceRoleKey: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
    storageBucket: z.string().default('artifacts'),
})

// Wasabi Configuration
const WasabiConfigSchema = z.object({
    enabled: z.boolean().default(false),
    accessKey: z.string().optional(),
    secretKey: z.string().optional(),
    bucket: z.string().optional(),
    region: z.string().default('us-central-1'),
    endpoint: z.string().optional(),
})

// API Configuration
const ApiConfigSchema = z.object({
    url: z.string().url().default('http://localhost:3001'),
    internalKey: z.string().optional(),
})

// Limits Configuration - Issue #10: Centralized constants
const LimitsConfigSchema = z.object({
    guestMaxSteps: z.number().int().default(25),
    registeredMaxSteps: z.number().int().default(100),
    diagnosisPageLimit: z.number().int().default(5),
    visionCallsPerTest: z.number().int().default(10),
    actionTimeoutMs: z.number().int().default(30000),
    pageLoadTimeoutMs: z.number().int().default(60000),
})

// Feature Flags
const FeaturesConfigSchema = z.object({
    enableVisionValidation: z.boolean().default(true),
    enablePinecone: z.boolean().default(false),
    enableBehaviorTests: z.boolean().default(true),
    enableWasabi: z.boolean().default(false),
    // Rate limiter modes: 'shadow' | 'soft' | 'full'
    rateLimiterMode: z.enum(['shadow', 'soft', 'full']).default('shadow'),
})

// Platform Safety Limits - Global ceiling
const PlatformLimitsSchema = z.object({
    maxTokensPerHour: z.number().int().default(10_000_000),
    maxConcurrentAICalls: z.number().int().default(100),
    maxQueuedTests: z.number().int().default(500),
})

// Log Level
const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']).default('info')

// Complete Config Schema
export const ConfigSchema = z.object({
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    logLevel: LogLevelSchema,
    openai: OpenAIConfigSchema,
    gemini: GeminiConfigSchema,
    vision: VisionConfigSchema,
    redis: RedisConfigSchema,
    supabase: SupabaseConfigSchema,
    wasabi: WasabiConfigSchema,
    api: ApiConfigSchema,
    limits: LimitsConfigSchema,
    features: FeaturesConfigSchema,
    platform: PlatformLimitsSchema,
})

export type Config = z.infer<typeof ConfigSchema>
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>
export type GeminiConfig = z.infer<typeof GeminiConfigSchema>
export type VisionConfig = z.infer<typeof VisionConfigSchema>
export type RedisConfig = z.infer<typeof RedisConfigSchema>
export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>
export type WasabiConfig = z.infer<typeof WasabiConfigSchema>
export type LimitsConfig = z.infer<typeof LimitsConfigSchema>
export type FeaturesConfig = z.infer<typeof FeaturesConfigSchema>
export type PlatformLimits = z.infer<typeof PlatformLimitsSchema>
