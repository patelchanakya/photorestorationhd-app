import { getSubscriptionPlanDetails, getVideoTrackingId } from './revenuecat';
import { supabase } from './supabaseClient';

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
   */
  async checkUsage(): Promise<BackToLifeUsage> {
    try {
      // Get subscription details from RevenueCat
      const planDetails = await getSubscriptionPlanDetails();
      if (!planDetails) {
        if (__DEV__) {
          console.log('🎬 BackToLife: No subscription plan details available');
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

      // Get stable tracking ID for video usage
      const userId = await getVideoTrackingId();
      if (!userId) {
        if (__DEV__) {
          console.log('🎬 BackToLife: No video tracking ID available');
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

      if (__DEV__) {
        console.log('📊 BackToLife Usage Check:', {
          user_id: userId,
          plan_type: planDetails.planType,
          usage_limit: planDetails.usageLimit,
          billing_cycle_start: planDetails.billingCycleStart,
          next_reset_date: planDetails.nextResetDate
        });
      }

      // Get or create usage record
      const usageRecord = await this.getOrCreateUsageRecord(userId, planDetails);
      
      // Check if user can use today (daily limit: 1 video per day for weekly plans only)
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const hasMonthlyCapacity = usageRecord.back_to_life_count < planDetails.usageLimit;
      
      // Daily limits only apply to weekly plans, monthly plans have no daily restrictions
      let canUseToday = true;
      if (planDetails.planType === 'weekly') {
        canUseToday = !usageRecord.last_video_date || usageRecord.last_video_date !== today;
      }
      
      if (__DEV__) {
        console.log('🎬 BackToLife Usage Status:', {
          user_id: userId,
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
      if (!planDetails) {
        if (__DEV__) {
          console.log('🎬 BackToLife: No subscription plan details for increment');
        }
        return false;
      }

      const userId = await getVideoTrackingId();
      if (!userId) {
        if (__DEV__) {
          console.log('⚠️ No video tracking ID for usage increment');
        }
        return false;
      }

      if (__DEV__) {
        console.log('🔒 Attempting atomic usage increment:', {
          user_id: userId,
          plan_type: planDetails.planType,
          usage_limit: planDetails.usageLimit
        });
      }

      // Call atomic database function
      const { data, error } = await supabase.rpc('check_and_increment_usage', {
        p_user_id: userId,
        p_plan_type: planDetails.planType,
        p_usage_limit: planDetails.usageLimit,
        p_billing_cycle_start: planDetails.billingCycleStart,
        p_next_reset_date: planDetails.nextResetDate,
        p_original_purchase_date: planDetails.originalPurchaseDate,
        p_store_transaction_id: planDetails.storeTransactionId
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
            .eq('user_id', userId)
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
      const userId = await getVideoTrackingId();
      if (!userId) {
        if (__DEV__) {
          console.log('⚠️ No video tracking ID for rollback');
        }
        return false;
      }

      if (__DEV__) {
        console.log('🔄 Rolling back usage increment for user:', userId);
      }

      const { data, error } = await supabase.rpc('rollback_usage', {
        p_user_id: userId
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
   * Handles billing cycle resets automatically
   */
  async getOrCreateUsageRecord(userId: string, planDetails: any) {
    // Try to get existing record
    const { data: existingRecord, error: fetchError } = await supabase
      .from('user_video_usage')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If record doesn't exist, create it
    if (fetchError?.code === 'PGRST116' || !existingRecord) {
      const newRecord = {
        user_id: userId,
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
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    return existingRecord;
  }
};