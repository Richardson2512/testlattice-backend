const { createClient } = require('@supabase/supabase-js');

// Parse command line args
const args = process.argv.slice(2);
const SUPABASE_URL = args[0];
const SUPABASE_SERVICE_KEY = args[1]; // Use service role key to bypass RLS

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Usage: node debug-admin.js <SUPABASE_URL> <SUPABASE_SERVICE_KEY>');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const EMAIL = 'richsamven12@gmail.com';

async function main() {
    console.log(`Debug Admin for: ${EMAIL}\n`);

    // 1. Check Auth User
    console.log('--- 1. Checking Auth User ---');
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
        console.error('Error listing users:', userError);
        return;
    }

    const user = users.find(u => u.email === EMAIL);

    if (!user) {
        console.error('User NOT FOUND in auth.users!');
        return;
    }

    console.log(`User ID: ${user.id}`);
    console.log('App Metadata:', user.app_metadata);
    console.log('User Metadata:', user.user_metadata);

    const isAdmin = user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin';
    console.log(`Is Admin? ${isAdmin ? 'YES' : 'NO'}`);

    if (!isAdmin) {
        console.log('XXX ISSUE FOUND: User is not an admin!');
    }

    // 2. Check Subscription
    console.log('\n--- 2. Checking Subscription ---');
    const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (subError) {
        console.log('Error/No Subscription:', subError.message);
    } else {
        console.log('Subscription:', subscription);
    }

    if (!subscription || subscription.tier === 'free') {
        console.log('XXX ISSUE FOUND: User is on Free tier or no subscription record.');
    }

    // 3. Check Stats (Data Existence)
    console.log('\n--- 3. Checking Data for Stats ---');
    const { count: testRuns } = await supabase.from('test_runs').select('*', { count: 'exact', head: true });
    // const { count: usersCount } = await supabase.from('user_subscriptions').select('*', { count: 'exact', head: true });

    console.log(`Total Test Runs in DB: ${testRuns}`);
    // console.log(`Total Subscriptions in DB: ${usersCount}`);

}

main().catch(console.error);
