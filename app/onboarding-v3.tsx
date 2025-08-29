import React from 'react';
import { useRouter } from 'expo-router';
import { presentPaywall } from '@/services/revenuecat';
import { useQuickEditStore } from '@/store/quickEditStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingProvider, useOnboardingContext } from '@/contexts/OnboardingContext';
import { ONBOARDING_FEATURES } from '@/utils/onboarding';
import { WelcomeScreen } from '@/components/Onboarding/WelcomeScreen';
import { PermissionsScreen } from '@/components/Onboarding/PermissionsScreen';
import { FeatureSelectionScreen } from '@/components/Onboarding/FeatureSelectionScreen';
import { FeaturePreviewScreen } from '@/components/Onboarding/FeaturePreviewScreen';
import { CommunityScreen } from '@/components/Onboarding/CommunityScreen';
import { SetupAnimationScreen } from '@/components/Onboarding/SetupAnimationScreen';

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
  'recreate': 'restoration',
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
  'make_slimmer': "Reduce visible body and facial fat while keeping natural proportions, pose, and facial identity intact. Make changes realistic and balanced without distorting the subject."
};

// Inner component that uses the context
function OnboardingFlow() {
  const router = useRouter();
  const { currentScreen, navigateToScreen, onboardingState, selectFeature, pickPhoto, setCustomPrompt } = useOnboardingContext();

  // Screen handlers - now much simpler using context
  const handleWelcomeContinue = () => {
    navigateToScreen('permissions');
  };

  const handlePermissionsContinue = () => {
    navigateToScreen('features');
  };

  const handleFeatureSelection = (featureId: string, customPrompt?: string) => {
    // Store custom prompt in context if provided, or use predefined prompt for popular features
    const finalPrompt = customPrompt || FEATURE_PROMPTS[featureId];
    if (finalPrompt) {
      setCustomPrompt(finalPrompt);
    }
    
    // Context handles both state update and navigation
    selectFeature(featureId);
  };

  const handlePreviewBack = () => {
    navigateToScreen('features');
  };

  const handlePreviewSkip = () => {
    navigateToScreen('community');
  };

  const handlePickPhoto = (photo: { uri: string; width: number; height: number }) => {
    // Context handles both state update and navigation
    pickPhoto(photo);
  };

  const handleCommunityContinue = () => {
    navigateToScreen('setup');
  };

  const handleSetupComplete = async () => {
    try {
      if (__DEV__) {
        console.log('🎯 Onboarding setup complete, presenting paywall...');
      }

      // Present paywall
      const purchased = await presentPaywall();

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
      
      // Mark onboarding as completed (you can add this later with backend integration)
      // await onboardingUtils.completeOnboarding();

      if (__DEV__) {
        console.log('🚀 Navigating to explore screen...');
        console.log('📊 Onboarding state:', {
          selectedFeature: onboardingState.selectedFeature,
          hasPhoto: !!onboardingState.selectedPhoto,
          hasPickedPhoto: onboardingState.hasPickedPhoto,
        });
      }

      // Navigate to explore
      router.replace('/explore');

      // If user picked a photo, open Quick Edit Sheet with their photo and selected mode
      if (onboardingState.hasPickedPhoto && onboardingState.selectedPhoto && onboardingState.selectedFeature) {
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
    switch (currentScreen) {
      case 'welcome':
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
        return <WelcomeScreen onContinue={handleWelcomeContinue} />;
    }
  };

  return renderCurrentScreen();
}

// Main component with provider wrapper
export default function OnboardingV3() {
  return (
    <OnboardingProvider initialScreen="welcome">
      <OnboardingFlow />
    </OnboardingProvider>
  );
}