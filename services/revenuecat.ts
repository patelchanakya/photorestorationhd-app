import { analyticsService } from '@/services/analytics';
// Removed: No longer using stable IDs - RevenueCat handles anonymous IDs automatically
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';

// Timeout wrapper for RevenueCat API calls to prevent hanging
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

// Mutex for preventing concurrent sync operations
let syncInProgress = false;
export const acquireSyncLock = async (): Promise<boolean> => {
  if (syncInProgress) {
    console.log('🔒 [SYNC] Another sync operation in progress, skipping');
    return false;
  }
  syncInProgress = true;
  console.log('🔓 [SYNC] Acquired sync lock');
  return true;
};

export const releaseSyncLock = () => {
  syncInProgress = false;
  console.log('🔓 [SYNC] Released sync lock');
};

// Query keys for TanStack Query
const QUERY_KEYS = {
  subscriptionStatus: ['subscription-status'] as const,
  customerInfo: ['customer-info'] as const,
  subscriptionPlan: ['subscription-plan'] as const,
} as const;

// Store update callbacks to break circular dependency
interface SubscriptionStoreCallbacks {
  setIsPro: (isPro: boolean) => void;
  setExpirationDate: (date: string | null) => void;
  setTransactionId: (transactionId: string | null) => void;
  getIsPro: () => boolean;
}

let storeCallbacks: SubscriptionStoreCallbacks | null = null;

/**
 * Initialize store callbacks to break circular dependency
 * Call this from subscriptionStore to provide update functions
 */
export const initializeStoreCallbacks = (callbacks: SubscriptionStoreCallbacks) => {
  storeCallbacks = callbacks;
};

/**
 * Safe store update helper
 */
const updateStore = (isPro: boolean, expirationDate?: string | null, transactionId?: string | null) => {
  if (storeCallbacks) {
    storeCallbacks.setIsPro(isPro);
    if (expirationDate !== undefined) {
      storeCallbacks.setExpirationDate(expirationDate);
    }
    if (transactionId !== undefined) {
      storeCallbacks.setTransactionId(transactionId);
    }
  }
};

/**
 * Safe store getter helper
 */
const getCurrentProStatus = (): boolean => {
  return storeCallbacks?.getIsPro() ?? false;
};
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Purchases, {
    CustomerInfo,
    PURCHASES_ERROR_CODE,
    PurchasesError,
    PurchasesOffering,
    PurchasesPackage
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

export interface RevenueCatOfferings {
  monthly?: PurchasesPackage;
  weekly?: PurchasesPackage;
}

// Purchase error result types for better error handling
export interface PurchaseResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  userCancelled?: boolean;
  shouldRetry?: boolean;
  requiresRestore?: boolean;
}

// Helper to check if we're in Expo Go
const isExpoGo = () => Constants.appOwnership === 'expo';

// Get or create a stable custom user ID using SecureStore (survives reinstalls)
const getOrCreateCustomUserId = async (): Promise<string | null> => {
  try {
    const CUSTOM_USER_ID_KEY = 'rc_custom_user_id';
    
    // Try to get existing ID from SecureStore
    let customUserId = await SecureStore.getItemAsync(CUSTOM_USER_ID_KEY);
    
    if (!customUserId) {
      // Generate new stable ID
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

// Helper to safely reset identity before restore operations
// Always logs out to prevent cross-Apple-ID entitlement carryover.
async function safeResetIdentity() {
  try {
    await Purchases.logOut();
    if (__DEV__) console.log('👤 safeResetIdentity: Logged out to new anonymous RevenueCat ID');
  } catch (e) {
    // Ignore logout errors
    if (__DEV__) console.log('ℹ️ safeResetIdentity: logOut error (ignored):', (e as any)?.message);
  }
  try { await Purchases.invalidateCustomerInfoCache(); } catch {}
}

// Extract transaction ID from entitlement (same logic as simpleSubscriptionService)
function extractTransactionId(customerInfo: CustomerInfo, proEntitlement: any): string | null {
  if (!proEntitlement?.productIdentifier) {
    return null;
  }
  
  try {
    const subscription = customerInfo.subscriptionsByProductIdentifier?.[proEntitlement.productIdentifier];
    return subscription?.storeTransactionId || null;
  } catch (error) {
    if (__DEV__) console.warn('Failed to extract transaction ID:', error);
    return null;
  }
}

// Robust entitlement validation to avoid granting access for expired subscriptions (esp. in sandbox)
function isEntitlementTrulyActive(entitlement: any): boolean {
  if (__DEV__) {
    console.log('🔍 Entitlement input:', {
      hasEntitlement: !!entitlement,
      isActive: entitlement?.isActive,
      expirationDate: entitlement?.expirationDate,
      willRenew: entitlement?.willRenew
    });
  }
  
  if (!entitlement?.isActive) {
    if (__DEV__) {
      console.log('❌ Entitlement not active, returning false');
    }
    return false;
  }
  if (entitlement?.expirationDate) {
    const expiration = new Date(entitlement.expirationDate);
    const now = new Date();
    // Small buffer to account for device/server clock skew
    const bufferMs = 5 * 60 * 1000;
    const isValid = expiration.getTime() > (now.getTime() - bufferMs);
    
    if (__DEV__) {
      console.log('⏰ Entitlement validation:', {
        expirationDate: entitlement.expirationDate,
        expirationTime: expiration.toISOString(),
        nowTime: now.toISOString(),
        timeDiff: expiration.getTime() - now.getTime(),
        bufferMs,
        isValid,
        rcIsActive: entitlement.isActive
      });
    }
    
    return isValid;
  }
  // Lifetime purchases or missing expiration date: trust isActive
  if (__DEV__) {
    console.log('✅ No expiration date, trusting isActive:', entitlement.isActive);
  }
  return entitlement.isActive === true;
}

export const getOfferings = async (): Promise<RevenueCatOfferings> => {
  try {
    // Mock data for Expo Go
    if (isExpoGo()) {
      if (__DEV__) {
      console.log('⚠️ Using mock offerings in Expo Go');
    }
      return {};
    }
    
    const offerings = await Purchases.getOfferings();
    if (__DEV__) {
      console.log('📦 Fetched offerings:', offerings);
    }
    
    if (offerings.current !== null) {
      const availablePackages = offerings.current.availablePackages;
      
      // Find monthly and weekly packages based on your RevenueCat configuration
      const monthly = availablePackages.find(pkg => 
        pkg.identifier === '$rc_monthly'
      );
      
      const weekly = availablePackages.find(pkg => 
        pkg.identifier === '$rc_weekly'
      );
      
      if (__DEV__) {
        console.log('💰 Monthly package:', monthly);
      }
      if (__DEV__) {
        console.log('📅 Weekly package:', weekly);
      }
      
      return { monthly, weekly };
    }
    
    if (__DEV__) {
      console.log('⚠️ No current offering found');
    }
    return {};
  } catch (error) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to get offerings:', error);
    }
    return {};
  }
};

// Enhanced purchase function that returns detailed error information
export const purchasePackageEnhanced = async (packageToPurchase: PurchasesPackage): Promise<PurchaseResult> => {
  try {
    if (isExpoGo()) {
      return {
        success: false,
        errorMessage: 'Cannot purchase in Expo Go'
      };
    }
    
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    
    // Verify entitlement immediately
    const proEntitlement = customerInfo.entitlements.active['pro'];
    const hasProEntitlement = proEntitlement?.isActive === true;
    
    if (!hasProEntitlement) {
      // Try refresh once
      const refreshedInfo = await getCustomerInfo();
      if (refreshedInfo) {
        const refreshedEntitlement = refreshedInfo.entitlements.active['pro'];
        if (refreshedEntitlement?.isActive === true) {
          return { success: true };
        }
      }
      return {
        success: false,
        errorMessage: 'Purchase succeeded but entitlement not active'
      };
    }
    
    // Explicitly update store status (no reliance on global listener)
    await checkSubscriptionStatus();
    
    
    return { success: true };
  } catch (error: any) {
    const purchaseError = error as PurchasesError;
    
    if (purchaseError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || 
        purchaseError.userCancelled) {
      return {
        success: false,
        userCancelled: true
      };
    }
    
    switch (purchaseError.code) {
      case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
        return {
          success: false,
          errorCode: 'STORE_PROBLEM',
          errorMessage: 'App Store temporarily unavailable',
          shouldRetry: true
        };
        
      case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
        return {
          success: false,
          errorCode: 'ALREADY_PURCHASED',
          errorMessage: 'You already own this subscription',
          requiresRestore: true
        };
        
      case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
        return {
          success: false,
          errorCode: 'RECEIPT_IN_USE',
          errorMessage: 'Subscription owned by different Apple ID',
          requiresRestore: true
        };
        
      case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
        return {
          success: false,
          errorCode: 'PAYMENT_PENDING',
          errorMessage: 'Payment is being processed'
        };
        
      case PURCHASES_ERROR_CODE.NETWORK_ERROR:
        return {
          success: false,
          errorCode: 'NETWORK_ERROR',
          errorMessage: 'Network connection issue',
          shouldRetry: true
        };
        
      default:
        return {
          success: false,
          errorCode: purchaseError.code?.toString(),
          errorMessage: 'Purchase failed. Please try again.'
        };
    }
  }
};

// Original purchase function for backward compatibility
export const purchasePackage = async (packageToPurchase: PurchasesPackage): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      if (__DEV__) {
        console.log('⚠️ Cannot purchase in Expo Go');
      }
      return false;
    }
    
    if (__DEV__) {
      console.log('🛒 Purchasing package:', packageToPurchase.identifier);
    }
    
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    
    if (__DEV__) {
      console.log('✅ Purchase successful:', customerInfo);
    }
    
    // BEST PRACTICE: Immediately verify entitlement after purchase
    // Don't just assume success - check the actual entitlement status
    const proEntitlement = customerInfo.entitlements.active['pro'];
    const hasProEntitlement = proEntitlement?.isActive === true;
    
    if (!hasProEntitlement) {
      // Purchase succeeded but entitlement not active - this shouldn't happen
      // but we handle it gracefully
      if (__DEV__) {
        console.warn('⚠️ Purchase succeeded but entitlement not active');
      }
      // Try to refresh customer info once more
      const refreshedInfo = await getCustomerInfo();
      if (refreshedInfo) {
        const refreshedEntitlement = refreshedInfo.entitlements.active['pro'];
        return refreshedEntitlement?.isActive === true;
      }
    }
    
    // Explicitly update store status (no reliance on global listener)
    await checkSubscriptionStatus();
    if (__DEV__) {
      console.log('🔄 Purchase completed, pro status:', hasProEntitlement);
    }
    
    return hasProEntitlement;
  } catch (error: any) {
    // Enhanced error handling with specific error codes
    const purchaseError = error as PurchasesError;
    
    // User cancelled - this is normal behavior
    if (purchaseError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || 
        purchaseError.userCancelled) {
      if (__DEV__) {
        console.log('👤 User cancelled purchase');
      }
      return false;
    }
    
    // Handle specific error cases
    switch (purchaseError.code) {
      case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
        // Store connection issue - could retry
        if (__DEV__) {
          console.error('🔒 Store problem - App Store unavailable');
        }
        break;
        
      case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
        // Device/account restrictions
        if (__DEV__) {
          console.error('💳 Purchase not allowed on this device/account');
        }
        break;
        
      case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
        // Product configuration issue
        if (__DEV__) {
          console.error('🚫 Product not available for purchase');
        }
        break;
        
      case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
        // User already owns this - should restore instead
        if (__DEV__) {
          console.log('🔑 Product already purchased - attempting restore');
        }
        // Automatically attempt restore for better UX
        try {
          const customerInfo = await Purchases.restorePurchases();
          const proEntitlement = customerInfo.entitlements.active['pro'];
          return proEntitlement?.isActive === true;
        } catch (restoreError) {
          if (__DEV__) {
            console.error('Failed to auto-restore:', restoreError);
          }
        }
        break;
        
      case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
        // Different Apple ID owns this subscription
        if (__DEV__) {
          console.error('🔐 Receipt already in use by different account');
        }
        break;
        
      case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
        // Payment is being processed
        if (__DEV__) {
          console.log('⏳ Payment pending - user needs to complete payment');
        }
        break;
        
      case PURCHASES_ERROR_CODE.NETWORK_ERROR:
        // Network issue - definitely should retry
        if (__DEV__) {
          console.error('🌐 Network error during purchase');
        }
        break;
        
      default:
        // Unknown error
        if (__DEV__) {
          console.error('❌ Purchase failed with error:', purchaseError);
        }
    }
    
    return false;
  }
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    if (isExpoGo()) {
      if (__DEV__) {
        console.log('⚠️ Cannot get customer info in Expo Go');
      }
      return null;
    }
    
    const customerInfo = await Purchases.getCustomerInfo();
    if (__DEV__) {
      console.log('👤 Customer info:', customerInfo);
    }
    return customerInfo;
  } catch (error) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to get customer info:', error);
    }
    return null;
  }
};


export const checkSubscriptionStatus = async (): Promise<boolean> => {
  try {
    console.log('🔍 [TEST] Starting subscription status check...');
    const customerInfo = await withTimeout(getCustomerInfo());
    
    if (!customerInfo) {
      console.log('❌ [TEST] No customer info available - setting to non-Pro');
      // Only update store in error case where CustomerInfo is unavailable
      updateStore(false, null);
      return false;
    }
    
    console.log('📊 [TEST] Customer Info Retrieved:', {
      appUserId: customerInfo.originalAppUserId,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
      allEntitlements: Object.keys(customerInfo.entitlements.all),
      originalPurchaseDate: customerInfo.originalPurchaseDate,
      firstSeen: customerInfo.firstSeen
    });
    
    // Prefer active entitlements, but fall back to all to read expiration/debug info
    const entitlementsAny: any = (customerInfo as any)?.entitlements ?? {};
    const proEntitlement = entitlementsAny.active?.['pro'] ?? entitlementsAny.all?.['pro'];
    
    if (proEntitlement) {
      console.log('🎯 [TEST] Pro Entitlement Details:', {
        isActive: proEntitlement.isActive,
        willRenew: proEntitlement.willRenew,
        periodType: proEntitlement.periodType,
        productIdentifier: proEntitlement.productIdentifier,
        originalPurchaseDate: proEntitlement.originalPurchaseDate,
        latestPurchaseDate: proEntitlement.latestPurchaseDate,
        expirationDate: proEntitlement.expirationDate,
        originalTransactionId: proEntitlement.originalTransactionId,
        store: proEntitlement.store,
        isSandbox: proEntitlement.isSandbox
      });
    } else {
      console.log('❌ [TEST] No Pro entitlement found');
    }
    
    const hasProEntitlement = isEntitlementTrulyActive(proEntitlement);
    console.log('✅ [TEST] Entitlement validation result:', hasProEntitlement);
    
    // Update store if different from current value (for Apple ID switches)
    const currentProStatus = getCurrentProStatus();
    console.log('🔍 [TEST] Store comparison:', {
      currentProStatus,
      hasProEntitlement,
      needsUpdate: hasProEntitlement !== currentProStatus,
      timestamp: new Date().toISOString()
    });
    
    if (hasProEntitlement !== currentProStatus) {
      console.log('🔄 [TEST] Updating store with new subscription status:', hasProEntitlement);
      const transactionId = extractTransactionId(customerInfo, proEntitlement);
      if (__DEV__ && transactionId) {
        console.log('📧 Transaction ID extracted:', `${transactionId.substring(0, 10)}...`);
      }
      updateStore(hasProEntitlement, proEntitlement?.expirationDate ?? null, transactionId);
      console.log('✅ [TEST] Store updated. New state:', getCurrentProStatus());
    } else {
      console.log('ℹ️ [TEST] No store update needed - status unchanged');
    }
    
    console.log('🔍 [TEST] Final subscription status check result:', {
      result: hasProEntitlement,
      rcIsActive: proEntitlement?.isActive ?? null,
      willRenew: proEntitlement?.willRenew ?? null,
      expirationDate: proEntitlement?.expirationDate ?? null,
      timestamp: new Date().toISOString()
    });
    
    return hasProEntitlement;
  } catch (error) {
    console.error('❌ [TEST] Failed to check subscription status:', error);
    // On error, don't change current state - let user keep current access level
    const currentStatus = getCurrentProStatus();
    console.log('⚠️ [TEST] Returning current status due to error:', currentStatus);
    return currentStatus;
  }
};

export interface RestoreResult {
  success: boolean;
  hasActiveEntitlements: boolean;
  error?: 'cancelled' | 'network' | 'store_problem' | 'unknown';
  errorMessage?: string;
}

export const restorePurchases = async (): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      if (__DEV__) {
        console.log('⚠️ Cannot restore purchases in Expo Go');
      }
      return false;
    }
    
    if (__DEV__) {
      console.log('🔄 Restoring purchases...');
    }
    
    // Sync with current Apple ID to prevent cross-Apple-ID carryover
    await safeResetIdentity();

    const customerInfo = await withTimeout(Purchases.restorePurchases());

    // Force fetch fresh info after restore to avoid stale cache side-effects
    try { 
      await Purchases.invalidateCustomerInfoCache(); 
      // Add explicit delay after cache invalidation to ensure it takes effect
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {}
    const freshInfo = await withTimeout(getCustomerInfo());
    const info = freshInfo ?? customerInfo;
    
    if (__DEV__) {
      console.log('✅ Purchases restored:', customerInfo);
    }
    
    // Add null safety check
    if (!info) {
      if (__DEV__) {
        console.log('⚠️ No customer info returned from restore');
      }
      const hasPro = await checkSubscriptionStatus();
      return hasPro;
    }
    
    // Validate entitlement strictly
    const entitlementsAny: any = (info as any)?.entitlements ?? {};
    const proEntitlement = entitlementsAny.active?.['pro'] ?? entitlementsAny.all?.['pro'];
    const hasProEntitlement = isEntitlementTrulyActive(proEntitlement);
    // Update store explicitly
    const transactionId = extractTransactionId(info, proEntitlement);
    updateStore(hasProEntitlement, proEntitlement?.expirationDate ?? null, transactionId);
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
    if (__DEV__) {
      console.log('🔄 Restore completed:', {
        result: hasProEntitlement,
        rcIsActive: proEntitlement?.isActive ?? null,
        willRenew: proEntitlement?.willRenew ?? null,
        expirationDate: proEntitlement?.expirationDate ?? null,
      });
    }
    
    return hasProEntitlement;
  } catch (error) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to restore purchases:', error);
    }
    return false;
  }
};

export const restorePurchasesDetailed = async (): Promise<RestoreResult> => {
  try {
    if (isExpoGo()) {
      if (__DEV__) {
        console.log('⚠️ Cannot restore purchases in Expo Go');
      }
      return {
        success: false,
        hasActiveEntitlements: false,
        error: 'unknown',
        errorMessage: 'Cannot restore purchases in Expo Go'
      };
    }
    
    if (__DEV__) {
      console.log('🔄 Restoring purchases...');
    }
    
    // Sync with current Apple ID to prevent cross-Apple-ID carryover
    await safeResetIdentity();

    const customerInfo = await withTimeout(Purchases.restorePurchases());
    
    if (__DEV__) {
      console.log('✅ Purchases restored:', customerInfo);
    }
    
    // Add null safety check - but customerInfo can be null even on successful restores
    if (!customerInfo) {
      if (__DEV__) {
        console.log('⚠️ No customer info returned from detailed restore');
      }
      
      // Wait for store update with proper timeout instead of hardcoded delay
      const waitForStoreUpdate = await waitForSubscriptionUpdate({
        timeout: 3000,
        checkInterval: 100,
        expectedChange: true // We expect a change if restore is successful
      });
      
      if (waitForStoreUpdate.success) {
        updateStore(waitForStoreUpdate.isPro);
        if (__DEV__) {
          console.log('✅ Restore successful - store updated with PRO status');
        }
        return {
          success: true,
          hasActiveEntitlements: waitForStoreUpdate.isPro
        };
      }
      
      if (__DEV__) {
        console.log('❌ Restore failed - no customerInfo and store not updated');
      }
      return {
        success: false,
        hasActiveEntitlements: false,
        error: 'network',
        errorMessage: 'Unable to verify subscription status'
      };
    }
    
    // Check entitlement with robust validation
    const entitlementsAny: any = (customerInfo as any)?.entitlements ?? {};
    const proEntitlement = entitlementsAny.active?.['pro'] ?? entitlementsAny.all?.['pro'];
    const hasProEntitlement = isEntitlementTrulyActive(proEntitlement);
    const transactionId = extractTransactionId(customerInfo, proEntitlement);
    updateStore(hasProEntitlement, proEntitlement?.expirationDate ?? null, transactionId);
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
    if (__DEV__) {
      console.log('🔄 Detailed restore completed:', {
        result: hasProEntitlement,
        rcIsActive: proEntitlement?.isActive ?? null,
        willRenew: proEntitlement?.willRenew ?? null,
        expirationDate: proEntitlement?.expirationDate ?? null,
      });
    }
    
    return {
      success: true,
      hasActiveEntitlements: hasProEntitlement
    };
  } catch (error: any) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to restore purchases:', error);
    }
    
    // Categorize error types for better UX
    let errorType: RestoreResult['error'] = 'unknown';
    let errorMessage = 'Failed to restore purchases';
    
    if (error.userCancelled || error.code === '1') {
      errorType = 'cancelled';
      errorMessage = 'Restore cancelled by user';
    } else if (error.code === '2') {
      errorType = 'store_problem';
      errorMessage = 'Store connection problem';
    } else if (error.message && error.message.toLowerCase().includes('network')) {
      errorType = 'network';
      errorMessage = 'Network connection problem';
    }
    
    return {
      success: false,
      hasActiveEntitlements: false,
      error: errorType,
      errorMessage
    };
  }
};

// Native paywall presentation functions
export const presentPaywall = async (): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      if (__DEV__) {
        console.log('⚠️ Cannot present native paywall in Expo Go');
      }
      return false;
    }
    
    if (__DEV__) {
      console.log('🎯 Presenting native paywall...');
    }

    // Track paywall presentation
    analyticsService.track('Paywall Shown', {
      source: 'presentPaywall',
      timestamp: new Date().toISOString(),
    });
    
    // Try-catch specifically for the UI module
    let paywallResult: PAYWALL_RESULT;
    try {
      if (__DEV__) {
        console.log('📦 RevenueCatUI module:', RevenueCatUI);
      }
      if (__DEV__) {
        console.log('📦 RevenueCatUI.presentPaywall:', RevenueCatUI.presentPaywall);
      }
      
      // Fetch offerings and use specific "defaultv2" offering
      // Clear cache to get fresh offering data
      await Purchases.invalidateCustomerInfoCache();
      const offerings = await Purchases.getOfferings();
      const defaultv2Offering = offerings.all['defaultv2'];
      
      if (defaultv2Offering) {
        if (__DEV__) {
          console.log('🎯 Using defaultv2 offering (with trial toggle paywall):', defaultv2Offering);
        }
        paywallResult = await RevenueCatUI.presentPaywall({ offering: defaultv2Offering });
      } else {
        if (__DEV__) {
          console.log('⚠️ defaultv2 offering not found, using default');
          console.log('📋 Available offerings:', Object.keys(offerings.all));
        }
        paywallResult = await RevenueCatUI.presentPaywall();
      }
    } catch (uiError) {
      // Only log UI errors in development, not user cancellations
      if (__DEV__) {
        console.error('❌ RevenueCatUI error:', uiError);
        if (__DEV__) {
          console.log('⚠️ RevenueCatUI not available - the native module is not linked in this build');
        }
        if (__DEV__) {
          console.log('💡 You need to rebuild with EAS after the pod install');
        }
      }
      return false;
    }
    
    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
        if (__DEV__) {
          console.log('✅ Purchase completed via paywall');
        }
        // Track successful purchase
        analyticsService.track('Paywall Purchase Completed', {
          source: 'presentPaywall',
          timestamp: new Date().toISOString(),
        });
        // Update subscription status
        await checkSubscriptionStatus();
        return true;
        
      case PAYWALL_RESULT.RESTORED:
        if (__DEV__) {
          console.log('✅ Purchases restored via paywall');
        }
        // Track successful restore
        analyticsService.track('Paywall Restore Completed', {
          source: 'presentPaywall',
          timestamp: new Date().toISOString(),
        });
        // Update subscription status
        await checkSubscriptionStatus();
        return true;
        
      case PAYWALL_RESULT.CANCELLED:
        // Track user cancellation
        analyticsService.track('Paywall Cancelled', {
          source: 'presentPaywall',
          timestamp: new Date().toISOString(),
        });
        // User cancelled - this is normal behavior
        return false;
        
      case PAYWALL_RESULT.ERROR:
        // Track paywall error
        analyticsService.track('Paywall Error', {
          source: 'presentPaywall',
          timestamp: new Date().toISOString(),
        });
        // Only log errors in development builds
        if (__DEV__) {
          if (__DEV__) {
            console.log('❌ Error presenting paywall');
          }
        }
        return false;
        
      case PAYWALL_RESULT.NOT_PRESENTED:
        // Track paywall not presented
        analyticsService.track('Paywall Not Presented', {
          source: 'presentPaywall',
          timestamp: new Date().toISOString(),
        });
        if (__DEV__) {
          if (__DEV__) {
            console.log('⚠️ Paywall not presented');
          }
        }
        return false;
        
      default:
        // Track unknown result
        analyticsService.track('Paywall Unknown Result', {
          source: 'presentPaywall',
          result: paywallResult,
          timestamp: new Date().toISOString(),
        });
        if (__DEV__) {
          if (__DEV__) {
            console.log('❓ Unknown paywall result:', paywallResult);
          }
        }
        return false;
    }
  } catch (error) {
    // Only log errors in development builds, suppress in production
    if (__DEV__) {
      console.error('❌ Failed to present paywall:', error);
    }
    return false;
  }
};

// Present paywall only if user doesn't have the required entitlement
export const presentPaywallIfNeeded = async (requiredEntitlementIdentifier: string = 'pro'): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      if (__DEV__) {
        console.log('⚠️ Cannot present native paywall in Expo Go');
      }
      return false;
    }
    
    if (__DEV__) {
      console.log('🔍 Checking if paywall is needed for entitlement:', requiredEntitlementIdentifier);
    }
    
    const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier
    });
    
    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        if (__DEV__) {
          console.log('✅ Access granted via paywall');
        }
        await checkSubscriptionStatus();
        return true;
        
      case PAYWALL_RESULT.NOT_PRESENTED:
        if (__DEV__) {
          console.log('✅ User already has access, paywall not needed');
        }
        return true;
        
      case PAYWALL_RESULT.CANCELLED:
        // User cancelled - normal behavior
        return false;
        
      default:
        if (__DEV__) {
          if (__DEV__) {
            console.log('❌ Access not granted:', paywallResult);
          }
        }
        return false;
    }
  } catch (error) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to present paywall if needed:', error);
    }
    return false;
  }
};

// Present paywall for a specific offering
export const presentPaywallForOffering = async (offering: PurchasesOffering): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      if (__DEV__) {
        console.log('⚠️ Cannot present native paywall in Expo Go');
      }
      return false;
    }
    
    if (__DEV__) {
      console.log('🎯 Presenting paywall for offering:', offering.identifier);
    }
    
    const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall({
      offering
    });
    
    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        if (__DEV__) {
          console.log('✅ Success via paywall');
        }
        await checkSubscriptionStatus();
        return true;
        
      case PAYWALL_RESULT.CANCELLED:
        // User cancelled - normal behavior
        return false;
        
      default:
        if (__DEV__) {
          if (__DEV__) {
            console.log('❌ Paywall result:', paywallResult);
          }
        }
        return false;
    }
  } catch (error) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to present paywall for offering:', error);
    }
    return false;
  }
};

// Helper function to get subscription expiration date
export const getSubscriptionExpirationDate = async (): Promise<Date | null> => {
  try {
    const customerInfo = await getCustomerInfo();
    
    if (!customerInfo) {
      return null;
    }
    
    // Prefer active but fall back to all for expiration visibility
    const entitlementsAny: any = (customerInfo as any)?.entitlements ?? {};
    const proEntitlement = entitlementsAny.active?.['pro'] ?? entitlementsAny.all?.['pro'];
    
    // Only return expiration date if entitlement is active
    if (isEntitlementTrulyActive(proEntitlement) && proEntitlement.expirationDate) {
      return new Date(proEntitlement.expirationDate);
    }
    
    return null;
  } catch (error) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to get expiration date:', error);
    }
    return null;
  }
};

// Validate premium access before granting features - follows RevenueCat best practices
export const validatePremiumAccess = async (): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      // In Expo Go, deny premium access to ensure proper testing of paywall flows
      if (__DEV__) {
        console.log('⚠️ Denying premium access in Expo Go - use development build for subscription testing');
      }
      return false;
    }
    
    // Call getCustomerInfo() as recommended by RevenueCat docs
    // "It's safe to call getCustomerInfo() frequently throughout your app"
    const customerInfo = await getCustomerInfo();
    
    if (!customerInfo) {
      // Only update store in error case where CustomerInfo is unavailable
      updateStore(false, null);
      if (__DEV__) {
        console.log('🔐 Premium access validation: No customer info, denying access');
      }
      return false;
    }
    
    // Check entitlement using robust validation
    const entitlementsAny: any = (customerInfo as any)?.entitlements ?? {};
    const proEntitlement = entitlementsAny.active?.['pro'] ?? entitlementsAny.all?.['pro'];
    const hasValidAccess = isEntitlementTrulyActive(proEntitlement);
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
    if (__DEV__) {
      console.log('🔐 Premium access validation result:', {
        hasValidAccess,
        hasProEntitlement: !!proEntitlement,
        activeEntitlements: Object.keys(entitlementsAny.active || {}),
        allEntitlements: Object.keys(entitlementsAny.all || {})
      });
      if (proEntitlement) {
        console.log('🔐 Pro entitlement details (validation):', {
          isActive: proEntitlement?.isActive ?? null,
          willRenew: proEntitlement?.willRenew ?? null,
          expirationDate: proEntitlement?.expirationDate ?? null,
        });
      }
    }
    
    return hasValidAccess;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to validate premium access:', error);
    }
    // On error, return current state to avoid disrupting user experience
    return getCurrentProStatus();
  }
};

// Helper function to get the user's original app user ID
export const getAppUserId = async (): Promise<string | null> => {
  try {
    if (isExpoGo()) {
      // Return a consistent mock ID for Expo Go testing
      return 'expo-go-user';
    }

    // Use RevenueCat's current app user ID, which changes when Apple ID switches
    // This is the standard approach recommended by RevenueCat
    const currentAppUserId = await Purchases.getAppUserID();
    
    if (__DEV__) {
      console.log('👤 Current app user ID:', currentAppUserId);
    }
    
    return currentAppUserId;
  } catch (error) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to get app user ID:', error);
    }
    return null;
  }
};

// Note: getVideoTrackingId has been moved to services/trackingIds.ts
// This prevents RevenueCat identity mismatch issues by centralizing ID management

// Interface for subscription plan details
export interface SubscriptionPlanDetails {
  planType: 'weekly' | 'monthly';
  usageLimit: number;
  billingCycleStart: string; // ISO date string
  nextResetDate: string; // ISO date string
  originalPurchaseDate: string; // ISO date string
  productIdentifier: string;
  storeTransactionId: string | null; // For detecting new subscriptions
}

// Helper function to get subscription plan details for usage limits
export const getSubscriptionPlanDetails = async (): Promise<SubscriptionPlanDetails | null> => {
  try {
    if (isExpoGo()) {
      // Mock data for Expo Go testing
      if (__DEV__) {
        console.log('⚠️ Using mock subscription plan details in Expo Go');
      }
      const now = new Date();
      return {
        planType: 'monthly',
        usageLimit: 10,
        billingCycleStart: now.toISOString(),
        nextResetDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        originalPurchaseDate: now.toISOString(),
        productIdentifier: 'mock_monthly',
        storeTransactionId: 'mock_transaction_id'
      };
    }

    const customerInfo = await getCustomerInfo();
    
    if (!customerInfo) {
      return null;
    }

    const proEntitlement = customerInfo.entitlements.active['pro'];
    
    if (!proEntitlement?.isActive) {
      return null;
    }

    // Detect plan type from product identifier
    const productId = proEntitlement.productIdentifier?.toLowerCase() || '';
    const isWeekly = productId.includes('weekly') || productId.includes('week');
    const planType: 'weekly' | 'monthly' = isWeekly ? 'weekly' : 'monthly';
    // Pro users get 1 video per day: 7 for weekly, 31 for monthly
    const usageLimit = isWeekly ? 7 : 31;

    // Get original purchase date and ensure UTC consistency
    const originalPurchaseDate = proEntitlement.originalPurchaseDate || new Date().toISOString();
    
    // Get store transaction ID for new subscription detection
    const productIdentifier = proEntitlement.productIdentifier || 'unknown';
    const subscriptionInfo = customerInfo.subscriptionsByProductIdentifier?.[productIdentifier];
    const storeTransactionId = subscriptionInfo?.storeTransactionId || null;
    
    // Use UTC dates to avoid timezone issues
    const originalDate = new Date(originalPurchaseDate);
    const now = new Date();
    
    // Calculate current billing cycle start and next reset
    let billingCycleStart: Date;
    let nextResetDate: Date;
    
    if (isWeekly) {
      // Weekly: Simple 7-day calculation
      const daysSincePurchase = Math.floor((now.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentCycle = Math.floor(daysSincePurchase / 7);
      billingCycleStart = new Date(originalDate.getTime() + (currentCycle * 7 * 24 * 60 * 60 * 1000));
      nextResetDate = new Date(billingCycleStart.getTime() + (7 * 24 * 60 * 60 * 1000));
    } else {
      // Monthly: Use actual month boundaries
      const originalYear = originalDate.getFullYear();
      const originalMonth = originalDate.getMonth();
      const originalDay = originalDate.getDate();
      
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Calculate how many months have passed
      const monthsPassed = (currentYear - originalYear) * 12 + (currentMonth - originalMonth);
      
      // Current billing cycle starts on the same day of the month
      billingCycleStart = new Date(originalYear, originalMonth + monthsPassed, originalDay);
      
      // Handle edge case where original day doesn't exist in current month (e.g., Jan 31 -> Feb 28)
      if (billingCycleStart.getMonth() !== (originalMonth + monthsPassed) % 12) {
        // Day doesn't exist in this month, use last day of previous month
        billingCycleStart = new Date(originalYear, originalMonth + monthsPassed, 0);
      }
      
      // Next reset is same day next month
      nextResetDate = new Date(originalYear, originalMonth + monthsPassed + 1, originalDay);
      if (nextResetDate.getMonth() !== (originalMonth + monthsPassed + 1) % 12) {
        nextResetDate = new Date(originalYear, originalMonth + monthsPassed + 2, 0);
      }
      
      // If current time is before billing cycle start, we're in the previous cycle
      if (now < billingCycleStart) {
        billingCycleStart = new Date(originalYear, originalMonth + monthsPassed - 1, originalDay);
        if (billingCycleStart.getMonth() !== (originalMonth + monthsPassed - 1) % 12) {
          billingCycleStart = new Date(originalYear, originalMonth + monthsPassed, 0);
        }
        nextResetDate = new Date(originalYear, originalMonth + monthsPassed, originalDay);
        if (nextResetDate.getMonth() !== (originalMonth + monthsPassed) % 12) {
          nextResetDate = new Date(originalYear, originalMonth + monthsPassed + 1, 0);
        }
      }
    }

    if (__DEV__) {
      console.log('📊 Subscription plan details:', {
        planType,
        usageLimit,
        productIdentifier: proEntitlement.productIdentifier,
        originalPurchaseDate,
        billingCycleStart: billingCycleStart.toISOString(),
        nextResetDate: nextResetDate.toISOString(),
        isWeekly,
        calculationMethod: isWeekly ? 'days-based' : 'month-boundaries'
      });
    }

    return {
      planType,
      usageLimit,
      billingCycleStart: billingCycleStart.toISOString(),
      nextResetDate: nextResetDate.toISOString(),
      originalPurchaseDate,
      productIdentifier: proEntitlement.productIdentifier || 'unknown',
      storeTransactionId
    };
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to get subscription plan details:', error);
    }
    return null;
  }
};

// Wait for subscription store update with timeout
interface WaitForUpdateOptions {
  timeout?: number; // Max time to wait in ms
  checkInterval?: number; // How often to check in ms
  expectedChange?: boolean; // If true, wait for a change. If false, just wait for stable state
}

interface WaitForUpdateResult {
  success: boolean;
  isPro: boolean;
  timedOut: boolean;
}

export const waitForSubscriptionUpdate = async (options: WaitForUpdateOptions = {}): Promise<WaitForUpdateResult> => {
  const { 
    timeout = 3000, 
    checkInterval = 100,
    expectedChange = false 
  } = options;
  
  const startTime = Date.now();
  const initialProStatus = getCurrentProStatus();
  let lastProStatus = initialProStatus;
  let stableCheckCount = 0;
  const requiredStableChecks = 3; // Status must be stable for 3 checks
  
  if (__DEV__) {
    console.log(`⏳ Waiting for subscription update (timeout: ${timeout}ms, expecting change: ${expectedChange})`);
  }
  
  return new Promise((resolve) => {
    const checkStatus = () => {
      const currentProStatus = getCurrentProStatus();
      const elapsed = Date.now() - startTime;
      
      // Check if status is stable
      if (currentProStatus === lastProStatus) {
        stableCheckCount++;
      } else {
        stableCheckCount = 0;
        lastProStatus = currentProStatus;
      }
      
      // Success conditions
      if (expectedChange && currentProStatus !== initialProStatus && stableCheckCount >= requiredStableChecks) {
        // We expected a change and got one that's stable
        if (__DEV__) {
          console.log(`✅ Subscription status changed and stabilized: ${initialProStatus} → ${currentProStatus}`);
        }
        resolve({ success: true, isPro: currentProStatus, timedOut: false });
        return;
      }
      
      if (!expectedChange && stableCheckCount >= requiredStableChecks) {
        // We just wanted a stable state and got one
        if (__DEV__) {
          console.log(`✅ Subscription status stable at: ${currentProStatus}`);
        }
        resolve({ success: true, isPro: currentProStatus, timedOut: false });
        return;
      }
      
      // Check for timeout
      if (elapsed >= timeout) {
        if (__DEV__) {
          console.log(`⏱️ Subscription update wait timed out after ${timeout}ms`);
        }
        resolve({ 
          success: false, 
          isPro: currentProStatus, 
          timedOut: true 
        });
        return;
      }
      
      // Continue checking
      setTimeout(checkStatus, checkInterval);
    };
    
    // Start checking
    checkStatus();
  });
};


// Clean restore function following RevenueCat best practices
export const restorePurchasesSimple = async (): Promise<RestoreResult> => {
  try {
    if (isExpoGo()) {
      return {
        success: false,
        hasActiveEntitlements: false,
        error: 'unknown',
        errorMessage: 'Cannot restore purchases in Expo Go'
      };
    }

    if (__DEV__) {
      console.log('🔄 Starting restore purchases...');
    }
    
    // RevenueCat best practice: just call restorePurchases() - it handles everything
    const customerInfo = await Purchases.restorePurchases();
    
    // Check for active entitlements 
    const proEntitlement = customerInfo.entitlements.active['pro'];
    const hasActiveEntitlements = isEntitlementTrulyActive(proEntitlement);
    
    // Update store with restore result
    const transactionId = extractTransactionId(customerInfo, proEntitlement);
    updateStore(hasActiveEntitlements, proEntitlement?.expirationDate ?? null, transactionId);
    
    if (__DEV__) {
      console.log('🔄 Restore complete:', {
        hasActiveEntitlements,
        rcIsActive: proEntitlement?.isActive ?? null,
        expirationDate: proEntitlement?.expirationDate ?? null,
      });
    }
    
    return {
      success: true,
      hasActiveEntitlements
    };
  } catch (error: any) {
    if (__DEV__) {
      console.error('❌ Restore failed:', error);
    }
    
    return {
      success: false,
      hasActiveEntitlements: false,
      error: 'unknown',
      errorMessage: 'Failed to restore purchases. Please try again.'
    };
  }
};

// Enhanced secure restore function with StoreKit validation
export const restorePurchasesSecure = async (): Promise<RestoreResult & {
  validationPassed: boolean;
  appleValidation?: {
    hasSubscription: boolean;
    transactionId: string | null;
    productId: string | null;
  };
}> => {
  try {
    if (isExpoGo()) {
      return {
        success: false,
        hasActiveEntitlements: false,
        validationPassed: false,
        error: 'unknown',
        errorMessage: 'Cannot restore purchases in Expo Go'
      };
    }

    console.log('🔒 [SECURITY] Starting secure restore with Apple validation...');
    
    // CRITICAL SECURITY: First validate with Apple StoreKit
    const { validateRestoreOperation } = await import('./iOSStoreKitValidator');
    const restoreValidation = await validateRestoreOperation();
    
    console.log('🔍 [SECURITY] Restore validation result:', {
      shouldProceed: restoreValidation.shouldProceed,
      hasAppleSubscription: restoreValidation.hasAppleSubscription,
      reason: restoreValidation.reason
    });
    
    // If Apple says no subscription on current Apple ID, block the restore
    if (!restoreValidation.shouldProceed) {
      console.log('❌ [SECURITY] Restore blocked - no subscription on current Apple ID');
      
      // Clear any cached Pro status since Apple has no subscription
      updateStore(false, null, null);
      
      return {
        success: false,
        hasActiveEntitlements: false,
        validationPassed: false,
        error: 'cancelled', // Use cancelled to avoid retry prompts
        errorMessage: restoreValidation.errorForUser || 'No subscription found on this Apple ID',
        appleValidation: {
          hasSubscription: false,
          transactionId: null,
          productId: null
        }
      };
    }
    
    // Apple validation passed, proceed with RevenueCat restore
    console.log('✅ [SECURITY] Apple validation passed, proceeding with RevenueCat restore...');
    
    const customerInfo = await Purchases.restorePurchases();
    
    // Check for active entitlements 
    const proEntitlement = customerInfo.entitlements.active['pro'];
    const hasActiveEntitlements = isEntitlementTrulyActive(proEntitlement);
    
    // Update store with restore result
    const transactionId = extractTransactionId(customerInfo, proEntitlement);
    updateStore(hasActiveEntitlements, proEntitlement?.expirationDate ?? null, transactionId);
    
    if (__DEV__) {
      console.log('🔄 Secure restore complete:', {
        hasActiveEntitlements,
        rcIsActive: proEntitlement?.isActive ?? null,
        expirationDate: proEntitlement?.expirationDate ?? null,
        appleValidationPassed: restoreValidation.shouldProceed
      });
    }
    
    return {
      success: true,
      hasActiveEntitlements,
      validationPassed: true,
      appleValidation: {
        hasSubscription: restoreValidation.hasAppleSubscription,
        transactionId: restoreValidation.transactionId,
        productId: restoreValidation.productId
      }
    };
  } catch (error: any) {
    console.error('❌ [SECURITY] Secure restore failed:', error);
    
    return {
      success: false,
      hasActiveEntitlements: false,
      validationPassed: false,
      error: 'unknown',
      errorMessage: 'Failed to restore purchases. Please try again.',
      appleValidation: {
        hasSubscription: false,
        transactionId: null,
        productId: null
      }
    };
  }
};

// =============================================================================
// TanStack Query Hooks for Subscription State Management
// =============================================================================

/**
 * Hook to get subscription status with TanStack Query caching
 * Replaces direct store access to break require cycles
 */
export const useSubscriptionStatus = () => {
  return useQuery({
    queryKey: QUERY_KEYS.subscriptionStatus,
    queryFn: async () => {
      const status = await checkSubscriptionStatus();
      const planDetails = status ? await getSubscriptionPlanDetails() : null;
      
      return {
        isPro: status,
        planDetails,
        lastChecked: new Date().toISOString()
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: 2,
  });
};

/**
 * Hook to invalidate subscription cache when needed
 */
export const useInvalidateSubscription = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscriptionStatus });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customerInfo });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscriptionPlan });
  };
};