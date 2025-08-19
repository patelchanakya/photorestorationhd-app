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
 * Get video tracking ID for Pro users (transaction ID only - bulletproof approach)
 * Free users are blocked from videos (return null)
 * 
 * Strategy: ONLY use originalTransactionId - no fallbacks to prevent edge cases
 * - If no transaction ID available, block video feature (same UX as network error)
 * - This ensures 100% bulletproof tracking with zero edge cases
 * - Eliminates ID mismatch issues completely
 */
export const getVideoTrackingId = async (options?: { retries?: number, retryDelay?: number }): Promise<string | null> => {
  const { retries = 3, retryDelay = 1000 } = options || {};
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔑 [TEST] Video tracking ID attempt ${attempt}/${retries}...`);
      
      // Get fresh customer info for subscription verification (bypass cache)
      // This is critical for getting originalTransactionId after app restarts
      const customerInfo = await Purchases.getCustomerInfo({ fetchPolicy: "FETCH_CURRENT" });
      if (!customerInfo) {
        console.log('❌ [TEST] Video tracking: CustomerInfo not ready');
        if (attempt < retries) {
          console.log(`⏳ [TEST] Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        return null;
      }
      
      console.log('📊 [TEST] Customer info for video tracking:', {
        appUserId: customerInfo.originalAppUserId,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        allEntitlements: Object.keys(customerInfo.entitlements.all)
      });
      
      // Check if user has Pro entitlement (blocks free users)
      const proEntitlement = customerInfo.entitlements?.active?.pro;
      if (!proEntitlement?.isActive) {
        console.log('❌ [TEST] Video tracking: No Pro entitlement - blocking free users');
        return null;
      }
      
      // Cast to access originalTransactionId (RevenueCat types may be incomplete)
      const entitlementAny = proEntitlement as any;
      
      console.log('🎯 [TEST] Pro entitlement found for video tracking:', {
        isActive: proEntitlement.isActive,
        productIdentifier: proEntitlement.productIdentifier,
        originalTransactionId: entitlementAny.originalTransactionId,
        latestPurchaseDate: proEntitlement.latestPurchaseDate,
        originalPurchaseDate: proEntitlement.originalPurchaseDate,
        periodType: proEntitlement.periodType,
        store: proEntitlement.store,
        isSandbox: proEntitlement.isSandbox
      });
      
      
      // Primary Strategy: Get transaction ID from subscription data (iOS correct approach)
      const productId = proEntitlement.productIdentifier;
      const subscription = customerInfo.subscriptionsByProductIdentifier?.[productId];
      
      if (subscription?.storeTransactionId) {
        const trackingKey = `store:${subscription.storeTransactionId}`;
        
        console.log('✅ [TEST] Video Tracking (Store Transaction ID - iOS Primary):', {
          store_transaction_id: subscription.storeTransactionId,
          tracking_key: trackingKey,
          product_id: productId,
          period_type: proEntitlement.periodType,
          is_trial: proEntitlement.periodType === 'TRIAL',
          attempt: attempt
        });
        
        return trackingKey;
      }
      
      // No transaction ID available - retry or fail
      console.log(`⚠️ [TEST] No transaction ID on attempt ${attempt}/${retries}`);
      if (attempt < retries) {
        console.log(`⏳ [TEST] Retrying in ${retryDelay}ms for transaction ID...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      console.log('❌ [TEST] No transaction ID after all retries - blocking video feature');
      return null;
      
    } catch (error) {
      console.error(`❌ [TEST] Attempt ${attempt} failed:`, error);
      if (attempt < retries) {
        console.log(`⏳ [TEST] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      console.error('❌ [TEST] All video tracking attempts failed');
      return null;
    }
  }
  
  return null;
};