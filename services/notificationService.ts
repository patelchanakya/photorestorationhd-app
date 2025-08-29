import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private hasPermission = false;
  private hasRequestedPermission = false;

  async initialize() {
    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      this.hasPermission = existingStatus === 'granted';
      
      if (__DEV__) {
        console.log('🔔 Notification permission status:', existingStatus);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to initialize notifications:', error);
      }
    }
  }

  async requestPermission(): Promise<boolean> {
    if (this.hasPermission) {
      return true;
    }

    if (this.hasRequestedPermission) {
      return false; // Don't ask again in the same session
    }

    try {
      this.hasRequestedPermission = true;
      
      const { status } = await Notifications.requestPermissionsAsync();
      this.hasPermission = status === 'granted';
      
      if (__DEV__) {
        console.log('🔔 Notification permission requested, result:', status);
      }
      
      return this.hasPermission;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to request notification permission:', error);
      }
      return false;
    }
  }

  async sendVideoCompletionNotification(jobType: 'photo' | 'video' = 'video') {
    if (!this.hasPermission) {
      if (__DEV__) {
        console.log('🔔 No notification permission, skipping notification');
      }
      return;
    }

    try {
      const title = jobType === 'video' ? 'Video Generation Complete! 🎬' : 'Photo Enhancement Complete! ✨';
      const body = jobType === 'video' 
        ? 'Your AI-generated video is ready to view and share!'
        : 'Your enhanced photo is ready to view and share!';

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          categoryIdentifier: 'completion',
        },
        trigger: null, // Send immediately
      });

      if (__DEV__) {
        console.log('🔔 Completion notification sent for:', jobType);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to send completion notification:', error);
      }
    }
  }

  async sendProgressNotification(message: string, progress?: number) {
    if (!this.hasPermission) {
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Processing in Progress...',
          body: message,
          categoryIdentifier: 'progress',
        },
        trigger: null,
      });

      if (__DEV__) {
        console.log('🔔 Progress notification sent:', message);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to send progress notification:', error);
      }
    }
  }

  getPermissionStatus(): boolean {
    return this.hasPermission;
  }

  hasAlreadyRequestedPermission(): boolean {
    return this.hasRequestedPermission;
  }
}

export const notificationService = new NotificationService();