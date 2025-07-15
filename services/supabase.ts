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

// Restoration database operations
export const restorationService = {
  // Create a new restoration record
  async create(data: Partial<Restoration>): Promise<Restoration> {
    try {
      console.log('🔵 Creating restoration record:', data);
      console.log('🔵 Supabase URL:', supabaseUrl);
      
      const { data: restoration, error } = await supabase
        .from('restorations')
        .insert(data)
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
      return restoration;
    } catch (error) {
      console.error('❌ Full error object:', error);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);
      
      // Return a mock restoration for offline mode
      return {
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
      } as Restoration;
    }
  },

  // Update restoration record
  async update(id: string, data: Partial<Restoration>): Promise<Restoration> {
    try {
      console.log('🔵 Updating restoration record:', id, data);
      
      const { data: restoration, error } = await supabase
        .from('restorations')
        .update(data)
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
      return restoration;
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
      const { data, error } = await supabase
        .from('restorations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Failed to get user restorations:', error);
      // Return empty array for offline mode
      return [];
    }
  },

  // Delete a restoration
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('restorations')
      .delete()
      .eq('id', id);

    if (error) throw error;
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