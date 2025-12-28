require('dotenv').config({ path: '../api/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmin() {
    console.log('Searching for user richsamven12...');

    // Search by email (assuming richsamven12 is part of email) 
    // or checks if it is the username (metadata)

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error listing users:', error);
        process.exit(1);
    }

    const user = users.find(u =>
        u.email.includes('richsamven12') ||
        u.user_metadata?.username === 'richsamven12' ||
        u.id === 'richsamven12' // unlikely
    );

    if (!user) {
        console.error('User richsamven12 not found in auth.');
        console.log('Available users:', users.map(u => u.email).join(', '));
        return;
    }

    console.log(`Found user: ${user.email} (${user.id})`);
    console.log('Role (app_metadata):', user.app_metadata?.role);
    console.log('Role (user_metadata):', user.user_metadata?.role);

    // Check subscription
    const { data: sub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (subError) {
        console.error('Error fetching subscription:', subError);
    } else {
        console.log('Subscription:', sub);
    }

    // Check if we should upgrade
    if (sub && sub.tier === 'free') {
        console.log('User is on FREE plan. Upgrading to PRO because they are admin...');
        const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({
                tier: 'pro',
                status: 'active',
                test_limit_count: 1000,
                visual_limit_count: 500
            })
            .eq('user_id', user.id);

        if (updateError) {
            console.error('Failed to upgrade:', updateError);
        } else {
            console.log('✅ Successfully upgraded richsamven12 to PRO plan.');
        }
    }
}

checkAdmin();
