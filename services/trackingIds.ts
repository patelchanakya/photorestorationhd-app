import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Purchases from 'react-native-purchases';
import { getCustomerInfo, getSubscriptionPlanDetails } from './revenuecat';

const CUSTOM_USER_ID_KEY = 'rc_custom_user_id';

/**
 * Get or create a stable custom user ID using SecureStore (survives reinstalls)
 * This is used for bulletproof tracking that prevents reinstall abuse
 */
export const getOrCreateCustomUserId = async (): Promise<string | null> => {
  try {
    // Try to get existing ID from SecureStore
    let customUserId = await SecureStore.getItemAsync(CUSTOM_USER_ID_KEY);
    
    if (!customUserId) {
      // Generate new stable ID using Crypto.randomUUID()
      customUserId = await Crypto.randomUUID();
      
      // Store in SecureStore (survives app reinstalls)
      await SecureStore.setItemAsync(CUSTOM_USER_ID_KEY, customUserId);
      
      if (__DEV__) {
        console.log('🔑 Generated new custom user ID:', customUserId);
      }
    } else {
      if (__DEV__) {
        console.log('🔑 Retrieved existing custom user ID:', customUserId);
      }
    }
    
    return customUserId;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to get/create custom user ID:', error);
    }
    return null;
  }
};

/**
 * Get photo tracking ID - simplified to use RevenueCat anonymous IDs
 * Pro users return null (unlimited photos, no tracking needed)
 * Free users use RevenueCat anonymous ID (same as existing users)
 */
export const getPhotoTrackingId = async (planType: string): Promise<string | null> => {
  try {
    if (planType !== 'free') {
      // Pro users: unlimited photos (no tracking)
      return null;
    }

    // Free users: use RevenueCat anonymous ID for simplicity
    // This matches how existing users work and eliminates complex ID mapping
    const { getCustomerInfo } = await import('./revenuecat');
    const customerInfo = await getCustomerInfo();
    
    if (!customerInfo?.originalAppUserId) {
      console.error('❌ No RevenueCat user ID available for photo tracking');
      return null;
    }

    const trackingId = customerInfo.originalAppUserId;
    
    if (__DEV__) {
      console.log('📸 Photo Tracking ID (Free User - Anonymous ID):', {
        tracking_id: trackingId,
        plan_type: planType
      });
    }
    
    return trackingId;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to get photo tracking ID:', error);
    }
    return null;
  }
};

/**
 * Get video tracking ID for Pro users with original transaction ID support
 * Free users are blocked from videos (return null)
 * 
 * Strategy: Use originalTransactionId (stable across renewals) with smart fallbacks
 * - Primary: originalTransactionId for consistent cross-renewal tracking
 * - Fallback 1: storeTransactionId for edge cases
 * - Fallback 2: anonymous ID with warning for extreme edge cases
 * - This ensures video feature works while maintaining best tracking possible
 */
export const getVideoTrackingId = async (options?: { retries?: number, retryDelay?: number }): Promise<string | null> => {
  const { retries = 3, retryDelay = 1000 } = options || {};
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔑 [VIDEO] Tracking ID attempt ${attempt}/${retries}...`);
      
      // Get fresh customer info for subscription verification (bypass cache)
      // This is critical for getting transaction IDs after app restarts
      const customerInfo = await Purchases.getCustomerInfo({ fetchPolicy: "FETCH_CURRENT" });
      if (!customerInfo) {
        console.log('❌ [VIDEO] CustomerInfo not ready');
        if (attempt < retries) {
          console.log(`⏳ [VIDEO] Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        return null;
      }
      
      console.log('📊 [VIDEO] Customer info retrieved:', {
        appUserId: customerInfo.originalAppUserId,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        allEntitlements: Object.keys(customerInfo.entitlements.all)
      });
      
      // Check if user has Pro entitlement (blocks free users)
      const proEntitlement = customerInfo.entitlements?.active?.pro;
      if (!proEntitlement?.isActive) {
        console.log('❌ [VIDEO] No Pro entitlement - blocking free users');
        return null;
      }
      
      // Get subscription data for transaction IDs
      const productId = proEntitlement.productIdentifier;
      const subscription = customerInfo.subscriptionsByProductIdentifier?.[productId];
      
      // Cast to access additional fields that may not be in types
      const subscriptionAny = subscription as any;
      const entitlementAny = proEntitlement as any;
      
      console.log('🎯 [VIDEO] Pro entitlement and subscription data:', {
        isActive: proEntitlement.isActive,
        productIdentifier: productId,
        periodType: proEntitlement.periodType,
        store: proEntitlement.store,
        isSandbox: proEntitlement.isSandbox,
        isFreeTrial: proEntitlement.periodType === 'TRIAL',
        
        // Subscription object fields
        subscriptionExists: !!subscription,
        storeTransactionId: subscription?.storeTransactionId,
        originalTransactionId: subscriptionAny?.originalTransactionId,
        
        // Entitlement object fields (alternative source)
        entitlementOriginalTransactionId: entitlementAny?.originalTransactionId,
        
        attempt: attempt
      });
      
      let trackingKey: string | null = null;
      let trackingSource: string = '';
      
      // Strategy 1: Try originalTransactionId from subscription (preferred)
      if (subscriptionAny?.originalTransactionId) {
        trackingKey = `orig:${subscriptionAny.originalTransactionId}`;
        trackingSource = 'subscription.originalTransactionId';
      }
      // Strategy 2: Try originalTransactionId from entitlement
      else if (entitlementAny?.originalTransactionId) {
        trackingKey = `orig:${entitlementAny.originalTransactionId}`;
        trackingSource = 'entitlement.originalTransactionId';
      }
      // Strategy 3: Fall back to storeTransactionId (changes on renewal)
      else if (subscription?.storeTransactionId) {
        trackingKey = `store:${subscription.storeTransactionId}`;
        trackingSource = 'subscription.storeTransactionId (fallback)';
        console.log('⚠️ [VIDEO] Using storeTransactionId fallback - may reset on renewal');
      }
      // Strategy 4: Last resort - use anonymous ID with warning
      else if (customerInfo.originalAppUserId) {
        trackingKey = `fallback:${customerInfo.originalAppUserId}`;
        trackingSource = 'originalAppUserId (emergency fallback)';
        console.log('🚨 [VIDEO] Using emergency fallback ID - investigate transaction ID availability');
      }
      
      if (trackingKey) {
        console.log('✅ [VIDEO] Tracking ID resolved:', {
          tracking_key: trackingKey,
          source: trackingSource,
          product_id: productId,
          period_type: proEntitlement.periodType,
          is_trial: proEntitlement.periodType === 'TRIAL',
          is_sandbox: proEntitlement.isSandbox,
          attempt: attempt,
          stable_across_renewals: trackingSource.includes('original')
        });
        
        return trackingKey;
      }
      
      // No ID available - retry or fail
      console.log(`⚠️ [VIDEO] No transaction ID available on attempt ${attempt}/${retries}`);
      console.log('🔍 [VIDEO] Debug info for missing transaction ID:', {
        hasSubscription: !!subscription,
        hasProEntitlement: !!proEntitlement?.isActive,
        hasAppUserId: !!customerInfo.originalAppUserId,
        subscriptionKeys: subscription ? Object.keys(subscription) : [],
        entitlementKeys: proEntitlement ? Object.keys(proEntitlement) : []
      });
      
      if (attempt < retries) {
        console.log(`⏳ [VIDEO] Retrying in ${retryDelay}ms for transaction ID...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      console.log('❌ [VIDEO] No transaction ID after all retries - blocking video feature');
      return null;
      
    } catch (error) {
      console.error(`❌ [VIDEO] Attempt ${attempt} failed:`, error);
      if (attempt < retries) {
        console.log(`⏳ [VIDEO] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      console.error('❌ [VIDEO] All video tracking attempts failed');
      return null;
    }
  }
  
  return null;
};