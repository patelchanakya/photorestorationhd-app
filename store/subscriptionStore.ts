import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceTrackingService } from '@/services/deviceTracking';

interface SubscriptionState {
  isPro: boolean;
  freeRestorationsUsed: number;
  freeRestorationsLimit: number;
  lastResetDate: string;
  expirationDate: string | null;
  appUserId: string | null;
  hasSeenUpgradePrompt: boolean;
  setIsPro: (isPro: boolean) => void;
  setExpirationDate: (date: string | null) => void;
  setAppUserId: (userId: string | null) => void;
  setHasSeenUpgradePrompt: (seen: boolean) => void;
  incrementFreeRestorations: () => Promise<void>;
  decrementFreeRestorations: (restorationCreatedAt: string) => Promise<void>;
  resetDailyLimit: () => void;
  canRestore: () => Promise<boolean>;
  getRemainingRestorations: () => Promise<number>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isPro: false,
      freeRestorationsUsed: 0,
      freeRestorationsLimit: 3, // 3 free restorations every 48 hours
      lastResetDate: new Date().toISOString(),
      expirationDate: null,
      appUserId: null,
      hasSeenUpgradePrompt: false,

      setIsPro: (isPro) => {
        if (__DEV__) {
          console.log('🔄 Subscription store: Setting isPro to', isPro);
        }
        set({ isPro });
      },

      setExpirationDate: (date) => {
        if (__DEV__) {
          console.log('📅 Subscription store: Setting expiration date to', date);
        }
        set({ expirationDate: date });
      },

      setAppUserId: (userId) => {
        if (__DEV__) {
          console.log('👤 Subscription store: Setting app user ID to', userId);
        }
        set({ appUserId: userId });
      },

      setHasSeenUpgradePrompt: (seen) => {
        if (__DEV__) {
          console.log('🎯 Subscription store: Setting hasSeenUpgradePrompt to', seen);
        }
        set({ hasSeenUpgradePrompt: seen });
      },


      incrementFreeRestorations: async () => {
        const state = get();
        
        // Don't increment if user is pro
        if (state.isPro) {
          if (__DEV__) {
            console.log('✨ Pro user - not incrementing free restoration count');
          }
          return;
        }
        
        // Increment device-based usage (now local-only)
        const updatedUsage = await deviceTrackingService.incrementUsage();
        
        // Update local state to match device tracking
        set({ 
          freeRestorationsUsed: updatedUsage.free_restorations_used,
          lastResetDate: updatedUsage.last_reset_date
        });
        
        if (__DEV__) {
          console.log('✅ Device usage incremented locally:', updatedUsage.free_restorations_used);
        }
      },

      decrementFreeRestorations: async (restorationCreatedAt: string) => {
        const state = get();
        
        // Don't decrement if user is pro
        if (state.isPro) {
          if (__DEV__) {
            console.log('✨ Pro user - not decrementing free restoration count');
          }
          return;
        }
        
        // Check if the restoration was created within the current 48-hour window
        const now = new Date();
        const createdAt = new Date(restorationCreatedAt);
        const lastReset = new Date(state.lastResetDate);
        
        // If the restoration was created before the last reset, don't decrement
        if (createdAt < lastReset) {
          if (__DEV__) {
            console.log('⚠️ Restoration was created before current 48-hour window, not decrementing');
          }
          return;
        }
        
        // Check if we're still within the same 48-hour window
        const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
        if (hoursSinceReset >= 48) {
          if (__DEV__) {
            console.log('⚠️ Outside current 48-hour window, not decrementing');
          }
          return;
        }
        
        // Decrement device-based usage (now local-only)
        const updatedUsage = await deviceTrackingService.decrementUsage();
        
        // Update local state to match device tracking
        set({ 
          freeRestorationsUsed: updatedUsage.free_restorations_used,
          lastResetDate: updatedUsage.last_reset_date
        });
        
        if (__DEV__) {
          console.log('✅ Device usage decremented locally:', updatedUsage.free_restorations_used);
        }
      },

      resetDailyLimit: () => {
        set({ 
          freeRestorationsUsed: 0, 
          lastResetDate: new Date().toISOString() 
        });
      },

      canRestore: async () => {
        const state = get();
        
        // Pro users have unlimited restorations
        if (state.isPro) {
          if (__DEV__) {
            console.log('✨ Pro user - can restore unlimited');
          }
          return true;
        }
        
        // For free users, check device-based limits (now local-only)
        const canRestoreDevice = await deviceTrackingService.canRestore();
        
        // Update local state to match device tracking
        const deviceUsage = await deviceTrackingService.getDeviceUsage();
        set({ 
          freeRestorationsUsed: deviceUsage.free_restorations_used,
          lastResetDate: deviceUsage.last_reset_date
        });
        
        if (__DEV__) {
          console.log(`🔍 Device tracking (local): can restore = ${canRestoreDevice}`);
        }
        
        return canRestoreDevice;
      },

      getRemainingRestorations: async () => {
        const state = get();
        
        // Pro users have unlimited
        if (state.isPro) {
          return 999; // Large number to indicate unlimited
        }
        
        // For free users, get from device tracking (now local-only)
        return await deviceTrackingService.getRemainingRestorations();
      }
    }),
    {
      name: 'subscription-storage-v2', // Changed name to clear old cache
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
    }
  )
);