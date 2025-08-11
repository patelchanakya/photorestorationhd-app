import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface PermissionState {
  mediaLibrary: PermissionStatus;
  camera: PermissionStatus;
  notifications: PermissionStatus;
}

class PermissionsService {
  private permissions: PermissionState = {
    mediaLibrary: 'undetermined',
    camera: 'undetermined',
    notifications: 'undetermined',
  };

  /**
   * Check current status of all permissions without requesting them
   */
  async checkAllPermissions(): Promise<PermissionState> {
    try {
      // Check media library permissions
      const mediaLibraryStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
      this.permissions.mediaLibrary = mediaLibraryStatus.status as PermissionStatus;

      // Check camera permissions  
      const cameraStatus = await Camera.getCameraPermissionsAsync();
      this.permissions.camera = cameraStatus.status as PermissionStatus;

      // Check notification permissions
      const notificationStatus = await Notifications.getPermissionsAsync();
      this.permissions.notifications = notificationStatus.status as PermissionStatus;

      if (__DEV__) {
        console.log('🔍 Permission status check:', this.permissions);
      }

      return { ...this.permissions };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to check permissions:', error);
      }
      return this.permissions;
    }
  }

  /**
   * Request essential permissions upfront during app initialization
   * Note: We only request notifications here, not media/camera permissions
   * Those are requested on-demand to preserve the native permission dialogs
   */
  async requestEssentialPermissions(): Promise<PermissionState> {
    try {
      if (__DEV__) {
        console.log('🔐 Requesting essential permissions...');
      }

      // Check (but don't request) media library permissions
      try {
        const mediaLibraryStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
        this.permissions.mediaLibrary = mediaLibraryStatus.status as PermissionStatus;
        if (__DEV__) {
          console.log('📱 Media library permission status:', mediaLibraryStatus.status);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Media library permission check failed:', error);
        }
        this.permissions.mediaLibrary = 'undetermined';
      }

      // Check (but don't request) camera permissions
      try {
        const cameraStatus = await Camera.getCameraPermissionsAsync();
        this.permissions.camera = cameraStatus.status as PermissionStatus;
        if (__DEV__) {
          console.log('📷 Camera permission status:', cameraStatus.status);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Camera permission check failed:', error);
        }
        this.permissions.camera = 'undetermined';
      }

      // Request notification permissions (these are fine to request upfront)
      try {
        const notificationResult = await Notifications.requestPermissionsAsync();
        this.permissions.notifications = notificationResult.status as PermissionStatus;
        if (__DEV__) {
          console.log('🔔 Notification permission:', notificationResult.status);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Notification permission failed:', error);
        }
        this.permissions.notifications = 'denied';
      }

      if (__DEV__) {
        console.log('✅ Essential permissions checked. Final state:', this.permissions);
      }

      return { ...this.permissions };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to request essential permissions:', error);
      }
      return this.permissions;
    }
  }

  /**
   * Get current permission state (from cache)
   */
  getPermissionState(): PermissionState {
    return { ...this.permissions };
  }

  /**
   * Check if a specific permission is granted
   */
  hasPermission(permission: keyof PermissionState): boolean {
    return this.permissions[permission] === 'granted';
  }

  /**
   * Check if media library permission is granted
   */
  hasMediaLibraryPermission(): boolean {
    return this.permissions.mediaLibrary === 'granted';
  }

  /**
   * Check if camera permission is granted
   */
  hasCameraPermission(): boolean {
    return this.permissions.camera === 'granted';
  }

  /**
   * Check if notification permission is granted
   */
  hasNotificationPermission(): boolean {
    return this.permissions.notifications === 'granted';
  }

  /**
   * Request a specific permission if needed
   */
  async requestSpecificPermission(permission: keyof PermissionState): Promise<PermissionStatus> {
    try {
      let result: any;
      
      switch (permission) {
        case 'mediaLibrary':
          if (this.permissions.mediaLibrary === 'granted') {
            return 'granted';
          }
          result = await ImagePicker.requestMediaLibraryPermissionsAsync();
          this.permissions.mediaLibrary = result.status as PermissionStatus;
          return this.permissions.mediaLibrary;
          
        case 'camera':
          if (this.permissions.camera === 'granted') {
            return 'granted';
          }
          result = await Camera.requestCameraPermissionsAsync();
          this.permissions.camera = result.status as PermissionStatus;
          return this.permissions.camera;
          
        case 'notifications':
          if (this.permissions.notifications === 'granted') {
            return 'granted';
          }
          result = await Notifications.requestPermissionsAsync();
          this.permissions.notifications = result.status as PermissionStatus;
          return this.permissions.notifications;
          
        default:
          return 'denied';
      }
    } catch (error) {
      if (__DEV__) {
        console.error(`❌ Failed to request ${permission} permission:`, error);
      }
      return 'denied';
    }
  }
}

// Export singleton instance
export const permissionsService = new PermissionsService();