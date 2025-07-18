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
      
      console.log(`🧹 Cleaned up ${cleanedCount} orphaned restoration records`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup orphaned records:', error);
      return 0;
    }
  },
  async saveRestoration(restoration: Restoration): Promise<void> {
    try {
      const key = `restoration_${restoration.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(restoration));
      console.log('💾 Saved restoration to local storage:', restoration.id);
    } catch (error) {
      console.error('❌ Failed to save restoration to local storage:', error);
    }
  },

  async getRestoration(id: string): Promise<Restoration | null> {
    try {
      const key = `restoration_${id}`;
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const restoration = JSON.parse(data);
        console.log('📱 Retrieved restoration from local storage:', id);
        return restoration;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get restoration from local storage:', error);
      return null;
    }
  },

  async updateRestoration(id: string, updates: Partial<Restoration>): Promise<Restoration | null> {
    try {
      const existing = await this.getRestoration(id);
      if (existing) {
        const updated = { ...existing, ...updates };
        await this.saveRestoration(updated);
        console.log('✅ Updated restoration in local storage:', id);
        return updated;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to update restoration in local storage:', error);
      return null;
    }
  },

  async getAllLocalRestorations(): Promise<Restoration[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const restorationKeys = keys.filter(key => key.startsWith('restoration_'));
      
      const restorations: Restoration[] = [];
      
      for (const key of restorationKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const restoration = JSON.parse(data);
            restorations.push(restoration);
          }
        } catch (error) {
          console.warn('Failed to parse restoration from local storage:', key, error);
        }
      }
      
      console.log('📱 Retrieved', restorations.length, 'local restorations');
      return restorations;
    } catch (error) {
      console.error('❌ Failed to get all local restorations:', error);
      return [];
    }
  },

  async deleteRestoration(id: string): Promise<void> {
    try {
      const key = `restoration_${id}`;
      await AsyncStorage.removeItem(key);
      console.log('🗑️ Deleted restoration from local storage:', id);
    } catch (error) {
      console.error('❌ Failed to delete restoration from local storage:', error);
    }
  },

  async deleteAllLocalRestorations(): Promise<{ deletedCount: number }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const restorationKeys = keys.filter(key => key.startsWith('restoration_'));
      
      if (restorationKeys.length > 0) {
        await AsyncStorage.multiRemove(restorationKeys);
      }
      
      console.log(`🗑️ Deleted ${restorationKeys.length} restoration records from local storage`);
      return { deletedCount: restorationKeys.length };
    } catch (error) {
      console.error('❌ Failed to delete all restorations from local storage:', error);
      return { deletedCount: 0 };
    }
  },
};

// Restoration database operations (now using AsyncStorage only)
export const restorationService = {
  // Create a new restoration record
  async create(data: Partial<Restoration>): Promise<Restoration> {
    console.log('💾 Creating restoration record locally:', data);
    
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
    console.log('✅ Restoration saved locally:', restoration.id);
    
    return restoration;
  },

  // Update restoration record
  async update(id: string, data: Partial<Restoration>): Promise<Restoration> {
    console.log('💾 Updating restoration:', id, data);
    
    const updatedRestoration = await localStorageHelpers.updateRestoration(id, data);
    if (updatedRestoration) {
      console.log('✅ Restoration updated locally:', id);
      return updatedRestoration;
    }
    
    // If not found, throw error
    throw new Error(`Restoration ${id} not found`);
  },

  // Get restoration by ID
  async getById(id: string): Promise<Restoration | null> {
    console.log('📱 Getting restoration by ID:', id);
    const restoration = await localStorageHelpers.getRestoration(id);
    
    if (restoration) {
      console.log('✅ Restoration found:', id);
    } else {
      console.log('⚠️ Restoration not found:', id);
    }
    
    return restoration;
  },

  // Get all restorations for a user (now local only)
  async getUserRestorations(userId: string): Promise<Restoration[]> {
    console.log('📱 Getting all restorations from local storage');
    
    try {
      const restorations = await localStorageHelpers.getAllLocalRestorations();
      
      // Sort by creation date (newest first)
      const sorted = restorations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      console.log(`✅ Found ${sorted.length} restorations`);
      return sorted;
    } catch (error) {
      console.error('❌ Failed to get restorations:', error);
      return [];
    }
  },

  // Delete a restoration
  async delete(id: string): Promise<void> {
    console.log('🗑️ Deleting restoration:', id);
    await localStorageHelpers.deleteRestoration(id);
    console.log('✅ Restoration deleted');
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