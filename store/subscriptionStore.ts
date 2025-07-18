import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SubscriptionState {
  isPro: boolean;
  freeRestorationsUsed: number;
  freeRestorationsLimit: number;
  lastResetDate: string;
  setIsPro: (isPro: boolean) => void;
  incrementFreeRestorations: () => void;
  resetDailyLimit: () => void;
  canRestore: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isPro: false,
      freeRestorationsUsed: 0,
      freeRestorationsLimit: 3, // 3 free restorations per day
      lastResetDate: new Date().toDateString(),

      setIsPro: (isPro) => set({ isPro }),

      incrementFreeRestorations: () => {
        const state = get();
        // Check if we need to reset daily limit
        const today = new Date().toDateString();
        if (state.lastResetDate !== today) {
          set({ 
            freeRestorationsUsed: 1, 
            lastResetDate: today 
          });
        } else {
          set({ 
            freeRestorationsUsed: state.freeRestorationsUsed + 1 
          });
        }
      },

      resetDailyLimit: () => {
        set({ 
          freeRestorationsUsed: 0, 
          lastResetDate: new Date().toDateString() 
        });
      },

      canRestore: () => {
        const state = get();
        // Check if we need to reset daily limit
        const today = new Date().toDateString();
        if (state.lastResetDate !== today) {
          // Reset the limit for new day
          set({ 
            freeRestorationsUsed: 0, 
            lastResetDate: today 
          });
          return true;
        }
        
        // Pro users have unlimited restorations
        if (state.isPro) return true;
        
        // Free users check against limit
        return state.freeRestorationsUsed < state.freeRestorationsLimit;
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