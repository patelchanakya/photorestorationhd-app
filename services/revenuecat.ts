import { useSubscriptionStore } from '@/store/subscriptionStore';
import { analyticsService } from '@/services/analytics';
import Constants from 'expo-constants';
import Purchases, {
    CustomerInfo,
    PurchasesOffering,
    PurchasesPackage,
    PurchasesError,
    PURCHASES_ERROR_CODE
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
        pkg.identifier === '$rc_monthly' || 
        pkg.packageType === 'monthly'
      );
      
      const weekly = availablePackages.find(pkg => 
        pkg.identifier === '$rc_weekly' || 
        pkg.packageType === 'weekly'
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
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
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
    const customerInfo = await getCustomerInfo();
    
    if (!customerInfo) {
      // Only update store in error case where CustomerInfo is unavailable
      useSubscriptionStore.getState().setIsPro(false);
      return false;
    }
    
    // Check if user has active pro entitlement using isActive property
    const proEntitlement = customerInfo.entitlements.active['pro'];
    const hasProEntitlement = proEntitlement?.isActive === true;
    
    // Update store if different from current value (for Apple ID switches)
    const currentProStatus = useSubscriptionStore.getState().isPro;
    if (hasProEntitlement !== currentProStatus) {
      useSubscriptionStore.getState().setIsPro(hasProEntitlement);
      if (__DEV__) {
        console.log('🔄 Updated subscription status on check:', hasProEntitlement);
      }
    }
    
    if (__DEV__) {
      console.log('🔍 Subscription status check:', hasProEntitlement);
      if (proEntitlement) {
        console.log('🔍 Pro entitlement details:', {
          isActive: proEntitlement.isActive,
          willRenew: proEntitlement.willRenew,
          expirationDate: proEntitlement.expirationDate
        });
      }
    }
    
    return hasProEntitlement;
  } catch (error) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to check subscription status:', error);
    }
    // On error, don't change current state - let user keep current access level
    return useSubscriptionStore.getState().isPro;
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
    
    const { customerInfo } = await Purchases.restorePurchases();
    
    if (__DEV__) {
      console.log('✅ Purchases restored:', customerInfo);
    }
    
    // Add null safety check
    if (!customerInfo) {
      if (__DEV__) {
        console.log('⚠️ No customer info returned from restore');
      }
      return false;
    }
    
    // Check if restored purchases include pro entitlement using isActive property
    const proEntitlement = customerInfo.entitlements.active['pro'];
    const hasProEntitlement = proEntitlement?.isActive === true;
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
    if (__DEV__) {
      console.log('🔄 Restore completed, pro status:', hasProEntitlement);
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
    
    const { customerInfo } = await Purchases.restorePurchases();
    
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
    
    // Check if restored purchases include pro entitlement using isActive property
    const proEntitlement = customerInfo.entitlements.active['pro'];
    const hasProEntitlement = proEntitlement?.isActive === true;
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
    if (__DEV__) {
      console.log('🔄 Detailed restore completed, pro status:', hasProEntitlement);
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
      
      paywallResult = await RevenueCatUI.presentPaywall();
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
    
    const proEntitlement = customerInfo.entitlements.active['pro'];
    
    // Only return expiration date if entitlement is active
    if (proEntitlement?.isActive && proEntitlement.expirationDate) {
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
      // In Expo Go, allow access for testing
      if (__DEV__) {
        console.log('⚠️ Allowing premium access in Expo Go for testing');
      }
      return true;
    }
    
    // Call getCustomerInfo() as recommended by RevenueCat docs
    // "It's safe to call getCustomerInfo() frequently throughout your app"
    const customerInfo = await getCustomerInfo();
    
    if (!customerInfo) {
      // Only update store in error case where CustomerInfo is unavailable
      useSubscriptionStore.getState().setIsPro(false);
      return false;
    }
    
    // Check entitlement using isActive property for accuracy
    const proEntitlement = customerInfo.entitlements.active['pro'];
    const hasValidAccess = proEntitlement?.isActive === true;
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
    if (__DEV__) {
      console.log('🔐 Premium access validation:', hasValidAccess);
      if (proEntitlement && !hasValidAccess) {
        console.log('🔐 Pro entitlement exists but not active:', {
          isActive: proEntitlement.isActive,
          willRenew: proEntitlement.willRenew,
          expirationDate: proEntitlement.expirationDate
        });
      }
    }
    
    return hasValidAccess;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to validate premium access:', error);
    }
    // On error, return current state to avoid disrupting user experience
    return useSubscriptionStore.getState().isPro;
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

// Interface for subscription plan details
export interface SubscriptionPlanDetails {
  planType: 'weekly' | 'monthly';
  usageLimit: number;
  billingCycleStart: string; // ISO date string
  nextResetDate: string; // ISO date string
  originalPurchaseDate: string; // ISO date string
  productIdentifier: string;
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
        productIdentifier: 'mock_monthly'
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
      productIdentifier: proEntitlement.productIdentifier || 'unknown'
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
  const initialProStatus = useSubscriptionStore.getState().isPro;
  let lastProStatus = initialProStatus;
  let stableCheckCount = 0;
  const requiredStableChecks = 3; // Status must be stable for 3 checks
  
  if (__DEV__) {
    console.log(`⏳ Waiting for subscription update (timeout: ${timeout}ms, expecting change: ${expectedChange})`);
  }
  
  return new Promise((resolve) => {
    const checkStatus = () => {
      const currentProStatus = useSubscriptionStore.getState().isPro;
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


// Proper restore following RevenueCat docs - sync first, then restore
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
    
    // Store initial state
    const initialProStatus = useSubscriptionStore.getState().isPro;
    
    // STEP 1: Sync purchases first (recommended by RevenueCat for anonymous users)
    // This pulls past purchases from App Store and links anonymous IDs
    try {
      if (__DEV__) {
        console.log('🔄 Syncing purchases with current Apple ID...');
      }
      await Purchases.syncPurchases();
      
      // Check if sync found purchases
      const afterSyncInfo = await Purchases.getCustomerInfo();
      const afterSyncPro = afterSyncInfo.entitlements.active['pro'];
      const foundPurchasesFromSync = afterSyncPro?.isActive === true;
      
      if (foundPurchasesFromSync) {
        if (__DEV__) {
          console.log('✅ Sync found purchases, no need for restore');
        }
        
        // Wait for listener to update
        await waitForSubscriptionUpdate({
          timeout: 2000,
          checkInterval: 100,
          expectedChange: !initialProStatus
        });
        
        return {
          success: true,
          hasActiveEntitlements: true
        };
      }
    } catch (syncError) {
      if (__DEV__) {
        console.log('⚠️ Sync failed, will try restore:', syncError);
      }
    }
    
    // STEP 2: If sync didn't find purchases, try restore (may prompt user)
    if (__DEV__) {
      console.log('🔄 Sync found no purchases, trying restore...');
    }
    
    const restore = await Purchases.restorePurchases();
    
    // Wait for the listener to update the store
    const storeUpdate = await waitForSubscriptionUpdate({
      timeout: 3000,
      checkInterval: 100,
      expectedChange: !initialProStatus
    });
    
    // Check the final status from store
    const finalProStatus = useSubscriptionStore.getState().isPro;
    
    if (__DEV__) {
      console.log('🔄 Restore complete:', {
        hadProBefore: initialProStatus,
        hasProNow: finalProStatus,
        storeUpdated: storeUpdate.success
      });
    }
    
    return {
      success: true,
      hasActiveEntitlements: finalProStatus
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