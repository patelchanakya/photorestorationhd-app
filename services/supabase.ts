import AsyncStorage from '@react-native-async-storage/async-storage';
import { Restoration } from '../types';

// This service now uses AsyncStorage exclusively for offline-first functionality
// No Supabase dependency required

// Local storage helpers for offline restoration data
export const localStorageHelpers = {
  async cleanupOrphanedRecords(): Promise<number> {
    try {
      let cleanedCount = 0;
      const restorations = await this.getAllLocalRestorations();
      
      for (const restoration of restorations) {
        // Check if thumbnail exists
        let hasFiles = false;
        if (restoration.thumbnail_filename) {
          const { photoStorage } = await import('./storage');
          hasFiles = await photoStorage.checkPhotoExists('thumbnail', restoration.thumbnail_filename);
        }
        
        // If no files exist, delete the record
        if (!hasFiles) {
          await this.deleteRestoration(restoration.id);
          cleanedCount++;
        }
      }
      
      if (__DEV__) {
        console.log(`🧹 Cleaned up ${cleanedCount} orphaned restoration records`);
      }
      
      // Clear restoration cache if any records were cleaned
      if (cleanedCount > 0) {
        const { restorationService } = await import('./supabase');
        restorationService.clearRestorationCache();
      }
      
      return cleanedCount;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to cleanup orphaned records:', error);
      }
      return 0;
    }
  },
  async saveRestoration(restoration: Restoration): Promise<void> {
    try {
      const key = `restoration_${restoration.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(restoration));
      if (__DEV__) {
        console.log('💾 Saved restoration to storage:', restoration.id);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to save restoration to storage:', error);
      }
      throw error;
    }
  },

  async getRestoration(id: string): Promise<Restoration | null> {
    try {
      const key = `restoration_${id}`;
      const data = await AsyncStorage.getItem(key);
      
      if (data) {
        const restoration = JSON.parse(data);
        if (__DEV__) {
          console.log('📱 Retrieved restoration from storage:', id);
        }
        return restoration;
      }
      return null;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to get restoration from storage:', error);
      }
      return null;
    }
  },

  async updateRestoration(id: string, updates: Partial<Restoration>): Promise<Restoration | null> {
    try {
      const existing = await this.getRestoration(id);
      if (existing) {
        const updated = { ...existing, ...updates };
        await this.saveRestoration(updated);
        if (__DEV__) {
          console.log('✅ Updated restoration in local storage:', id);
        }
        return updated;
      }
      return null;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to update restoration in local storage:', error);
      }
      return null;
    }
  },

  async getAllLocalRestorations(): Promise<Restoration[]> {
    try {
      const restorations: Restoration[] = [];
      
      // Get all restoration keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const restorationKeys = allKeys.filter(key => key.startsWith('restoration_'));
      
      // Fetch all restorations
      for (const key of restorationKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const restoration = JSON.parse(data);
            restorations.push(restoration);
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('Failed to parse restoration:', key, error);
          }
        }
      }
      
      if (__DEV__) {
        console.log('📱 Retrieved', restorations.length, 'local restorations');
      }
      return restorations;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to get all local restorations:', error);
      }
      return [];
    }
  },

  async deleteRestoration(id: string): Promise<void> {
    try {
      const key = `restoration_${id}`;
      await AsyncStorage.removeItem(key);
      if (__DEV__) {
        console.log('🗑️ Deleted restoration from storage:', id);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to delete restoration from storage:', error);
      }
      throw error;
    }
  },

  async deleteAllLocalRestorations(): Promise<{ deletedCount: number }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const restorationKeys = keys.filter(key => key.startsWith('restoration_'));
      
      if (restorationKeys.length > 0) {
        await AsyncStorage.multiRemove(restorationKeys);
      }
      
      if (__DEV__) {
        console.log(`🗑️ Deleted ${restorationKeys.length} restoration records from local storage`);
      }
      return { deletedCount: restorationKeys.length };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to delete all restorations from local storage:', error);
      }
      return { deletedCount: 0 };
    }
  },
};

// Restoration database operations (now using AsyncStorage only)
export const restorationService = {
  // Create a new restoration record
  async create(data: Partial<Restoration>): Promise<Restoration> {
    // Clear cache when creating new restoration
    this.clearRestorationCache();
    if (__DEV__) {
      console.log('💾 Creating restoration record locally:', data);
    }
    
    // Always create with a local ID
    const restoration = {
      id: `restoration-${Date.now()}`,
      user_id: data.user_id || 'anonymous',
      original_filename: data.original_filename || '',
      restored_filename: data.restored_filename,
      thumbnail_filename: data.thumbnail_filename,
      status: data.status || 'pending',
      processing_time_ms: data.processing_time_ms,
      created_at: new Date().toISOString(),
      completed_at: data.completed_at,
      error_message: data.error_message,
      prediction_id: data.prediction_id,
      function_type: data.function_type || 'restoration',
    } as Restoration;

    // Save to local storage
    await localStorageHelpers.saveRestoration(restoration);
    if (__DEV__) {
      console.log('✅ Restoration saved locally:', restoration.id);
    }
    
    return restoration;
  },

  // Update restoration record
  async update(id: string, data: Partial<Restoration>): Promise<Restoration> {
    // Clear cache when updating restoration
    this.clearRestorationCache();
    if (__DEV__) {
      console.log('💾 Updating restoration:', id, data);
    }
    
    const updatedRestoration = await localStorageHelpers.updateRestoration(id, data);
    if (updatedRestoration) {
      if (__DEV__) {
        console.log('✅ Restoration updated locally:', id);
      }
      return updatedRestoration;
    }
    
    // If not found, throw error
    throw new Error(`Restoration ${id} not found`);
  },

  // Get restoration by ID
  async getById(id: string): Promise<Restoration | null> {
    if (__DEV__) {
      console.log('📱 Getting restoration by ID:', id);
    }
    const restoration = await localStorageHelpers.getRestoration(id);
    
    if (restoration) {
      if (__DEV__) {
        console.log('✅ Restoration found:', id);
      }
    } else {
      if (__DEV__) {
        console.log('⚠️ Restoration not found:', id);
      }
    }
    
    return restoration;
  },

  // Cache for restoration data
  _restorationCache: {
    data: null as Restoration[] | null,
    timestamp: 0,
    promise: null as Promise<Restoration[]> | null,
  },

  // Get all restorations for a user (now local only with caching)
  async getUserRestorations(_userId: string): Promise<Restoration[]> {
    const now = Date.now();
    const CACHE_DURATION = 2000; // 2 seconds cache
    
    // Return cached data if it's recent
    if (this._restorationCache.data && (now - this._restorationCache.timestamp) < CACHE_DURATION) {
      if (__DEV__) {
        console.log('📦 Using cached restoration data');
      }
      return this._restorationCache.data;
    }
    
    // If there's already a request in progress, return that promise
    if (this._restorationCache.promise) {
      if (__DEV__) {
        console.log('⏳ Waiting for existing restoration request');
      }
      return this._restorationCache.promise;
    }
    
    if (__DEV__) {
      console.log('📱 Getting all restorations from local storage');
    }
    
    // Create new request
    this._restorationCache.promise = this._fetchRestorations();
    
    try {
      const result = await this._restorationCache.promise;
      
      // Cache the result
      this._restorationCache.data = result;
      this._restorationCache.timestamp = now;
      this._restorationCache.promise = null;
      
      return result;
    } catch (error) {
      // Clear the promise on error
      this._restorationCache.promise = null;
      throw error;
    }
  },

  // Internal method to fetch restorations
  async _fetchRestorations(): Promise<Restoration[]> {
    try {
      const restorations = await localStorageHelpers.getAllLocalRestorations();
      
      // Sort by creation date (newest first)
      const sorted = restorations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      if (__DEV__) {
        console.log(`✅ Found ${sorted.length} restorations`);
      }
      return sorted;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to get restorations:', error);
      }
      return [];
    }
  },

  // Clear the cache (call when data changes)
  clearRestorationCache() {
    this._restorationCache.data = null;
    this._restorationCache.timestamp = 0;
    this._restorationCache.promise = null;
  },

  // Delete a restoration
  async delete(id: string): Promise<void> {
    // Clear cache when deleting restoration
    this.clearRestorationCache();
    if (__DEV__) {
      console.log('🗑️ Deleting restoration:', id);
    }
    await localStorageHelpers.deleteRestoration(id);
    if (__DEV__) {
      console.log('✅ Restoration deleted');
    }
  },

  // Get restoration statistics for a user
  async getUserStats(userId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    avgProcessingTime: number;
  }> {
    const restorations = await this.getUserRestorations(userId);
    
    const stats = restorations.reduce(
      (acc, restoration) => {
        acc.total++;
        if (restoration.status === 'completed') {
          acc.completed++;
          if (restoration.processing_time_ms) {
            acc.totalTime += restoration.processing_time_ms;
          }
        } else if (restoration.status === 'failed') {
          acc.failed++;
        }
        return acc;
      },
      { total: 0, completed: 0, failed: 0, totalTime: 0 }
    );

    return {
      total: stats.total,
      completed: stats.completed,
      failed: stats.failed,
      avgProcessingTime: stats.completed > 0 ? stats.totalTime / stats.completed : 0,
    };
  },
};

// Auth helpers (placeholder for future implementation)
export const authService = {
  // For now, always return anonymous user
  async getCurrentUser() {
    return null;
  },
};