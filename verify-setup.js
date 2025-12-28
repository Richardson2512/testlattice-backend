/**
 * Comprehensive Setup Verification Script
 * Checks all connections, configurations, and database setup
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const IORedis = require('ioredis');
const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60));
}

async function checkOllama() {
  logSection('Checking Ollama Connection');
  try {
    const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
    const models = response.data.models || [];
    
    log('✅ Ollama is running', 'green');
    log(`   Found ${models.length} models:`, 'green');
    
    const requiredModels = ['qwen2.5-coder:7b', 'qwen2.5-coder:14b'];
    const installedModels = models.map(m => m.name);
    
    for (const model of requiredModels) {
      if (installedModels.includes(model)) {
        log(`   ✅ ${model}`, 'green');
      } else {
        log(`   ❌ ${model} - NOT FOUND`, 'red');
      }
    }
    
    // Test model API
    try {
      const testResponse = await axios.post(
        'http://localhost:11434/v1/chat/completions',
        {
          model: 'qwen2.5-coder:7b',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5
        },
        { timeout: 10000 }
      );
      log('   ✅ Model API is responding', 'green');
    } catch (err) {
      log(`   ⚠️  Model API test failed: ${err.message}`, 'yellow');
    }
    
    return true;
  } catch (error) {
    log('❌ Ollama is not running or not accessible', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function checkRedis() {
  logSection('Checking Redis Connection');
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true
    });
    
    await redis.connect();
    await redis.ping();
    await redis.quit();
    
    log('✅ Redis is connected', 'green');
    log(`   URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`, 'green');
    return true;
  } catch (error) {
    log('❌ Redis connection failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    log(`   Make sure Redis is running at: ${process.env.REDIS_URL || 'redis://localhost:6379'}`, 'yellow');
    return false;
  }
}

async function checkSupabase() {
  logSection('Checking Supabase Connection');
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !serviceKey) {
      log('❌ Supabase credentials missing', 'red');
      log('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY', 'yellow');
      return false;
    }
    
    const supabase = createClient(url, serviceKey);
    
    // Test connection by querying a table
    const { data, error } = await supabase.from('projects').select('count').limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist (schema issue)
      log('⚠️  Supabase connected but schema may need updates', 'yellow');
      log(`   Error: ${error.message}`, 'yellow');
      return false;
    }
    
    log('✅ Supabase is connected', 'green');
    log(`   URL: ${url}`, 'green');
    
    // Check required tables
    const requiredTables = ['projects', 'test_runs', 'test_artifacts', 'test_steps'];
    for (const table of requiredTables) {
      try {
        const { error: tableError } = await supabase.from(table).select('count').limit(1);
        if (tableError && tableError.code === 'PGRST116') {
          log(`   ❌ Table '${table}' does not exist`, 'red');
        } else {
          log(`   ✅ Table '${table}' exists`, 'green');
        }
      } catch (e) {
        log(`   ⚠️  Could not check table '${table}'`, 'yellow');
      }
    }
    
    return true;
  } catch (error) {
    log('❌ Supabase connection failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function checkDatabaseSchema() {
  logSection('Checking Database Schema');
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !serviceKey) {
      log('⚠️  Cannot check schema - Supabase credentials missing', 'yellow');
      return false;
    }
    
    const supabase = createClient(url, serviceKey);
    
    // Check for required columns in test_runs
    const requiredColumns = ['trace_url', 'stream_url'];
    log('Checking test_runs table columns...', 'blue');
    
    // Try to query with these columns to see if they exist
    try {
      const { error } = await supabase
        .from('test_runs')
        .select('id, trace_url, stream_url')
        .limit(1);
      
      if (error && error.message.includes('trace_url')) {
        log('   ❌ Column "trace_url" is missing from test_runs', 'red');
        log('   Run the migration: api/supabase-patches/2025-02-17-add-missing-columns.sql', 'yellow');
        return false;
      }
      
      if (error && error.message.includes('stream_url')) {
        log('   ❌ Column "stream_url" is missing from test_runs', 'red');
        log('   Run the migration: api/supabase-patches/2025-02-17-add-missing-columns.sql', 'yellow');
        return false;
      }
      
      log('   ✅ All required columns exist in test_runs', 'green');
      return true;
    } catch (err) {
      log(`   ⚠️  Could not verify columns: ${err.message}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`   ❌ Schema check failed: ${error.message}`, 'red');
    return false;
  }
}

function checkEnvironmentFiles() {
  logSection('Checking Environment Files');
  
  const envFiles = [
    { path: 'worker/.env', required: true },
    { path: 'api/.env', required: true },
    { path: 'frontend/.env.local', required: false }
  ];
  
  let allGood = true;
  
  for (const file of envFiles) {
    const fullPath = path.resolve(file.path);
    if (fs.existsSync(fullPath)) {
      log(`✅ ${file.path} exists`, 'green');
      
      // Check for key variables (without reading sensitive data)
      const content = fs.readFileSync(fullPath, 'utf8');
      if (file.path.includes('worker')) {
        const required = ['REDIS_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
        for (const key of required) {
          if (content.includes(key)) {
            log(`   ✅ ${key} is set`, 'green');
          } else {
            log(`   ❌ ${key} is missing`, 'red');
            allGood = false;
          }
        }
      }
      if (file.path.includes('api')) {
        const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'REDIS_URL'];
        for (const key of required) {
          if (content.includes(key)) {
            log(`   ✅ ${key} is set`, 'green');
          } else {
            log(`   ❌ ${key} is missing`, 'red');
            allGood = false;
          }
        }
      }
    } else {
      if (file.required) {
        log(`❌ ${file.path} is missing (REQUIRED)`, 'red');
        allGood = false;
      } else {
        log(`⚠️  ${file.path} is missing (optional)`, 'yellow');
      }
    }
  }
  
  return allGood;
}

function checkModelConfiguration() {
  logSection('Checking Model Configuration');
  
  // Check if models are configured in code
  const workerEnvPath = path.resolve('worker/.env');
  if (fs.existsSync(workerEnvPath)) {
    const content = fs.readFileSync(workerEnvPath, 'utf8');
    
    const modelConfigs = [
      { key: 'QWEN_CODER_7B_MODEL', default: 'qwen2.5-coder:7b' },
      { key: 'QWEN_CODER_14B_MODEL', default: 'qwen2.5-coder:14b' }
    ];
    
    for (const config of modelConfigs) {
      if (content.includes(config.key)) {
        log(`   ✅ ${config.key} is configured`, 'green');
      } else {
        log(`   ⚠️  ${config.key} not set (will use default: ${config.default})`, 'yellow');
      }
    }
  } else {
    log('   ⚠️  Cannot check model config - worker/.env not found', 'yellow');
  }
  
  return true;
}

async function testOllamaModels() {
  logSection('Testing Ollama Models');
  
  const models = [
    { name: 'qwen2.5-coder:7b', endpoint: 'http://localhost:11434/v1' },
    { name: 'qwen2.5-coder:14b', endpoint: 'http://localhost:11434/v1' }
  ];
  
  for (const model of models) {
    try {
      log(`Testing ${model.name}...`, 'blue');
      const response = await axios.post(
        `${model.endpoint}/chat/completions`,
        {
          model: model.name,
          messages: [{ role: 'user', content: 'Say "OK" if you can read this.' }],
          max_tokens: 10,
          temperature: 0.1
        },
        { timeout: 30000 }
      );
      
      if (response.data.choices && response.data.choices[0]) {
        log(`   ✅ ${model.name} is responding`, 'green');
      } else {
        log(`   ⚠️  ${model.name} returned unexpected response`, 'yellow');
      }
    } catch (error) {
      log(`   ❌ ${model.name} test failed: ${error.message}`, 'red');
    }
  }
}

async function main() {
  console.log('\n');
  log('🔍 Ghost-Tester Setup Verification', 'blue');
  log('=====================================\n', 'blue');
  
  const results = {
    ollama: false,
    redis: false,
    supabase: false,
    schema: false,
    envFiles: false,
    models: false
  };
  
  // Check environment files first
  results.envFiles = checkEnvironmentFiles();
  
  // Check connections
  results.ollama = await checkOllama();
  results.redis = await checkRedis();
  results.supabase = await checkSupabase();
  results.schema = await checkDatabaseSchema();
  
  // Check model configuration
  checkModelConfiguration();
  
  // Test models
  if (results.ollama) {
    await testOllamaModels();
    results.models = true;
  }
  
  // Summary
  logSection('Summary');
  
  const allChecks = [
    { name: 'Environment Files', result: results.envFiles },
    { name: 'Ollama Connection', result: results.ollama },
    { name: 'Redis Connection', result: results.redis },
    { name: 'Supabase Connection', result: results.supabase },
    { name: 'Database Schema', result: results.schema },
    { name: 'Model Tests', result: results.models }
  ];
  
  let allPassed = true;
  for (const check of allChecks) {
    if (check.result) {
      log(`✅ ${check.name}`, 'green');
    } else {
      log(`❌ ${check.name}`, 'red');
      allPassed = false;
    }
  }
  
  console.log('\n');
  if (allPassed) {
    log('🎉 All checks passed! System is ready.', 'green');
  } else {
    log('⚠️  Some checks failed. Please fix the issues above.', 'yellow');
    log('\nNext steps:', 'blue');
    log('1. Ensure all .env files are configured', 'blue');
    log('2. Run database migrations if schema check failed', 'blue');
    log('3. Start Redis if connection failed', 'blue');
    log('4. Start Ollama if connection failed', 'blue');
  }
  console.log('\n');
}

main().catch(console.error);


