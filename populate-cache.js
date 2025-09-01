#!/usr/bin/env node

// Script to populate subscription cache for existing Pro users
// Run this after implementing the security system to backfill cache

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service key for admin access

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function populateCache() {
  console.log('🔍 Checking for Pro users in video usage table...');
  
  // Find Pro users from video usage table
  const { data: proUsers, error } = await supabase
    .from('user_video_usage')
    .select('user_id, plan_type, expires_date, original_purchase_date')
    .eq('is_active', true)
    .neq('plan_type', 'free');

  if (error) {
    console.error('❌ Failed to fetch Pro users:', error);
    return;
  }

  console.log(`📊 Found ${proUsers?.length || 0} active Pro users`);

  if (!proUsers || proUsers.length === 0) {
    console.log('ℹ️ No Pro users found to migrate to cache');
    return;
  }

  for (const user of proUsers) {
    console.log(`🔄 Populating cache for user: ${user.user_id}`);
    
    try {
      const { error: cacheError } = await supabase.rpc('update_subscription_cache', {
        p_user_id: user.user_id,
        p_is_pro: true,
        p_plan_type: user.plan_type,
        p_expires_at: user.expires_date,
        p_transaction_id: null, // Will be updated by webhook
        p_revenue_cat_user_id: user.user_id
      });

      if (cacheError) {
        console.error(`❌ Failed to populate cache for ${user.user_id}:`, cacheError);
      } else {
        console.log(`✅ Cache populated for ${user.user_id} (${user.plan_type})`);
      }
    } catch (err) {
      console.error(`❌ Error processing ${user.user_id}:`, err.message);
    }
  }

  console.log('🎉 Cache population complete!');
}

populateCache().catch(console.error);