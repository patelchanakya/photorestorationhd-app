import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import { AppState, AppStateStatus } from 'react-native';

const BACKGROUND_TIME_KEY = 'app_background_timestamp';
const BACKGROUND_THRESHOLD = 60 * 60 * 1000; // 1 hour in milliseconds

class AppLifecycleService {
  private backgroundTime: number | null = null;
  private appStateSubscription: any = null;
  private isInitialized = false;
  private storeResetFunctions: (() => void)[] = [];

  initialize() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.setupAppStateListener();

    if (__DEV__) {
      console.log('🔄 AppLifecycleService initialized');
    }
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private async handleAppStateChange(nextAppState: AppStateStatus) {
    try {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background - record timestamp
        await this.handleAppBackground();
      } else if (nextAppState === 'active') {
        // App coming to foreground - check if we should restart
        await this.handleAppForeground();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('🔄 Error handling app state change:', error);
      }
    }
  }

  private async handleAppBackground() {
    const timestamp = Date.now();
    this.backgroundTime = timestamp;
    await AsyncStorage.setItem(BACKGROUND_TIME_KEY, timestamp.toString());

    if (__DEV__) {
      console.log('🔄 App backgrounded at:', new Date(timestamp).toISOString());
    }
  }

  private async handleAppForeground() {
    if (__DEV__) {
      console.log('🔄 App foregrounded - checking background duration');
    }

    const shouldRestart = await this.shouldRestartApp();

    if (shouldRestart) {
      if (__DEV__) {
        console.log('🔄 App needs restart after extended background');
      }
      await this.performSeamlessRestart();
    } else {
      // Clear the background timestamp since we're not restarting
      await AsyncStorage.removeItem(BACKGROUND_TIME_KEY);
      this.backgroundTime = null;
    }
  }

  private async shouldRestartApp(): Promise<boolean> {
    try {
      const storedTime = await AsyncStorage.getItem(BACKGROUND_TIME_KEY);

      if (!storedTime) return false;

      const backgroundTimestamp = parseInt(storedTime, 10);
      const currentTime = Date.now();
      const timeInBackground = currentTime - backgroundTimestamp;

      if (__DEV__) {
        const minutes = Math.round(timeInBackground / 1000 / 60);
        console.log(`🔄 Time in background: ${minutes} minutes`);
      }

      return timeInBackground > BACKGROUND_THRESHOLD;
    } catch (error) {
      if (__DEV__) {
        console.error('🔄 Error checking background time:', error);
      }
      return false;
    }
  }

  private async performSeamlessRestart() {
    try {
      if (__DEV__) {
        console.log('🔄 Starting seamless app restart...');
      }

      // Step 1: Prevent splash screen from auto-hiding
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch (splashError) {
        if (__DEV__) {
          console.warn('🔄 Could not control splash screen:', splashError);
        }
      }

      // Step 2: Reset all registered stores
      this.resetAllStores();

      // Step 3: Clear background timestamp
      await AsyncStorage.removeItem(BACKGROUND_TIME_KEY);
      this.backgroundTime = null;

      // Step 4: Just restart the app - exactly like killing it
      if (__DEV__) {
        console.log('🔄 Restarting app...');
      }
      await Updates.reloadAsync();
    } catch (error) {
      if (__DEV__) {
        console.error('🔄 Error during seamless restart:', error);
      }

      // Fallback: Hide splash screen and continue normally
      try {
        await SplashScreen.hideAsync();
      } catch (hideError) {
        // Silent fail
      }
    }
  }


  // Manual restart trigger (for testing)
  async forceRestart() {
    if (__DEV__) {
      console.log('🔄 Force restarting app...');
    }
    await this.performSeamlessRestart();
  }

  // Register a store reset function
  registerStoreReset(resetFunction: () => void): () => void {
    this.storeResetFunctions.push(resetFunction);

    // Return unregister function
    return () => {
      const index = this.storeResetFunctions.indexOf(resetFunction);
      if (index > -1) {
        this.storeResetFunctions.splice(index, 1);
      }
    };
  }

  // Reset all registered stores
  private resetAllStores() {
    if (__DEV__) {
      console.log(`🔄 Resetting ${this.storeResetFunctions.length} registered stores`);
    }

    this.storeResetFunctions.forEach((resetFn, index) => {
      try {
        resetFn();
      } catch (error) {
        if (__DEV__) {
          console.error(`🔄 Error resetting store ${index}:`, error);
        }
      }
    });
  }

  // Get current background duration (for debugging)
  getBackgroundDuration(): number | null {
    if (!this.backgroundTime) return null;
    return Date.now() - this.backgroundTime;
  }

  // Set custom threshold (for testing)
  setThresholdForTesting(milliseconds: number) {
    if (__DEV__) {
      // In development, we can dynamically change the threshold
      (global as any).__APP_RESTART_THRESHOLD = milliseconds;
      console.log(`🔄 Background threshold set to: ${milliseconds / 1000} seconds (DEV ONLY)`);
    }
  }

  // Clean up
  destroy() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.isInitialized = false;

    if (__DEV__) {
      console.log('🔄 AppLifecycleService destroyed');
    }
  }
}

export const appLifecycleService = new AppLifecycleService();