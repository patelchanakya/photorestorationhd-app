import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Production-safe logging function
const logSupabaseIssue = (message: string, error?: any) => {
  // Always log to console in development
  if (__DEV__) {
    console.warn('⚠️ Supabase:', message, error);
  } else {
    // In production, we could send to analytics or crash reporting
    // For now, just ensure the error doesn't crash the app
    try {
      console.warn('⚠️ Supabase:', message);
    } catch (e) {
      // Failsafe - do nothing if console.warn fails
    }
  }
};

if (!supabaseUrl || !supabaseAnonKey) {
  logSupabaseIssue('URL or Anon Key not configured', { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseAnonKey 
  });
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We're not using auth, so disable session persistence
  },
});

// Export the logging function for use in other services
export { logSupabaseIssue };

// Health check function to test Supabase connectivity
export const testSupabaseConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return { 
        success: false, 
        message: 'Missing Supabase credentials' 
      };
    }

    // Simple query to test connection - just get count of device_usage table
    const { data, error } = await supabase
      .from('device_usage')
      .select('device_id', { count: 'exact', head: true });

    if (error) {
      logSupabaseIssue('Connection test failed', error);
      return { 
        success: false, 
        message: `Connection error: ${error.message}` 
      };
    }

    return { 
      success: true, 
      message: 'Connection successful' 
    };
  } catch (error) {
    logSupabaseIssue('Connection test exception', error);
    return { 
      success: false, 
      message: `Exception: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

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
      user_video_usage: {
        Row: {
          user_id: string;
          back_to_life_count: number;
          plan_type: string;
          usage_limit: number;
          billing_cycle_start: string | null;
          next_reset_date: string | null;
          original_purchase_date: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          back_to_life_count?: number;
          plan_type?: string;
          usage_limit?: number;
          billing_cycle_start?: string;
          next_reset_date?: string;
          original_purchase_date?: string;
        };
        Update: {
          back_to_life_count?: number;
          plan_type?: string;
          usage_limit?: number;
          billing_cycle_start?: string;
          next_reset_date?: string;
          original_purchase_date?: string;
          updated_at?: string;
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
      user_onboarding: {
        Row: {
          id: string;
          user_id: string;
          selected_features: string[];
          primary_interest: string;
          free_attempt_used: boolean;
          free_attempt_feature: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          selected_features: string[];
          primary_interest: string;
          free_attempt_used?: boolean;
          free_attempt_feature?: string;
        };
        Update: {
          selected_features?: string[];
          primary_interest?: string;
          free_attempt_used?: boolean;
          free_attempt_feature?: string;
          updated_at?: string;
        };
      };
      feature_requests: {
        Row: {
          id: string;
          request_text: string;
          user_email: string | null;
          device_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          request_text: string;
          user_email?: string | null;
          device_id?: string | null;
          status?: string;
        };
        Update: {
          request_text?: string;
          user_email?: string | null;
          device_id?: string | null;
          status?: string;
        };
      };
    };
  };
}