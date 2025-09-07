import { CommunityScreen } from '@/components/Onboarding/CommunityScreen';
import { FeaturePreviewScreen } from '@/components/Onboarding/FeaturePreviewScreen';
import { FeatureSelectionScreen } from '@/components/Onboarding/FeatureSelectionScreen';
import { PermissionsScreen } from '@/components/Onboarding/PermissionsScreen';
import { SetupAnimationScreen } from '@/components/Onboarding/SetupAnimationScreen';
import { WelcomeScreen } from '@/components/Onboarding/WelcomeScreen';
import { OnboardingProvider, useOnboardingContext } from '@/contexts/OnboardingContext';
import { useOnboardingTracking } from '@/hooks/useOnboardingTracking';
import { onboardingTrackingService } from '@/services/onboardingTracking';
import { permissionsService } from '@/services/permissions';
import { presentPaywall } from '@/services/revenuecat';
import { useQuickEditStore } from '@/store/quickEditStore';
import { ONBOARDING_FEATURES } from '@/utils/onboarding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React from 'react';

const FEATURE_MODE_MAP: Record<string, string> = {
  // Special Options
  'custom_prompt': 'custom',
  'none_above': 'skip',
  
  // Popular Creative Features
  'clear_skin': 'custom',
  'add_smile': 'custom',
  'fix_hair': 'custom', 
  'make_younger': 'custom',
  'add_wings': 'custom',
  'add_halo': 'custom',
  'make_slimmer': 'custom',
  
  // Main Features
  'repair': 'repair',
  'water_stain_damage': 'water_damage',
  'restore_repair': 'restore_repair',
  'professional_outfit': 'outfit',
  'blur_background': 'background',
  
  // Core Repair & Enhance
  'fix_old_damaged': 'restoration',
  'add_color_bw': 'colorize',
  'unblur_sharpen': 'unblur',
  'brighten_photos': 'enlighten',
  
  // Popular Templates
  'beach_background': 'background'
};

// Prompts for popular creative features
const FEATURE_PROMPTS: Record<string, string> = {
  'clear_skin': "Remove acne, blemishes, and skin imperfections while keeping natural skin texture, tone, and lighting unchanged.",
  'add_smile': "Add a natural, authentic smile while preserving facial identity and features.",
  'fix_hair': "Clean up messy or stray hairs while preserving natural hair texture, style, volume, and keeping hair in place without altering its position on the face.",
  'make_younger': "Make the subject look a bit younger while keeping their identity, facial features, and natural expression unchanged.",
  'add_wings': "Add realistic wings that match pose, background, and lighting.",
  'add_halo': "Add a subtle glowing halo above the subject's head.",
  'make_slimmer': "Reduce visible body and facial fat while keeping natural proportions, pose, and facial identity intact. Make changes realistic and balanced without distorting the subject.",
};

// Inner component that uses the context
function OnboardingFlow() {
  if (__DEV__) {
    console.log('🔥 [ONBOARDING-FLOW] Component mounting...');
  }

  const router = useRouter();
  
  if (__DEV__) {
    console.log('🔥 [ONBOARDING-FLOW] Getting context...');
  }
  
  let contextValue;
  try {
    contextValue = useOnboardingContext();
    if (__DEV__) {
      console.log('🔥 [ONBOARDING-FLOW] Context retrieved successfully');
      console.log('🔥 [ONBOARDING-FLOW] Current screen:', contextValue.currentScreen);
    }
  } catch (error) {
    if (__DEV__) {
      console.error('🔥 [ONBOARDING-FLOW] ERROR getting context:', error);
    }
    throw error;
  }
  
  const { 
    currentScreen, 
    navigateToScreen, 
    onboardingState, 
    selectFeature, 
    pickPhoto, 
    setCustomPrompt,
    completeOnboarding
  } = contextValue;
  
  const {
    trackFeatureSelection,
    trackCustomPromptUsage,
    trackPhotoSelection,
    trackStepSkip,
    trackStepBack
  } = useOnboardingTracking();

  // Screen handlers - now much simpler using context
  const handleWelcomeContinue = () => {
    navigateToScreen('permissions');
  };

  const handlePermissionsContinue = () => {
    navigateToScreen('features');
  };

  const handleFeatureSelection = async (featureId: string, customPrompt?: string) => {
    // Store custom prompt in context if provided, or use predefined prompt for popular features
    const finalPrompt = customPrompt || FEATURE_PROMPTS[featureId];
    if (finalPrompt) {
      setCustomPrompt(finalPrompt);
      
      // Track custom prompt usage
      if (customPrompt) {
        await trackCustomPromptUsage(customPrompt);
      }
    }
    
    // Track feature selection
    await trackFeatureSelection(featureId, {
      hasCustomPrompt: !!customPrompt,
      promptSource: customPrompt ? 'user_input' : 'predefined'
    });
    
    // Context handles both state update and navigation
    await selectFeature(featureId);
  };

  const handlePreviewBack = async () => {
    await trackStepBack('preview', 'features');
    await navigateToScreen('features');
  };

  const handlePreviewSkip = async () => {
    await trackStepSkip('preview', 'user_chose_to_skip_photo');
    await navigateToScreen('community');
  };

  const handlePickPhoto = async (photo: { uri: string; width: number; height: number }) => {
    // Track photo selection
    await trackPhotoSelection({
      width: photo.width,
      height: photo.height,
      source: 'image_picker'
    });
    
    // Context handles both state update and navigation
    await pickPhoto(photo);
  };

  const handleCommunityContinue = () => {
    navigateToScreen('setup');
  };

  const handleSetupComplete = async () => {
    try {
      if (__DEV__) {
        console.log('🎯 Onboarding setup complete, presenting paywall...');
      }

      // Present paywall and track conversion
      const purchased = await presentPaywall();
      
      if (purchased) {
        await onboardingTrackingService.trackConversionEvent({
          conversionType: 'subscription',
          triggerFeature: onboardingState.selectedFeature || 'setup_complete'
        });
      }

      if (__DEV__) {
        console.log('💰 Paywall result:', purchased ? 'purchased' : 'dismissed');
      }

      // Navigate to explore regardless of purchase result
      await navigateToExplore();
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Paywall error:', error);
      }
      // Navigate to explore even if paywall fails
      await navigateToExplore();
    }
  };

  const navigateToExplore = async () => {
    try {
      // Clear any old predictions to prevent recovery system from opening them
      await AsyncStorage.removeItem('activePredictionId');
      
      // Mark onboarding as completed with tracking
      await completeOnboarding();

      // Ensure permissions service has the latest state for explore screen
      await permissionsService.refreshPermissionStates();

      if (__DEV__) {
        console.log('🚀 Navigating to explore screen...');
        console.log('📊 Onboarding state:', {
          selectedFeature: onboardingState.selectedFeature,
          hasPhoto: !!onboardingState.selectedPhoto,
          hasPickedPhoto: onboardingState.hasPickedPhoto,
        });
        console.log('📱 Permission state at navigation:', permissionsService.getPermissionState());
      }

      // Navigate to explore
      router.replace('/explore');

      // If user picked a photo, track first_edit conversion and open Quick Edit Sheet
      if (onboardingState.hasPickedPhoto && onboardingState.selectedPhoto && onboardingState.selectedFeature) {
        // Track first edit conversion
        await onboardingTrackingService.trackConversionEvent({
          conversionType: 'first_edit',
          triggerFeature: onboardingState.selectedFeature
        });
        const mode = FEATURE_MODE_MAP[onboardingState.selectedFeature] || 'restoration';
        
        if (__DEV__) {
          console.log('📱 Opening Quick Edit Sheet with:', {
            photo: onboardingState.selectedPhoto.uri,
            mode: mode,
          });
        }

        // Small delay to ensure explore screen is loaded
        setTimeout(() => {
          // Get the feature to extract styleKey if available
          const feature = ONBOARDING_FEATURES.find(f => f.id === onboardingState.selectedFeature);
          const styleKey = feature && 'styleKey' in feature ? feature.styleKey : undefined;

          useQuickEditStore.getState().openWithImage({
            functionType: mode as any,
            imageUri: onboardingState.selectedPhoto!.uri,
            styleKey,
            styleName: onboardingState.selectedFeature === 'custom_prompt' ? 'Photo Magic' : feature?.name,
            customPrompt: onboardingState.customPrompt || undefined
          });
        }, 500);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Navigation error:', error);
      }
      // Fallback to explore screen
      router.replace('/explore');
    }
  };

  // No more useEffect needed - context handles state completely

  // Render current screen
  const renderCurrentScreen = () => {
    if (__DEV__) {
      console.log('🔥 [ONBOARDING-FLOW] renderCurrentScreen called');
      console.log('🔥 [ONBOARDING-FLOW] currentScreen:', currentScreen);
    }
    
    switch (currentScreen) {
      case 'welcome':
        if (__DEV__) {
          console.log('🔥 [ONBOARDING-FLOW] Rendering WelcomeScreen');
        }
        return <WelcomeScreen onContinue={handleWelcomeContinue} />;
      
      case 'permissions':
        return <PermissionsScreen onContinue={handlePermissionsContinue} />;
      
      case 'features':
        return <FeatureSelectionScreen onContinue={handleFeatureSelection} />;
      
      case 'preview':
        if (!onboardingState.selectedFeature) {
          // Fallback if no feature selected
          navigateToScreen('features');
          return null;
        }
        return (
          <FeaturePreviewScreen
            selectedFeatureId={onboardingState.selectedFeature}
            onBack={handlePreviewBack}
            onSkip={handlePreviewSkip}
            onPickPhoto={handlePickPhoto}
          />
        );
      
      case 'community':
        return <CommunityScreen onContinue={handleCommunityContinue} />;
      
      case 'setup':
        return <SetupAnimationScreen onComplete={handleSetupComplete} />;
      
      default:
        if (__DEV__) {
          console.log('🔥 [ONBOARDING-FLOW] Default case - rendering WelcomeScreen');
        }
        return <WelcomeScreen onContinue={handleWelcomeContinue} />;
    }
  };

  if (__DEV__) {
    console.log('🔥 [ONBOARDING-FLOW] About to call renderCurrentScreen');
  }
  
  const screenComponent = renderCurrentScreen();
  
  if (__DEV__) {
    console.log('🔥 [ONBOARDING-FLOW] Screen component generated:', !!screenComponent);
  }

  return screenComponent;
}

// Main component with provider wrapper
export default function OnboardingV3() {
  if (__DEV__) {
    console.log('🔥 [ONBOARDING-V3] Component mounting...');
  }
  
  try {
    if (__DEV__) {
      console.log('🔥 [ONBOARDING-V3] About to render OnboardingProvider');
    }
    
    return (
      <OnboardingProvider initialScreen="welcome">
        <OnboardingFlow />
      </OnboardingProvider>
    );
  } catch (error) {
    if (__DEV__) {
      console.error('🔥 [ONBOARDING-V3] ERROR rendering:', error);
    }
    throw error;
  }
}