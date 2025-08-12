import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Logging configuration - set to false for production
const LOG_CONFIG = {
  enabled: true,           // Master switch - set to false to disable all logging
  webhook: true,           // Log incoming webhook details
  subscriber: true,        // Log subscriber API responses
  database: true,          // Log database operations
  errors: true,           // Always log errors (even if enabled is false)
};

// Helper function for conditional logging
const log = (category: keyof typeof LOG_CONFIG, ...args: any[]) => {
  if ((LOG_CONFIG.enabled && LOG_CONFIG[category]) || (category === 'errors' && LOG_CONFIG.errors)) {
    console.log(...args);
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    app_id: string;
    app_user_id: string;
    environment: string;
    event_timestamp_ms: number;
    id: string;
    product_id: string;
    purchased_at_ms: number;
    type: string;
    aliases?: string[];
    currency?: string;
    entitlement_id?: string;
    entitlement_ids?: string[];
    expiration_at_ms?: number;
    is_family_share?: boolean;
    new_product_id?: string;
    offer_code?: string;
    period_type?: string;
    price?: number;
    price_in_purchased_currency?: number;
    presented_offering_id?: string;
    store?: string;
    subscriber_attributes?: Record<string, any>;
    takehome_percentage?: number;
    tax_percentage?: number;
    transferred_from?: string[];
    transferred_to?: string[];
  };
}

// Event types that indicate active subscription
const ACTIVE_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION'
];

// Event types that indicate subscription end
const INACTIVE_EVENTS = [
  'EXPIRATION',
  'CANCELLATION',
  'BILLING_ISSUE'
];

// Event types that require special handling
const TRANSFER_EVENTS = ['TRANSFER'];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    log('webhook', '🔧 Environment Check:', {
      has_supabase_url: !!Deno.env.get('SUPABASE_URL'),
      has_service_key: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      has_rc_api_key: !!Deno.env.get('RC_API_KEY'),
      has_webhook_secret: !!Deno.env.get('RC_WEBHOOK_SECRET')
    });

    // Verify required environment variables
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RC_API_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !Deno.env.get(varName));
    
    if (missingVars.length > 0) {
      log('errors', '❌ Missing required environment variables:', missingVars);
      return new Response(JSON.stringify({ 
        error: 'Missing required environment variables',
        missing: missingVars,
        required: requiredEnvVars
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Verify webhook secret (if configured)
    const webhookSecret = Deno.env.get('RC_WEBHOOK_SECRET');
    if (webhookSecret) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader !== `Bearer ${webhookSecret}`) {
        log('errors', '❌ Invalid webhook secret');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Parse webhook payload
    let payload: RevenueCatWebhookEvent;
    try {
      payload = await req.json();
    } catch (parseError) {
      log('errors', '❌ Failed to parse webhook payload:', parseError.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON payload',
        details: parseError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    const event = payload.event;
    
    log('webhook', '📥 Processing RevenueCat webhook:', {
      type: event.type,
      app_user_id: event.app_user_id,
      product_id: event.product_id,
      environment: event.environment,
      event_id: event.id,
      timestamp: new Date(event.event_timestamp_ms).toISOString()
    });

    // Handle TEST events
    if (event.type === 'TEST') {
      log('webhook', '✅ TEST webhook received - webhook integration is working');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'TEST webhook received successfully',
        event_type: 'TEST'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    let supabase;
    try {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
      log('database', '✅ Supabase client initialized');
    } catch (supabaseError) {
      log('errors', '❌ Failed to initialize Supabase client:', supabaseError.message);
      throw new Error(`Supabase initialization failed: ${supabaseError.message}`);
    }

    // Fetch canonical subscriber info from RevenueCat API
    const rcApiKey = Deno.env.get('RC_API_KEY')!;
    let rcResponse;
    try {
      rcResponse = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${event.app_user_id}`,
        {
          headers: {
            'Authorization': rcApiKey,  // v1 API doesn't use Bearer prefix
            'X-Platform': 'ios'
          }
        }
      );
    } catch (fetchError) {
      log('errors', '❌ Network error fetching subscriber from RevenueCat:', {
        error: fetchError.message,
        app_user_id: event.app_user_id
      });
      throw new Error(`Network error: ${fetchError.message}`);
    }

    if (!rcResponse.ok) {
      const errorText = await rcResponse.text().catch(() => 'Could not read error response');
      log('errors', '❌ Failed to fetch subscriber from RevenueCat:', {
        status: rcResponse.status,
        statusText: rcResponse.statusText,
        app_user_id: event.app_user_id,
        api_url: `https://api.revenuecat.com/v1/subscribers/${event.app_user_id}`,
        error_body: errorText,
        api_key_prefix: rcApiKey.substring(0, 8) + '...',
        headers_sent: {
          'Authorization': '[REDACTED]',
          'X-Platform': 'ios'
        }
      });
      
      // Return a 200 response but log the error - don't fail the webhook
      return new Response(JSON.stringify({ 
        success: false,
        error: 'RevenueCat API access forbidden',
        details: `${rcResponse.status} ${rcResponse.statusText}`,
        app_user_id: event.app_user_id,
        event_type: event.type,
        suggestion: 'Check if REST API key has permissions for this user/environment'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200  // Return 200 so RevenueCat doesn't retry
      });
    }

    let subscriberData, subscriber;
    try {
      subscriberData = await rcResponse.json();
      subscriber = subscriberData.subscriber;
    } catch (jsonError) {
      log('errors', '❌ Failed to parse RevenueCat response:', jsonError.message);
      throw new Error(`JSON parse error: ${jsonError.message}`);
    }
    
    // Get canonical ID (original_app_user_id)
    const canonicalId = subscriber.original_app_user_id || event.app_user_id;
    
    // Check if user has Pro entitlement
    const proEntitlement = subscriber.entitlements?.pro;
    const hasProEntitlement = proEntitlement && 
      new Date(proEntitlement.expires_date) > new Date();

    log('subscriber', '👤 Subscriber info:', {
      canonical_id: canonicalId,
      original_id: event.app_user_id,
      has_pro: hasProEntitlement,
      product_identifier: proEntitlement?.product_identifier,
      expires_date: proEntitlement?.expires_date
    });

    // Handle different event types
    if (ACTIVE_EVENTS.includes(event.type)) {
      // User has active subscription - update/create usage record
      if (hasProEntitlement) {
        const productId = proEntitlement.product_identifier?.toLowerCase() || '';
        const isWeekly = productId.includes('weekly') || productId.includes('week');
        const planType = isWeekly ? 'weekly' : 'monthly';
        const usageLimit = isWeekly ? 7 : 31;

        // Calculate billing cycle dates
        const originalPurchaseDate = new Date(proEntitlement.original_purchase_date || Date.now());
        const now = new Date();
        
        let billingCycleStart: Date;
        let nextResetDate: Date;
        
        if (isWeekly) {
          // Weekly: Simple 7-day calculation
          const daysSincePurchase = Math.floor((now.getTime() - originalPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
          const currentCycle = Math.floor(daysSincePurchase / 7);
          billingCycleStart = new Date(originalPurchaseDate.getTime() + (currentCycle * 7 * 24 * 60 * 60 * 1000));
          nextResetDate = new Date(billingCycleStart.getTime() + (7 * 24 * 60 * 60 * 1000));
        } else {
          // Monthly: Use actual month boundaries
          const originalYear = originalPurchaseDate.getFullYear();
          const originalMonth = originalPurchaseDate.getMonth();
          const originalDay = originalPurchaseDate.getDate();
          
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth();
          
          const monthsPassed = (currentYear - originalYear) * 12 + (currentMonth - originalMonth);
          
          billingCycleStart = new Date(originalYear, originalMonth + monthsPassed, originalDay);
          
          // Handle edge case where original day doesn't exist in current month
          if (billingCycleStart.getMonth() !== (originalMonth + monthsPassed) % 12) {
            billingCycleStart = new Date(originalYear, originalMonth + monthsPassed, 0);
          }
          
          nextResetDate = new Date(originalYear, originalMonth + monthsPassed + 1, originalDay);
          if (nextResetDate.getMonth() !== (originalMonth + monthsPassed + 1) % 12) {
            nextResetDate = new Date(originalYear, originalMonth + monthsPassed + 2, 0);
          }
          
          // If current time is before billing cycle start, we're in the previous cycle
          if (now < billingCycleStart) {
            billingCycleStart = new Date(originalYear, originalMonth + monthsPassed - 1, originalDay);
            if (billingCycleStart.getMonth() !== (originalMonth + monthsPassed - 1) % 12) {
              billingCycleStart = new Date(originalYear, originalMonth + monthsPassed, 0);
            }
            nextResetDate = new Date(originalYear, originalMonth + monthsPassed, originalDay);
            if (nextResetDate.getMonth() !== (originalMonth + monthsPassed) % 12) {
              nextResetDate = new Date(originalYear, originalMonth + monthsPassed + 1, 0);
            }
          }
        }

        // Check if we need to reset usage (new billing cycle)
        let existingRecord = null;
        try {
          const { data, error: selectError } = await supabase
            .from('user_video_usage')
            .select('*')
            .eq('user_id', canonicalId)
            .single();
          
          if (selectError && selectError.code !== 'PGRST116') { // PGRST116 is "not found"
            log('errors', '❌ Database error fetching existing record:', selectError);
            throw selectError;
          }
          
          existingRecord = data;
          log('database', '📊 Existing record check:', { 
            found: !!existingRecord,
            user_id: canonicalId,
            current_count: existingRecord?.back_to_life_count || 0
          });
        } catch (dbError) {
          log('errors', '❌ Database query failed:', dbError.message);
          throw new Error(`Database query failed: ${dbError.message}`);
        }

        let back_to_life_count = existingRecord?.back_to_life_count || 0;
        let last_video_date = existingRecord?.last_video_date || null;

        // Reset usage if billing cycle changed
        if (existingRecord && existingRecord.billing_cycle_start !== billingCycleStart.toISOString()) {
          log('database', '🔄 Resetting usage for new billing cycle:', {
          old_cycle: existingRecord.billing_cycle_start,
          new_cycle: billingCycleStart.toISOString()
        });
          back_to_life_count = 0;
          last_video_date = null;
        }

        // Upsert usage record with canonical ID
        const upsertData = {
          user_id: canonicalId,
          plan_type: planType,
          usage_limit: usageLimit,
          billing_cycle_start: billingCycleStart.toISOString(),
          next_reset_date: nextResetDate.toISOString(),
          original_purchase_date: originalPurchaseDate.toISOString(),
          back_to_life_count,
          last_video_date,
          is_active: true,
          expires_date: proEntitlement.expires_date,
          updated_at: new Date().toISOString()
        };

        log('database', '💾 Attempting to upsert usage record:', upsertData);

        try {
          const { error: upsertError } = await supabase
            .from('user_video_usage')
            .upsert(upsertData);

          if (upsertError) {
            log('errors', '❌ Failed to upsert usage record:', upsertError);
            throw new Error(`Database upsert failed: ${upsertError.message}`);
          }
        } catch (dbError) {
          log('errors', '❌ Database upsert operation failed:', dbError.message);
          throw new Error(`Database operation failed: ${dbError.message}`);
        }

        log('database', '✅ Successfully updated usage record:', {
          canonical_id: canonicalId,
          plan_type: planType,
          usage_limit: usageLimit,
          billing_cycle_start: billingCycleStart.toISOString(),
          next_reset_date: nextResetDate.toISOString()
        });
      }
    } else if (INACTIVE_EVENTS.includes(event.type)) {
      // User no longer has active subscription - mark as inactive
      const { error } = await supabase
        .from('user_video_usage')
        .update({
          is_active: false,
          expires_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', canonicalId);

      if (error) {
        log('errors', '❌ Failed to mark user as inactive:', error);
        throw error;
      }

      log('database', '⏸️ Marked user as inactive:', {
        canonical_id: canonicalId,
        event_type: event.type
      });
    } else if (TRANSFER_EVENTS.includes(event.type)) {
      // Handle transfer events - merge usage from old IDs to canonical ID
      const transferredFrom = event.transferred_from || [];
      
      for (const oldId of transferredFrom) {
        // Get old usage record
        const { data: oldRecord } = await supabase
          .from('user_video_usage')
          .select('*')
          .eq('user_id', oldId)
          .single();

        if (oldRecord) {
          // Get canonical record
          const { data: canonicalRecord } = await supabase
            .from('user_video_usage')
            .select('*')
            .eq('user_id', canonicalId)
            .single();

          // Merge usage (take the higher count)
          const mergedCount = Math.max(
            oldRecord.back_to_life_count || 0,
            canonicalRecord?.back_to_life_count || 0
          );

          // Update canonical record with merged data
          const { error: updateError } = await supabase
            .from('user_video_usage')
            .upsert({
              user_id: canonicalId,
              back_to_life_count: mergedCount,
              plan_type: oldRecord.plan_type,
              usage_limit: oldRecord.usage_limit,
              billing_cycle_start: oldRecord.billing_cycle_start,
              next_reset_date: oldRecord.next_reset_date,
              original_purchase_date: oldRecord.original_purchase_date,
              last_video_date: oldRecord.last_video_date,
              is_active: oldRecord.is_active,
              expires_date: oldRecord.expires_date,
              updated_at: new Date().toISOString()
            });

          if (updateError) {
            log('errors', '❌ Failed to merge usage records:', updateError);
            throw updateError;
          }

          // Delete old record
          const { error: deleteError } = await supabase
            .from('user_video_usage')
            .delete()
            .eq('user_id', oldId);

          if (deleteError) {
            log('errors', '⚠️ Failed to delete old usage record:', deleteError);
          }

          log('database', '🔀 Merged usage records:', {
            from: oldId,
            to: canonicalId,
            merged_count: mergedCount
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      canonical_id: canonicalId,
      event_type: event.type
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    log('errors', '❌ Webhook processing error:', {
      error: error.message,
      stack: error.stack
    });
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});