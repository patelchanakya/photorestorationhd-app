import { analyticsService } from '@/services/analytics';
// Removed: No longer using stable IDs - RevenueCat handles anonymous IDs automatically
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    if (__DEV__) {
      console.log('🔒 Another sync operation in progress, skipping');
    }
    return false;
  }
  syncInProgress = true;
  if (__DEV__) {
    console.log('🔓 Acquired sync lock');
  }
  return true;
};

export const releaseSyncLock = () => {
  syncInProgress = false;
  if (__DEV__) {
    console.log('🔓 Released sync lock');
  }
};

// Query keys for TanStack Query
const QUERY_KEYS = {
  subscriptionStatus: ['subscription-status'] as const,
  customerInfo: ['customer-info'] as const,
  subscriptionPlan: ['subscription-plan'] as const,
} as const;

// Note: Store updates are now handled by RevenueCat Context Provider
// The context automatically updates when customer info changes via listeners
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Purchases, {
    CustomerInfo,
    PurchasesOffering
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';



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
    if (__DEV__) console.log('👤 Logged out to new anonymous RevenueCat ID');
  } catch (e) {
    // Ignore logout errors
    if (__DEV__) console.log('ℹ️ LogOut error (ignored):', (e as any)?.message);
  }
  try { await Purchases.invalidateCustomerInfoCache(); } catch {}
}

// Extract transaction IDs from entitlement with detailed logging
function extractTransactionId(customerInfo: CustomerInfo, proEntitlement: any): string | null {
  if (!proEntitlement?.productIdentifier) {
    return null;
  }
  
  try {
    const subscription = customerInfo.subscriptionsByProductIdentifier?.[proEntitlement.productIdentifier];
    const latestTransactionId = subscription?.storeTransactionId || null;
    
    if (__DEV__ && subscription) {
      console.log('📊 [TRANSACTION] Current Subscription Transaction Details:', {
        productId: proEntitlement.productIdentifier,
        latestTransactionId: latestTransactionId,
        originalTransactionId: proEntitlement.originalTransactionId,
        purchaseDate: subscription.purchaseDate,
        expiresDate: subscription.expiresDate,
        isActive: subscription.isActive,
        willRenew: subscription.willRenew,
        periodType: subscription.periodType
      });
    }
    
    return latestTransactionId;
  } catch (error) {
    if (__DEV__) console.warn('Failed to extract transaction ID:', error);
    return null;
  }
}

// Get comprehensive transaction info for current subscription
export const getCurrentSubscriptionTransactionInfo = async (): Promise<{
  latestTransactionId: string | null;
  originalTransactionId: string | null;
  productId: string | null;
  subscriptionDetails: any;
} | null> => {
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) {
      if (__DEV__) console.log('❌ [TRANSACTION] No customer info available');
      return null;
    }

    const proEntitlement = customerInfo?.entitlements?.active?.['pro'];
    if (!proEntitlement) {
      if (__DEV__) console.log('❌ [TRANSACTION] No active Pro entitlement found');
      return null;
    }

    const productId = proEntitlement.productIdentifier;
    const subscription = productId ? customerInfo.subscriptionsByProductIdentifier?.[productId] : null;
    const latestTransactionId = subscription?.storeTransactionId || null;
    // Try to get original transaction ID from multiple sources
    const originalTransactionId = (proEntitlement as any).originalTransactionId || 
                                 (subscription as any)?.originalTransactionId || 
                                 (subscription?.originalPurchaseDate ? 'original-purchase' : null);

    const result = {
      latestTransactionId,
      originalTransactionId,
      productId,
      subscriptionDetails: subscription
    };

    if (__DEV__) {
      console.log('🎯 [TRANSACTION] Complete Transaction Info:', {
        ...result,
        subscriptionDetails: subscription ? {
          isActive: subscription.isActive,
          willRenew: subscription.willRenew,
          purchaseDate: subscription.purchaseDate,
          expiresDate: subscription.expiresDate,
          periodType: subscription.periodType,
          price: (subscription as any).price
        } : null
      });
    }

    return result;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ [TRANSACTION] Failed to get subscription transaction info:', error);
    }
    return null;
  }
};

// Official RevenueCat pattern for checking active entitlements
// RevenueCat already handles expiration checking in the active collection
function hasActiveEntitlement(customerInfo: CustomerInfo, entitlementId: string): boolean {
  // Use official RevenueCat pattern: check if entitlement exists in active collection
  const entitlement = customerInfo?.entitlements?.active?.[entitlementId];
  const isActive = entitlement !== undefined;
  
  if (__DEV__) {
    console.log('🔍 Entitlement check - hasActive:', isActive, 'for:', entitlementId);
  }
  
  return isActive;
}




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
    const customerInfo = await withTimeout(getCustomerInfo());
    
    if (!customerInfo) {
      if (__DEV__) {
        console.log('❌ No customer info available - returning false');
      }
      return false;
    }
    
    // Check active entitlements first (for actual validation)
    const activeProEntitlement = customerInfo?.entitlements?.active?.['pro'];
    const hasActiveSubscription = activeProEntitlement !== undefined;
    
    if (__DEV__) {
      console.log('🔍 Subscription status check result:', {
        hasActiveSubscription,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        timestamp: new Date().toISOString()
      });
      
      // Log transaction info when we have an active subscription
      if (hasActiveSubscription) {
        getCurrentSubscriptionTransactionInfo().catch(() => {});
      }
    }
    
    // Note: Store updates handled automatically by RevenueCat Context Provider
    return hasActiveSubscription;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to check subscription status:', error);
    }
    return false;
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
    
    // DO NOT log out before restore - it breaks transaction ID persistence
    // RevenueCat already handles Apple ID switching properly
    // await safeResetIdentity(); // DISABLED: Preserves transaction IDs

    const customerInfo = await withTimeout(Purchases.restorePurchases());

    // Get customer info after restore (RevenueCat handles cache freshness automatically)
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
    
    // Validate entitlement using RevenueCat official pattern
    const proEntitlement = info?.entitlements?.active?.['pro'];
    const hasProEntitlement = proEntitlement !== undefined;
    // Note: Store updates handled automatically by RevenueCat Context Provider
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
    
    // DO NOT log out before restore - it breaks transaction ID persistence
    // RevenueCat already handles Apple ID switching properly
    // await safeResetIdentity(); // DISABLED: Preserves transaction IDs

    const customerInfo = await withTimeout(Purchases.restorePurchases());
    
    if (__DEV__) {
      console.log('✅ Purchases restored:', customerInfo);
    }
    
    // Add null safety check - but customerInfo can be null even on successful restores
    if (!customerInfo) {
      if (__DEV__) {
        console.log('⚠️ No customer info returned from detailed restore');
      }
      
      // Fallback: try to check subscription status directly
      const hasProStatus = await checkSubscriptionStatus();
      
      if (__DEV__) {
        console.log(`🔄 Restore fallback check result: ${hasProStatus}`);
      }
      
      return {
        success: hasProStatus,
        hasActiveEntitlements: hasProStatus,
        error: hasProStatus ? undefined : 'network',
        errorMessage: hasProStatus ? undefined : 'Unable to verify subscription status'
      };
    }
    
    // Check entitlement with official RevenueCat pattern
    const proEntitlement = customerInfo?.entitlements?.active?.['pro'];
    const hasProEntitlement = proEntitlement !== undefined;
    const transactionId = extractTransactionId(customerInfo, proEntitlement);
    // Store will be updated by RevenueCat Context Provider
    
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
export const presentPaywall = async (offeringId?: string): Promise<boolean> => {
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
      offeringId: offeringId || 'default',
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
      
      // Fetch offerings and use specific offering if provided
      const offerings = await Purchases.getOfferings();
      
      if (offeringId) {
        // Use specific offering if provided
        const targetOffering = offerings.all[offeringId];
        if (targetOffering) {
          if (__DEV__) {
            console.log('🎯 Using specific offering:', offeringId);
          }
          paywallResult = await RevenueCatUI.presentPaywall({ offering: targetOffering });
        } else {
          if (__DEV__) {
            console.log('⚠️ Specific offering not found:', offeringId);
            console.log('📋 Available offerings:', Object.keys(offerings.all));
          }
          // Fallback to current offering
          paywallResult = await RevenueCatUI.presentPaywall({ offering: offerings.current });
        }
      } else {
        // Use current offering for experiments, fallback to defaultv4
        const currentOffering = offerings.current;
        const fallbackOffering = offerings.all['defaultv4'];
        
        if (currentOffering) {
          if (__DEV__) {
            console.log('🎯 Using current offering for experiments:', currentOffering.identifier);
          }
          paywallResult = await RevenueCatUI.presentPaywall({ offering: currentOffering });
        } else if (fallbackOffering) {
          if (__DEV__) {
            console.log('🔄 No current offering, using defaultv4 fallback');
          }
          paywallResult = await RevenueCatUI.presentPaywall({ offering: fallbackOffering });
        } else {
          if (__DEV__) {
            console.log('⚠️ No current or defaultv4 offering found, using default');
            console.log('📋 Available offerings:', Object.keys(offerings.all));
          }
          paywallResult = await RevenueCatUI.presentPaywall();
        }
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
    
    // Use official RevenueCat pattern - only check active entitlements
    const proEntitlement = customerInfo?.entitlements?.active?.['pro'];
    
    // Only return expiration date if entitlement exists in active collection
    if (proEntitlement && proEntitlement.expirationDate) {
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
export const validatePremiumAccess = async (forceRefresh: boolean = false): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      // In Expo Go, deny premium access to ensure proper testing of paywall flows
      if (__DEV__) {
        console.log('⚠️ Denying premium access in Expo Go - use development build for subscription testing');
      }
      return false;
    }
    
    // Only force refresh cache when explicitly requested (like Pro badge tap)
    if (forceRefresh) {
      try {
        await Purchases.invalidateCustomerInfoCache();
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay
        if (__DEV__) {
          console.log('🔄 Cache invalidated for premium access validation');
        }
      } catch (cacheError) {
        if (__DEV__) {
          console.warn('⚠️ Failed to invalidate cache, continuing with validation:', cacheError);
        }
      }
    }
    
    // Call getCustomerInfo() as recommended by RevenueCat docs
    // "It's safe to call getCustomerInfo() frequently throughout your app"
    const customerInfo = await getCustomerInfo();
    
    if (!customerInfo) {
      // Store will be updated by RevenueCat Context Provider
      if (__DEV__) {
        console.log('🔐 Premium access validation: No customer info, denying access');
      }
      return false;
    }
    
    // Check entitlement following RevenueCat official pattern
    // "if(typeof customerInfo.entitlements.active[<my_entitlement_identifier>] !== "undefined")"
    const proEntitlement = customerInfo?.entitlements?.active?.['pro'];
    const hasValidAccess = proEntitlement !== undefined;
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
    if (__DEV__) {
      console.log('🔐 Premium access validation result:', {
        hasValidAccess,
        hasProEntitlement: !!proEntitlement,
        activeEntitlements: Object.keys(customerInfo.entitlements.active || {}),
        allEntitlements: Object.keys(customerInfo.entitlements.all || {})
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
    // On error, deny access for security - RevenueCat Context Provider will manage state
    return false;
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
    
    if (!proEntitlement) {
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

// Removed waitForSubscriptionUpdate - no longer needed with RevenueCat Context Provider


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
    
    // Check for active entitlements using official RevenueCat pattern
    const hasActiveEntitlements = hasActiveEntitlement(customerInfo, 'pro');
    const proEntitlement = customerInfo.entitlements.active['pro'];
    
    // Store will be updated by RevenueCat Context Provider
    const transactionId = extractTransactionId(customerInfo, proEntitlement);
    
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

    console.log('🔄 Starting restore purchases...');
    
    // Clear cache before restore for fresh data
    await Purchases.invalidateCustomerInfoCache();
    
    // RevenueCat handles all Apple ID validation internally
    // It automatically checks with Apple StoreKit and validates receipts
    // No need for custom validation - RevenueCat does this better than we can
    const customerInfo = await Purchases.restorePurchases();
    
    // Check for active entitlements using official RevenueCat pattern
    const hasActiveEntitlements = hasActiveEntitlement(customerInfo, 'pro');
    const proEntitlement = customerInfo.entitlements.active['pro'];
    
    // Store will be updated by RevenueCat Context Provider
    const transactionId = extractTransactionId(customerInfo, proEntitlement);
    
    if (__DEV__) {
      console.log('✅ Restore complete:', {
        hasActiveEntitlements,
        rcIsActive: proEntitlement?.isActive ?? null,
        expirationDate: proEntitlement?.expirationDate ?? null,
        transactionId
      });
    }
    
    return {
      success: true,
      hasActiveEntitlements,
      validationPassed: true,
      appleValidation: {
        hasSubscription: hasActiveEntitlements,
        transactionId,
        productId: proEntitlement?.productIdentifier || null
      }
    };
  } catch (error: any) {
    console.error('❌ Restore failed:', error);
    
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