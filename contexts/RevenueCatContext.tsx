import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Constants from 'expo-constants';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { analyticsService } from '@/services/analytics';
import { getOrCreateCustomUserId } from '@/services/trackingIds';

interface RevenueCatContextValue {
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  isPro: boolean;
  error: string | null;
  refreshCustomerInfo: () => Promise<void>;
  checkSubscriptionStatus: () => Promise<boolean>;
  getSubscriptionExpirationDate: () => Date | null;
  syncPurchases: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

export const RevenueCatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Calculate isPro based on current customer info using RevenueCat official pattern
  const isPro = React.useMemo(() => {
    if (!customerInfo) return false;
    // Follow RevenueCat docs: check if entitlement exists in active collection
    const proEntitlement = customerInfo?.entitlements?.active?.['pro'];
    return proEntitlement !== undefined;
  }, [customerInfo]);

  const refreshCustomerInfo = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Skip in Expo Go
      if (Constants.appOwnership === 'expo') {
        if (__DEV__) {
          console.log('⚠️ Using mock customer info in Expo Go');
        }
        setCustomerInfo(null);
        return;
      }

      // Check if RevenueCat is configured before making API calls
      const isConfigured = await Purchases.isConfigured();
      if (!isConfigured) {
        if (__DEV__) {
          console.log('⚠️ RevenueCat not configured, skipping refresh');
        }
        return;
      }

      // Only invalidate cache if explicitly requested for critical operations
      // RevenueCat automatically manages cache freshness in most cases
      if (__DEV__) {
        console.log('📊 Getting customer info (using RevenueCat automatic cache management)');
      }

      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);

      // Set user context for analytics
      try {
        const deviceId = await getOrCreateCustomUserId();
        const subscriptionStatus = Object.keys(info.entitlements.active).length > 0 ? 'pro' : 'free';
        
        analyticsService.setUserContext(
          info.originalAppUserId || deviceId || 'anonymous',
          subscriptionStatus,
          false // We'll determine if it's a new user elsewhere
        );
        
        if (__DEV__) {
          console.log('✅ User context set for analytics:', {
            userId: info.originalAppUserId || deviceId,
            subscriptionStatus
          });
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Failed to set user context:', error);
        }
      }

      if (__DEV__) {
        console.log('📊 Customer info refreshed:', {
          appUserId: info.originalAppUserId,
          activeEntitlements: Object.keys(info.entitlements.active),
          allEntitlements: Object.keys(info.entitlements.all)
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      // Log error for debugging
      if (__DEV__) {
        console.error('❌ Failed to refresh customer info:', errorMessage);
      }
      
      // Track error in analytics
      analyticsService.track('RevenueCat Error', {
        operation: 'refreshCustomerInfo',
        error: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkSubscriptionStatus = useCallback(async (): Promise<boolean> => {
    try {
      // Skip in Expo Go
      if (Constants.appOwnership === 'expo') {
        return false;
      }

      // Check if RevenueCat is configured before making API calls
      const isConfigured = await Purchases.isConfigured();
      if (!isConfigured) {
        if (__DEV__) {
          console.log('⚠️ RevenueCat not configured, cannot check subscription status');
        }
        return false;
      }

      // Use automatic cache management for better performance
      // Only invalidate cache when explicitly needed (like after purchases)
      if (__DEV__) {
        console.log('🔍 Checking subscription status (using cached data if available)');
      }

      // Get fresh customer info directly to avoid stale state
      const info = await Purchases.getCustomerInfo();
      if (!info) return false;
      
      // Use official RevenueCat pattern for entitlement checking
      const proEntitlement = info?.entitlements?.active?.['pro'];
      return proEntitlement !== undefined;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to check subscription status:', error);
      }
      return false;
    }
  }, []);

  const getSubscriptionExpirationDate = useCallback((): Date | null => {
    if (!customerInfo) return null;
    
    // Follow RevenueCat pattern - only check active entitlements
    const proEntitlement = customerInfo?.entitlements?.active?.['pro'];
    
    // Only return expiration date if entitlement exists in active collection
    if (proEntitlement && proEntitlement.expirationDate) {
      return new Date(proEntitlement.expirationDate);
    }
    
    return null;
  }, [customerInfo]);

  const syncPurchases = useCallback(async () => {
    try {
      if (Constants.appOwnership === 'expo') {
        if (__DEV__) {
          console.log('⚠️ Cannot sync purchases in Expo Go');
        }
        return;
      }
      
      // Check if RevenueCat is configured before making API calls
      const isConfigured = await Purchases.isConfigured();
      if (!isConfigured) {
        if (__DEV__) {
          console.log('⚠️ RevenueCat not configured, cannot sync purchases');
        }
        return;
      }
      
      if (__DEV__) {
        console.log('🔄 Syncing purchases with RevenueCat...');
      }
      
      await Purchases.syncPurchases();
      
      // Refresh customer info after sync
      await refreshCustomerInfo();
      
      if (__DEV__) {
        console.log('✅ Purchases synced successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (__DEV__) {
        console.error('❌ Failed to sync purchases:', errorMessage);
      }
      
      analyticsService.track('RevenueCat Error', {
        operation: 'syncPurchases',
        error: errorMessage,
      });
    }
  }, [refreshCustomerInfo]);

  const forceRefresh = useCallback(async () => {
    try {
      if (Constants.appOwnership === 'expo') {
        if (__DEV__) {
          console.log('⚠️ Cannot force refresh in Expo Go');
        }
        return;
      }
      
      // Check if RevenueCat is configured before making API calls
      const isConfigured = await Purchases.isConfigured();
      if (!isConfigured) {
        if (__DEV__) {
          console.log('⚠️ RevenueCat not configured, cannot force refresh');
        }
        return;
      }
      
      if (__DEV__) {
        console.log('🔄 Force refreshing RevenueCat data...');
      }
      
      // Only invalidate cache for force refresh operations
      await Purchases.invalidateCustomerInfoCache();
      
      // Reduced delay for better performance
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Refresh customer info
      await refreshCustomerInfo();
      
      if (__DEV__) {
        console.log('✅ Force refresh completed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (__DEV__) {
        console.error('❌ Failed to force refresh:', errorMessage);
      }
      
      analyticsService.track('RevenueCat Error', {
        operation: 'forceRefresh',
        error: errorMessage,
      });
    }
  }, [refreshCustomerInfo]);

  useEffect(() => {
    let isMounted = true;
    let removeListener: (() => void) | undefined;

    const initializeRevenueCatContext = async () => {
      try {
        // Initial fetch
        await refreshCustomerInfo();

        if (!isMounted) return;

        // Skip listener setup in Expo Go
        if (Constants.appOwnership === 'expo') {
          return;
        }

        // Wait for RevenueCat to be configured by _layout.tsx
        // This is the proper pattern from official docs - configuration happens in main app
        let attempts = 0;
        const maxAttempts = 50; // 10 seconds max wait
        
        while (attempts < maxAttempts) {
          try {
            if (await Purchases.isConfigured()) {
              break;
            }
          } catch (error) {
            // RevenueCat not ready yet, continue waiting
          }
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
          
          if (!isMounted) return;
        }

        if (attempts >= maxAttempts) {
          if (__DEV__) {
            console.warn('⚠️ RevenueCat not configured after waiting, skipping listener setup');
          }
          return;
        }

        // Set up customer info listener (official docs pattern)
        Purchases.addCustomerInfoUpdateListener((info) => {
          if (isMounted) {
            setCustomerInfo(info);
            setError(null);
            
            if (__DEV__) {
              console.log('🔄 Customer info updated via context listener');
            }
          }
        });
        removeListener = () => {
          // RevenueCat doesn't provide a direct remove method for individual listeners
          // The listener is automatically cleaned up when the context unmounts
        };

        if (__DEV__) {
          console.log('✅ RevenueCat context listener configured');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Failed to setup RevenueCat context listener:', error);
        }
      }
    };

    initializeRevenueCatContext();

    return () => {
      isMounted = false;
      removeListener?.();
    };
  }, [refreshCustomerInfo]);

  const contextValue = React.useMemo(() => ({
    customerInfo,
    isLoading,
    isPro,
    error,
    refreshCustomerInfo,
    checkSubscriptionStatus,
    getSubscriptionExpirationDate,
    syncPurchases,
    forceRefresh,
  }), [
    customerInfo,
    isLoading,
    isPro,
    error,
    refreshCustomerInfo,
    checkSubscriptionStatus,
    getSubscriptionExpirationDate,
    syncPurchases,
    forceRefresh,
  ]);

  return (
    <RevenueCatContext.Provider value={contextValue}>
      {children}
    </RevenueCatContext.Provider>
  );
};

export const useRevenueCat = () => {
  const context = useContext(RevenueCatContext);
  if (!context) {
    if (__DEV__) {
      console.warn('useRevenueCat called before RevenueCatProvider is ready, providing defaults');
    }
    // Provide safe defaults instead of throwing error
    return {
      customerInfo: null,
      isLoading: true,
      isPro: false,
      error: null,
      refreshCustomerInfo: async () => {},
      checkSubscriptionStatus: async () => false,
      getSubscriptionExpirationDate: () => null,
      syncPurchases: async () => {},
      forceRefresh: async () => {},
    };
  }
  return context;
};

export default RevenueCatContext;