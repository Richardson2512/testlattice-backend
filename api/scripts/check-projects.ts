
import { createClient } from '@supabase/supabase-js'
import { config } from '../src/config/env'

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

async function main() {
    console.log('--- Checking Projects ---')

    const { data: projects, error } = await supabase
        .from('projects')
        .select('id, name, created_at, team_id')

    if (error) {
        console.error('Error fetching projects:', error)
        return
    }

    if (!projects || projects.length === 0) {
        console.log('No projects found.')
        return
    }

    console.table(projects)

    // Check for any invalid IDs (though postgres usually enforces uuid type)
    const invalid = projects.filter(p => !p.id || p.id === 'undefined')
    if (invalid.length > 0) {
        console.error('⚠️ FOUND INVALID PROJECT IDS:', invalid)
    } else {
        console.log('✅ All project IDs look valid (UUID format expected by DB).')
    }
}

main()
