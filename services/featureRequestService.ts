import { supabase } from './supabaseClient';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

export interface FeatureRequest {
  id?: string;
  request_text: string;
  user_email?: string;
  device_id?: string;
  app_version?: string;
  platform?: string;
  is_pro_user?: boolean;
  request_type?: 'feature' | 'bug';
  status?: string;
  created_at?: string;
}

export const featureRequestService = {
  async submitRequest(
    requestText: string, 
    userEmail?: string, 
    isProUser?: boolean,
    requestType?: 'feature' | 'bug'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!requestText.trim()) {
        return { success: false, error: 'Request text cannot be empty' };
      }

      const { data, error } = await supabase
        .from('feature_requests')
        .insert({
          request_text: requestText.trim(),
          user_email: userEmail || null,
          device_id: Device.osInternalBuildId || null,
          app_version: Constants.expoConfig?.version || 'unknown',
          platform: Platform.OS,
          is_pro_user: isProUser || false,
          request_type: requestType || 'feature',
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to submit feature request:', error);
        return { success: false, error: 'Failed to submit request. Please try again.' };
      }

      console.log('✅ Feature request submitted:', data?.id);
      return { success: true };
    } catch (error) {
      console.error('❌ Exception submitting feature request:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  }
};