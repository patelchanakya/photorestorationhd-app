import { supabase, logSupabaseIssue } from './supabaseClient';
import { getOrCreateCustomUserId } from './trackingIds';

// Type for restoration metadata that goes to Supabase
export interface RestorationMetadata {
  id?: string;
  user_id: string; // Device ID for privacy
  original_filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_time_ms?: number;
  created_at?: string;
  completed_at?: string;
  error_message?: string;
  prediction_id?: string;
  function_type: 'restoration' | 'unblur' | 'colorize' | 'descratch';
}

export const restorationTrackingService = {
  /**
   * Start tracking a new restoration (insert into Supabase)
   */
  async trackRestorationStarted(
    originalFilename: string,
    functionType: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' = 'restoration',
    predictionId?: string
  ): Promise<string | null> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      
      const { data, error } = await supabase
        .from('restorations')
        .insert({
          user_id: deviceId,
          original_filename: originalFilename,
          status: 'processing' as const,
          function_type: functionType,
          prediction_id: predictionId,
        })
        .select('id')
        .single();

      if (error) {
        logSupabaseIssue('Failed to track restoration start', error);
        return null;
      }

      if (__DEV__) {
        console.log('✅ Restoration tracking started:', data.id);
      }
      
      return data.id;
    } catch (error) {
      logSupabaseIssue('Exception tracking restoration start', error);
      return null;
    }
  },

  /**
   * Update restoration when completed (success or failure)
   */
  async trackRestorationCompleted(
    restorationId: string | null,
    success: boolean,
    processingTimeMs?: number,
    errorMessage?: string
  ): Promise<void> {
    if (!restorationId) {
      if (__DEV__) {
        console.warn('⚠️ No restoration ID to update');
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('restorations')
        .update({
          status: success ? 'completed' as const : 'failed' as const,
          completed_at: new Date().toISOString(),
          processing_time_ms: processingTimeMs,
          error_message: errorMessage,
        })
        .eq('id', restorationId);

      if (error) {
        logSupabaseIssue('Failed to update restoration', error);
        return;
      }

      if (__DEV__) {
        console.log('✅ Restoration tracking updated:', restorationId);
      }
    } catch (error) {
      logSupabaseIssue('Exception updating restoration', error);
    }
  },

  /**
   * Get restoration analytics (for debugging/admin purposes)
   */
  async getRestorationStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
  } | null> {
    try {
      const deviceId = await getOrCreateCustomUserId();
      
      const { data, error } = await supabase
        .from('restorations')
        .select('status')
        .eq('user_id', deviceId);

      if (error) {
        logSupabaseIssue('Failed to get restoration stats', error);
        return null;
      }

      const stats = data.reduce(
        (acc, restoration) => {
          acc.total++;
          if (restoration.status === 'completed') acc.completed++;
          else if (restoration.status === 'failed') acc.failed++;
          else acc.pending++;
          return acc;
        },
        { total: 0, completed: 0, failed: 0, pending: 0 }
      );

      return stats;
    } catch (error) {
      logSupabaseIssue('Exception getting restoration stats', error);
      return null;
    }
  },
};