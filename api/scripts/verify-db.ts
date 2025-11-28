// Script to verify database tables exist
// Run with: npx tsx scripts/verify-db.ts

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from '../src/config/env'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../.env') })

// Use config which validates env vars at startup
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
)

async function verifyDatabase() {
  console.log('🔍 Verifying database tables...\n')

  // Check projects table
  console.log('1. Checking projects table...')
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .limit(1)

  if (projectsError) {
    if (projectsError.code === 'PGRST116' || projectsError.message.includes('does not exist')) {
      console.log('   ❌ projects table does NOT exist')
      console.log('   💡 Run api/supabase-schema.sql in Supabase SQL Editor\n')
    } else {
      console.log(`   ⚠️  Error checking projects: ${projectsError.message}\n`)
    }
  } else {
    console.log('   ✅ projects table exists')
    console.log(`   📊 Current projects count: ${projects?.length || 0}\n`)
  }

  // Check test_runs table
  console.log('2. Checking test_runs table...')
  const { data: testRuns, error: testRunsError } = await supabase
    .from('test_runs')
    .select('*')
    .limit(1)

  if (testRunsError) {
    if (testRunsError.code === 'PGRST116' || testRunsError.message.includes('does not exist')) {
      console.log('   ❌ test_runs table does NOT exist')
      console.log('   💡 Run api/supabase-schema.sql in Supabase SQL Editor\n')
    } else {
      console.log(`   ⚠️  Error checking test_runs: ${testRunsError.message}\n`)
    }
  } else {
    console.log('   ✅ test_runs table exists\n')
  }

  // Check test_artifacts table
  console.log('3. Checking test_artifacts table...')
  const { data: artifacts, error: artifactsError } = await supabase
    .from('test_artifacts')
    .select('*')
    .limit(1)

  if (artifactsError) {
    if (artifactsError.code === 'PGRST116' || artifactsError.message.includes('does not exist')) {
      console.log('   ❌ test_artifacts table does NOT exist')
      console.log('   💡 Run api/supabase-schema.sql in Supabase SQL Editor\n')
    } else {
      console.log(`   ⚠️  Error checking test_artifacts: ${artifactsError.message}\n`)
    }
  } else {
    console.log('   ✅ test_artifacts table exists\n')
  }

  // Test project creation
  console.log('4. Testing project creation...')
  try {
    const testProject = {
      name: `Test Project ${Date.now()}`,
      description: 'Test project for verification',
      team_id: 'test-team',
      user_id: null,
    }

    const { data: createdProject, error: createError } = await supabase
      .from('projects')
      .insert(testProject)
      .select()
      .single()

    if (createError) {
      console.log(`   ❌ Failed to create test project: ${createError.message}`)
      console.log(`   Error code: ${createError.code}`)
      console.log(`   Error details: ${JSON.stringify(createError, null, 2)}\n`)
    } else {
      console.log('   ✅ Successfully created test project!')
      console.log(`   Project ID: ${createdProject.id}`)
      console.log(`   Project Name: ${createdProject.name}\n`)

      // Clean up test project
      await supabase.from('projects').delete().eq('id', createdProject.id)
      console.log('   🧹 Cleaned up test project\n')
    }
  } catch (error: any) {
    console.log(`   ❌ Exception during test: ${error.message}\n`)
  }

  console.log('✅ Database verification complete!')
  console.log('\n📋 Next Steps:')
  console.log('   1. If any tables are missing, run api/supabase-schema.sql in Supabase SQL Editor')
  console.log('   2. Check VERIFY_DATABASE.md for detailed instructions')
  console.log('   3. Verify RLS policies are set up correctly')
}

verifyDatabase().catch(console.error)

