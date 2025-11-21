import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config/env'

// Lazy initialization - validate and create clients only when accessed
let _supabase: SupabaseClient | null = null
let _supabaseAnon: SupabaseClient | null = null

function initializeSupabase(): SupabaseClient {
  // Read directly from process.env to avoid config module caching issues
  const supabaseUrl = process.env.SUPABASE_URL || config.supabase.url || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabase.serviceRoleKey || ''
  const anonKey = process.env.SUPABASE_KEY || config.supabase.key || ''
  
  // Validate Supabase configuration
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required. Please set it in api/.env file.')
  }

  if (!serviceRoleKey && !anonKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY environment variable is required. Please set it in api/.env file.')
  }

  // Create Supabase client with service role key for admin operations
  return createClient(
    supabaseUrl,
    serviceRoleKey || anonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

function initializeSupabaseAnon(): SupabaseClient {
  // Read directly from process.env to avoid config module caching issues
  const supabaseUrl = process.env.SUPABASE_URL || config.supabase.url || ''
  const anonKey = process.env.SUPABASE_KEY || config.supabase.key || ''
  
  // Validate Supabase configuration
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required. Please set it in api/.env file.')
  }

  if (!anonKey) {
    throw new Error('SUPABASE_KEY environment variable is required. Please set it in api/.env file.')
  }

  // Create Supabase client with anon key for user operations
  return createClient(
    supabaseUrl,
    anonKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    }
  )
}

// Export clients with lazy initialization
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = initializeSupabase()
    }
    const value = (_supabase as any)[prop]
    return typeof value === 'function' ? value.bind(_supabase) : value
  }
})

export const supabaseAnon: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAnon) {
      _supabaseAnon = initializeSupabaseAnon()
    }
    const value = (_supabaseAnon as any)[prop]
    return typeof value === 'function' ? value.bind(_supabaseAnon) : value
  }
})

