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
 * Enhanced subscription verification for edge functions with new ID format support
 * Handles original transaction IDs, store transaction IDs, and anonymous IDs
 * The app handles the main subscription logic via RevenueCat
 */
export async function verifySubscriptionAccess(
  supabase: any,
  userId: string,
  requiredFeature: 'unlimited_photos' | 'video_generation' | 'premium_styles' = 'unlimited_photos'
): Promise<AccessVerificationResult> {
  try {
    console.log(`🔍 [EDGE] Verifying access for feature "${requiredFeature}" with userId: ${userId}`);
    console.log(`🔍 [EDGE] User ID details: { length: ${userId?.length}, startsWith: "${userId?.substring(0, 10)}..." }`);
    
    // Validate and parse the user ID format
    const idInfo = parseTrackingId(userId);
    console.log(`🎯 [EDGE] Parsed ID info:`, idInfo);
    
    // For videos, check if user has any Pro transaction ID
    if (requiredFeature === 'video_generation') {
      // Only Pro users with transaction IDs can use videos
      if (!idInfo.isPro) {
        console.log(`❌ [EDGE] Video access denied: ${idInfo.reason}`);
        console.log(`❌ [EDGE] ID validation details:`, { idInfo, userId });
        return {
          canUse: false,
          isPro: false,
          planType: 'free',
          reason: idInfo.reason || 'Video generation requires Pro subscription',
          code: 'PRO_REQUIRED_FOR_VIDEOS'
        };
      }
      
      // ADDITIONAL SECURITY: Check for suspicious patterns that might indicate Apple ID switching
      if (userId.startsWith('store:') || userId.startsWith('orig:')) {
        // Extract the transaction ID
        const transactionId = userId.substring(userId.indexOf(':') + 1);
        
        // Basic validation - transaction IDs should be reasonably long
        if (transactionId.length < 10) {
          console.log(`🚨 [EDGE] SECURITY ALERT: Suspicious short transaction ID: ${transactionId.length} chars`);
          return {
            canUse: false,
            isPro: false,
            planType: 'free',
            reason: 'Invalid transaction ID format',
            code: 'INVALID_TRANSACTION_ID'
          };
        }
        
        // Log transaction ID for monitoring (first 10 chars only for privacy)
        console.log(`🔍 [EDGE] Video access for transaction: ${transactionId.substring(0, 10)}...`);
      }
      
      // Valid Pro user with transaction ID
      console.log(`✅ [EDGE] Video access granted for Pro user with ${idInfo.idType}`);
      console.log(`✅ [EDGE] Pro user details:`, { idInfo, userId });
      return {
        canUse: true,
        isPro: true,
        planType: 'monthly', // Default to monthly for Pro users
      };
    }
    
    // For photos, distinguish between free and Pro users
    if (requiredFeature === 'unlimited_photos') {
      if (idInfo.isPro) {
        // Pro user - unlimited photos
        console.log(`✅ [EDGE] Unlimited photo access for Pro user`);
        return {
          canUse: true,
          isPro: true,
          planType: 'monthly',
        };
      } else {
        // Free user - limited photos
        console.log(`✅ [EDGE] Limited photo access for free user`);
        return {
          canUse: true, // Will be limited by usage tracking
          isPro: false,
          planType: 'free',
        };
      }
    }
    
    // Default: allow access for other features
    console.log(`✅ [EDGE] Default access granted for feature: ${requiredFeature}`);
    return {
      canUse: true,
      isPro: idInfo.isPro,
      planType: idInfo.isPro ? 'monthly' : 'free',
    };

  } catch (error) {
    console.error('❌ [EDGE] Access verification failed:', error);
    
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
 * Parse and validate tracking ID format
 * Returns information about the ID type and user status
 */
function parseTrackingId(userId: string): {
  isPro: boolean;
  idType: string;
  reason?: string;
  isValid: boolean;
} {
  if (!userId || typeof userId !== 'string') {
    return {
      isPro: false,
      idType: 'invalid',
      reason: 'Missing or invalid user ID',
      isValid: false
    };
  }
  
  // Original transaction ID (stable across renewals) - Pro users
  if (userId.startsWith('orig:')) {
    const transactionId = userId.substring(5);
    if (transactionId.length >= 10) {
      return {
        isPro: true,
        idType: 'original_transaction',
        isValid: true
      };
    }
    return {
      isPro: false,
      idType: 'invalid_original_transaction',
      reason: 'Invalid original transaction ID format',
      isValid: false
    };
  }
  
  // Store transaction ID (changes on renewal) - Pro users
  if (userId.startsWith('store:')) {
    const transactionId = userId.substring(6);
    if (transactionId.length >= 10) {
      return {
        isPro: true,
        idType: 'store_transaction',
        isValid: true
      };
    }
    return {
      isPro: false,
      idType: 'invalid_store_transaction',
      reason: 'Invalid store transaction ID format',
      isValid: false
    };
  }
  
  // Fallback ID (emergency case) - Pro users without transaction ID
  if (userId.startsWith('fallback:')) {
    const fallbackId = userId.substring(9);
    if (fallbackId.startsWith('$RCAnonymousID:') && fallbackId.length > 20) {
      return {
        isPro: true, // Pro user using fallback (subscription verified but no transaction ID available)
        idType: 'fallback_anonymous',
        isValid: true
      };
    }
    return {
      isPro: false,
      idType: 'invalid_fallback',
      reason: 'Invalid fallback ID format',
      isValid: false
    };
  }
  
  // RevenueCat anonymous ID - Free users
  if (userId.startsWith('$RCAnonymousID:')) {
    if (userId.length > 20) {
      return {
        isPro: false,
        idType: 'anonymous',
        isValid: true
      };
    }
    return {
      isPro: false,
      idType: 'invalid_anonymous',
      reason: 'Invalid anonymous ID format',
      isValid: false
    };
  }
  
  // Legacy or unknown format
  return {
    isPro: false,
    idType: 'unknown',
    reason: 'Unknown ID format',
    isValid: false
  };
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
    } else if (feature === 'videos') {
      const { error } = await supabase.rpc('rollback_video_usage_unified', {
        p_tracking_id: userId
      });
      
      if (error) {
        console.error('❌ Unified video usage rollback failed:', error);
        return false;
      }
      
      console.log('✅ Unified video usage rollback succeeded');
      return true;
    }

    console.log('✅ Unified usage rollback completed for:', { userId, feature });
    return true;

  } catch (error) {
    console.error('❌ Unified rollback error:', error);
    return false;
  }
}