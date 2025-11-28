import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config/env'

// Lazy initialization - validate and create clients only when accessed
let _supabase: SupabaseClient | null = null
let _supabaseAnon: SupabaseClient | null = null

function initializeSupabase(): SupabaseClient {
  // Use config which validates env vars at startup
  const supabaseUrl = config.supabase.url
  const serviceRoleKey = config.supabase.serviceRoleKey
  const anonKey = config.supabase.key
  
  // Create Supabase client with service role key for admin operations
  // Prefer service role key, fallback to anon key if service role not available
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
  // Use config which validates env vars at startup
  const supabaseUrl = config.supabase.url
  const anonKey = config.supabase.key
  
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

