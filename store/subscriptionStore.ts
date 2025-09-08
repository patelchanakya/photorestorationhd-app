// Removed import - migrating to RevenueCat Context Provider
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Optimized debounced storage shared with restoration store for better performance
let subscriptionPersistenceTimeout: ReturnType<typeof setTimeout> | null = null;
let subscriptionPendingWrites = new Map<string, string>();

const debouncedSubscriptionStorage = {
  getItem: async (name: string) => {
    try {
      const value = await AsyncStorage.getItem(name);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      if (__DEV__) {
        console.error('Subscription storage getItem error:', error);
      }
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    // Batch subscription writes for better performance
    subscriptionPendingWrites.set(name, value);
    
    if (subscriptionPersistenceTimeout) {
      clearTimeout(subscriptionPersistenceTimeout);
    }
    
    subscriptionPersistenceTimeout = setTimeout(async () => {
      try {
        // Batch write all pending subscription items
        const writes = Array.from(subscriptionPendingWrites.entries());
        subscriptionPendingWrites.clear();
        
        await Promise.all(
          writes.map(([key, val]) => AsyncStorage.setItem(key, val))
        );
      } catch (error) {
        if (__DEV__) {
          console.error('Subscription storage batch write error:', error);
        }
      } finally {
        subscriptionPersistenceTimeout = null;
      }
    }, 300); // Faster than restoration store since subscription updates are more critical
  },
  removeItem: async (name: string) => {
    try {
      subscriptionPendingWrites.delete(name);
      await AsyncStorage.removeItem(name);
    } catch (error) {
      if (__DEV__) {
        console.error('Subscription storage removeItem error:', error);
      }
    }
  },
};

interface SubscriptionState {
  isPro: boolean;
  expirationDate: string | null;
  appUserId: string | null;
  transactionId: string | null;
  hasSeenUpgradePrompt: boolean;
  planType: 'free' | 'weekly' | 'monthly';
  setIsPro: (isPro: boolean) => void;
  setExpirationDate: (date: string | null) => void;
  setAppUserId: (userId: string | null) => void;
  setTransactionId: (transactionId: string | null) => void;
  setHasSeenUpgradePrompt: (seen: boolean) => void;
  setPlanType: (planType: 'free' | 'weekly' | 'monthly') => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isPro: false, // This will NOT be persisted - see partialize below
      expirationDate: null,
      appUserId: null,
      transactionId: null,
      hasSeenUpgradePrompt: false,
      planType: 'free',
      setIsPro: (isPro) => set({ isPro }),
      setExpirationDate: (date) => set({ expirationDate: date }),
      setAppUserId: (userId) => set({ appUserId: userId }),
      setTransactionId: (transactionId) => set({ transactionId }),
      setHasSeenUpgradePrompt: (seen) => set({ hasSeenUpgradePrompt: seen }),
      setPlanType: (planType) => set({ planType }),
    }),
    {
      name: 'subscription-storage-v2', // Keep same name to avoid breaking production
      storage: debouncedSubscriptionStorage as any,
      // Only persist user preferences, not subscription status
      partialize: (state) => ({
        expirationDate: state.expirationDate,
        appUserId: state.appUserId,
        transactionId: state.transactionId,
        hasSeenUpgradePrompt: state.hasSeenUpgradePrompt,
        planType: state.planType,
        // isPro is not persisted - must be refreshed from RevenueCat on app start
      }),
    }
  )
);

// Callback initialization removed - using RevenueCat Context Provider instead