import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { getSubscriptionPlanDetails } from './revenuecat';
import { getPhotoTrackingId } from './trackingIds';
import { supabase } from './supabaseClient';
import { networkStateService } from './networkState';
import { getFreePhotoLimit } from './usageLimits';

// PhotoUsage type moved here from photoUsageStore
export interface PhotoUsage {
  canUse: boolean;
  used: number;
  limit: number;
  planType: 'free' | 'weekly' | 'monthly';
}

const QUERY_KEYS = {
  photoUsage: ['photo-usage'] as const,
};

/**
 * Check network connectivity and throw user-friendly error if offline
 */
function requireNetwork() {
  if (__DEV__) {
    console.log('🌐 Network check: isOnline =', networkStateService.isOnline);
  }
  
  if (!networkStateService.isOnline) {
    if (__DEV__) {
      console.log('🚨 NETWORK ERROR: Throwing offline error');
    }
    throw new Error('Network connection required for photo processing. Please check your internet connection and try again.');
  }
  
  if (__DEV__) {
    console.log('✅ Network check passed');
  }
}

/**
 * Photo Usage Service with TanStack Query for optimal UX
 * Provides caching, optimistic updates, and automatic background refresh
 * Requires network connection for all operations (no offline support)
 */
export const photoUsageService = {
  
  /**
   * Fetch photo usage data from database
   */
  async fetchPhotoUsage(): Promise<PhotoUsage> {
    try {
      console.log('📸 [TEST] Starting photo usage fetch...');
      requireNetwork(); // Network required for all operations
      
      // Get subscription plan to determine user type
      console.log('🔍 [TEST] Getting subscription plan details...');
      const planDetails = await getSubscriptionPlanDetails();
      console.log('📊 [TEST] Plan details:', planDetails);
      
      // Pro users: unlimited photos
      if (planDetails) {
        console.log('✅ [TEST] Pro user detected - unlimited photos');
        const result: PhotoUsage = {
          canUse: true,
          used: 0,
          limit: -1, // Unlimited
          planType: planDetails.planType as 'weekly' | 'monthly'
        };
        console.log('📸 [TEST] Returning Pro photo usage:', result);
        return result;
      }
      
      console.log('👤 [TEST] Free user detected - checking photo limits');
      // Free users: configurable photo limit
      const freeLimit = getFreePhotoLimit();
      console.log('📊 [TEST] Free photo limit:', freeLimit);
      
      const photoKey = await getPhotoTrackingId('free');
      console.log('🔑 [TEST] Photo tracking ID:', photoKey);
      
      if (!photoKey) {
        console.log('❌ [TEST] No photo tracking ID - returning blocked state');
        return { 
          canUse: false, 
          used: 0, 
          limit: freeLimit, 
          planType: 'free' 
        };
      }
      
      // Get usage from database
      console.log('🗄️ [TEST] Querying database for photo usage...');
      const { data, error } = await supabase.rpc('get_photo_usage', {
        p_user_id: photoKey
      });
      
      if (error) {
        console.error('❌ [TEST] Database error:', error);
        throw error;
      }
      
      console.log('📊 [TEST] Database response:', data);
      const usage = data?.[0];
      
      if (!usage) {
        console.log('✨ [TEST] No usage record found - new user');
        // No record exists, user hasn't used any photos yet
        const result: PhotoUsage = {
          canUse: true,
          used: 0,
          limit: freeLimit,
          planType: 'free' as const
        };
        console.log('📸 [TEST] Returning new user photo usage:', result);
        return result;
      }
      
      const result: PhotoUsage = {
        canUse: usage.can_use,
        used: usage.photo_count,
        limit: usage.usage_limit,
        planType: 'free' as const
      };
      console.log('📸 [TEST] Returning existing user photo usage:', result);
      return result;
    } catch (error) {
      console.error('❌ [TEST] Failed to fetch photo usage:', error);
      
      // Return safe defaults on error
      const freeLimit = getFreePhotoLimit();
      const result: PhotoUsage = {
        canUse: false,
        used: 0,
        limit: freeLimit,
        planType: 'free' as const
      };
      console.log('⚠️ [TEST] Returning error fallback photo usage:', result);
      return result;
    }
  },

  /**
   * Atomically check and increment photo usage
   */
  async checkAndIncrementUsage(): Promise<boolean> {
    try {
      requireNetwork(); // Network required for all operations
      
      const planDetails = await getSubscriptionPlanDetails();
      
      // Pro users: unlimited (no increment needed)
      if (planDetails) {
        return true;
      }
      
      // Free users: atomic increment
      const photoKey = await getPhotoTrackingId('free');
      if (!photoKey) return false;
      
      const freeLimit = getFreePhotoLimit();
      const { data, error } = await supabase.rpc('check_and_increment_photo_usage', {
        p_user_id: photoKey,
        p_usage_limit: freeLimit
      });
      
      if (error) {
        if (__DEV__) {
          console.error('❌ Photo usage increment error:', error);
        }
        return false;
      }
      
      const success = Boolean(data);
      
      if (__DEV__) {
        console.log(success ? '✅ Photo usage incremented' : '❌ Photo limit reached');
      }
      
      return success;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to increment photo usage:', error);
      }
      return false;
    }
  },

  /**
   * Rollback photo usage increment (on failure)
   */
  async rollbackUsage(): Promise<boolean> {
    try {
      requireNetwork(); // Network required for all operations
      
      const photoKey = await getPhotoTrackingId('free');
      if (!photoKey) return false;
      
      const { data, error } = await supabase.rpc('rollback_photo_usage', {
        p_user_id: photoKey
      });
      
      if (error) {
        if (__DEV__) {
          console.error('❌ Photo usage rollback error:', error);
        }
        return false;
      }
      
      const success = Boolean(data);
      
      if (__DEV__) {
        console.log(success ? '🔄 Photo usage rolled back' : '⚠️ No rollback needed');
      }
      
      return success;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to rollback photo usage:', error);
      }
      return false;
    }
  },

  /**
   * Check if user can use photos (convenience method)
   */
  async checkUsage(): Promise<PhotoUsage> {
    return this.fetchPhotoUsage();
  }
};

/**
 * React Query hook for photo usage - simplified for instant updates
 */
export const usePhotoUsage = () => {
  return useQuery({
    queryKey: QUERY_KEYS.photoUsage,
    queryFn: photoUsageService.fetchPhotoUsage,
    staleTime: 0, // Always fresh from DB
    gcTime: 30 * 1000, // 30 seconds cache (short)
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: 2,
  });
};

/**
 * Mutation for photo usage increment (simplified - no optimistic updates)
 */
export const usePhotoUsageIncrement = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: photoUsageService.checkAndIncrementUsage,
    onSettled: () => {
      // Always refetch to get fresh data from DB
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photoUsage });
    },
  });
};

/**
 * Mutation for photo usage rollback (simplified - no optimistic updates)
 */
export const usePhotoUsageRollback = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: photoUsageService.rollbackUsage,
    onSettled: () => {
      // Always refetch to get fresh data from DB
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photoUsage });
    },
  });
};

/**
 * Hook to invalidate photo usage cache (for subscription changes)
 */
export const useInvalidatePhotoUsage = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photoUsage });
  };
};