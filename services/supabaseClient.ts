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
export interface DeviceUsage {
  device_id: string;
  free_restorations_used: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      device_usage: {
        Row: DeviceUsage;
        Insert: Omit<DeviceUsage, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DeviceUsage, 'device_id'>>;
      };
      restorations: {
        Row: any; // Using existing Restoration type from types/index.ts
        Insert: any;
        Update: any;
      };
    };
  };
}