import React, { useState } from 'react';
import { Alert, View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';

import { PhotoPicker } from '@/components/PhotoPicker';
import { restorePhoto } from '@/services/replicate';
import { photoStorage } from '@/services/storage';
import { restorationService, authService } from '@/services/supabase';

export default function HomeScreen() {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePhotoSelected = async (uri: string) => {
    try {
      setIsProcessing(true);

      // Get current user (for now, we'll handle auth later)
      const user = await authService.getCurrentUser();
      const userId = user?.id || 'anonymous';

      // Save original photo locally
      const originalFilename = await photoStorage.saveOriginal(uri);

      // Create restoration record in database
      const restoration = await restorationService.create({
        user_id: userId,
        original_filename: originalFilename,
        status: 'processing',
      });

      const startTime = Date.now();

      // Process photo with Replicate
      const restoredUrl = await restorePhoto(uri);
      console.log('🎉 Photo restored successfully, URL:', restoredUrl);

      // Save restored photo locally
      const restoredFilename = await photoStorage.saveRestored(restoredUrl, originalFilename);
      console.log('💾 Restored photo saved locally:', restoredFilename);

      // Get the URI for the restored photo
      const restoredUri = photoStorage.getPhotoUri('restored', restoredFilename);
      console.log('📍 Restored photo URI:', restoredUri);

      // Create thumbnails
      const thumbnailFilename = await photoStorage.createThumbnail(
        restoredUri,
        'restored'
      );
      console.log('🖼️ Thumbnail created:', thumbnailFilename);

      // Update restoration record
      await restorationService.update(restoration.id, {
        restored_filename: restoredFilename,
        thumbnail_filename: thumbnailFilename,
        status: 'completed',
        processing_time_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      });

      // Navigate to restoration result
      router.push(`/restoration/${restoration.id}`);
    } catch (error) {
      console.error('Restoration error:', error);
      
      let errorMessage = 'Unable to restore your photo. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Authentication failed')) {
          errorMessage = 'Authentication failed. Please check your API token.';
        } else if (error.message.includes('Network request failed')) {
          errorMessage = 'Network connection failed. Please check your internet connection.';
        } else if (error.message.includes('does not exist')) {
          errorMessage = 'File system error. Please restart the app and try again.';
        } else if (error.message.includes('Download failed')) {
          errorMessage = 'Failed to download restored photo. Please try again.';
        }
      }
      
      Alert.alert(
        'Restoration Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 px-4 py-2">
        <PhotoPicker 
          onPhotoSelected={handlePhotoSelected}
          isProcessing={isProcessing}
        />
      </View>
    </SafeAreaView>
  );
}
