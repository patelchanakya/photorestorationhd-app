import Purchases, { 
  CustomerInfo, 
  Offerings, 
  PurchasesPackage, 
  PurchasesOffering 
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import Constants from 'expo-constants';

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
      console.log('⚠️ Using mock offerings in Expo Go');
      return {};
    }
    
    const offerings = await Purchases.getOfferings();
    console.log('📦 Fetched offerings:', offerings);
    
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
      
      console.log('💰 Monthly package:', monthly);
      console.log('📅 Weekly package:', weekly);
      
      return { monthly, weekly };
    }
    
    console.log('⚠️ No current offering found');
    return {};
  } catch (error) {
    console.error('❌ Failed to get offerings:', error);
    return {};
  }
};

export const purchasePackage = async (packageToPurchase: PurchasesPackage): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      console.log('⚠️ Cannot purchase in Expo Go');
      return false;
    }
    
    console.log('🛒 Purchasing package:', packageToPurchase.identifier);
    
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    
    console.log('✅ Purchase successful:', customerInfo);
    
    // Check if the purchase gave access to pro features
    const hasProEntitlement = customerInfo.entitlements.active['pro'] !== undefined;
    
    // Update the subscription store
    useSubscriptionStore.getState().setIsPro(hasProEntitlement);
    
    console.log('🔄 Updated pro status after purchase:', hasProEntitlement);
    
    return hasProEntitlement;
  } catch (error) {
    console.error('❌ Purchase failed:', error);
    
    // Handle different error types
    if (error.code === '1' || error.userCancelled) {
      console.log('🚫 User cancelled purchase');
    } else if (error.code === '2') {
      console.log('🔒 Store problem');
    } else if (error.code === '3') {
      console.log('💳 Purchase not allowed');
    } else if (error.code === '4') {
      console.log('🚫 Product not available for purchase');
    } else if (error.code === '5') {
      console.log('🔑 Product already purchased');
    }
    
    return false;
  }
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    if (isExpoGo()) {
      console.log('⚠️ Cannot get customer info in Expo Go');
      return null;
    }
    
    const customerInfo = await Purchases.getCustomerInfo();
    console.log('👤 Customer info:', customerInfo);
    return customerInfo;
  } catch (error) {
    console.error('❌ Failed to get customer info:', error);
    return null;
  }
};

export const checkSubscriptionStatus = async (): Promise<boolean> => {
  try {
    const customerInfo = await getCustomerInfo();
    
    if (!customerInfo) {
      return false;
    }
    
    // Check if user has active pro entitlement
    const hasProEntitlement = customerInfo.entitlements.active['pro'] !== undefined;
    
    // Update the subscription store
    useSubscriptionStore.getState().setIsPro(hasProEntitlement);
    
    console.log('🔍 Subscription status check:', hasProEntitlement);
    
    return hasProEntitlement;
  } catch (error) {
    console.error('❌ Failed to check subscription status:', error);
    return false;
  }
};

export const restorePurchases = async (): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      console.log('⚠️ Cannot restore purchases in Expo Go');
      return false;
    }
    
    console.log('🔄 Restoring purchases...');
    
    const { customerInfo } = await Purchases.restorePurchases();
    
    console.log('✅ Purchases restored:', customerInfo);
    
    // Check if restored purchases include pro entitlement
    const hasProEntitlement = customerInfo.entitlements.active['pro'] !== undefined;
    
    // Update the subscription store
    useSubscriptionStore.getState().setIsPro(hasProEntitlement);
    
    console.log('🔄 Pro status after restore:', hasProEntitlement);
    
    return hasProEntitlement;
  } catch (error) {
    console.error('❌ Failed to restore purchases:', error);
    return false;
  }
};

// Native paywall presentation functions
export const presentPaywall = async (): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      console.log('⚠️ Cannot present native paywall in Expo Go');
      return false;
    }
    
    console.log('🎯 Presenting native paywall...');
    
    // Try-catch specifically for the UI module
    let paywallResult: PAYWALL_RESULT;
    try {
      console.log('📦 RevenueCatUI module:', RevenueCatUI);
      console.log('📦 RevenueCatUI.presentPaywall:', RevenueCatUI.presentPaywall);
      
      paywallResult = await RevenueCatUI.presentPaywall();
    } catch (uiError) {
      console.error('❌ RevenueCatUI error:', uiError);
      console.log('⚠️ RevenueCatUI not available - the native module is not linked in this build');
      console.log('💡 You need to rebuild with EAS after the pod install');
      return false;
    }
    
    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
        console.log('✅ Purchase completed via paywall');
        // Update subscription status
        await checkSubscriptionStatus();
        return true;
        
      case PAYWALL_RESULT.RESTORED:
        console.log('✅ Purchases restored via paywall');
        // Update subscription status
        await checkSubscriptionStatus();
        return true;
        
      case PAYWALL_RESULT.CANCELLED:
        console.log('🚫 User cancelled paywall');
        return false;
        
      case PAYWALL_RESULT.ERROR:
        console.log('❌ Error presenting paywall');
        return false;
        
      case PAYWALL_RESULT.NOT_PRESENTED:
        console.log('⚠️ Paywall not presented');
        return false;
        
      default:
        console.log('❓ Unknown paywall result:', paywallResult);
        return false;
    }
  } catch (error) {
    console.error('❌ Failed to present paywall:', error);
    return false;
  }
};

// Present paywall only if user doesn't have the required entitlement
export const presentPaywallIfNeeded = async (requiredEntitlementIdentifier: string = 'pro'): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      console.log('⚠️ Cannot present native paywall in Expo Go');
      return false;
    }
    
    console.log('🔍 Checking if paywall is needed for entitlement:', requiredEntitlementIdentifier);
    
    const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier
    });
    
    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        console.log('✅ Access granted via paywall');
        await checkSubscriptionStatus();
        return true;
        
      case PAYWALL_RESULT.NOT_PRESENTED:
        console.log('✅ User already has access, paywall not needed');
        return true;
        
      default:
        console.log('❌ Access not granted:', paywallResult);
        return false;
    }
  } catch (error) {
    console.error('❌ Failed to present paywall if needed:', error);
    return false;
  }
};

// Present paywall for a specific offering
export const presentPaywallForOffering = async (offering: PurchasesOffering): Promise<boolean> => {
  try {
    if (isExpoGo()) {
      console.log('⚠️ Cannot present native paywall in Expo Go');
      return false;
    }
    
    console.log('🎯 Presenting paywall for offering:', offering.identifier);
    
    const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall({
      offering
    });
    
    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        console.log('✅ Success via paywall');
        await checkSubscriptionStatus();
        return true;
        
      default:
        console.log('❌ Paywall result:', paywallResult);
        return false;
    }
  } catch (error) {
    console.error('❌ Failed to present paywall for offering:', error);
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
    
    if (proEntitlement && proEntitlement.expirationDate) {
      return new Date(proEntitlement.expirationDate);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to get expiration date:', error);
    return null;
  }
};

// Helper function to get the user's original app user ID
export const getAppUserId = async (): Promise<string | null> => {
  try {
    const customerInfo = await getCustomerInfo();
    return customerInfo?.originalAppUserId || null;
  } catch (error) {
    console.error('❌ Failed to get app user ID:', error);
    return null;
  }
};