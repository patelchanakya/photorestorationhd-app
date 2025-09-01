import { supabase, logSupabaseIssue } from './supabaseClient';
import { getOrCreateCustomUserId } from './trackingIds';
import type { OnboardingData } from '../utils/onboarding';
import { networkSafeOperationWithQueue } from '@/utils/networkSafeOperation';
import * as Crypto from 'expo-crypto';

export interface OnboardingMetadata {
  id?: string;
  user_id: string; // Device ID for privacy
  selected_features: string[];
  primary_interest: string;
  free_attempt_used: boolean;
  free_attempt_feature?: string;
  created_at?: string;
  updated_at?: string;
  // New fields
  onboarding_version?: string;
  completed_at?: string;
  completion_status?: 'completed' | 'abandoned' | 'partial';
  drop_off_step?: string;
  time_to_complete_seconds?: number;
  permissions_granted?: Record<string, boolean>;
  custom_prompt?: string;
  referral_source?: string;
  device_info?: Record<string, any>;
  experiment_variant?: string;
  experiment_id?: string;
  session_id?: string;
}

export interface StepTrackingData {
  stepName: string;
  status: 'viewed' | 'completed' | 'skipped' | 'abandoned';
  timeSpentSeconds?: number;
  stepData?: Record<string, any>;
}

export interface FeatureInteractionData {
  featureId: string;
  interactionType: 'viewed' | 'selected' | 'deselected' | 'tried' | 'completed';
  interactionOrder?: number;
  interactionDurationMs?: number;
  featureMetadata?: Record<string, any>;
}

export interface ConversionEventData {
  conversionType: 'free_trial' | 'subscription' | 'first_edit' | 'share' | 'app_review' | 'referral';
  conversionValue?: number;
  triggerFeature?: string;
  conversionMetadata?: Record<string, any>;
  revenueCatTransactionId?: string;
}

// Session management
let currentSessionId: string | null = null;
let sessionStartTime: number | null = null;

export const onboardingTrackingService = {
  /**
   * Start a new onboarding session
   */
  async startOnboardingSession(version: string = 'v3'): Promise<string> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      const sessionId = Crypto.randomUUID();
      
      currentSessionId = sessionId;
      sessionStartTime = Date.now();
      
      // Create or update onboarding record with session info  
      // Use upsert with merge to update existing records instead of failing
      const { data, error } = await supabase
        .from('user_onboarding')
        .upsert({
          user_id: deviceId,
          session_id: sessionId,
          onboarding_version: version,
          selected_features: [],
          primary_interest: '',
          completion_status: 'partial',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select('id')
        .single();

      if (error) {
        logSupabaseIssue('Failed to start onboarding session', { error, deviceId, sessionId });
      } else if (__DEV__) {
        console.log('📱 Onboarding session started:', sessionId);
      }
      
      return sessionId;
    } catch (error) {
      logSupabaseIssue('Exception starting onboarding session', error);
      return Crypto.randomUUID(); // Fallback to local session ID
    }
  },

  /**
   * Get current session ID or create one
   */
  getCurrentSessionId(): string {
    if (!currentSessionId) {
      currentSessionId = Crypto.randomUUID();
      sessionStartTime = Date.now();
    }
    return currentSessionId;
  },

  /**
   * Track onboarding step progress
   */
  async trackStepProgress(data: StepTrackingData): Promise<void> {
    await networkSafeOperationWithQueue(async () => {
      const deviceId = await getOrCreateCustomUserId();
      const sessionId = this.getCurrentSessionId();
      
      const { error } = await supabase
        .from('onboarding_steps')
        .insert({
          user_id: deviceId,
          session_id: sessionId,
          step_name: data.stepName,
          step_status: data.status,
          time_spent_seconds: data.timeSpentSeconds || 0,
          step_data: data.stepData || {}
        });

      if (error) {
        throw error;
      } else if (__DEV__) {
        console.log('📊 Step tracked:', data.stepName, data.status);
      }
    }, `track step: ${data.stepName}`, true);
  },

  /**
   * Track feature interactions
   */
  async trackFeatureInteraction(data: FeatureInteractionData): Promise<void> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      const sessionId = this.getCurrentSessionId();
      
      const { error } = await supabase
        .from('feature_interactions')
        .insert({
          user_id: deviceId,
          session_id: sessionId,
          feature_id: data.featureId,
          interaction_type: data.interactionType,
          interaction_order: data.interactionOrder,
          interaction_duration_ms: data.interactionDurationMs || 0,
          feature_metadata: data.featureMetadata || {}
        });

      if (error) {
        logSupabaseIssue('Failed to track feature interaction', { error, data });
      } else if (__DEV__) {
        console.log('🎯 Feature interaction tracked:', data.featureId, data.interactionType);
      }
    } catch (error) {
      logSupabaseIssue('Exception tracking feature interaction', error);
    }
  },

  /**
   * Track conversion events
   */
  async trackConversionEvent(data: ConversionEventData): Promise<void> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      const sessionId = currentSessionId;
      
      // Use the database function for accurate time calculation
      const { error } = await supabase
        .rpc('track_conversion_event', {
          p_user_id: deviceId,
          p_session_id: sessionId,
          p_conversion_type: data.conversionType,
          p_conversion_value: data.conversionValue || null,
          p_trigger_feature: data.triggerFeature || null,
          p_conversion_metadata: data.conversionMetadata || {},
          p_revenue_cat_transaction_id: data.revenueCatTransactionId || null
        });

      if (error) {
        logSupabaseIssue('Failed to track conversion event', { error, data });
      } else if (__DEV__) {
        console.log('💰 Conversion tracked:', data.conversionType, data.triggerFeature);
      }
    } catch (error) {
      logSupabaseIssue('Exception tracking conversion event', error);
    }
  },

  /**
   * Update device and permission info
   */
  async updateDeviceInfo(deviceInfo: Record<string, any>, permissions: Record<string, boolean>): Promise<void> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      
      const { error } = await supabase
        .from('user_onboarding')
        .update({
          device_info: deviceInfo,
          permissions_granted: permissions,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        logSupabaseIssue('Failed to update device info', { error, deviceInfo, permissions });
      } else if (__DEV__) {
        console.log('📱 Device info updated');
      }
    } catch (error) {
      logSupabaseIssue('Exception updating device info', error);
    }
  },

  /**
   * Mark onboarding as completed
   */
  async completeOnboarding(status: 'completed' | 'abandoned' = 'completed', dropOffStep?: string): Promise<void> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      
      // Calculate completion time
      const completionTime = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : null;
      
      const { error } = await supabase
        .rpc('complete_user_onboarding', {
          p_user_id: deviceId,
          p_completion_status: status
        });

      // Also update additional fields
      if (!error) {
        await supabase
          .from('user_onboarding')
          .update({
            drop_off_step: dropOffStep,
            time_to_complete_seconds: completionTime
          })
          .eq('user_id', deviceId)
          .order('created_at', { ascending: false })
          .limit(1);
      }

      if (error) {
        logSupabaseIssue('Failed to complete onboarding', { error, status, dropOffStep });
      } else if (__DEV__) {
        console.log('✅ Onboarding completed:', status);
      }
      
      // Reset session
      currentSessionId = null;
      sessionStartTime = null;
    } catch (error) {
      logSupabaseIssue('Exception completing onboarding', error);
    }
  },
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

  /**
   * Get funnel analytics - shows drop-off at each step
   */
  async getFunnelAnalytics(daysBack: number = 30): Promise<{
    stepName: string;
    totalUsers: number;
    completedUsers: number;
    completionRate: number;
    avgTimeSpentSeconds: number;
  }[] | null> {
    try {
      const { data, error } = await supabase
        .from('onboarding_steps')
        .select('step_name, step_status, time_spent_seconds, user_id')
        .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        logSupabaseIssue('Failed to get funnel analytics', error);
        return null;
      }

      const stepStats: Record<string, {
        totalUsers: Set<string>;
        completedUsers: Set<string>;
        totalTimeSpent: number;
        interactions: number;
      }> = {};

      data.forEach((record) => {
        if (!stepStats[record.step_name]) {
          stepStats[record.step_name] = {
            totalUsers: new Set(),
            completedUsers: new Set(),
            totalTimeSpent: 0,
            interactions: 0
          };
        }

        const stat = stepStats[record.step_name];
        stat.totalUsers.add(record.user_id);
        stat.totalTimeSpent += record.time_spent_seconds || 0;
        stat.interactions++;

        if (record.step_status === 'completed') {
          stat.completedUsers.add(record.user_id);
        }
      });

      return Object.entries(stepStats).map(([stepName, stats]) => ({
        stepName,
        totalUsers: stats.totalUsers.size,
        completedUsers: stats.completedUsers.size,
        completionRate: stats.totalUsers.size > 0 ? (stats.completedUsers.size / stats.totalUsers.size) * 100 : 0,
        avgTimeSpentSeconds: stats.interactions > 0 ? stats.totalTimeSpent / stats.interactions : 0
      }));
    } catch (error) {
      logSupabaseIssue('Exception getting funnel analytics', error);
      return null;
    }
  },

  /**
   * Get feature popularity from database function
   */
  async getFeaturePopularityStats(daysBack: number = 30): Promise<{
    featureId: string;
    interactionType: string;
    interactionCount: number;
    uniqueUsers: number;
    avgInteractionDurationMs: number;
  }[] | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_feature_popularity_stats', { days_back: daysBack });

      if (error) {
        logSupabaseIssue('Failed to get feature popularity stats', error);
        return null;
      }

      return data;
    } catch (error) {
      logSupabaseIssue('Exception getting feature popularity stats', error);
      return null;
    }
  },

  /**
   * Get conversion rates from database function
   */
  async getConversionRates(daysBack: number = 30, conversionType?: string): Promise<{
    conversionType: string;
    triggerFeature: string;
    conversionCount: number;
    totalUsersWithFeature: number;
    conversionRate: number;
    avgTimeToConvertHours: number;
    totalRevenue: number;
  }[] | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_conversion_rates', { 
          days_back: daysBack,
          conversion_type_filter: conversionType 
        });

      if (error) {
        logSupabaseIssue('Failed to get conversion rates', error);
        return null;
      }

      return data;
    } catch (error) {
      logSupabaseIssue('Exception getting conversion rates', error);
      return null;
    }
  },

  /**
   * Get user journey for debugging
   */
  async getUserJourney(userId?: string): Promise<{
    steps: any[];
    interactions: any[];
    conversions: any[];
  } | null> {
    try {
      const deviceId = userId || await getOrCreateCustomUserId();
      
      // Get steps
      const { data: steps, error: stepsError } = await supabase
        .from('onboarding_steps')
        .select('*')
        .eq('user_id', deviceId)
        .order('created_at');

      // Get interactions
      const { data: interactions, error: interactionsError } = await supabase
        .rpc('get_user_feature_journey', { p_user_id: deviceId });

      // Get conversions
      const { data: conversions, error: conversionsError } = await supabase
        .rpc('get_user_conversion_timeline', { p_user_id: deviceId });

      if (stepsError || interactionsError || conversionsError) {
        logSupabaseIssue('Failed to get user journey', { 
          stepsError, 
          interactionsError, 
          conversionsError 
        });
        return null;
      }

      return {
        steps: steps || [],
        interactions: interactions || [],
        conversions: conversions || []
      };
    } catch (error) {
      logSupabaseIssue('Exception getting user journey', error);
      return null;
    }
  },

  /**
   * Get comprehensive onboarding metrics
   */
  async getComprehensiveMetrics(daysBack: number = 30): Promise<{
    totalUsers: number;
    completionRate: number;
    avgTimeToComplete: number;
    topFeatures: string[];
    conversionRate: number;
    totalRevenue: number;
  } | null> {
    try {
      const [onboardingData, conversions] = await Promise.all([
        supabase
          .from('user_onboarding')
          .select('completion_status, time_to_complete_seconds, selected_features')
          .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()),
        
        supabase
          .from('onboarding_conversions')
          .select('conversion_type, conversion_value')
          .eq('conversion_type', 'subscription')
          .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
      ]);

      if (onboardingData.error || conversions.error) {
        logSupabaseIssue('Failed to get comprehensive metrics', { 
          onboardingError: onboardingData.error,
          conversionsError: conversions.error
        });
        return null;
      }

      const totalUsers = onboardingData.data.length;
      const completedUsers = onboardingData.data.filter(u => u.completion_status === 'completed').length;
      const completionRate = totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0;
      
      const completedUsersWithTime = onboardingData.data.filter(u => 
        u.completion_status === 'completed' && u.time_to_complete_seconds
      );
      const avgTimeToComplete = completedUsersWithTime.length > 0 
        ? completedUsersWithTime.reduce((sum, u) => sum + u.time_to_complete_seconds, 0) / completedUsersWithTime.length 
        : 0;

      // Calculate feature popularity
      const featureCount: Record<string, number> = {};
      onboardingData.data.forEach(user => {
        user.selected_features.forEach((feature: string) => {
          featureCount[feature] = (featureCount[feature] || 0) + 1;
        });
      });
      
      const topFeatures = Object.entries(featureCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([feature]) => feature);

      const totalRevenue = conversions.data.reduce((sum, conv) => 
        sum + (conv.conversion_value || 0), 0
      );
      
      const conversionRate = totalUsers > 0 ? (conversions.data.length / totalUsers) * 100 : 0;

      return {
        totalUsers,
        completionRate,
        avgTimeToComplete,
        topFeatures,
        conversionRate,
        totalRevenue
      };
    } catch (error) {
      logSupabaseIssue('Exception getting comprehensive metrics', error);
      return null;
    }
  }
};