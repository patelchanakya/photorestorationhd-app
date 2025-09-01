import { clarityService } from './clarityService';

class AnalyticsService {
  private isInitialized: boolean = false;

  async initialize() {
    // Initialize Microsoft Clarity
    await clarityService.initialize();
    
    this.isInitialized = true;
    if (__DEV__) {
      console.log('✅ Analytics service initialized');
    }
  }

  // Public methods for tracking specific events
  trackOnboardingStarted() {
    // Send to Clarity
    clarityService.sendCustomEvent('onboarding_started');
    clarityService.setCustomTag('onboarding_step', 'started');
    
    if (__DEV__) {
      console.log('📊 Analytics: Onboarding Started');
    }
  }

  trackOnboardingCompleted() {
    // Send to Clarity
    clarityService.sendCustomEvent('onboarding_completed');
    clarityService.setCustomTag('onboarding_step', 'completed');
    clarityService.trackMilestone('onboarding_complete');
    
    if (__DEV__) {
      console.log('📊 Analytics: Onboarding Completed');
    }
  }

  trackRestorationStarted(imageSource: 'camera' | 'gallery') {
    // Send to Clarity
    clarityService.sendCustomEvent('restoration_started');
    clarityService.setCustomTag('image_source', imageSource);
    clarityService.setCustomTag('operation_type', 'restoration');
    
    if (__DEV__) {
      console.log(`📊 Analytics: Restoration Started (${imageSource})`);
    }
  }

  async trackRestorationCompleted(success: boolean, imageSource: 'camera' | 'gallery', processingTime?: number, functionType?: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'water_damage') {
    // Send to Clarity
    clarityService.sendCustomEvent(success ? 'restoration_success' : 'restoration_failure');
    clarityService.setCustomTag('image_source', imageSource);
    clarityService.setCustomTag('function_type', functionType || 'restoration');
    clarityService.setCustomTag('success', success ? 'true' : 'false');
    
    if (processingTime) {
      clarityService.setCustomTag('processing_time_ms', processingTime.toString());
    }
    
    if (success) {
      clarityService.trackMilestone('first_restoration_complete');
    }
    
    if (__DEV__) {
      console.log(`📊 Analytics: Restoration Completed (${success ? 'success' : 'failure'}, ${imageSource}, ${functionType})`);
    }
  }

  trackSubscriptionEvent(eventType: 'upgraded' | 'restored', planType?: string) {
    // Send to Clarity
    clarityService.sendCustomEvent(`subscription_${eventType}`);
    clarityService.setCustomTag('subscription_event', eventType);
    
    if (planType) {
      clarityService.setCustomTag('plan_type', planType);
    }
    
    if (eventType === 'upgraded') {
      clarityService.trackMilestone('subscription_purchased', { plan: planType || 'unknown' });
    }
    
    if (__DEV__) {
      console.log(`📊 Analytics: Subscription Event (${eventType}, ${planType})`);
    }
  }

  trackRestorationError(errorType: 'api_error' | 'network_error' | 'processing_error' | 'validation_error', errorMessage: string, imageSource: 'camera' | 'gallery', functionType?: string) {
    // Send to Clarity
    clarityService.sendCustomEvent('restoration_error');
    clarityService.setCustomTag('error_type', errorType);
    clarityService.setCustomTag('image_source', imageSource);
    clarityService.setCustomTag('error_message', errorMessage.substring(0, 100)); // Truncate for privacy
    
    if (functionType) {
      clarityService.setCustomTag('function_type', functionType);
    }
    
    if (__DEV__) {
      console.log(`📊 Analytics: Restoration Error (${errorType}) - ${errorMessage}`);
    }
  }

  trackModeUsed(functionType: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'water_damage', imageSource: 'camera' | 'gallery') {
    // Send to Clarity
    clarityService.sendCustomEvent('mode_used');
    clarityService.setCustomTag('function_type', functionType);
    clarityService.setCustomTag('image_source', imageSource);
    clarityService.trackMilestone('feature_discovery', { feature: functionType });
    
    if (__DEV__) {
      console.log(`📊 Analytics: Mode Used - ${functionType} (${imageSource})`);
    }
  }

  // Custom event tracking
  track(eventName: string, properties?: Record<string, any>) {
    // Send to Clarity
    clarityService.sendCustomEvent(eventName);
    
    // Add properties as tags
    if (properties) {
      Object.entries(properties).forEach(([key, value]) => {
        clarityService.setCustomTag(key, String(value));
      });
    }
    
    if (__DEV__) {
      console.log(`📊 Analytics: ${eventName}`, properties);
    }
  }

  // User properties
  setUserProperty(property: string, value: any) {
    // Send to Clarity as custom tag
    clarityService.setCustomTag(property, String(value));
    
    if (__DEV__) {
      console.log(`📊 Analytics: Set user property ${property} = ${value}`);
    }
  }

  // Cleanup
  destroy() {
    // Clarity doesn't need explicit cleanup, but we can pause it
    clarityService.pause();
    
    if (__DEV__) {
      console.log('📊 Analytics: Destroyed');
    }
  }

  // Additional B2C specific methods
  
  // Set user context for B2C analytics
  setUserContext(userId: string, subscriptionStatus: 'free' | 'pro', isNewUser: boolean = false) {
    const cohort = isNewUser ? 'new' : 'returning';
    clarityService.setUserContext(userId, subscriptionStatus, cohort);
  }

  // Track key B2C events
  trackFirstPhotoUpload() {
    clarityService.trackMilestone('first_photo_upload');
    this.track('first_photo_upload');
  }

  trackPaywallShown(trigger: string) {
    this.track('paywall_shown', { trigger });
  }

  trackShareAction(contentType: string) {
    this.track('share_action', { content_type: contentType });
    clarityService.trackMilestone('first_share');
  }

  trackAppReview(triggered: boolean) {
    this.track('app_review_prompt', { triggered: triggered ? 'true' : 'false' });
  }

  // Screen tracking with Clarity integration
  trackScreenView(screenName: string, properties?: Record<string, any>) {
    clarityService.setCurrentScreenName(screenName);
    this.track(`screen_${screenName}`, properties);
  }

  // Tile usage tracking
  trackTileUsage(params: {
    category: 'outfit' | 'background' | 'memorial' | 'popular' | 'feature' | 'style';
    tileName: string;
    tileId: string;
    functionType?: string;
    styleKey?: string;
    customPrompt?: string;
    stage: 'selected' | 'started' | 'completed' | 'failed';
    success?: boolean;
    processingTime?: number;
  }) {
    const { category, tileName, tileId, functionType, styleKey, customPrompt, stage, success, processingTime } = params;
    
    // Track in Clarity based on stage
    switch (stage) {
      case 'selected':
        clarityService.trackTileSelected(category, tileName, tileId, {
          function_type: functionType || '',
          style_key: styleKey || '',
          has_custom_prompt: customPrompt ? 'true' : 'false'
        });
        break;
      
      case 'started':
        clarityService.trackTileStarted(category, tileName, tileId);
        break;
      
      case 'completed':
      case 'failed':
        clarityService.trackTileCompleted(
          category, 
          tileName, 
          tileId, 
          success ?? (stage === 'completed'),
          processingTime
        );
        break;
    }
    
    // Also track as general event
    this.track(`tile_${stage}`, {
      category,
      tile_name: tileName,
      tile_id: tileId,
      function_type: functionType,
      style_key: styleKey,
      success: success,
      processing_time: processingTime
    });
    
    if (__DEV__) {
      console.log(`📊 Tile Usage: ${tileName} (${category}) - ${stage}`);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();