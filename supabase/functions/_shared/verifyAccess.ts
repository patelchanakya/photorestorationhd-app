/**
 * Shared access verification utilities for edge functions
 * Direct database checks without caching
 */

export interface AccessVerificationResult {
  canUse: boolean;
  isPro: boolean;
  planType: 'free' | 'weekly' | 'monthly';
  reason?: string;
  code?: string;
}

/**
 * Simple subscription verification for edge functions
 * Since subscription cache was removed, this now does basic checks
 * The app handles the main subscription logic via RevenueCat
 */
export async function verifySubscriptionAccess(
  supabase: any,
  userId: string,
  requiredFeature: 'unlimited_photos' | 'video_generation' | 'premium_styles' = 'unlimited_photos'
): Promise<AccessVerificationResult> {
  try {
    // For videos, check if user has a transaction ID (Pro users only)
    if (requiredFeature === 'video_generation') {
      // Transaction ID format: store:xxxxx
      if (!userId || !userId.startsWith('store:')) {
        return {
          canUse: false,
          isPro: false,
          planType: 'free',
          reason: 'Video generation requires Pro subscription',
          code: 'PRO_REQUIRED'
        };
      }
      
      // Valid transaction ID means Pro user
      return {
        canUse: true,
        isPro: true,
        planType: 'monthly', // Default to monthly for Pro users
      };
    }
    
    // For photos, check if it's an anonymous ID (free) or transaction ID (pro)
    if (requiredFeature === 'unlimited_photos') {
      // Anonymous ID format: $RCAnonymousID:xxxxx
      if (userId && userId.startsWith('$RCAnonymousID:')) {
        // Free user - limited photos
        return {
          canUse: true, // Will be limited by usage tracking
          isPro: false,
          planType: 'free',
        };
      }
      
      // No tracking ID or transaction ID = Pro user (unlimited)
      return {
        canUse: true,
        isPro: true,
        planType: 'monthly',
      };
    }
    
    // Default: allow access
    return {
      canUse: true,
      isPro: false,
      planType: 'free',
    };

  } catch (error) {
    console.error('❌ Access verification failed:', error);
    
    // Fail open for critical errors - allow request to proceed
    return {
      canUse: true,
      isPro: false,
      planType: 'free',
      reason: 'Verification error, allowing request',
      code: 'VERIFICATION_ERROR'
    };
  }
}

/**
 * Check if user can access specific feature based on subscription
 */
function checkFeatureAccess(
  isPro: boolean,
  planType: 'free' | 'weekly' | 'monthly',
  feature: 'unlimited_photos' | 'video_generation' | 'premium_styles'
): boolean {
  switch (feature) {
    case 'unlimited_photos':
      return isPro; // Any Pro plan gets unlimited photos
    
    case 'video_generation':
      return isPro && planType !== 'free'; // Only Pro plans (weekly/monthly)
    
    case 'premium_styles':
      return isPro; // Any Pro plan gets premium styles
    
    default:
      return false; // Unknown feature - deny by default
  }
}

/**
 * Verify user limits (photos/videos) with atomic increment
 * Combines subscription check with usage tracking
 */
export async function verifyAndIncrementUsage(
  supabase: any,
  userId: string,
  feature: 'photos' | 'videos'
): Promise<{
  canUse: boolean;
  reason?: string;
  code?: string;
  currentCount?: number;
  limit?: number;
}> {
  try {
    // First check subscription status
    const accessResult = await verifySubscriptionAccess(
      supabase, 
      userId,
      feature === 'photos' ? 'unlimited_photos' : 'video_generation'
    );

    // If Pro user, allow unlimited access (still track for analytics)
    if (accessResult.isPro && feature === 'photos') {
      // Pro users: no tracking needed for photos (unlimited)
      return { canUse: true };
    }

    if (accessResult.isPro && feature === 'videos') {
      // Pro users: check video limits using transaction ID
      const { data: result, error } = await supabase.rpc('increment_back_to_life_usage', {
        p_user_id: userId // This should be the transaction ID (store:xxxx)
      });

      if (error) {
        console.error('❌ Video usage check failed:', error);
        return {
          canUse: false,
          reason: 'Usage verification failed',
          code: 'USAGE_CHECK_ERROR'
        };
      }

      if (!result?.success) {
        return {
          canUse: false,
          reason: result?.reason || 'Video limit exceeded',
          code: 'VIDEO_LIMIT_EXCEEDED',
          currentCount: result?.current_count,
          limit: result?.limit
        };
      }

      return { 
        canUse: true,
        currentCount: result.current_count,
        limit: result.limit
      };
    }

    // Free user - check photo limits only
    if (!accessResult.isPro && feature === 'photos') {
      // For free users, userId should be $RCAnonymousID:xxxxx
      const { data: canIncrement, error } = await supabase.rpc('check_and_increment_photo_usage', {
        p_user_id: userId,
        p_usage_limit: 5 // Free user limit
      });

      if (error) {
        console.error('❌ Photo usage check failed:', error);
        return {
          canUse: false,
          reason: 'Usage verification failed',
          code: 'USAGE_CHECK_ERROR'
        };
      }

      if (!canIncrement) {
        return {
          canUse: false,
          reason: 'Free photo limit reached (5 photos)',
          code: 'FREE_PHOTO_LIMIT',
          currentCount: 5,
          limit: 5
        };
      }

      return { canUse: true };
    }

    // Free user trying to access videos
    if (!accessResult.isPro && feature === 'videos') {
      return {
        canUse: false,
        reason: 'Video generation requires Pro subscription',
        code: 'PRO_REQUIRED_FOR_VIDEOS'
      };
    }

    // Default deny
    return {
      canUse: false,
      reason: 'Access denied',
      code: 'ACCESS_DENIED'
    };

  } catch (error) {
    console.error('❌ Usage verification failed:', error);
    
    // For usage functions, fail closed (deny access) on errors
    return {
      canUse: false,
      reason: 'Usage verification error',
      code: 'USAGE_ERROR'
    };
  }
}

/**
 * Rollback usage on processing failure
 */
export async function rollbackUsage(
  supabase: any,
  userId: string,
  feature: 'photos' | 'videos'
): Promise<boolean> {
  try {
    if (feature === 'photos') {
      const { error } = await supabase.rpc('rollback_photo_usage', {
        p_user_id: userId
      });
      
      if (error) {
        console.error('❌ Photo usage rollback failed:', error);
        return false;
      }
    } else {
      const { error } = await supabase.rpc('rollback_back_to_life_usage', {
        p_user_id: userId
      });
      
      if (error) {
        console.error('❌ Video usage rollback failed:', error);
        return false;
      }
    }

    console.log('✅ Usage rollback completed for:', { userId, feature });
    return true;

  } catch (error) {
    console.error('❌ Rollback error:', error);
    return false;
  }
}