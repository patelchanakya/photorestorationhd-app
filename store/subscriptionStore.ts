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
  setIsPro: (isPro: boolean) => void;
  setExpirationDate: (date: string | null) => void;
  setAppUserId: (userId: string | null) => void;
  incrementFreeRestorations: () => Promise<void>;
  resetDailyLimit: () => void;
  canRestore: () => Promise<boolean>;
  getRemainingRestorations: () => Promise<number>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isPro: false,
      freeRestorationsUsed: 0,
      freeRestorationsLimit: 3, // 3 free restorations per day
      lastResetDate: new Date().toDateString(),
      expirationDate: null,
      appUserId: null,

      setIsPro: (isPro) => {
        console.log('🔄 Subscription store: Setting isPro to', isPro);
        set({ isPro });
      },

      setExpirationDate: (date) => {
        console.log('📅 Subscription store: Setting expiration date to', date);
        set({ expirationDate: date });
      },

      setAppUserId: (userId) => {
        console.log('👤 Subscription store: Setting app user ID to', userId);
        set({ appUserId: userId });
      },

      incrementFreeRestorations: async () => {
        const state = get();
        
        // Don't increment if user is pro
        if (state.isPro) {
          console.log('✨ Pro user - not incrementing free restoration count');
          return;
        }
        
        // Increment device-based usage
        try {
          const updatedUsage = await deviceTrackingService.incrementUsage();
          if (updatedUsage) {
            // Update local state to match device tracking
            set({ 
              freeRestorationsUsed: updatedUsage.free_restorations_used,
              lastResetDate: new Date(updatedUsage.last_reset_date).toDateString()
            });
            console.log('✅ Device usage incremented:', updatedUsage.free_restorations_used);
          }
        } catch (error) {
          console.error('❌ Error incrementing device usage, updating local only:', error);
          
          // Fallback to local increment if device tracking fails
          const today = new Date().toDateString();
          if (state.lastResetDate !== today) {
            console.log('🔄 New day - resetting restoration count');
            set({ 
              freeRestorationsUsed: 1, 
              lastResetDate: today 
            });
          } else {
            console.log('➕ Incrementing local restoration count:', state.freeRestorationsUsed + 1);
            set({ 
              freeRestorationsUsed: state.freeRestorationsUsed + 1 
            });
          }
        }
      },

      resetDailyLimit: () => {
        set({ 
          freeRestorationsUsed: 0, 
          lastResetDate: new Date().toDateString() 
        });
      },

      canRestore: async () => {
        // 🧪 TEMPORARY: Always allow restorations for testing
        console.log('🧪 Testing mode - unlimited restorations enabled');
        return true;
        
        /* Original logic commented out for testing:
        const state = get();
        
        // Pro users have unlimited restorations
        if (state.isPro) {
          console.log('✨ Pro user - can restore unlimited');
          return true;
        }
        
        // For free users, check device-based limits
        try {
          const canRestoreDevice = await deviceTrackingService.canRestore();
          console.log(`🔍 Device tracking: can restore = ${canRestoreDevice}`);
          
          // Also update local state to match device tracking
          const deviceUsage = await deviceTrackingService.getDeviceUsage();
          if (deviceUsage) {
            set({ 
              freeRestorationsUsed: deviceUsage.free_restorations_used,
              lastResetDate: new Date(deviceUsage.last_reset_date).toDateString()
            });
          }
          
          return canRestoreDevice;
        } catch (error) {
          console.error('❌ Error checking device limits, falling back to local:', error);
          
          // Fallback to local storage if device tracking fails
          const today = new Date().toDateString();
          if (state.lastResetDate !== today) {
            set({ 
              freeRestorationsUsed: 0, 
              lastResetDate: today 
            });
            return true;
          }
          
          const canRestore = state.freeRestorationsUsed < state.freeRestorationsLimit;
          console.log(`🔍 Local fallback - can restore: ${canRestore} (used: ${state.freeRestorationsUsed}/${state.freeRestorationsLimit})`);
          return canRestore;
        }
        */
      },

      getRemainingRestorations: async () => {
        const state = get();
        
        // Pro users have unlimited
        if (state.isPro) {
          return 999; // Large number to indicate unlimited
        }
        
        // For free users, get from device tracking
        try {
          const remaining = await deviceTrackingService.getRemainingRestorations();
          return remaining;
        } catch (error) {
          console.error('❌ Error getting remaining restorations:', error);
          // Fallback to local calculation
          return Math.max(0, state.freeRestorationsLimit - state.freeRestorationsUsed);
        }
      }
    }),
    {
      name: 'subscription-storage',
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