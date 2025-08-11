import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // Verify webhook secret (if configured)
    const webhookSecret = Deno.env.get('RC_WEBHOOK_SECRET');
    if (webhookSecret) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader !== `Bearer ${webhookSecret}`) {
        console.error('Invalid webhook secret');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Parse webhook payload
    const payload: RevenueCatWebhookEvent = await req.json();
    const event = payload.event;
    
    console.log('Processing RevenueCat webhook:', {
      type: event.type,
      app_user_id: event.app_user_id,
      product_id: event.product_id
    });

    // Handle TEST events
    if (event.type === 'TEST') {
      console.log('Received TEST webhook - confirming webhook is working');
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch canonical subscriber info from RevenueCat API
    const rcApiKey = Deno.env.get('RC_API_KEY')!;
    const rcResponse = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${event.app_user_id}`,
      {
        headers: {
          'Authorization': `Bearer ${rcApiKey}`,
          'X-Platform': 'ios'
        }
      }
    );

    if (!rcResponse.ok) {
      console.error('Failed to fetch subscriber from RevenueCat:', rcResponse.status);
      throw new Error('Failed to fetch subscriber data');
    }

    const subscriberData = await rcResponse.json();
    const subscriber = subscriberData.subscriber;
    
    // Get canonical ID (original_app_user_id)
    const canonicalId = subscriber.original_app_user_id || event.app_user_id;
    
    // Check if user has Pro entitlement
    const proEntitlement = subscriber.entitlements?.pro;
    const hasProEntitlement = proEntitlement && 
      new Date(proEntitlement.expires_date) > new Date();

    console.log('Subscriber info:', {
      canonical_id: canonicalId,
      has_pro: hasProEntitlement,
      product_identifier: proEntitlement?.product_identifier
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
        const { data: existingRecord } = await supabase
          .from('user_video_usage')
          .select('*')
          .eq('user_id', canonicalId)
          .single();

        let back_to_life_count = existingRecord?.back_to_life_count || 0;
        let last_video_date = existingRecord?.last_video_date || null;

        // Reset usage if billing cycle changed
        if (existingRecord && existingRecord.billing_cycle_start !== billingCycleStart.toISOString()) {
          console.log('Resetting usage for new billing cycle');
          back_to_life_count = 0;
          last_video_date = null;
        }

        // Upsert usage record with canonical ID
        const { error } = await supabase
          .from('user_video_usage')
          .upsert({
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
          });

        if (error) {
          console.error('Failed to upsert usage record:', error);
          throw error;
        }

        console.log('Successfully updated usage record for canonical ID:', canonicalId);
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
        console.error('Failed to mark user as inactive:', error);
        throw error;
      }

      console.log('Marked user as inactive:', canonicalId);
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
            console.error('Failed to merge usage records:', updateError);
            throw updateError;
          }

          // Delete old record
          const { error: deleteError } = await supabase
            .from('user_video_usage')
            .delete()
            .eq('user_id', oldId);

          if (deleteError) {
            console.error('Failed to delete old usage record:', deleteError);
          }

          console.log(`Merged usage from ${oldId} to ${canonicalId}`);
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
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});