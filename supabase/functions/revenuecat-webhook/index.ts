import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// RevenueCat webhook event types
type WebhookEventType = 
  | 'INITIAL_PURCHASE' 
  | 'RENEWAL' 
  | 'CANCELLATION' 
  | 'EXPIRATION' 
  | 'PRODUCT_CHANGE'
  | 'NON_RENEWING_PURCHASE'
  | 'UNCANCELLATION'

interface RevenueCatWebhookEvent {
  event: {
    type: WebhookEventType;
    id: string;
    app_user_id: string;
    original_app_user_id: string;
    aliases: string[];
    is_family_share: boolean;
    country_code: string;
    currency: string;
    entitlements: {
      [key: string]: {
        expires_date: string | null;
        grace_period_expires_date: string | null;
        product_identifier: string;
        purchase_date: string;
      }
    };
    original_transaction_id: string;
    period_type: 'normal' | 'trial' | 'intro' | 'promotional';
    presented_offering_identifier: string | null;
    price: number;
    price_in_purchased_currency: number;
    product_id: string;
    purchased_at: string;
    store: 'app_store' | 'play_store' | 'amazon' | 'mac_app_store' | 'stripe' | 'promotional';
    subscriber_attributes: { [key: string]: any };
    takehome_percentage: number;
    tax_percentage: number;
    transaction_id: string;
  };
  api_version: string;
}

/**
 * RevenueCat Webhook Handler
 * Updates subscription cache in real-time when subscription events occur
 * Provides instant updates without waiting for client-side checks
 */

function validateWebhookSignature(payload: string, signature: string): boolean {
  // TODO: Implement webhook signature validation
  // For now, we'll validate the Authorization header contains our secret
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  return webhookSecret && signature === `Bearer ${webhookSecret}`;
}

function parsePlanType(productId: string, periodType: string): 'free' | 'weekly' | 'monthly' {
  const lowerProductId = productId.toLowerCase();
  
  if (lowerProductId.includes('weekly') || periodType === 'weekly') {
    return 'weekly';
  }
  
  if (lowerProductId.includes('monthly') || periodType === 'monthly') {
    return 'monthly';
  }
  
  // Default to monthly for Pro subscriptions
  return 'monthly';
}

async function handleSubscriptionEvent(
  supabase: any,
  event: RevenueCatWebhookEvent['event']
): Promise<void> {
  const userId = event.app_user_id;
  const eventType = event.type;
  
  console.log('📨 Processing webhook event:', {
    type: eventType,
    userId,
    productId: event.product_id,
    transactionId: event.original_transaction_id
  });

  // Check for 'pro' entitlement
  const proEntitlement = event.entitlements['pro'];
  
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
      // User gained or renewed Pro access
      if (proEntitlement) {
        const planType = parsePlanType(event.product_id, event.period_type);
        
        await supabase.rpc('update_subscription_cache', {
          p_user_id: userId,
          p_is_pro: true,
          p_plan_type: planType,
          p_expires_at: proEntitlement.expires_date,
          p_transaction_id: event.original_transaction_id,
          p_revenue_cat_user_id: event.original_app_user_id
        });
        
        console.log('✅ Pro subscription activated:', {
          userId,
          planType,
          expiresAt: proEntitlement.expires_date
        });
      }
      break;

    case 'CANCELLATION':
      // Subscription cancelled but may still be active until expiration
      if (proEntitlement && proEntitlement.expires_date) {
        const expirationDate = new Date(proEntitlement.expires_date);
        const isStillActive = expirationDate > new Date();
        
        if (isStillActive) {
          // Still active until expiration - keep Pro status
          const planType = parsePlanType(event.product_id, event.period_type);
          
          await supabase.rpc('update_subscription_cache', {
            p_user_id: userId,
            p_is_pro: true,
            p_plan_type: planType,
            p_expires_at: proEntitlement.expires_date,
            p_transaction_id: event.original_transaction_id,
            p_revenue_cat_user_id: event.original_app_user_id
          });
          
          console.log('📅 Subscription cancelled but still active until:', proEntitlement.expires_date);
        } else {
          // Already expired - remove Pro access
          await supabase.rpc('update_subscription_cache', {
            p_user_id: userId,
            p_is_pro: false,
            p_plan_type: 'free',
            p_expires_at: null,
            p_transaction_id: event.original_transaction_id,
            p_revenue_cat_user_id: event.original_app_user_id
          });
          
          console.log('❌ Subscription cancelled and expired');
        }
      } else {
        // No valid entitlement - remove Pro access
        await supabase.rpc('update_subscription_cache', {
          p_user_id: userId,
          p_is_pro: false,
          p_plan_type: 'free',
          p_expires_at: null,
          p_transaction_id: event.original_transaction_id,
          p_revenue_cat_user_id: event.original_app_user_id
        });
      }
      break;

    case 'EXPIRATION':
      // Subscription has expired - remove Pro access
      await supabase.rpc('update_subscription_cache', {
        p_user_id: userId,
        p_is_pro: false,
        p_plan_type: 'free',
        p_expires_at: proEntitlement?.expires_date || null,
        p_transaction_id: event.original_transaction_id,
        p_revenue_cat_user_id: event.original_app_user_id
      });
      
      console.log('⏰ Subscription expired for user:', userId);
      break;

    case 'PRODUCT_CHANGE':
      // User changed subscription plan
      if (proEntitlement) {
        const planType = parsePlanType(event.product_id, event.period_type);
        
        await supabase.rpc('update_subscription_cache', {
          p_user_id: userId,
          p_is_pro: true,
          p_plan_type: planType,
          p_expires_at: proEntitlement.expires_date,
          p_transaction_id: event.original_transaction_id,
          p_revenue_cat_user_id: event.original_app_user_id
        });
        
        console.log('🔄 Subscription plan changed:', {
          userId,
          newPlan: planType,
          productId: event.product_id
        });
      }
      break;

    case 'NON_RENEWING_PURCHASE':
      // Handle one-time purchases if needed
      console.log('💰 Non-renewing purchase detected:', event.product_id);
      break;

    default:
      console.log('❓ Unhandled webhook event type:', eventType);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('🎣 RevenueCat webhook received');
    
    // Validate webhook signature
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bodyText = await req.text();
    
    if (!validateWebhookSignature(bodyText, authHeader)) {
      console.error('❌ Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse webhook payload
    let webhookData: RevenueCatWebhookEvent;
    try {
      webhookData = JSON.parse(bodyText);
    } catch (error) {
      console.error('❌ Invalid JSON payload:', error);
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process the webhook event
    await handleSubscriptionEvent(supabase, webhookData.event);

    // Log successful processing
    console.log('✅ Webhook processed successfully:', {
      eventId: webhookData.event.id,
      eventType: webhookData.event.type,
      userId: webhookData.event.app_user_id
    });

    // Return success response
    return new Response(JSON.stringify({ 
      success: true,
      event_id: webhookData.event.id,
      processed_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({ 
      error: 'Webhook processing failed',
      details: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});