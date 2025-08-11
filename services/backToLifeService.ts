import { getVideoTrackingId, getSubscriptionPlanDetails } from './revenuecat';
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
 * Simple online-only Back to Life usage service
 * No local state, no complex sync - just direct database queries
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

      // Get or create usage record
      const usageRecord = await this.getOrCreateUsageRecord(userId, planDetails);
      
      // Check if user can use today (daily limit: 1 video per day)
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const canUseToday = !usageRecord.last_video_date || usageRecord.last_video_date !== today;
      const hasMonthlyCapacity = usageRecord.back_to_life_count < planDetails.usageLimit;
      
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
   * Increment usage counter after successful video generation
   * Returns true if successful, false if at limit or error
   */
  async incrementUsage(): Promise<boolean> {
    try {
      // First check if user can use the feature
      const usage = await this.checkUsage();
      if (!usage.canUse) {
        if (__DEV__) {
          console.log('⚠️ Cannot increment - user at limit or not eligible');
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

      // Increment the counter and set today's date
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const { error } = await supabase
        .from('user_video_usage')
        .update({ 
          back_to_life_count: usage.used + 1,
          last_video_date: today,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      if (__DEV__) {
        console.log(`✅ Back to Life usage incremented: ${usage.used + 1}/${usage.limit}`);
      }

      return true;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to increment Back to Life usage:', error);
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
    const needsReset = existingRecord.billing_cycle_start !== planDetails.billingCycleStart;
    
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