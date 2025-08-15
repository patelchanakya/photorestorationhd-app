import { initializeStoreCallbacks } from '@/services/revenuecat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SubscriptionState {
  isPro: boolean;
  expirationDate: string | null;
  appUserId: string | null;
  hasSeenUpgradePrompt: boolean;
  setIsPro: (isPro: boolean) => void;
  setExpirationDate: (date: string | null) => void;
  setAppUserId: (userId: string | null) => void;
  setHasSeenUpgradePrompt: (seen: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isPro: false, // This will NOT be persisted - see partialize below
      expirationDate: null,
      appUserId: null,
      hasSeenUpgradePrompt: false,

      setIsPro: (isPro) => {
        const currentState = get();
        console.log('🔄 [TEST] Subscription store: Setting isPro', {
          from: currentState.isPro,
          to: isPro,
          changed: currentState.isPro !== isPro,
          timestamp: new Date().toISOString()
        });
        set({ isPro });
      },

      setExpirationDate: (date) => {
        const currentState = get();
        console.log('📅 [TEST] Subscription store: Setting expiration date', {
          from: currentState.expirationDate,
          to: date,
          changed: currentState.expirationDate !== date,
          timestamp: new Date().toISOString()
        });
        set({ expirationDate: date });
      },

      setAppUserId: (userId) => {
        const currentState = get();
        console.log('👤 [TEST] Subscription store: Setting app user ID', {
          from: currentState.appUserId,
          to: userId,
          changed: currentState.appUserId !== userId,
          timestamp: new Date().toISOString()
        });
        set({ appUserId: userId });
      },

      setHasSeenUpgradePrompt: (seen) => {
        if (__DEV__) {
          console.log('🎯 Subscription store: Setting hasSeenUpgradePrompt to', seen);
        }
        set({ hasSeenUpgradePrompt: seen });
      },
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
      // IMPORTANT: Exclude isPro from persistence to prevent subscription leakage across Apple IDs
      partialize: (state) => ({
        // Only persist these fields - isPro is explicitly excluded
        expirationDate: state.expirationDate,
        appUserId: state.appUserId,
        hasSeenUpgradePrompt: state.hasSeenUpgradePrompt,
        // isPro is NOT included here - it must come fresh from RevenueCat on each app start
        // Photo usage is now handled by database - no local persistence needed
      }) as any,
      // Force isPro to always start as false when rehydrating from storage
      onRehydrateStorage: () => (state, error) => {
        if (state && !error) {
          // Always reset isPro to false on app startup - RevenueCat will set it correctly
          console.log('🔄 [TEST] Store rehydrating from persistence:', {
            persistedState: {
              expirationDate: state.expirationDate,
              appUserId: state.appUserId,
              hasSeenUpgradePrompt: state.hasSeenUpgradePrompt
            },
            isPro_before_reset: state.isPro
          });
          state.isPro = false;
          console.log('✅ [TEST] Store rehydrated: isPro reset to false, waiting for RevenueCat');
        } else if (error) {
          console.error('❌ [TEST] Store rehydration error:', error);
        }
      },
    }
  )
);

// Initialize callbacks to break circular dependency with revenuecat service
initializeStoreCallbacks({
  setIsPro: (isPro: boolean) => useSubscriptionStore.getState().setIsPro(isPro),
  setExpirationDate: (date: string | null) => useSubscriptionStore.getState().setExpirationDate(date),
  getIsPro: () => useSubscriptionStore.getState().isPro,
});