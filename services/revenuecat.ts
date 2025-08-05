import { useSubscriptionStore } from '@/store/subscriptionStore';
import { analyticsService } from '@/services/analytics';
import Constants from 'expo-constants';
import Purchases, {
    CustomerInfo,
    PurchasesOffering,
    PurchasesPackage
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

export interface RevenueCatOfferings {
  monthly?: PurchasesPackage;
  weekly?: PurchasesPackage;
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
    
    // Check if the purchase gave access to pro features using isActive property
    const proEntitlement = customerInfo.entitlements.active['pro'];
    const hasProEntitlement = proEntitlement?.isActive === true;
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
    if (__DEV__) {
      console.log('🔄 Purchase completed, pro status:', hasProEntitlement);
    }
    
    return hasProEntitlement;
  } catch (error) {
    // Handle different error types
    if (error.code === '1' || error.userCancelled) {
      // User cancelled - normal behavior, no logging needed
      return false;
    }
    
    // Only log actual errors in development builds
    if (__DEV__) {
      console.error('❌ Purchase failed:', error);
      if (error.code === '2') {
        if (__DEV__) {
          console.log('🔒 Store problem');
        }
      } else if (error.code === '3') {
        if (__DEV__) {
          console.log('💳 Purchase not allowed');
        }
      } else if (error.code === '4') {
        if (__DEV__) {
          console.log('🚫 Product not available for purchase');
        }
      } else if (error.code === '5') {
        if (__DEV__) {
          console.log('🔑 Product already purchased');
        }
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
    
    // Note: Store update handled by CustomerInfo listener in _layout.tsx
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
      
      // Wait briefly and check subscription status via store to see if restore actually worked
      // The CustomerInfo listener in _layout.tsx might have updated the store
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const currentProStatus = useSubscriptionStore.getState().isPro;
      if (currentProStatus) {
        if (__DEV__) {
          console.log('✅ Restore appears successful despite null customerInfo - user has pro status');
        }
        return {
          success: true,
          hasActiveEntitlements: true
        };
      }
      
      if (__DEV__) {
        console.log('❌ Restore failed - no customerInfo and user not pro');
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
    const customerInfo = await getCustomerInfo();
    return customerInfo?.originalAppUserId || null;
  } catch (error) {
    // Only log errors in development builds
    if (__DEV__) {
      console.error('❌ Failed to get app user ID:', error);
    }
    return null;
  }
};