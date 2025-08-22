import * as SecureStore from 'expo-secure-store';
import Purchases from 'react-native-purchases';

export interface ProStatus {
  isPro: boolean;
  planType: 'free' | 'weekly' | 'monthly';
  expiresAt: string | null;
  transactionId: string | null;
}

const PRO_STATUS_KEY = 'pro_status';

/**
 * Simple subscription service using expiration-based checks
 * No complex caching - just RevenueCat API + SecureStorage + expiration dates
 */
export class SimpleSubscriptionService {
  
  /**
   * Refresh Pro status from RevenueCat and store in SecureStorage
   * Call this on app startup and after purchases
   */
  static async refreshProStatus(): Promise<ProStatus> {
    try {
      console.log('🔄 Refreshing Pro status from RevenueCat...');
      
      const customerInfo = await Purchases.getCustomerInfo();
      const proEntitlement = customerInfo.entitlements.active.pro;
      
      // Get transaction ID using iOS-correct method (same as trackingIds.ts)
      let transactionId: string | null = null;
      if (proEntitlement?.productIdentifier) {
        const subscription = customerInfo.subscriptionsByProductIdentifier?.[proEntitlement.productIdentifier];
        transactionId = subscription?.storeTransactionId || null;
      }
      
      const proStatus: ProStatus = {
        isPro: !!proEntitlement,
        planType: SimpleSubscriptionService.getPlanType(proEntitlement?.productIdentifier),
        expiresAt: proEntitlement?.expirationDate || null,
        transactionId: transactionId
      };
      
      // Store in SecureStorage for fast access
      await SecureStore.setItemAsync(PRO_STATUS_KEY, JSON.stringify(proStatus));
      
      console.log('✅ Pro status refreshed:', {
        isPro: proStatus.isPro,
        planType: proStatus.planType,
        expiresAt: proStatus.expiresAt,
        hasTransactionId: !!proStatus.transactionId
      });
      
      return proStatus;
      
    } catch (error) {
      console.error('❌ Failed to refresh Pro status:', error);
      
      // Fallback to cached status or default free
      const cached = await SimpleSubscriptionService.getCachedProStatus();
      return cached || {
        isPro: false,
        planType: 'free',
        expiresAt: null,
        transactionId: null
      };
    }
  }
  
  /**
   * Get Pro status with automatic expiration checking
   * Fast SecureStorage access with expiration validation
   */
  static async getProStatus(): Promise<ProStatus> {
    try {
      const cached = await SimpleSubscriptionService.getCachedProStatus();
      
      if (!cached) {
        // No cache - refresh from RevenueCat
        return SimpleSubscriptionService.refreshProStatus();
      }
      
      // Check if Pro status has expired or is expiring soon (within 5 minutes)
      if (cached.isPro && cached.expiresAt) {
        const now = new Date();
        const expirationDate = new Date(cached.expiresAt);
        const timeUntilExpiration = expirationDate.getTime() - now.getTime();
        const fiveMinutesMs = 5 * 60 * 1000;
        
        if (timeUntilExpiration <= 0) {
          console.log('⏰ Cached Pro subscription appears expired, verifying with RevenueCat...');
          
          // CRITICAL FIX: Don't immediately mark as expired based on cache
          // Always verify with RevenueCat first, as local cache may be stale
          const freshStatus = await SimpleSubscriptionService.refreshProStatus();
          
          if (!freshStatus.isPro) {
            console.log('✅ RevenueCat confirms subscription is expired');
            return freshStatus;
          } else {
            console.log('🔄 RevenueCat shows active subscription - cache was stale');
            return freshStatus;
          }
        } else if (timeUntilExpiration <= fiveMinutesMs) {
          console.log(`⚠️ Pro subscription expiring in ${Math.round(timeUntilExpiration / 1000 / 60)} minutes, refreshing from RevenueCat...`);
          
          // Refresh from RevenueCat to get latest status
          return SimpleSubscriptionService.refreshProStatus();
        }
      }
      
      // Cache is valid
      return cached;
      
    } catch (error) {
      console.error('❌ Failed to get Pro status:', error);
      return {
        isPro: false,
        planType: 'free',
        expiresAt: null,
        transactionId: null
      };
    }
  }
  
  /**
   * Quick Pro check for UI elements
   */
  static async isProUser(): Promise<boolean> {
    const status = await SimpleSubscriptionService.getProStatus();
    return status.isPro;
  }
  
  /**
   * Get transaction ID for Pro users (for video usage tracking)
   */
  static async getTransactionId(): Promise<string | null> {
    const status = await SimpleSubscriptionService.getProStatus();
    return status.isPro ? status.transactionId : null;
  }
  
  /**
   * Get user ID for usage tracking
   * Pro users: use transaction ID
   * Free users: use RevenueCat anonymous ID
   */
  static async getUserIdForTracking(): Promise<string | null> {
    try {
      if (__DEV__) console.log('🔍 Getting user ID for tracking...');
      
      // Always get fresh status to ensure we have the latest data after purchases
      if (__DEV__) console.log('🔄 Getting fresh Pro status to ensure accurate tracking ID');
      
      // Get current Pro status (this will now properly verify with RevenueCat if cache is stale)
      const status = await SimpleSubscriptionService.getProStatus();
      if (__DEV__) console.log('📊 Pro status for tracking:', {
        isPro: status.isPro,
        hasTransactionId: !!status.transactionId,
        transactionId: status.transactionId ? `${status.transactionId.substring(0, 10)}...` : null,
        expiresAt: status.expiresAt
      });
      
      if (status.isPro && status.transactionId) {
        // Pro users: use transaction ID for cross-device tracking
        const userId = `store:${status.transactionId}`;
        if (__DEV__) console.log('✅ Pro user - using transaction ID format:', `store:${status.transactionId.substring(0, 10)}...`);
        return userId;
      } else if (status.isPro && !status.transactionId) {
        if (__DEV__) console.log('⚠️ Pro user but no transaction ID - forcing refresh from RevenueCat...');
        
        // Force a fresh refresh to get transaction ID
        const refreshedStatus = await SimpleSubscriptionService.refreshProStatus();
        if (refreshedStatus.isPro && refreshedStatus.transactionId) {
          const userId = `store:${refreshedStatus.transactionId}`;
          if (__DEV__) console.log('✅ Force refresh successful - got transaction ID:', `store:${refreshedStatus.transactionId.substring(0, 10)}...`);
          return userId;
        } else {
          if (__DEV__) console.error('❌ Pro user confirmed but still no transaction ID - using fallback');
          // For Pro users without transaction ID, use a special fallback format
          const customerInfo = await Purchases.getCustomerInfo();
          const fallbackId = `fallback:${customerInfo.originalAppUserId}`;
          if (__DEV__) console.log('🆘 Using Pro fallback ID format:', fallbackId);
          return fallbackId;
        }
      }
      
      // Free users: use current RevenueCat anonymous ID
      const customerInfo = await Purchases.getCustomerInfo();
      const anonymousId = customerInfo.originalAppUserId;
      if (__DEV__) console.log('📱 Using RevenueCat anonymous ID for free user:', anonymousId);
      return anonymousId;
      
    } catch (error) {
      if (__DEV__) console.error('❌ Failed to get tracking ID:', error);
      return null;
    }
  }
  
  /**
   * Check if user can access feature
   */
  static async canAccessFeature(feature: 'unlimited_photos' | 'video_generation' | 'premium_styles'): Promise<boolean> {
    const status = await SimpleSubscriptionService.getProStatus();
    
    switch (feature) {
      case 'unlimited_photos':
      case 'premium_styles':
        return status.isPro;
      case 'video_generation':
        return status.isPro; // Videos require Pro
      default:
        return false;
    }
  }
  
  /**
   * Clear cached Pro status (for testing or logout)
   */
  static async clearCache(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(PRO_STATUS_KEY);
      console.log('🗑️ Pro status cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear Pro status cache:', error);
    }
  }
  
  // Private helper methods
  
  private static async getCachedProStatus(): Promise<ProStatus | null> {
    try {
      const cached = await SecureStore.getItemAsync(PRO_STATUS_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('❌ Failed to get cached Pro status:', error);
      return null;
    }
  }
  
  private static getPlanType(productIdentifier?: string): 'free' | 'weekly' | 'monthly' {
    if (!productIdentifier) return 'free';
    
    const productId = productIdentifier.toLowerCase();
    if (productId.includes('weekly') || productId.includes('week')) {
      return 'weekly';
    } else if (productId.includes('monthly') || productId.includes('month')) {
      return 'monthly';
    }
    
    return 'monthly'; // Default assumption for Pro users
  }
}

// Export convenience functions
export const refreshProStatus = SimpleSubscriptionService.refreshProStatus;
export const getProStatus = SimpleSubscriptionService.getProStatus;
export const isProUser = SimpleSubscriptionService.isProUser;
export const getTransactionId = SimpleSubscriptionService.getTransactionId;
export const getUserIdForTracking = SimpleSubscriptionService.getUserIdForTracking;
export const canAccessFeature = SimpleSubscriptionService.canAccessFeature;