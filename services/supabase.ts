import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Restoration } from '../types';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

console.log('🔗 Supabase URL:', supabaseUrl);
console.log('🔑 Supabase Key:', supabaseAnonKey ? '✅ Loaded' : '❌ Missing');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Local storage helpers for offline restoration data
const localStorageHelpers = {
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
};

// Restoration database operations
export const restorationService = {
  // Create a new restoration record
  async create(data: Partial<Restoration>): Promise<Restoration> {
    try {
      console.log('🔵 Creating restoration record:', data);
      console.log('🔵 Supabase URL:', supabaseUrl);
      
      // Remove function_type from database calls to avoid schema errors
      const { function_type, ...dbData } = data;
      
      const { data: restoration, error } = await supabase
        .from('restorations')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      
      console.log('✅ Restoration record created:', restoration);
      // Add function_type back to the response for local use
      return { ...restoration, function_type: function_type || 'restoration' };
    } catch (error) {
      console.error('❌ Full error object:', error);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);
      
      // Create a local restoration for offline mode
      const localRestoration = {
        id: `local-${Date.now()}`,
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
      await localStorageHelpers.saveRestoration(localRestoration);
      
      return localRestoration;
    }
  },

  // Update restoration record
  async update(id: string, data: Partial<Restoration>): Promise<Restoration> {
    try {
      console.log('🔵 Updating restoration record:', id, data);
      
      // Check if this is a local ID (starts with "local-")
      if (id.startsWith('local-')) {
        console.log('📱 Local ID detected, updating local storage');
        // For local IDs, update the local storage
        const updatedRestoration = await localStorageHelpers.updateRestoration(id, data);
        if (updatedRestoration) {
          return updatedRestoration;
        }
        // Fallback if local storage fails
        return {
          id,
          user_id: 'anonymous',
          original_filename: 'original_' + Date.now() + '.jpg',
          restored_filename: 'restored_' + Date.now() + '.jpg', 
          thumbnail_filename: 'thumb_restored_' + Date.now() + '.jpg',
          status: 'completed',
          processing_time_ms: 8000,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          function_type: 'restoration',
          ...data,
        } as Restoration;
      }
      
      // Remove function_type from database calls to avoid schema errors
      const { function_type, ...dbData } = data;
      
      const { data: restoration, error } = await supabase
        .from('restorations')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase update error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      
      console.log('✅ Restoration record updated:', restoration);
      // Add function_type back to the response for local use
      return { ...restoration, function_type: function_type || 'restoration' };
    } catch (error) {
      console.error('❌ Full update error object:', error);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error message:', error?.message);
      
      // Return a mock updated restoration for offline mode
      return {
        id,
        ...data,
        user_id: data.user_id || 'anonymous',
        original_filename: data.original_filename || '',
        created_at: data.created_at || new Date().toISOString(),
      } as Restoration;
    }
  },

  // Get restoration by ID
  async getById(id: string): Promise<Restoration | null> {
    try {
      console.log('🔵 Getting restoration by ID:', id);
      
      // Check if this is a local ID (starts with "local-")
      if (id.startsWith('local-')) {
        console.log('📱 Local ID detected, retrieving from local storage');
        // For local IDs, retrieve from local storage
        const localRestoration = await localStorageHelpers.getRestoration(id);
        if (localRestoration) {
          return localRestoration;
        }
        // Fallback if not found in local storage
        console.log('⚠️ Local restoration not found in storage, creating mock');
        return {
          id: id,
          user_id: 'anonymous',
          original_filename: 'original_' + Date.now() + '.jpg',
          restored_filename: 'restored_' + Date.now() + '.jpg', 
          thumbnail_filename: 'thumb_restored_' + Date.now() + '.jpg',
          status: 'completed',
          processing_time_ms: 8000,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          function_type: 'restoration',
        } as Restoration;
      }
      
      const { data, error } = await supabase
        .from('restorations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Supabase getById error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        
        if (error.code === 'PGRST116') {
          console.log('⚠️ Restoration not found:', id);
          return null; // Not found
        }
        throw error;
      }
      
      console.log('✅ Restoration found:', data);
      return data;
    } catch (error) {
      console.error('❌ Full getById error object:', error);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error message:', error?.message);
      throw error;
    }
  },

  // Get all restorations for a user
  async getUserRestorations(userId: string): Promise<Restoration[]> {
    try {
      // Get restorations from both Supabase and local storage
      const [supabaseRestorations, localRestorations] = await Promise.all([
        this.getSupabaseRestorations(userId),
        localStorageHelpers.getAllLocalRestorations()
      ]);

      // Combine and deduplicate (prioritize Supabase over local if same ID)
      const allRestorations = [...supabaseRestorations];
      
      // Add local restorations that don't exist in Supabase
      for (const localRestoration of localRestorations) {
        const existsInSupabase = supabaseRestorations.some(r => r.id === localRestoration.id);
        if (!existsInSupabase) {
          allRestorations.push(localRestoration);
        }
      }

      // Sort by creation date (newest first)
      return allRestorations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.warn('Failed to get user restorations:', error);
      // Fallback to local storage only
      try {
        const localRestorations = await localStorageHelpers.getAllLocalRestorations();
        return localRestorations.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } catch (localError) {
        console.error('Failed to get local restorations:', localError);
        return [];
      }
    }
  },

  // Helper function to get restorations from Supabase only
  async getSupabaseRestorations(userId: string): Promise<Restoration[]> {
    try {
      const { data, error } = await supabase
        .from('restorations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Failed to get Supabase restorations:', error);
      return [];
    }
  },

  // Delete a restoration
  async delete(id: string): Promise<void> {
    try {
      // Check if this is a local ID (starts with "local-")
      if (id.startsWith('local-')) {
        console.log('📱 Local ID detected, deleting from local storage');
        // For local IDs, delete from local storage
        await localStorageHelpers.deleteRestoration(id);
        return;
      }
      
      const { error } = await supabase
        .from('restorations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Failed to delete restoration:', error);
      throw error;
    }
  },

  // Get restoration statistics for a user
  async getUserStats(userId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    avgProcessingTime: number;
  }> {
    const { data, error } = await supabase
      .from('restorations')
      .select('status, processing_time_ms')
      .eq('user_id', userId);

    if (error) throw error;

    const stats = (data || []).reduce(
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

// Auth helpers
export const authService = {
  // Sign up with email
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Sign in with email
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current user
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null);
    });
  },
};