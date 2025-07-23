import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL or Anon Key not configured');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We're not using auth, so disable session persistence
  },
});

// Type definitions for our database tables
export interface Database {
  public: {
    Tables: {
      device_usage: {
        Row: {
          device_id: string;
          free_restorations_used: number;
          last_reset_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          device_id: string;
          free_restorations_used?: number;
          last_reset_date?: string;
        };
        Update: {
          free_restorations_used?: number;
          last_reset_date?: string;
        };
      };
      restorations: {
        Row: {
          id: string;
          user_id: string | null;
          original_filename: string;
          restored_filename: string | null;
          thumbnail_filename: string | null;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          processing_time_ms: number | null;
          created_at: string;
          completed_at: string | null;
          error_message: string | null;
          prediction_id: string | null;
          webhook_status: string | null;
          function_type: string;
        };
        Insert: {
          user_id?: string | null;
          original_filename: string;
          restored_filename?: string | null;
          thumbnail_filename?: string | null;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          processing_time_ms?: number | null;
          completed_at?: string | null;
          error_message?: string | null;
          prediction_id?: string | null;
          webhook_status?: string | null;
          function_type?: string;
        };
        Update: {
          user_id?: string | null;
          original_filename?: string;
          restored_filename?: string | null;
          thumbnail_filename?: string | null;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          processing_time_ms?: number | null;
          completed_at?: string | null;
          error_message?: string | null;
          prediction_id?: string | null;
          webhook_status?: string | null;
          function_type?: string;
        };
      };
    };
  };
}