import * as Clarity from '@microsoft/react-native-clarity';
import Constants from 'expo-constants';

class ClarityService {
  private isInitialized: boolean = false;
  private readonly projectId = 't2eqsax833';

  async initialize() {
    try {
      // Skip initialization in Expo Go
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        if (__DEV__) {
          console.log('⚠️ Microsoft Clarity is not available in Expo Go');
        }
        return;
      }

      // Skip if already initialized
      if (this.isInitialized) {
        if (__DEV__) {
          console.log('✅ Microsoft Clarity already initialized');
        }
        return;
      }

      // Initialize Clarity
      await Clarity.initialize(this.projectId, {
        logLevel: __DEV__ ? Clarity.LogLevel.Verbose : Clarity.LogLevel.None,
      });

      this.isInitialized = true;
      
      if (__DEV__) {
        console.log('✅ Microsoft Clarity initialized successfully');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Microsoft Clarity initialization failed:', error);
      }
    }
  }

  // Screen tracking (using the new API)
  setCurrentScreenName(screenName: string) {
    if (!this.isInitialized) return;
    
    try {
      Clarity.setCurrentScreenName(screenName);
      
      if (__DEV__) {
        console.log('📊 Clarity: Screen name set -', screenName);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Clarity screen name failed:', error);
      }
    }
  }

  // Legacy method for backward compatibility
  trackScreen(screenName: string, properties?: Record<string, any>) {
    this.setCurrentScreenName(screenName);
    
    // Add custom properties as event if provided
    if (properties) {
      this.sendCustomEvent(`screen_${screenName}`, properties);
    }
  }

  // Event tracking (using the new API)
  sendCustomEvent(eventName: string, properties?: Record<string, any>) {
    if (!this.isInitialized) return;
    
    try {
      // Clarity uses sendCustomEvent for detailed tracking
      if (properties && Object.keys(properties).length > 0) {
        // Convert properties to tags first
        Object.entries(properties).forEach(([key, value]) => {
          this.setCustomTag(key, String(value));
        });
      }
      
      Clarity.sendCustomEvent(eventName);
      
      if (__DEV__) {
        console.log('📊 Clarity: Custom event sent -', eventName, properties);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Clarity custom event failed:', error);
      }
    }
  }

  // Legacy method for backward compatibility
  trackEvent(eventName: string, properties?: Record<string, any>) {
    this.sendCustomEvent(eventName, properties);
  }

  // User identification (using the new API)
  setCustomUserId(userId: string) {
    if (!this.isInitialized) return;
    
    try {
      Clarity.setCustomUserId(userId);
      
      if (__DEV__) {
        console.log('📊 Clarity: Custom user ID set -', userId);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Clarity custom user ID failed:', error);
      }
    }
  }

  // Legacy method for backward compatibility
  setUserId(userId: string) {
    this.setCustomUserId(userId);
  }

  // Session tags/properties (using the new API)
  setCustomTag(key: string, value: string) {
    if (!this.isInitialized) return;
    
    try {
      Clarity.setCustomTag(key, value);
      
      if (__DEV__) {
        console.log('📊 Clarity: Custom tag set -', key, value);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Clarity custom tag failed:', error);
      }
    }
  }

  // Legacy method for backward compatibility
  setSessionProperty(key: string, value: string) {
    this.setCustomTag(key, value);
  }

  // Get session URL (using the new API)
  async getCurrentSessionUrl(): Promise<string | null> {
    if (!this.isInitialized) return null;
    
    try {
      const url = await Clarity.getCurrentSessionUrl();
      if (__DEV__) {
        console.log('📊 Clarity: Current session URL -', url);
      }
      return url;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Clarity current session URL failed:', error);
      }
      return null;
    }
  }

  // Legacy method for backward compatibility
  async getSessionUrl(): Promise<string | null> {
    return this.getCurrentSessionUrl();
  }

  // Session management
  setCustomSessionId(sessionId: string) {
    if (!this.isInitialized) return;
    
    try {
      Clarity.setCustomSessionId(sessionId);
      
      if (__DEV__) {
        console.log('📊 Clarity: Custom session ID set -', sessionId);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Clarity custom session ID failed:', error);
      }
    }
  }

  // Start new session
  startNewSession(callback?: () => void) {
    if (!this.isInitialized) return;
    
    try {
      Clarity.startNewSession(callback);
      
      if (__DEV__) {
        console.log('📊 Clarity: New session started');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Clarity start new session failed:', error);
      }
    }
  }

  // Pause/Resume session recording
  pause() {
    if (!this.isInitialized) return;
    
    try {
      Clarity.pause();
      
      if (__DEV__) {
        console.log('📊 Clarity: Session paused');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Clarity pause failed:', error);
      }
    }
  }

  resume() {
    if (!this.isInitialized) return;
    
    try {
      Clarity.resume();
      
      if (__DEV__) {
        console.log('📊 Clarity: Session resumed');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Clarity resume failed:', error);
      }
    }
  }

  // Utility methods for B2C analytics
  setUserContext(userId: string, subscriptionStatus: 'free' | 'pro', cohort: 'new' | 'returning') {
    this.setCustomUserId(userId);
    this.setCustomTag('subscription_status', subscriptionStatus);
    this.setCustomTag('user_cohort', cohort);
  }

  setAppContext(version: string, deviceType: 'phone' | 'tablet') {
    this.setCustomTag('app_version', version);
    this.setCustomTag('device_type', deviceType);
  }

  // Track user journey milestones
  trackMilestone(milestone: string, metadata?: Record<string, string>) {
    this.sendCustomEvent(`milestone_${milestone}`);
    
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        this.setCustomTag(`milestone_${key}`, value);
      });
    }
  }
}

// Export singleton instance
export const clarityService = new ClarityService();