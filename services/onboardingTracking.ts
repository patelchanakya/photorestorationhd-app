import { supabase, logSupabaseIssue } from './supabaseClient';
import { getOrCreateCustomUserId } from './trackingIds';
import type { OnboardingData } from '../utils/onboarding';

export interface OnboardingMetadata {
  id?: string;
  user_id: string; // Device ID for privacy
  selected_features: string[];
  primary_interest: string;
  free_attempt_used: boolean;
  free_attempt_feature?: string;
  created_at?: string;
  updated_at?: string;
}

export const onboardingTrackingService = {
  /**
   * Save or update onboarding selections to Supabase for analytics
   */
  async saveOnboardingSelections(data: {
    selectedFeatures: string[];
    primaryInterest: string;
  }): Promise<string | null> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      
      if (__DEV__) {
        console.log('💾 Saving onboarding selections:', { 
          deviceId, 
          selectedFeatures: data.selectedFeatures, 
          primaryInterest: data.primaryInterest 
        });
      }

      // First, check if user already has onboarding data
      const { data: existingData } = await supabase
        .from('user_onboarding')
        .select('id, free_attempt_used')
        .eq('user_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingData) {
        // Update existing record
        const { data: result, error } = await supabase
          .from('user_onboarding')
          .update({
            selected_features: data.selectedFeatures,
            primary_interest: data.primaryInterest,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingData.id)
          .select('id')
          .single();

        if (error) {
          logSupabaseIssue('Failed to update onboarding selections', { 
            error, 
            data: { selectedFeatures: data.selectedFeatures, primaryInterest: data.primaryInterest },
            deviceId,
            existingId: existingData.id
          });
          return null;
        }

        if (__DEV__) {
          console.log('✅ Onboarding selections updated:', result.id);
        }
        
        return result.id;
      } else {
        // Create new record
        const { data: result, error } = await supabase
          .from('user_onboarding')
          .insert({
            user_id: deviceId,
            selected_features: data.selectedFeatures,
            primary_interest: data.primaryInterest,
            free_attempt_used: false,
          })
          .select('id')
          .single();

        if (error) {
          logSupabaseIssue('Failed to save onboarding selections', { 
            error, 
            data: { selectedFeatures: data.selectedFeatures, primaryInterest: data.primaryInterest },
            deviceId 
          });
          return null;
        }

        if (__DEV__) {
          console.log('✅ Onboarding selections saved:', result.id);
        }
        
        return result.id;
      }
    } catch (error) {
      logSupabaseIssue('Exception saving onboarding selections', error);
      return null;
    }
  },

  /**
   * Mark free attempt as used
   */
  async markFreeAttemptUsed(feature: string): Promise<void> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      
      const { error } = await supabase
        .from('user_onboarding')
        .update({
          free_attempt_used: true,
          free_attempt_feature: feature,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        logSupabaseIssue('Failed to update free attempt status', error);
        return;
      }

      if (__DEV__) {
        console.log('✅ Free attempt marked as used:', feature);
      }
    } catch (error) {
      logSupabaseIssue('Exception marking free attempt used', error);
    }
  },

  /**
   * Get onboarding analytics (for debugging/admin purposes)
   */
  async getOnboardingStats(): Promise<{
    totalUsers: number;
    featurePopularity: Record<string, number>;
    freeAttemptConversion: number;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('user_onboarding')
        .select('selected_features, primary_interest, free_attempt_used');

      if (error) {
        logSupabaseIssue('Failed to get onboarding stats', error);
        return null;
      }

      const stats = {
        totalUsers: data.length,
        featurePopularity: {} as Record<string, number>,
        freeAttemptConversion: 0,
      };

      let freeAttemptUsers = 0;

      data.forEach((record) => {
        // Count feature popularity
        record.selected_features.forEach((feature: string) => {
          stats.featurePopularity[feature] = (stats.featurePopularity[feature] || 0) + 1;
        });

        // Count primary interest
        const primary = record.primary_interest;
        stats.featurePopularity[`${primary}_primary`] = (stats.featurePopularity[`${primary}_primary`] || 0) + 1;

        // Count free attempt usage
        if (record.free_attempt_used) {
          freeAttemptUsers++;
        }
      });

      stats.freeAttemptConversion = stats.totalUsers > 0 ? (freeAttemptUsers / stats.totalUsers) * 100 : 0;

      return stats;
    } catch (error) {
      logSupabaseIssue('Exception getting onboarding stats', error);
      return null;
    }
  },

  /**
   * Get user's onboarding data from Supabase
   */
  async getUserOnboardingData(): Promise<OnboardingMetadata | null> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      
      const { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error is OK
          logSupabaseIssue('Failed to get user onboarding data', error);
        }
        return null;
      }

      return data;
    } catch (error) {
      logSupabaseIssue('Exception getting user onboarding data', error);
      return null;
    }
  },
};