// Conditional import for expo-device to handle development environments
let Device: any = null;
try {
  Device = require('expo-device');
} catch (error) {
  console.warn('⚠️ expo-device not available in development mode');
  // Fallback device object for development
  Device = {
    brand: 'unknown',
    modelName: 'development',
    osInternalBuildId: null,
    osBuildId: 'dev-build',
    deviceYearClass: 'unknown'
  };
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// SecureStore keys for local storage
const DEVICE_ID_KEY = 'device_id_persistent';
const DEVICE_USAGE_LAST_RESET_KEY = 'device_usage_last_reset';
const DEVICE_USAGE_COUNT_KEY = 'device_usage_count';

const FREE_RESTORATION_LIMIT = 1; // 1 free restoration every 48 hours

// Local interface for device usage (no longer tied to Supabase)
interface LocalDeviceUsage {
  device_id: string;
  free_restorations_used: number;
  last_reset_date: string;
}

export const deviceTrackingService = {
  /**
   * Get a persistent device ID that survives app reinstalls
   */
  async getDeviceId(): Promise<string> {
    try {
      // First check SecureStore for device ID (persistent storage)
      let storedId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      
      if (storedId) {
        if (__DEV__) {
          console.log('📱 Using secure stored device ID:', storedId.substring(0, 8) + '...');
        }
        return storedId;
      }
      
      // Migration: Check AsyncStorage for existing device ID
      const asyncStorageId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (asyncStorageId) {
        if (__DEV__) {
          console.log('🔄 Migrating device ID from AsyncStorage to SecureStore');
        }
        await SecureStore.setItemAsync(DEVICE_ID_KEY, asyncStorageId);
        // Remove from AsyncStorage after successful migration
        await AsyncStorage.removeItem(DEVICE_ID_KEY);
        if (__DEV__) {
          console.log('✅ Device ID migration completed');
        }
        return asyncStorageId;
      }

      // Generate a new device ID using multiple device properties
      const deviceId = this.generateDeviceId();
      
      // Store it in SecureStore for persistence across app reinstalls
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      if (__DEV__) {
        console.log('📱 Generated new device ID and stored in SecureStore:', deviceId.substring(0, 8) + '...');
      }
      
      return deviceId;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to get device ID:', error);
      }
      // Fallback to a random ID if device info fails
      const fallbackId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      try {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, fallbackId);
      } catch {
        // If SecureStore fails, use AsyncStorage as final fallback
        await AsyncStorage.setItem(DEVICE_ID_KEY, fallbackId);
      }
      return fallbackId;
    }
  },

  /**
   * Generate a device ID from device properties
   */
  generateDeviceId(): string {
    const parts = [
      Device?.brand || 'unknown',
      Device?.modelName || 'unknown',
      Device?.osInternalBuildId || Device?.osBuildId || 'unknown',
      Device?.deviceYearClass || 'unknown'
    ];
    
    // Create a hash-like ID from device properties
    const baseId = parts.join('-').toLowerCase().replace(/\s+/g, '');
    
    // Add a timestamp component to ensure uniqueness
    const timestamp = Date.now().toString(36);
    
    return `${baseId}-${timestamp}`;
  },

  /**
   * Get device usage data from local SecureStore only
   */
  async getDeviceUsage(): Promise<LocalDeviceUsage> {
    const deviceId = await this.getDeviceId();
    
    try {
      // Get last reset date and usage count from SecureStore
      const lastResetStr = await SecureStore.getItemAsync(DEVICE_USAGE_LAST_RESET_KEY);
      const usageCountStr = await SecureStore.getItemAsync(DEVICE_USAGE_COUNT_KEY);
      
      // If no data exists, initialize with defaults
      if (!lastResetStr || !usageCountStr) {
        const initialUsage: LocalDeviceUsage = {
          device_id: deviceId,
          free_restorations_used: 0,
          last_reset_date: new Date().toISOString(),
        };
        
        // Save initial data
        await SecureStore.setItemAsync(DEVICE_USAGE_LAST_RESET_KEY, initialUsage.last_reset_date);
        await SecureStore.setItemAsync(DEVICE_USAGE_COUNT_KEY, '0');
        
        if (__DEV__) {
          console.log('📱 Initialized new device usage record');
        }
        return initialUsage;
      }
      
      const usage: LocalDeviceUsage = {
        device_id: deviceId,
        free_restorations_used: parseInt(usageCountStr, 10) || 0,
        last_reset_date: lastResetStr,
      };
      
      // Check if we need to reset 48-hour limit
      const now = new Date();
      const lastReset = new Date(usage.last_reset_date);
      const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceReset >= 48) {
        // Reset the 48-hour limit locally
        usage.free_restorations_used = 0;
        usage.last_reset_date = now.toISOString();
        
        // Update SecureStore
        await SecureStore.setItemAsync(DEVICE_USAGE_LAST_RESET_KEY, usage.last_reset_date);
        await SecureStore.setItemAsync(DEVICE_USAGE_COUNT_KEY, '0');
        
        if (__DEV__) {
          console.log('🔄 Reset 48-hour limit locally');
        }
      }
      
      return usage;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to get device usage from SecureStore:', error);
      }
      // Return default usage if SecureStore fails
      return {
        device_id: deviceId,
        free_restorations_used: 0,
        last_reset_date: new Date().toISOString(),
      };
    }
  },

  /**
   * Check if device can restore (has free restorations left)
   */
  async canRestore(): Promise<boolean> {
    const usage = await this.getDeviceUsage();
    
    const canRestore = usage.free_restorations_used < FREE_RESTORATION_LIMIT;
    if (__DEV__) {
      console.log(`🔍 Device can restore: ${canRestore} (used: ${usage.free_restorations_used}/${FREE_RESTORATION_LIMIT})`);
    }
    
    return canRestore;
  },

  /**
   * Increment the device's restoration count (local only)
   */
  async incrementUsage(): Promise<LocalDeviceUsage> {
    const currentUsage = await this.getDeviceUsage();
    const newCount = currentUsage.free_restorations_used + 1;

    try {
      // Update SecureStore
      await SecureStore.setItemAsync(DEVICE_USAGE_COUNT_KEY, newCount.toString());
      
      const updatedUsage: LocalDeviceUsage = {
        ...currentUsage,
        free_restorations_used: newCount,
      };
      
      if (__DEV__) {
        console.log(`➕ Incremented device usage locally: ${newCount}/${FREE_RESTORATION_LIMIT}`);
      }
      return updatedUsage;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to increment usage in SecureStore:', error);
      }
      // Return updated object even if SecureStore fails
      return {
        ...currentUsage,
        free_restorations_used: newCount,
      };
    }
  },

  /**
   * Decrement the device's restoration count (only if within current 48-hour window)
   */
  async decrementUsage(): Promise<LocalDeviceUsage> {
    const currentUsage = await this.getDeviceUsage();
    
    // Don't decrement if already at 0
    if (currentUsage.free_restorations_used === 0) {
      if (__DEV__) {
        console.log('⚠️ Usage count already at 0, cannot decrement');
      }
      return currentUsage;
    }

    // Check if we're still within the same 48-hour window
    const now = new Date();
    const lastReset = new Date(currentUsage.last_reset_date);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceReset >= 48) {
      if (__DEV__) {
        console.log('⚠️ Outside 48-hour window, not decrementing');
      }
      return currentUsage;
    }

    const newCount = Math.max(0, currentUsage.free_restorations_used - 1);

    try {
      // Update SecureStore
      await SecureStore.setItemAsync(DEVICE_USAGE_COUNT_KEY, newCount.toString());
      
      const updatedUsage: LocalDeviceUsage = {
        ...currentUsage,
        free_restorations_used: newCount,
      };
      
      if (__DEV__) {
        console.log(`➖ Decremented device usage locally: ${newCount}/${FREE_RESTORATION_LIMIT}`);
      }
      return updatedUsage;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to decrement usage in SecureStore:', error);
      }
      // Return updated object even if SecureStore fails
      return {
        ...currentUsage,
        free_restorations_used: newCount,
      };
    }
  },

  /**
   * Get remaining free restorations for the device
   */
  async getRemainingRestorations(): Promise<number> {
    const usage = await this.getDeviceUsage();
    return Math.max(0, FREE_RESTORATION_LIMIT - usage.free_restorations_used);
  },

  /**
   * Get time remaining until next free restoration (in milliseconds)
   */
  async getTimeUntilNextFreeRestoration(): Promise<number> {
    const usage = await this.getDeviceUsage();
    
    // If user hasn't used their free restoration, it's available now
    if (usage.free_restorations_used === 0) {
      return 0;
    }
    
    const now = new Date();
    const lastReset = new Date(usage.last_reset_date);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    
    // If 48 hours have passed, restoration is available now
    if (hoursSinceReset >= 48) {
      return 0;
    }
    
    // Calculate time remaining until 48 hours from last reset
    const hoursRemaining = 48 - hoursSinceReset;
    return Math.ceil(hoursRemaining * 60 * 60 * 1000); // Convert to milliseconds
  },

  /**
   * Get formatted time remaining until next free restoration
   */
  async getFormattedTimeUntilNext(): Promise<string> {
    const msRemaining = await this.getTimeUntilNextFreeRestoration();
    
    if (msRemaining === 0) {
      return 'Available now';
    }
    
    const hours = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) {
      return `${minutes}m`;
    } else if (hours < 24) {
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }
  },

  /**
   * Reset usage data (for testing purposes)
   */
  async resetUsageData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(DEVICE_USAGE_LAST_RESET_KEY);
      await SecureStore.deleteItemAsync(DEVICE_USAGE_COUNT_KEY);
      if (__DEV__) {
        console.log('🧹 Reset all usage data');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to reset usage data:', error);
      }
    }
  }
};