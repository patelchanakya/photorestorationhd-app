import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { photoStorage } from '@/services/storage';

interface SavePhotoParams {
  imageUri: string;
}

export function useSavePhoto() {
  return useMutation({
    mutationFn: async ({ imageUri }: SavePhotoParams) => {
      // Add haptic feedback at the start
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      
      await photoStorage.exportToCameraRoll(imageUri);
      
      // Success haptic feedback
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    },
    onError: (error) => {
      // Error haptic feedback
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      console.error('Failed to save photo:', error);
    },
  });
}