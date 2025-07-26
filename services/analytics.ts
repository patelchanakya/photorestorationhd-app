import { Mixpanel } from 'mixpanel-react-native';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

class AnalyticsService {
  private mixpanel: Mixpanel | null = null;
  private sessionStartTime: number | null = null;
  private userId: string | null = null;
  private isInitialized: boolean = false;
  private appStateSubscription: any = null;

  async initialize() {
    try {
      const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
      
      if (!token) {
        if (__DEV__) {
          console.warn('⚠️ Mixpanel token not found. Analytics disabled.');
        }
        return;
      }

      // Initialize Mixpanel - using constructor with parameters
      this.mixpanel = new Mixpanel(token, false, false); // token, trackAutomaticEvents, useNative
      await this.mixpanel.init();

      // Set up user identification
      await this.setupUserIdentification();

      // Set up session tracking
      this.setupSessionTracking();

      // Set device properties
      this.setDeviceProperties();

      this.isInitialized = true;

      if (__DEV__) {
        console.log('✅ Analytics service initialized successfully');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to initialize analytics:', error);
      }
    }
  }

  private async setupUserIdentification() {
    if (!this.mixpanel) return;

    try {
      // Get or create persistent user ID
      let storedUserId = await AsyncStorage.getItem('analytics_user_id');
      
      if (!storedUserId) {
        // Create a unique user ID based on device info
        const deviceId = Device.osInternalBuildId || Constants.sessionId || 'unknown';
        storedUserId = `user_${deviceId}_${Date.now()}`;
        await AsyncStorage.setItem('analytics_user_id', storedUserId);
      }

      this.userId = storedUserId;
      this.mixpanel.identify(storedUserId);

      // Set user properties
      this.mixpanel.getPeople().set({
        '$device_id': Device.osInternalBuildId,
        '$device_model': Device.modelName,
        '$os': Device.osName,
        '$os_version': Device.osVersion,
        'app_version': Constants.expoConfig?.version || '1.0.0',
        'first_seen': new Date().toISOString(),
      });

      if (__DEV__) {
        console.log('👤 User identified:', storedUserId);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to set up user identification:', error);
      }
    }
  }

  private setupSessionTracking() {
    if (!this.mixpanel) return;

    // Track initial app state
    const currentState = AppState.currentState;
    if (currentState === 'active') {
      this.startSession();
    }

    // Listen for app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private handleAppStateChange(nextAppState: AppStateStatus) {
    if (nextAppState === 'active') {
      this.startSession();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.endSession();
    }
  }

  private startSession() {
    if (!this.mixpanel) return;

    this.sessionStartTime = Date.now();
    
    this.mixpanel.track('App Opened', {
      timestamp: new Date().toISOString(),
      session_id: this.sessionStartTime,
    });

    this.mixpanel.track('Session Started', {
      timestamp: new Date().toISOString(),
      session_id: this.sessionStartTime,
    });

    if (__DEV__) {
      console.log('📱 Session started');
    }
  }

  private async endSession() {
    if (!this.mixpanel || !this.sessionStartTime) return;

    const sessionDuration = Date.now() - this.sessionStartTime;
    const sessionId = this.sessionStartTime;

    this.mixpanel.track('Session Ended', {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      session_duration_ms: sessionDuration,
      session_duration_seconds: Math.round(sessionDuration / 1000),
      session_duration_minutes: Math.round(sessionDuration / 60000),
    });

    this.mixpanel.track('App Closed', {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      session_duration_ms: sessionDuration,
    });

    // Update user properties with session data
    this.mixpanel.getPeople().set({
      'last_session_duration': Math.round(sessionDuration / 1000),
      'last_seen': new Date().toISOString(),
    });

    // Store session data for daily active users tracking
    await this.recordDailyActivity();

    this.sessionStartTime = null;

    if (__DEV__) {
      console.log(`📱 Session ended. Duration: ${Math.round(sessionDuration / 1000)}s`);
    }
  }

  private async recordDailyActivity() {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const key = `daily_activity_${today}`;
      await AsyncStorage.setItem(key, Date.now().toString());
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to record daily activity:', error);
      }
    }
  }

  private setDeviceProperties() {
    if (!this.mixpanel) return;

    // Set super properties that will be sent with every event
    this.mixpanel.registerSuperProperties({
      'device_model': Device.modelName,
      'device_brand': Device.brand,
      'os_name': Device.osName,
      'os_version': Device.osVersion,
      'app_version': Constants.expoConfig?.version || '1.0.0',
      'is_device': Device.isDevice,
    });
  }

  // Public methods for tracking specific events

  trackOnboardingStarted() {
    if (!this.isInitialized || !this.mixpanel) return;

    this.mixpanel.track('Onboarding Started', {
      timestamp: new Date().toISOString(),
      session_id: this.sessionStartTime,
    });

    if (__DEV__) {
      console.log('📊 Analytics: Onboarding Started');
    }
  }

  trackOnboardingCompleted() {
    if (!this.isInitialized || !this.mixpanel) return;

    this.mixpanel.track('Onboarding Completed', {
      timestamp: new Date().toISOString(),
      session_id: this.sessionStartTime,
    });

    // Update user properties
    this.mixpanel.getPeople().set({
      'onboarding_completed': true,
      'onboarding_completed_at': new Date().toISOString(),
    });

    if (__DEV__) {
      console.log('📊 Analytics: Onboarding Completed');
    }
  }

  trackRestorationStarted(imageSource: 'camera' | 'gallery') {
    if (!this.isInitialized || !this.mixpanel) return;

    this.mixpanel.track('Restoration Started', {
      timestamp: new Date().toISOString(),
      session_id: this.sessionStartTime,
      image_source: imageSource,
    });

    if (__DEV__) {
      console.log(`📊 Analytics: Restoration Started (${imageSource})`);
    }
  }

  async trackRestorationCompleted(success: boolean, imageSource: 'camera' | 'gallery', processingTime?: number) {
    if (!this.isInitialized || !this.mixpanel) return;

    this.mixpanel.track('Restoration Completed', {
      timestamp: new Date().toISOString(),
      session_id: this.sessionStartTime,
      success,
      image_source: imageSource,
      processing_time_ms: processingTime,
      processing_time_seconds: processingTime ? Math.round(processingTime / 1000) : undefined,
    });

    if (success) {
      // Check if this is the user's first successful restoration
      const isFirstRestoration = await this.checkFirstRestoration();
      
      if (isFirstRestoration) {
        this.trackFirstRestorationCompleted(imageSource);
      }

      // Update user properties
      this.mixpanel.getPeople().increment('total_restorations', 1);
      this.mixpanel.getPeople().set({
        'last_restoration_at': new Date().toISOString(),
      });
    }
  }

  private async checkFirstRestoration(): Promise<boolean> {
    try {
      const hasCompletedRestoration = await AsyncStorage.getItem('has_completed_restoration');
      if (!hasCompletedRestoration) {
        await AsyncStorage.setItem('has_completed_restoration', 'true');
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private trackFirstRestorationCompleted(imageSource: 'camera' | 'gallery') {
    if (!this.isInitialized || !this.mixpanel) return;

    this.mixpanel.track('First Restoration Completed', {
      timestamp: new Date().toISOString(),
      session_id: this.sessionStartTime,
      image_source: imageSource,
    });

    // This is a key activation event
    this.mixpanel.getPeople().set({
      'activated': true,
      'activated_at': new Date().toISOString(),
      'first_restoration_source': imageSource,
    });
  }

  trackSubscriptionEvent(eventType: 'upgraded' | 'restored', planType?: string) {
    if (!this.isInitialized || !this.mixpanel) return;

    this.mixpanel.track('Subscription Event', {
      timestamp: new Date().toISOString(),
      session_id: this.sessionStartTime,
      event_type: eventType,
      plan_type: planType,
    });

    // Update user properties
    this.mixpanel.getPeople().set({
      'is_pro': eventType === 'upgraded',
      'subscription_type': planType || 'free',
      'subscription_updated_at': new Date().toISOString(),
    });
  }

  // Custom event tracking
  track(eventName: string, properties?: Record<string, any>) {
    if (!this.isInitialized || !this.mixpanel) return;

    this.mixpanel.track(eventName, {
      timestamp: new Date().toISOString(),
      session_id: this.sessionStartTime,
      ...properties,
    });
  }

  // User properties
  setUserProperty(property: string, value: any) {
    if (!this.isInitialized || !this.mixpanel) return;

    this.mixpanel.getPeople().set({ [property]: value });
  }

  // Cleanup
  destroy() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.sessionStartTime) {
      this.endSession();
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();