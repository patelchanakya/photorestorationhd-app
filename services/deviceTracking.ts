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
import { supabase, DeviceUsage } from './supabaseClient';

const DEVICE_ID_KEY = 'device_id_persistent';
const DEVICE_USAGE_CACHE_KEY = 'device_usage_cache';
const FREE_RESTORATION_LIMIT = 3;

export const deviceTrackingService = {
  /**
   * Get a persistent device ID that survives app reinstalls
   */
  async getDeviceId(): Promise<string> {
    try {
      // First check SecureStore for device ID (persistent storage)
      let storedId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      
      if (storedId) {
        console.log('📱 Using secure stored device ID:', storedId.substring(0, 8) + '...');
        return storedId;
      }
      
      // Migration: Check AsyncStorage for existing device ID
      const asyncStorageId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (asyncStorageId) {
        console.log('🔄 Migrating device ID from AsyncStorage to SecureStore');
        await SecureStore.setItemAsync(DEVICE_ID_KEY, asyncStorageId);
        // Remove from AsyncStorage after successful migration
        await AsyncStorage.removeItem(DEVICE_ID_KEY);
        console.log('✅ Device ID migration completed');
        return asyncStorageId;
      }

      // Generate a new device ID using multiple device properties
      const deviceId = this.generateDeviceId();
      
      // Store it in SecureStore for persistence across app reinstalls
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      console.log('📱 Generated new device ID and stored in SecureStore:', deviceId.substring(0, 8) + '...');
      
      return deviceId;
    } catch (error) {
      console.error('❌ Failed to get device ID:', error);
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
   * Get device usage data from Supabase with local cache fallback
   */
  async getDeviceUsage(): Promise<DeviceUsage | null> {
    const deviceId = await this.getDeviceId();
    
    try {
      // Try to get from Supabase first
      const { data, error } = await supabase
        .from('device_usage')
        .select('*')
        .eq('device_id', deviceId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Supabase error:', error);
        // Fall back to cache
        return this.getCachedDeviceUsage();
      }

      if (data) {
        // Cache the data locally
        await this.cacheDeviceUsage(data);
        
        // Check if we need to reset daily limit
        const today = new Date().toDateString();
        const lastReset = new Date(data.last_reset_date).toDateString();
        
        if (today !== lastReset) {
          // Reset the daily limit
          return this.resetDailyLimit();
        }
        
        return data;
      }

      // No data found, create new record
      return this.createDeviceUsageRecord();
    } catch (error) {
      console.error('❌ Failed to get device usage:', error);
      // Fall back to cache
      return this.getCachedDeviceUsage();
    }
  },

  /**
   * Create a new device usage record
   */
  async createDeviceUsageRecord(): Promise<DeviceUsage | null> {
    const deviceId = await this.getDeviceId();
    
    const newRecord: Omit<DeviceUsage, 'created_at' | 'updated_at'> = {
      device_id: deviceId,
      free_restorations_used: 0,
      last_reset_date: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('device_usage')
        .insert(newRecord)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create device usage record:', error);
        // Create a local cache entry
        const localRecord = {
          ...newRecord,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await this.cacheDeviceUsage(localRecord);
        return localRecord;
      }

      if (data) {
        await this.cacheDeviceUsage(data);
      }
      
      return data;
    } catch (error) {
      console.error('❌ Failed to create device usage:', error);
      // Create a local cache entry
      const localRecord = {
        ...newRecord,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.cacheDeviceUsage(localRecord);
      return localRecord;
    }
  },

  /**
   * Check if device can restore (has free restorations left)
   */
  async canRestore(): Promise<boolean> {
    const usage = await this.getDeviceUsage();
    
    if (!usage) {
      // If we can't get usage data, allow the restoration
      console.warn('⚠️ Could not get device usage, allowing restoration');
      return true;
    }

    const canRestore = usage.free_restorations_used < FREE_RESTORATION_LIMIT;
    console.log(`🔍 Device can restore: ${canRestore} (used: ${usage.free_restorations_used}/${FREE_RESTORATION_LIMIT})`);
    
    return canRestore;
  },

  /**
   * Increment the device's restoration count
   */
  async incrementUsage(): Promise<DeviceUsage | null> {
    const deviceId = await this.getDeviceId();
    const currentUsage = await this.getDeviceUsage();
    
    if (!currentUsage) {
      console.error('❌ No device usage found to increment');
      return null;
    }

    const newCount = currentUsage.free_restorations_used + 1;

    try {
      const { data, error } = await supabase
        .from('device_usage')
        .update({ 
          free_restorations_used: newCount,
          updated_at: new Date().toISOString()
        })
        .eq('device_id', deviceId)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to increment usage:', error);
        // Update cache anyway
        const updatedUsage = {
          ...currentUsage,
          free_restorations_used: newCount,
          updated_at: new Date().toISOString()
        };
        await this.cacheDeviceUsage(updatedUsage);
        return updatedUsage;
      }

      if (data) {
        await this.cacheDeviceUsage(data);
      }
      
      console.log(`➕ Incremented device usage: ${newCount}/${FREE_RESTORATION_LIMIT}`);
      return data;
    } catch (error) {
      console.error('❌ Failed to increment usage:', error);
      // Update cache anyway
      const updatedUsage = {
        ...currentUsage,
        free_restorations_used: newCount,
        updated_at: new Date().toISOString()
      };
      await this.cacheDeviceUsage(updatedUsage);
      return updatedUsage;
    }
  },

  /**
   * Reset the daily limit for a device
   */
  async resetDailyLimit(): Promise<DeviceUsage | null> {
    const deviceId = await this.getDeviceId();

    try {
      const { data, error } = await supabase
        .from('device_usage')
        .update({ 
          free_restorations_used: 0,
          last_reset_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('device_id', deviceId)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to reset daily limit:', error);
        return null;
      }

      if (data) {
        await this.cacheDeviceUsage(data);
      }
      
      console.log('🔄 Reset daily limit for device');
      return data;
    } catch (error) {
      console.error('❌ Failed to reset daily limit:', error);
      return null;
    }
  },

  /**
   * Cache device usage data locally
   */
  async cacheDeviceUsage(usage: DeviceUsage): Promise<void> {
    try {
      await AsyncStorage.setItem(DEVICE_USAGE_CACHE_KEY, JSON.stringify(usage));
    } catch (error) {
      console.error('❌ Failed to cache device usage:', error);
    }
  },

  /**
   * Get cached device usage data
   */
  async getCachedDeviceUsage(): Promise<DeviceUsage | null> {
    try {
      const cached = await AsyncStorage.getItem(DEVICE_USAGE_CACHE_KEY);
      if (cached) {
        const usage = JSON.parse(cached) as DeviceUsage;
        
        // Check if we need to reset daily limit based on cached data
        const today = new Date().toDateString();
        const lastReset = new Date(usage.last_reset_date).toDateString();
        
        if (today !== lastReset) {
          // Reset in cache
          usage.free_restorations_used = 0;
          usage.last_reset_date = new Date().toISOString();
          await this.cacheDeviceUsage(usage);
        }
        
        console.log('📱 Using cached device usage');
        return usage;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get cached device usage:', error);
      return null;
    }
  },

  /**
   * Get remaining free restorations for the device
   */
  async getRemainingRestorations(): Promise<number> {
    const usage = await this.getDeviceUsage();
    
    if (!usage) {
      return FREE_RESTORATION_LIMIT;
    }

    return Math.max(0, FREE_RESTORATION_LIMIT - usage.free_restorations_used);
  },

  /**
   * Sync local usage with remote (for future use)
   */
  async syncWithRemote(): Promise<void> {
    const cached = await this.getCachedDeviceUsage();
    if (!cached) return;

    try {
      const deviceId = await this.getDeviceId();
      const { error } = await supabase
        .from('device_usage')
        .upsert({
          device_id: deviceId,
          free_restorations_used: cached.free_restorations_used,
          last_reset_date: cached.last_reset_date,
        });

      if (error) {
        console.error('❌ Failed to sync with remote:', error);
      } else {
        console.log('✅ Synced device usage with remote');
      }
    } catch (error) {
      console.error('❌ Failed to sync:', error);
    }
  }
};