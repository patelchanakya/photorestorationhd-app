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
 * Get photo tracking ID for free users (stable across reinstalls)
 * Pro users return null (unlimited photos, no tracking needed)
 */
export const getPhotoTrackingId = async (planType: string): Promise<string | null> => {
  try {
    if (planType !== 'free') {
      // Pro users: unlimited photos (no tracking)
      return null;
    }

    // Free users: use stable custom ID for database tracking only (no RevenueCat login)
    const customId = await getOrCreateCustomUserId();
    if (!customId) {
      return null;
    }

    // Use custom ID only for database tracking - RevenueCat keeps original stable ID
    const trackingKey = `stable:${customId}`;
    
    if (__DEV__) {
      console.log('📸 Photo Tracking ID (Free User):', {
        custom_user_id: customId,
        tracking_key: trackingKey,
        plan_type: planType
      });
    }
    
    return trackingKey;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to get photo tracking ID:', error);
    }
    return null;
  }
};

/**
 * Get video tracking ID for Pro users (bulletproof approach)
 * Free users are blocked from videos (return null)
 * 
 * Strategy:
 * 1. Use originalTransactionId if available (most stable)
 * 2. Fallback to stable custom ID for database tracking only (no RevenueCat identity change)
 */
export const getVideoTrackingId = async (): Promise<string | null> => {
  try {
    console.log('🔑 [TEST] Starting video tracking ID generation...');
    // Get customer info for subscription verification
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) {
      console.log('❌ [TEST] Video tracking: CustomerInfo not ready');
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
    
    console.log('🎯 [TEST] Pro entitlement found for video tracking:', {
      isActive: proEntitlement.isActive,
      productIdentifier: proEntitlement.productIdentifier,
      originalTransactionId: proEntitlement.originalTransactionId,
      periodType: proEntitlement.periodType,
      store: proEntitlement.store,
      isSandbox: proEntitlement.isSandbox
    });
    
    // Strategy 1: Use original transaction ID (most stable)
    if (proEntitlement.originalTransactionId) {
      const trackingKey = `orig:${proEntitlement.originalTransactionId}`;
      
      console.log('✅ [TEST] Video Tracking (Original Transaction ID Strategy):', {
        original_transaction_id: proEntitlement.originalTransactionId,
        tracking_key: trackingKey,
        product_id: proEntitlement.productIdentifier,
        period_type: proEntitlement.periodType,
        is_trial: proEntitlement.periodType === 'TRIAL'
      });
      
      return trackingKey;
    }
    
    console.log('⚠️ [TEST] No original transaction ID - falling back to custom ID strategy');
    // Strategy 2: Generate and use stable custom App User ID  
    const customUserId = await getOrCreateCustomUserId();
    if (customUserId) {
      // Use custom ID only for database tracking - RevenueCat keeps original stable ID
      const trackingKey = `stable:${customUserId}`;
      
      console.log('✅ [TEST] Video Tracking (Stable Custom ID Strategy):', {
        custom_user_id: customUserId,
        tracking_key: trackingKey,
        product_id: proEntitlement.productIdentifier,
        period_type: proEntitlement.periodType
      });
      
      return trackingKey;
    }
    
    console.log('❌ [TEST] Video tracking: No stable identifier available');
    return null;
  } catch (error) {
    console.error('❌ [TEST] Failed to get video tracking ID:', error);
    return null;
  }
};