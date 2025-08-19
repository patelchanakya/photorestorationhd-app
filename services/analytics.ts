class AnalyticsService {
  private isInitialized: boolean = false;

  async initialize() {
    this.isInitialized = true;
    if (__DEV__) {
      console.log('✅ Analytics service initialized (stub mode)');
    }
  }

  // Public methods for tracking specific events (all no-ops)
  trackOnboardingStarted() {
    if (__DEV__) {
      console.log('📊 Analytics: Onboarding Started (stub)');
    }
  }

  trackOnboardingCompleted() {
    if (__DEV__) {
      console.log('📊 Analytics: Onboarding Completed (stub)');
    }
  }

  trackRestorationStarted(imageSource: 'camera' | 'gallery') {
    if (__DEV__) {
      console.log(`📊 Analytics: Restoration Started (${imageSource}) (stub)`);
    }
  }

  async trackRestorationCompleted(success: boolean, imageSource: 'camera' | 'gallery', processingTime?: number, functionType?: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch') {
    if (__DEV__) {
      console.log(`📊 Analytics: Restoration Completed (${success ? 'success' : 'failure'}, ${imageSource}, ${functionType}) (stub)`);
    }
  }

  trackSubscriptionEvent(eventType: 'upgraded' | 'restored', planType?: string) {
    if (__DEV__) {
      console.log(`📊 Analytics: Subscription Event (${eventType}, ${planType}) (stub)`);
    }
  }

  trackRestorationError(errorType: 'api_error' | 'network_error' | 'processing_error' | 'validation_error', errorMessage: string, imageSource: 'camera' | 'gallery', functionType?: string) {
    if (__DEV__) {
      console.log(`📊 Analytics: Restoration Error (${errorType}) - ${errorMessage} (stub)`);
    }
  }

  trackModeUsed(functionType: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch', imageSource: 'camera' | 'gallery') {
    if (__DEV__) {
      console.log(`📊 Analytics: Mode Used - ${functionType} (${imageSource}) (stub)`);
    }
  }

  // Custom event tracking
  track(eventName: string, properties?: Record<string, any>) {
    if (__DEV__) {
      console.log(`📊 Analytics: ${eventName} (stub)`, properties);
    }
  }

  // User properties
  setUserProperty(property: string, value: any) {
    if (__DEV__) {
      console.log(`📊 Analytics: Set user property ${property} = ${value} (stub)`);
    }
  }

  // Cleanup
  destroy() {
    if (__DEV__) {
      console.log('📊 Analytics: Destroyed (stub)');
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();