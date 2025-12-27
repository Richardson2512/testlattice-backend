#!/usr/bin/env node
/**
 * Environment Variable Validation Script
 * Checks all required and optional environment variables across the platform
 * Run from project root: node scripts/validate-env.js
 */

const fs = require('fs')
const path = require('path')

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function check(condition, message) {
  if (condition) {
    console.log(`${colors.green}✅${colors.reset} ${message}`)
    return true
  } else {
    console.log(`${colors.red}❌${colors.reset} ${message}`)
    return false
  }
}

function warn(message) {
  console.log(`${colors.yellow}⚠️${colors.reset} ${message}`)
}

function info(message) {
  console.log(`${colors.blue}ℹ️${colors.reset} ${message}`)
}

function section(title) {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.cyan}${title}${colors.reset}`)
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`)
}

// Load environment variables from .env files
function loadEnvFile(dir) {
  const envPath = path.join(dir, '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const env = {}
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
        }
      }
    })
    return env
  }
  return {}
}

// Check if file exists
function fileExists(filePath) {
  return fs.existsSync(filePath)
}

// Main validation
async function validate() {
  console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║        Rihario Platform Environment Validation           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`)

  const apiEnv = loadEnvFile(path.join(__dirname, '../api'))
  const workerEnv = loadEnvFile(path.join(__dirname, '../worker'))
  // Frontend .env.local is in the parent directory (testlattice-main)
  const frontendEnvPath = path.join(__dirname, '../../testlattice-main')
  const frontendEnv = loadEnvFile(frontendEnvPath)

  let allPassed = true
  let criticalIssues = []

  // ============================================================
  // API SERVER ENVIRONMENT VARIABLES
  // ============================================================
  section('API Server Environment Variables')

  const apiRequired = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  apiRequired.forEach(key => {
    const value = apiEnv[key] || process.env[key]
    if (!check(value, `${key} is set`)) {
      allPassed = false
      criticalIssues.push(`API: Missing required variable ${key}`)
    }
  })

  const apiOptional = [
    { key: 'REDIS_URL', default: 'redis://localhost:6379', desc: 'Redis connection (defaults to localhost)' },
    { key: 'PORT', default: '3001', desc: 'API server port' },
    { key: 'HOST', default: '0.0.0.0', desc: 'API server host' },
    { key: 'OPENROUTER_API_KEY', default: '', desc: 'OpenRouter API key (for fix prompts)' },
    { key: 'PINECONE_API_KEY', default: '', desc: 'Pinecone API key (optional)' },
    { key: 'SENTRY_DSN', default: '', desc: 'Sentry DSN (optional)' },
  ]

  apiOptional.forEach(({ key, default: defaultValue, desc }) => {
    const value = apiEnv[key] || process.env[key]
    if (value) {
      check(true, `${key} is set`)
    } else {
      warn(`${key} not set (${desc})`)
    }
  })

  // ============================================================
  // WORKER ENVIRONMENT VARIABLES
  // ============================================================
  section('Worker Environment Variables')

  const workerRequired = [
    'REDIS_URL',
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  workerRequired.forEach(key => {
    const value = workerEnv[key] || process.env[key]
    if (!check(value, `${key} is set`)) {
      allPassed = false
      criticalIssues.push(`Worker: Missing required variable ${key}`)
    }
  })

  const workerOptional = [
    { key: 'TOGETHER_API_KEY', default: '', desc: 'Together.ai API key (for Unified Brain)' },
    { key: 'UNIFIED_BRAIN_API_KEY', default: '', desc: 'Unified Brain API key (alternative)' },
    { key: 'API_URL', default: 'http://localhost:3001', desc: 'API server URL' },
    { key: 'WASABI_ACCESS_KEY', default: '', desc: 'Wasabi access key (for guest artifacts)' },
    { key: 'WASABI_SECRET_KEY', default: '', desc: 'Wasabi secret key' },
    { key: 'WASABI_BUCKET', default: 'livestreamvideo', desc: 'Wasabi bucket name' },
    { key: 'WASABI_REGION', default: 'us-central-1', desc: 'Wasabi region' },
    { key: 'WASABI_ENDPOINT', default: '', desc: 'Wasabi endpoint (auto-generated if not set)' },
    { key: 'PINECONE_API_KEY', default: '', desc: 'Pinecone API key (optional)' },
    { key: 'SENTRY_DSN', default: '', desc: 'Sentry DSN (optional)' },
    { key: 'ENABLE_APPIUM', default: 'false', desc: 'Enable Appium for mobile testing' },
  ]

  workerOptional.forEach(({ key, default: defaultValue, desc }) => {
    const value = workerEnv[key] || process.env[key]
    if (value) {
      check(true, `${key} is set`)
    } else {
      warn(`${key} not set (${desc})`)
    }
  })

  // Check for Together.ai API key (critical for test execution)
  const togetherKey = workerEnv.TOGETHER_API_KEY || workerEnv.UNIFIED_BRAIN_API_KEY || process.env.TOGETHER_API_KEY || process.env.UNIFIED_BRAIN_API_KEY
  if (!togetherKey) {
    warn('TOGETHER_API_KEY or UNIFIED_BRAIN_API_KEY not set - test execution will fail!')
    criticalIssues.push('Worker: Missing TOGETHER_API_KEY (required for AI test execution)')
    allPassed = false
  }

  // ============================================================
  // FRONTEND ENVIRONMENT VARIABLES
  // ============================================================
  section('Frontend Environment Variables')

  const frontendRequired = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  frontendRequired.forEach(key => {
    const value = frontendEnv[key] || process.env[key]
    const isValid = !!value
    if (!check(isValid, `${key} is set`)) {
      allPassed = false
      criticalIssues.push(`Frontend: Missing required variable ${key}`)
    }
  })

  const frontendOptional = [
    { key: 'NEXT_PUBLIC_API_URL', default: 'http://localhost:3001', desc: 'Backend API URL' },
    { key: 'NEXT_PUBLIC_WS_URL', default: 'ws://localhost:3001', desc: 'WebSocket URL' },
  ]

  frontendOptional.forEach(({ key, default: defaultValue, desc }) => {
    const value = frontendEnv[key] || process.env[key]
    if (value) {
      check(true, `${key} is set`)
    } else {
      warn(`${key} not set (${desc})`)
    }
  })

  // ============================================================
  // CROSS-SERVICE CONNECTIONS
  // ============================================================
  section('Cross-Service Connections')

  // Check Redis URL consistency
  const apiRedis = apiEnv.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379'
  const workerRedis = workerEnv.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379'
  if (apiRedis === workerRedis) {
    check(true, 'API and Worker use the same Redis URL')
  } else {
    warn(`Redis URL mismatch: API=${apiRedis}, Worker=${workerRedis}`)
    criticalIssues.push('API and Worker must use the same Redis instance')
    allPassed = false
  }

  // Check API URL consistency
  const apiUrl = apiEnv.API_URL || process.env.API_URL || 'http://localhost:3001'
  const workerApiUrl = workerEnv.API_URL || process.env.API_URL || 'http://localhost:3001'
  const frontendApiUrl = frontendEnv.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  if (workerApiUrl === apiUrl) {
    check(true, 'Worker can reach API server')
  } else {
    warn(`API URL mismatch: Worker expects ${workerApiUrl}, API runs on ${apiUrl}`)
    criticalIssues.push('Worker API_URL must match API server URL')
    allPassed = false
  }

  if (frontendApiUrl === apiUrl || frontendApiUrl.replace('http://', '').replace('https://', '') === apiUrl.replace('http://', '').replace('https://', '')) {
    check(true, 'Frontend can reach API server')
  } else {
    warn(`API URL mismatch: Frontend expects ${frontendApiUrl}, API runs on ${apiUrl}`)
    criticalIssues.push('Frontend NEXT_PUBLIC_API_URL must match API server URL')
    allPassed = false
  }

  // Check Supabase consistency
  const apiSupabaseUrl = apiEnv.SUPABASE_URL || process.env.SUPABASE_URL
  const workerSupabaseUrl = workerEnv.SUPABASE_URL || process.env.SUPABASE_URL
  const frontendSupabaseUrl = frontendEnv.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL

  if (apiSupabaseUrl === workerSupabaseUrl) {
    check(true, 'API and Worker use the same Supabase URL')
  } else {
    warn(`Supabase URL mismatch: API=${apiSupabaseUrl}, Worker=${workerSupabaseUrl}`)
    criticalIssues.push('API and Worker must use the same Supabase project')
    allPassed = false
  }

  if (apiSupabaseUrl === frontendSupabaseUrl) {
    check(true, 'Frontend uses the same Supabase URL')
  } else {
    warn(`Supabase URL mismatch: Frontend=${frontendSupabaseUrl}, API=${apiSupabaseUrl}`)
    criticalIssues.push('Frontend must use the same Supabase project')
    allPassed = false
  }

  // ============================================================
  // WASABI CONFIGURATION (for guest tests)
  // ============================================================
  section('Wasabi Storage Configuration (Guest Tests)')

  const wasabiAccessKey = workerEnv.WASABI_ACCESS_KEY || process.env.WASABI_ACCESS_KEY
  const wasabiSecretKey = workerEnv.WASABI_SECRET_KEY || process.env.WASABI_SECRET_KEY
  const wasabiBucket = workerEnv.WASABI_BUCKET || process.env.WASABI_BUCKET || 'livestreamvideo'
  const wasabiRegion = workerEnv.WASABI_REGION || process.env.WASABI_REGION || 'us-central-1'
  const wasabiEndpoint = workerEnv.WASABI_ENDPOINT || process.env.WASABI_ENDPOINT

  if (wasabiAccessKey && wasabiSecretKey) {
    check(true, 'Wasabi credentials are set')
    check(wasabiBucket, `Wasabi bucket: ${wasabiBucket}`)
    check(wasabiRegion, `Wasabi region: ${wasabiRegion}`)

    const expectedEndpoint = wasabiEndpoint || `https://s3.${wasabiRegion}.wasabisys.com`
    if (wasabiEndpoint) {
      check(true, `Wasabi endpoint: ${wasabiEndpoint}`)
    } else {
      info(`Wasabi endpoint will be auto-generated: ${expectedEndpoint}`)
    }
  } else {
    warn('Wasabi not configured - guest test artifacts will use Supabase (more expensive)')
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  section('Validation Summary')

  if (allPassed && criticalIssues.length === 0) {
    console.log(`${colors.green}✅ All critical environment variables are properly configured!${colors.reset}\n`)
    console.log(`${colors.green}Your platform is ready to run tests.${colors.reset}\n`)
  } else {
    console.log(`${colors.red}❌ Found ${criticalIssues.length} critical issue(s):${colors.reset}\n`)
    criticalIssues.forEach((issue, index) => {
      console.log(`${colors.red}  ${index + 1}. ${issue}${colors.reset}`)
    })
    console.log(`\n${colors.yellow}Please fix these issues before running tests.${colors.reset}\n`)
  }

  // Additional recommendations
  if (!wasabiAccessKey || !wasabiSecretKey) {
    info('Recommendation: Configure Wasabi for cheaper guest test artifact storage')
  }

  if (!workerEnv.PINECONE_API_KEY && !process.env.PINECONE_API_KEY) {
    info('Recommendation: Configure Pinecone for test memory/learning features')
  }

  if (!workerEnv.SENTRY_DSN && !process.env.SENTRY_DSN) {
    info('Recommendation: Configure Sentry for error tracking in production')
  }

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`)

  process.exit(allPassed && criticalIssues.length === 0 ? 0 : 1)
}

// Run validation
validate().catch(err => {
  console.error(`${colors.red}Error running validation:${colors.reset}`, err)
  process.exit(1)
})

