import { getSubscriptionPlanDetails } from './revenuecat';
import { getVideoTrackingId } from './trackingIds';
import { supabase } from './supabaseClient';
import { getMonthlyVideoLimit, getWeeklyVideoDailyLimit } from './usageLimits';

export interface BackToLifeUsage {
  canUse: boolean;
  used: number;
  limit: number;
  planType: 'weekly' | 'monthly';
  nextResetDate: string;
  canUseToday: boolean;
  lastVideoDate: string | null;
}

/**
 * Back to Life usage service with multi-device protection
 * Uses atomic database operations to prevent race conditions
 * between multiple devices during 1-2 minute video generation windows
 */
export const backToLifeService = {
  /**
   * Check if user can generate a Back to Life video
   * Always fetches fresh data from RevenueCat and Supabase
   * FREE USERS ARE COMPLETELY BLOCKED FROM VIDEOS
   */
  async checkUsage(): Promise<BackToLifeUsage> {
    try {
      console.log('🎬 [TEST] Starting Back to Life usage check...');
      // Get subscription details from RevenueCat
      const planDetails = await getSubscriptionPlanDetails();
      console.log('📊 [TEST] Subscription plan details:', planDetails);
      
      // Block free users from videos completely
      if (!planDetails || planDetails.planType === 'free') {
        console.log('❌ [TEST] Free users blocked from video generation');
        return {
          canUse: false,
          used: 0,
          limit: 0,
          planType: 'monthly',
          nextResetDate: new Date().toISOString(),
          canUseToday: false,
          lastVideoDate: null
        };
      }
      
      console.log('✅ [TEST] Pro user detected for video generation:', {
        planType: planDetails.planType,
        usageLimit: planDetails.usageLimit,
        billingCycleStart: planDetails.billingCycleStart,
        nextResetDate: planDetails.nextResetDate
      });

      // Get stable subscriber key for video usage tracking (bulletproof approach)
      const subscriberKey = await getVideoTrackingId();
      if (!subscriberKey) {
        if (__DEV__) {
          console.log('🎬 BackToLife: No stable subscriber key available');
        }
        return {
          canUse: false,
          used: 0,
          limit: planDetails.usageLimit,
          planType: planDetails.planType,
          nextResetDate: planDetails.nextResetDate,
          canUseToday: false,
          lastVideoDate: null
        };
      }

      // Use subscriber key as primary database key (bulletproof strategy)
      const databaseKey = subscriberKey;

      if (__DEV__) {
        console.log('📊 BackToLife Usage Check (Bulletproof Strategy):', {
          subscriber_key: subscriberKey,
          database_key: databaseKey,
          plan_type: planDetails.planType,
          usage_limit: planDetails.usageLimit,
          billing_cycle_start: planDetails.billingCycleStart,
          next_reset_date: planDetails.nextResetDate
        });
      }

      // Get or create usage record using the subscriber key
      const usageRecord = await this.getOrCreateUsageRecord(databaseKey, subscriberKey, planDetails);
      
      // Check if user can use today (daily limit: 1 video per day for weekly plans only)
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const hasMonthlyCapacity = usageRecord.back_to_life_count < planDetails.usageLimit;
      
      // Daily limits only apply to weekly plans, monthly plans have no daily restrictions
      let canUseToday = true;
      if (planDetails.planType === 'weekly') {
        canUseToday = !usageRecord.last_video_date || usageRecord.last_video_date !== today;
      }
      
      if (__DEV__) {
        console.log('🎬 BackToLife Usage Status (Bulletproof Strategy):', {
          subscriber_key: subscriberKey,
          database_key: databaseKey,
          plan_type: planDetails.planType,
          used_count: usageRecord.back_to_life_count,
          limit: planDetails.usageLimit,
          can_use_today: canUseToday,
          has_monthly_capacity: hasMonthlyCapacity,
          last_video_date: usageRecord.last_video_date,
          today: today,
          daily_limit_applies: planDetails.planType === 'weekly'
        });
      }
      
      return {
        canUse: canUseToday && hasMonthlyCapacity,
        used: usageRecord.back_to_life_count,
        limit: planDetails.usageLimit,
        planType: planDetails.planType,
        nextResetDate: planDetails.nextResetDate,
        canUseToday,
        lastVideoDate: usageRecord.last_video_date
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to check Back to Life usage:', error);
      }
      return {
        canUse: false,
        used: 0,
        limit: 0,
        planType: 'monthly',
        nextResetDate: new Date().toISOString(),
        canUseToday: false,
        lastVideoDate: null
      };
    }
  },

  /**
   * Atomically check limits and increment usage - CALL THIS BEFORE VIDEO GENERATION
   * This prevents race conditions between multiple devices during 1-2 minute generation windows
   * Returns true if increment succeeded, false if at limit
   */
  async checkAndIncrementUsage(): Promise<boolean> {
    try {
      // Get subscription details from RevenueCat
      const planDetails = await getSubscriptionPlanDetails();
      
      // Block free users from videos completely
      if (!planDetails || planDetails.planType === 'free') {
        if (__DEV__) {
          console.log('🎬 BackToLife: Free users blocked from video increment');
        }
        return false;
      }

      const subscriberKey = await getVideoTrackingId();
      if (!subscriberKey) {
        if (__DEV__) {
          console.log('⚠️ No subscriber key for usage increment');
        }
        return false;
      }

      // Use subscriber key for database operations (bulletproof strategy)
      const databaseKey = subscriberKey;

      if (__DEV__) {
        console.log('🔒 Attempting atomic usage increment (Bulletproof Strategy):', {
          subscriber_key: subscriberKey,
          database_key: databaseKey,
          plan_type: planDetails.planType,
          usage_limit: planDetails.usageLimit
        });
      }

      // Extract original transaction ID from tracking key if available
      let originalTransactionId: string | null = null;
      if (databaseKey.startsWith('orig:')) {
        originalTransactionId = databaseKey.substring(5); // Remove "orig:" prefix
      }
      
      if (__DEV__) {
        console.log('🔑 Database call parameters:', {
          user_id: databaseKey,
          plan_type: planDetails.planType,
          usage_limit: planDetails.usageLimit,
          store_transaction_id: planDetails.storeTransactionId,
          original_transaction_id: originalTransactionId,
          billing_cycle_start: planDetails.billingCycleStart,
          next_reset_date: planDetails.nextResetDate
        });
      }

      // Call atomic database function with original transaction ID support
      const { data, error } = await supabase.rpc('check_and_increment_usage', {
        p_user_id: databaseKey,  // Use the appropriate database key
        p_plan_type: planDetails.planType,
        p_usage_limit: planDetails.usageLimit,
        p_billing_cycle_start: planDetails.billingCycleStart,
        p_next_reset_date: planDetails.nextResetDate,
        p_original_purchase_date: planDetails.originalPurchaseDate,
        p_store_transaction_id: planDetails.storeTransactionId,
        p_original_transaction_id: originalTransactionId
      });

      if (error) {
        if (__DEV__) {
          console.error('❌ Database function error:', error);
        }
        return false;
      }

      if (__DEV__) {
        console.log('🔍 Atomic function response:', { data, error });
        console.log(data ? '✅ Usage incremented successfully' : '❌ Usage increment blocked (at limit)');
        
        // Verify what the count actually is after increment
        if (data) {
          const { data: verifyData } = await supabase
            .from('user_video_usage')
            .select('back_to_life_count, last_video_date')
            .eq('user_id', databaseKey)
            .single();
          console.log('🔍 Verification query after increment:', verifyData);
        }
      }

      return Boolean(data);
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to check and increment usage:', error);
      }
      return false;
    }
  },

  /**
   * Rollback usage increment when video generation fails
   * Call this if video generation fails after successful checkAndIncrementUsage()
   */
  async rollbackUsage(): Promise<boolean> {
    try {
      // Only allow rollback for Pro users (free users can't generate videos)
      const planDetails = await getSubscriptionPlanDetails();
      if (!planDetails || planDetails.planType === 'free') {
        if (__DEV__) {
          console.log('🎬 BackToLife: No rollback needed for free users');
        }
        return false;
      }

      const subscriberKey = await getVideoTrackingId();
      if (!subscriberKey) {
        if (__DEV__) {
          console.log('⚠️ No subscriber key for rollback');
        }
        return false;
      }

      const databaseKey = subscriberKey;

      if (__DEV__) {
        console.log('🔄 Rolling back usage increment (Bulletproof Strategy):', {
          subscriber_key: subscriberKey,
          database_key: databaseKey
        });
      }

      const { data, error } = await supabase.rpc('rollback_usage', {
        p_user_id: databaseKey
      });

      if (error) {
        if (__DEV__) {
          console.error('❌ Rollback function error:', error);
        }
        return false;
      }

      if (__DEV__) {
        console.log(data ? '✅ Usage rollback successful' : '⚠️ No rollback needed');
      }

      return Boolean(data);
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to rollback usage:', error);
      }
      return false;
    }
  },

  /**
   * Get existing usage record or create new one with current billing cycle
   * Handles billing cycle resets automatically (bulletproof subscriber-based approach)
   * 
   * @param databaseKey - Primary key for database (subscriber key: orig: or stable:)
   * @param subscriberKey - The subscriber key for record creation
   * @param planDetails - Subscription plan information
   */
  async getOrCreateUsageRecord(databaseKey: string, subscriberKey: string, planDetails: any) {
    // Try to get existing record using the database key
    const { data: existingRecord, error: fetchError } = await supabase
      .from('user_video_usage')
      .select('*')
      .eq('user_id', databaseKey)
      .single();

    // If record doesn't exist, create it
    if (fetchError?.code === 'PGRST116' || !existingRecord) {
      const newRecord = {
        user_id: databaseKey,  // Use subscriber key as primary key
        back_to_life_count: 0,
        plan_type: planDetails.planType,
        usage_limit: planDetails.usageLimit,
        billing_cycle_start: planDetails.billingCycleStart,
        next_reset_date: planDetails.nextResetDate,
        original_purchase_date: planDetails.originalPurchaseDate,
        store_transaction_id: planDetails.storeTransactionId,
        last_video_date: null,
        updated_at: new Date().toISOString()
      };

      if (__DEV__) {
        console.log('📊 Creating new usage record:', {
          subscriber_key: subscriberKey,
          database_key: databaseKey
        });
      }

      const { data, error } = await supabase
        .from('user_video_usage')
        .insert(newRecord)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    // Check if billing cycle needs reset
    // Truth-based approach: Compare store transaction IDs instead of time hacks
    const currentTransactionId = planDetails.storeTransactionId;
    const existingTransactionId = existingRecord.store_transaction_id;
    
    // Reset if:
    // 1. We have a new transaction ID (new subscription), OR
    // 2. No existing transaction ID (legacy record), OR  
    // 3. Current time is past the reset date (fallback for edge cases)
    const now = new Date();
    const existingNextReset = new Date(existingRecord.next_reset_date);
    
    const hasNewTransaction = currentTransactionId && currentTransactionId !== existingTransactionId;
    const isLegacyRecord = !existingTransactionId;
    const isPastResetDate = now >= existingNextReset;
    
    const needsReset = hasNewTransaction || isLegacyRecord || isPastResetDate;
    
    if (__DEV__) {
      console.log('🔍 Billing cycle reset check:', {
        currentTransactionId,
        existingTransactionId,
        existingNextReset: existingNextReset.toISOString(),
        now: now.toISOString(),
        hasNewTransaction,
        isLegacyRecord,
        isPastResetDate,
        needsReset
      });
    }
    
    if (needsReset) {
      if (__DEV__) {
        console.log('🔄 Billing cycle reset detected');
      }
      
      // Reset usage for new billing cycle
      const resetRecord = {
        back_to_life_count: 0,
        plan_type: planDetails.planType,
        usage_limit: planDetails.usageLimit,
        billing_cycle_start: planDetails.billingCycleStart,
        next_reset_date: planDetails.nextResetDate,
        original_purchase_date: planDetails.originalPurchaseDate,
        store_transaction_id: planDetails.storeTransactionId,
        last_video_date: null, // Reset daily usage for new billing cycle
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_video_usage')
        .update(resetRecord)
        .eq('user_id', databaseKey)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    return existingRecord;
  }
};

/**
 * Get current video usage status for UI display (without incrementing)
 * Returns detailed information about usage, limits, and reset timing
 */
export const getVideoUsageStatus = async (): Promise<{
  canUse: boolean;
  currentCount: number;
  limit: number;
  nextResetDate: string | null;
  daysUntilReset: number | null;
  planType: string;
  trackingId: string | null;
  isPro: boolean;
} | null> => {
  try {
    if (__DEV__) {
      console.log('📊 [VIDEO] Getting usage status for UI display...');
    }

    // Get subscription details
    const planDetails = await getSubscriptionPlanDetails();
    if (!planDetails) {
      if (__DEV__) {
        console.log('❌ [VIDEO] No subscription plan details - user is not Pro');
      }
      return null; // Not a Pro user
    }

    // Get tracking ID
    const trackingId = await getVideoTrackingId();
    if (!trackingId) {
      if (__DEV__) {
        console.log('❌ [VIDEO] No tracking ID available');
      }
      return null;
    }

    if (__DEV__) {
      console.log('🔍 [VIDEO] Getting usage status for:', {
        trackingId,
        planType: planDetails.planType,
        limit: planDetails.usageLimit
      });
    }

    // Call database function to get current status
    const { data, error } = await supabase.rpc('get_video_usage_status', {
      p_user_id: trackingId
    });

    if (error) {
      if (__DEV__) {
        console.error('❌ [VIDEO] Database error getting usage status:', error);
      }
      return null;
    }

    const status = Array.isArray(data) ? data[0] : data;
    
    if (__DEV__) {
      console.log('✅ [VIDEO] Usage status retrieved:', status);
    }

    return {
      canUse: status?.can_use_today || false,
      currentCount: status?.current_count || 0,
      limit: status?.usage_limit || planDetails.usageLimit,
      nextResetDate: status?.next_reset_date || null,
      daysUntilReset: status?.days_until_reset || null,
      planType: status?.plan_type || planDetails.planType,
      trackingId,
      isPro: true
    };

  } catch (error) {
    if (__DEV__) {
      console.error('❌ [VIDEO] Failed to get usage status:', error);
    }
    return null;
  }
};