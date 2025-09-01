// Removed import - migrating to RevenueCat Context Provider
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        },
      },
      // Only persist user preferences, not subscription status
      partialize: (state) => ({
        expirationDate: state.expirationDate,
        appUserId: state.appUserId,
        transactionId: state.transactionId,
        hasSeenUpgradePrompt: state.hasSeenUpgradePrompt,
        planType: state.planType,
        // isPro is not persisted - must be refreshed from RevenueCat on app start
      }) as any,
    }
  )
);

// Callback initialization removed - using RevenueCat Context Provider instead