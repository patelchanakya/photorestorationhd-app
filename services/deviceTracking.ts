// Conditional import for expo-device to handle development environments
let Device: any = null;
try {
  Device = require('expo-device');
} catch (error) {
  if (__DEV__) {
    console.warn('⚠️ expo-device not available in development mode');
  }
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
import { supabase, Database } from './supabaseClient';
import { networkStateService } from './networkState';

// SecureStore keys for local storage
const DEVICE_ID_KEY = 'device_id_persistent';
const DEVICE_USAGE_LAST_RESET_KEY = 'device_usage_last_reset';
const DEVICE_USAGE_COUNT_KEY = 'device_usage_count';

const FREE_RESTORATION_LIMIT = 1; // 1 free restoration every 48 hours

// Interface for device usage data
interface DeviceUsage {
  device_id: string;
  free_restorations_used: number;
  last_reset_date: string;
}

// Queue for offline operations
interface PendingOperation {
  type: 'increment' | 'decrement' | 'reset';
  device_id: string;
  timestamp: string;
  data?: Partial<DeviceUsage>;
}

const PENDING_OPERATIONS_KEY = 'device_usage_pending_operations';

export const deviceTrackingService = {
  /**
   * Initialize the service and start network monitoring
   */
  async initialize(): Promise<void> {
    // Subscribe to network state changes for auto-sync
    networkStateService.subscribe(async (isOnline) => {
      if (isOnline) {
        await this.syncPendingOperations();
      }
    });
    
    // Sync any pending operations if we're online
    if (networkStateService.isOnline) {
      await this.syncPendingOperations();
    }
  },
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
   * Get device usage data from Supabase with local fallback
   */
  async getDeviceUsage(): Promise<DeviceUsage> {
    const deviceId = await this.getDeviceId();
    
    try {
      // Get last reset date and usage count from SecureStore
      const lastResetStr = await SecureStore.getItemAsync(DEVICE_USAGE_LAST_RESET_KEY);
      const usageCountStr = await SecureStore.getItemAsync(DEVICE_USAGE_COUNT_KEY);
      
      // Try to get data from Supabase first if online
      if (networkStateService.isOnline) {
        try {
          const supabaseUsage = await this.getDeviceUsageFromSupabase(deviceId);
          if (supabaseUsage) {
            // Update local cache with Supabase data
            await this.updateLocalCache(supabaseUsage);
            return this.processUsageData(supabaseUsage);
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('⚠️ Failed to get usage from Supabase, falling back to local:', error);
          }
        }
      }
      
      // If no local data exists, initialize with defaults
      if (!lastResetStr || !usageCountStr) {
        const initialUsage: DeviceUsage = {
          device_id: deviceId,
          free_restorations_used: 0,
          last_reset_date: new Date().toISOString(),
        };
        
        // Save initial data locally
        await SecureStore.setItemAsync(DEVICE_USAGE_LAST_RESET_KEY, initialUsage.last_reset_date);
        await SecureStore.setItemAsync(DEVICE_USAGE_COUNT_KEY, '0');
        
        // Try to create record in Supabase
        if (networkStateService.isOnline) {
          try {
            await this.createDeviceUsageInSupabase(initialUsage);
          } catch (error) {
            if (__DEV__) {
              console.warn('⚠️ Failed to create initial usage in Supabase:', error);
            }
          }
        }
        
        if (__DEV__) {
          console.log('📱 Initialized new device usage record');
        }
        return initialUsage;
      }
      
      const usage: DeviceUsage = {
        device_id: deviceId,
        free_restorations_used: parseInt(usageCountStr, 10) || 0,
        last_reset_date: lastResetStr,
      };
      
      return this.processUsageData(usage);
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
   * Process usage data and handle 48-hour reset logic
   */
  async processUsageData(usage: DeviceUsage): Promise<DeviceUsage> {
    const now = new Date();
    const lastReset = new Date(usage.last_reset_date);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceReset >= 48) {
      // Reset the 48-hour limit
      const resetUsage: DeviceUsage = {
        ...usage,
        free_restorations_used: 0,
        last_reset_date: now.toISOString(),
      };
      
      // Update local cache
      await this.updateLocalCache(resetUsage);
      
      // Update Supabase if online
      if (networkStateService.isOnline) {
        try {
          await this.updateDeviceUsageInSupabase(resetUsage);
        } catch (error) {
          if (__DEV__) {
            console.warn('⚠️ Failed to update reset in Supabase:', error);
          }
          // Queue operation for later sync
          await this.queueOperation('reset', usage.device_id, resetUsage);
        }
      } else {
        // Queue operation for when online
        await this.queueOperation('reset', usage.device_id, resetUsage);
      }
      
      if (__DEV__) {
        console.log('🔄 Reset 48-hour limit');
      }
      return resetUsage;
    }
    
    return usage;
  },

  /**
   * Get device usage from Supabase
   */
  async getDeviceUsageFromSupabase(deviceId: string): Promise<DeviceUsage | null> {
    const { data, error } = await supabase
      .from('device_usage')
      .select('*')
      .eq('device_id', deviceId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      device_id: data.device_id,
      free_restorations_used: data.free_restorations_used,
      last_reset_date: data.last_reset_date,
    };
  },

  /**
   * Create device usage record in Supabase
   */
  async createDeviceUsageInSupabase(usage: DeviceUsage): Promise<void> {
    const { error } = await supabase
      .from('device_usage')
      .insert({
        device_id: usage.device_id,
        free_restorations_used: usage.free_restorations_used,
        last_reset_date: usage.last_reset_date,
      });
    
    if (error) {
      throw error;
    }
  },

  /**
   * Update device usage record in Supabase
   */
  async updateDeviceUsageInSupabase(usage: DeviceUsage): Promise<void> {
    const { error } = await supabase
      .from('device_usage')
      .update({
        free_restorations_used: usage.free_restorations_used,
        last_reset_date: usage.last_reset_date,
      })
      .eq('device_id', usage.device_id);
    
    if (error) {
      throw error;
    }
  },

  /**
   * Update local cache with usage data
   */
  async updateLocalCache(usage: DeviceUsage): Promise<void> {
    try {
      await SecureStore.setItemAsync(DEVICE_USAGE_LAST_RESET_KEY, usage.last_reset_date);
      await SecureStore.setItemAsync(DEVICE_USAGE_COUNT_KEY, usage.free_restorations_used.toString());
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Failed to update local cache:', error);
      }
    }
  },

  /**
   * Queue operation for offline sync
   */
  async queueOperation(type: PendingOperation['type'], deviceId: string, data?: Partial<DeviceUsage>): Promise<void> {
    try {
      const operation: PendingOperation = {
        type,
        device_id: deviceId,
        timestamp: new Date().toISOString(),
        data,
      };
      
      const existingOps = await AsyncStorage.getItem(PENDING_OPERATIONS_KEY);
      const operations: PendingOperation[] = existingOps ? JSON.parse(existingOps) : [];
      operations.push(operation);
      
      await AsyncStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(operations));
      if (__DEV__) {
        console.log(`📝 Queued ${type} operation for offline sync`);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Failed to queue operation:', error);
      }
    }
  },

  /**
   * Sync pending operations when online
   */
  async syncPendingOperations(): Promise<void> {
    if (!networkStateService.isOnline) {
      return;
    }
    
    try {
      const existingOps = await AsyncStorage.getItem(PENDING_OPERATIONS_KEY);
      if (!existingOps) return;
      
      const operations: PendingOperation[] = JSON.parse(existingOps);
      if (operations.length === 0) return;
      
      // Process operations in chronological order
      for (const op of operations) {
        try {
          switch (op.type) {
            case 'increment':
            case 'decrement':
            case 'reset':
              if (op.data) {
                await this.updateDeviceUsageInSupabase(op.data as DeviceUsage);
              }
              break;
          }
        } catch (error) {
          if (__DEV__) {
            console.warn(`⚠️ Failed to sync ${op.type} operation:`, error);
          }
          // Keep failed operations for retry
          continue;
        }
      }
      
      // Clear successfully synced operations
      await AsyncStorage.removeItem(PENDING_OPERATIONS_KEY);
      if (__DEV__) {
        console.log('✅ Synced pending operations to Supabase');
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Failed to sync pending operations:', error);
      }
    }
  },

  /**
   * Check if device can restore (requires online connection)
   */
  async canRestore(): Promise<boolean> {
    // Must be online to restore photos
    if (!networkStateService.isOnline) {
      return false;
    }
    
    const usage = await this.getDeviceUsage();
    const canRestore = usage.free_restorations_used < FREE_RESTORATION_LIMIT;
    
    if (__DEV__) {
      console.log(`🔍 Device can restore: ${canRestore} (used: ${usage.free_restorations_used}/${FREE_RESTORATION_LIMIT})`);
    }
    
    return canRestore;
  },

  /**
   * Increment the device's restoration count
   */
  async incrementUsage(): Promise<DeviceUsage> {
    const currentUsage = await this.getDeviceUsage();
    const newCount = currentUsage.free_restorations_used + 1;
    
    const updatedUsage: DeviceUsage = {
      ...currentUsage,
      free_restorations_used: newCount,
    };
    
    // Update local cache
    await this.updateLocalCache(updatedUsage);
    
    // Update Supabase if online
    if (networkStateService.isOnline) {
      try {
        await this.updateDeviceUsageInSupabase(updatedUsage);
      } catch (error) {
        if (__DEV__) {
          console.warn('⚠️ Failed to increment usage in Supabase:', error);
        }
        // Queue operation for later sync
        await this.queueOperation('increment', currentUsage.device_id, updatedUsage);
      }
    } else {
      // Queue operation for when online
      await this.queueOperation('increment', currentUsage.device_id, updatedUsage);
    }
    
    if (__DEV__) {
      console.log(`➕ Incremented device usage: ${newCount}/${FREE_RESTORATION_LIMIT}`);
    }
    return updatedUsage;
  },

  /**
   * Decrement the device's restoration count (only if within current 48-hour window)
   */
  async decrementUsage(): Promise<DeviceUsage> {
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
    
    const updatedUsage: DeviceUsage = {
      ...currentUsage,
      free_restorations_used: newCount,
    };
    
    // Update local cache
    await this.updateLocalCache(updatedUsage);
    
    // Update Supabase if online
    if (networkStateService.isOnline) {
      try {
        await this.updateDeviceUsageInSupabase(updatedUsage);
      } catch (error) {
        if (__DEV__) {
          console.warn('⚠️ Failed to decrement usage in Supabase:', error);
        }
        // Queue operation for later sync
        await this.queueOperation('decrement', currentUsage.device_id, updatedUsage);
      }
    } else {
      // Queue operation for when online
      await this.queueOperation('decrement', currentUsage.device_id, updatedUsage);
    }
    
    if (__DEV__) {
      console.log(`➖ Decremented device usage: ${newCount}/${FREE_RESTORATION_LIMIT}`);
    }
    return updatedUsage;
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
      const deviceId = await this.getDeviceId();
      
      // Clear local cache
      await SecureStore.deleteItemAsync(DEVICE_USAGE_LAST_RESET_KEY);
      await SecureStore.deleteItemAsync(DEVICE_USAGE_COUNT_KEY);
      
      // Clear Supabase record if online
      if (networkStateService.isOnline) {
        try {
          await supabase
            .from('device_usage')
            .delete()
            .eq('device_id', deviceId);
        } catch (error) {
          if (__DEV__) {
            console.warn('⚠️ Failed to reset usage data in Supabase:', error);
          }
        }
      }
      
      // Clear pending operations
      await AsyncStorage.removeItem(PENDING_OPERATIONS_KEY);
      
      if (__DEV__) {
        console.log('🧹 Reset all usage data');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to reset usage data:', error);
      }
    }
  },

  /**
   * Get network status
   */
  isOnline(): boolean {
    return networkStateService.isOnline;
  }
};