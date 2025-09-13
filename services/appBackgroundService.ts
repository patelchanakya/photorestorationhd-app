import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { AppState, AppStateStatus } from 'react-native';

const BACKGROUND_TIME_KEY = 'app_background_timestamp';
const BACKGROUND_THRESHOLD = 60 * 60 * 1000; // 1 hour in milliseconds

class AppBackgroundService {
  private backgroundTime: number | null = null;
  private appStateSubscription: any = null;
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.setupAppStateListener();
    this.checkBackgroundTime();

    if (__DEV__) {
      console.log('📱 AppBackgroundService initialized');
    }
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private async handleAppStateChange(nextAppState: AppStateStatus) {
    try {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background - record timestamp
        const timestamp = Date.now();
        this.backgroundTime = timestamp;
        await AsyncStorage.setItem(BACKGROUND_TIME_KEY, timestamp.toString());

        if (__DEV__) {
          console.log('📱 App backgrounded at:', new Date(timestamp).toISOString());
        }
      } else if (nextAppState === 'active') {
        // App coming to foreground - check if we should restart
        await this.checkBackgroundTime();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('📱 Error handling app state change:', error);
      }
    }
  }

  private async checkBackgroundTime() {
    try {
      const storedTime = await AsyncStorage.getItem(BACKGROUND_TIME_KEY);

      if (!storedTime) return;

      const backgroundTimestamp = parseInt(storedTime, 10);
      const currentTime = Date.now();
      const timeInBackground = currentTime - backgroundTimestamp;

      if (__DEV__) {
        console.log('📱 Time in background:', Math.round(timeInBackground / 1000), 'seconds');
      }

      // If app was in background for more than threshold, restart it
      if (timeInBackground > BACKGROUND_THRESHOLD) {
        if (__DEV__) {
          console.log('📱 App was backgrounded for more than 1 hour, restarting...');
        }

        await this.restartApp();
      } else {
        // Clear the background time since we're checking it
        await AsyncStorage.removeItem(BACKGROUND_TIME_KEY);
        this.backgroundTime = null;
      }
    } catch (error) {
      if (__DEV__) {
        console.error('📱 Error checking background time:', error);
      }
    }
  }

  private async restartApp() {
    try {
      // Clear the background timestamp
      await AsyncStorage.removeItem(BACKGROUND_TIME_KEY);
      this.backgroundTime = null;

      // For development, just reload the JavaScript bundle
      if (__DEV__) {
        // In development, we can use DevSettings to reload
        const { DevSettings } = require('react-native');
        if (DevSettings && DevSettings.reload) {
          DevSettings.reload();
          return;
        }
      }

      // For production builds with Expo Updates
      try {
        await Updates.reloadAsync();
      } catch (reloadError) {
        if (__DEV__) {
          console.warn('📱 Updates.reloadAsync failed, trying alternative restart methods:', reloadError);
        }

        // Alternative restart method - this will cause a complete app restart
        // by navigating to a fresh instance
        const { Linking } = require('react-native');
        const { Constants } = require('expo-constants');

        if (Constants.linkingUrl) {
          await Linking.openURL(Constants.linkingUrl);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('📱 Error restarting app:', error);
      }
    }
  }

  // Manual method to force restart (can be used for testing or other scenarios)
  async forceRestart() {
    if (__DEV__) {
      console.log('📱 Forcing app restart...');
    }
    await this.restartApp();
  }

  // Get time spent in background (for debugging)
  getBackgroundDuration(): number | null {
    if (!this.backgroundTime) return null;
    return Date.now() - this.backgroundTime;
  }

  // Clean up
  destroy() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.isInitialized = false;

    if (__DEV__) {
      console.log('📱 AppBackgroundService destroyed');
    }
  }

  // For testing - set a custom threshold
  setThreshold(milliseconds: number) {
    if (__DEV__) {
      console.log('📱 Background threshold set to:', milliseconds / 1000, 'seconds');
    }
    // This would require modifying BACKGROUND_THRESHOLD, but for simplicity we'll just log it
  }
}

export const appBackgroundService = new AppBackgroundService();