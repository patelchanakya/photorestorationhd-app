import React from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { OnboardingV4Provider, useOnboardingV4Context } from '@/contexts/OnboardingV4Context';
import { useOnboardingV4Analytics } from '@/hooks/useOnboardingV4Analytics';
import { permissionsService } from '@/services/permissions';
import { presentPaywall } from '@/services/revenuecat';
import { useQuickEditStore } from '@/store/quickEditStore';
import { restorationService } from '@/services/supabase';

// V4 Screen Components
import { WelcomeScreenV4 } from '@/components/OnboardingV4/WelcomeScreen';
import { PermissionsScreenV4 } from '@/components/OnboardingV4/PermissionsScreen';
import { IntentCaptureScreen } from '@/components/OnboardingV4/IntentCaptureScreen';
import { CapabilityDemoScreen } from '@/components/OnboardingV4/CapabilityDemoScreen';
import { ShowcaseBackgroundsScreen } from '@/components/OnboardingV4/ShowcaseBackgroundsScreen';
import { ShowcaseOutfitsScreen } from '@/components/OnboardingV4/ShowcaseOutfitsScreen';
import { ShowcaseMemorialScreen } from '@/components/OnboardingV4/ShowcaseMemorialScreen';

// Intent options for user selection - photo restoration focused with "Just Explore" option
const INTENT_OPTIONS = [
  { 
    id: 'fix-old-photos', 
    label: 'Fix Old Family Photos', 
    icon: '📸', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/family-photos.mp4'),
    image: require('../assets/images/teared.png'),
    functionType: 'restore_repair' 
  },
  { 
    id: 'repair-torn', 
    label: 'Repair Torn & Ripped Photos', 
    icon: '📄', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/torn-photos.mp4'),
    image: require('../assets/images/teared.png'),
    functionType: 'repair',
    customPrompt: 'Repair tears and rips in old photos'
  },
  { 
    id: 'colorize-bw', 
    label: 'Colorize Black & White', 
    icon: '🎨', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/color-images.mp4'),
    image: require('../assets/images/popular/colorize/pop-1.png'),
    functionType: 'colorize' 
  },
  { 
    id: 'remove-water-damage', 
    label: 'Remove Water Damage', 
    icon: '💧', 
    demoImages: [], 
    video: require('../assets/videos/repair.mp4'),
    image: require('../assets/images/popular/stain/pop-7.png'),
    functionType: 'water_damage' 
  },
  { 
    id: 'sharpen-faces', 
    label: 'Clear Up Blurry Faces', 
    icon: '🔍', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/blur-photo.mp4'),
    image: require('../assets/images/popular/enhance/pop-3.png'),
    functionType: 'unblur' 
  },
  { 
    id: 'remove-scratches', 
    label: 'Remove Scratches & Marks', 
    icon: '✨', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/descratch-photo.mp4'),
    image: require('../assets/images/popular/descratch/pop-2.png'),
    functionType: 'descratch' 
  },
  { 
    id: 'brighten-dark', 
    label: 'Brighten Dark Photos', 
    icon: '☀️', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/brighten-photo.mp4'),
    image: require('../assets/images/popular/brighten/pop-4.png'),
    functionType: 'enlighten' 
  },
  { 
    id: 'just-explore', 
    label: 'Just Explore the App', 
    icon: '✨', 
    demoImages: [], 
    video: require('../assets/videos/welcome.mp4'),
    image: require('../assets/images/popular/enhance/pop-3.png'),
    functionType: null 
  }
];

function OnboardingV4Flow() {
  const router = useRouter();
  const {
    currentStep,
    onboardingState,
    navigateToStep,
    selectIntent,
    selectPhoto,
    setProcessingResult,
    setTrialOffered,
    completeOnboarding
  } = useOnboardingV4Context();

  const {
    trackOnboardingStarted,
    trackStepCompleted,
    trackIntentSelected,
    trackPhotoSelected,
    trackRestorationCompleted,
    trackTrialShown,
    trackTrialStarted,
    trackOnboardingAbandoned,
    trackOnboardingCompleted
  } = useOnboardingV4Analytics();

  // Initialize analytics on mount
  React.useEffect(() => {
    trackOnboardingStarted();
  }, []);

  const handleWelcomeContinue = async () => {
    await trackStepCompleted(1, 'welcome');
    navigateToStep('permissions');
  };

  const handlePermissionsContinue = async () => {
    try {
      // Request photo library permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      await trackStepCompleted(2, 'permissions', { 
        permission_granted: status === 'granted' 
      });
      
      navigateToStep('intent');
    } catch (error) {
      console.error('Permission request failed:', error);
      // Continue anyway - we'll handle permission denial later
      navigateToStep('intent');
    }
  };

  const handleIntentSelection = async (intentId: string) => {
    await selectIntent(intentId);
    await trackIntentSelected(intentId);
    await trackStepCompleted(3, 'intent', { selected_intent: intentId });
    
    // Special handling for "just-explore" - skip demo/restoration and go straight to showcases
    if (intentId === 'just-explore') {
      navigateToStep('showcase1');
    } else {
      navigateToStep('demo');
    }
  };

  const handleDemoContinue = async (photo?: { uri: string; width: number; height: number }) => {
    await trackStepCompleted(4, 'demo');
    
    if (photo) {
      // User selected a photo and saved result
      await selectPhoto(photo);
      
      await trackPhotoSelected({
        source: 'gallery',
        width: photo.width,
        height: photo.height
      });
    }

    // Navigate directly to showcase screens (skip processing/result)
    navigateToStep('showcase1');
  };

  const handleShowcase1Continue = async () => {
    await trackStepCompleted(5, 'showcase1');
    navigateToStep('showcase2');
  };

  const handleShowcase2Continue = async () => {
    await trackStepCompleted(6, 'showcase2');
    navigateToStep('showcase3');
  };

  const handleShowcase3Continue = async () => {
    await trackStepCompleted(7, 'showcase3');
    await handleNavigateToExploreWithTour();
  };

  const handleShowcaseSkip = async () => {
    await trackStepCompleted(currentStep === 'showcase1' ? 5 : currentStep === 'showcase2' ? 6 : 7, currentStep, { skipped: true });
    await handleNavigateToExploreWithTour();
  };

  const handleProcessingComplete = async (result: { uri: string; processingTime: number }) => {
    await setProcessingResult(result);
    await trackRestorationCompleted(result.processingTime);
    await trackStepCompleted(6, 'processing', { 
      processing_time: result.processingTime,
      has_result: true 
    });
    navigateToStep('result');
  };

  const handleTrialSelection = async () => {
    try {
      await trackTrialShown();
      setTrialOffered(true);
      
      const purchased = await presentPaywall();
      
      if (purchased) {
        await trackTrialStarted();
      }
      
      // Navigate to explore regardless of purchase
      await handleNavigateToExplore();
    } catch (error) {
      console.error('Trial flow error:', error);
      await handleNavigateToExplore();
    }
  };

  const handleMaybeLater = async () => {
    await trackStepCompleted(7, 'result', { conversion: 'declined' });
    await handleNavigateToExploreWithTour();
  };

  const handleNavigateToExploreWithTour = async () => {
    try {
      // Clear any existing prediction cache
      await AsyncStorage.removeItem('activePredictionId');
      
      // Mark onboarding as completed
      await completeOnboarding();
      await trackOnboardingCompleted({
        conversion_path: onboardingState.trialOffered ? 'trial' : 'free',
        completed_steps: 7, // No separate tour screen
        total_time: Date.now() - (onboardingState.startTime || 0)
      });
      
      // Ensure permissions are refreshed
      await permissionsService.refreshPermissionStates();
      
      // Navigate to explore with tour parameter
      router.replace('/explore?showTour=true');
      
      // If user has photo and intent, we'll handle this in explore screen
    } catch (error) {
      console.error('Navigation to explore with tour failed:', error);
      router.replace('/explore');
    }
  };

  const handleNavigateToExplore = async () => {
    try {
      // Clear any existing prediction cache
      await AsyncStorage.removeItem('activePredictionId');
      
      // Mark onboarding as completed
      await completeOnboarding();
      await trackOnboardingCompleted({
        conversion_path: onboardingState.trialOffered ? 'trial' : 'free',
        completed_steps: currentStep === 'tour' ? 8 : 7,
        total_time: Date.now() - (onboardingState.startTime || 0)
      });
      
      // Ensure permissions are refreshed
      await permissionsService.refreshPermissionStates();
      
      // Navigate to explore
      router.replace('/explore');
      
      // If user has photo and intent, open Quick Edit Sheet
      if (onboardingState.selectedPhoto && onboardingState.selectedIntent) {
        setTimeout(() => {
          const selectedIntent = INTENT_OPTIONS.find(opt => opt.id === onboardingState.selectedIntent);
          const mode = selectedIntent?.functionType || 'restoration';
          useQuickEditStore.getState().openWithImage({
            functionType: mode as any,
            imageUri: onboardingState.selectedPhoto!.uri,
            styleName: selectedIntent?.label || 'Photo Restoration',
            customPrompt: selectedIntent?.customPrompt || null
          });
        }, 500);
      }
    } catch (error) {
      console.error('Navigation to explore failed:', error);
      router.replace('/explore');
    }
  };

  const getEditModeFromIntent = (intentId: string): string => {
    const selectedIntent = INTENT_OPTIONS.find(opt => opt.id === intentId);
    return selectedIntent?.functionType || 'restoration';
  };

  // Error boundary for graceful fallbacks
  const handleError = async (error: Error, step: string) => {
    console.error(`OnboardingV4 error at ${step}:`, error);
    await trackOnboardingAbandoned(step, error.message);
    
    // Handle different error scenarios
    if (step === 'processing') {
      // For processing errors, show a demo result and continue
      const mockResult = {
        uri: onboardingState.selectedPhoto?.uri || 'demo-result',
        processingTime: 3000
      };
      await setProcessingResult(mockResult);
      await trackRestorationCompleted(mockResult.processingTime);
      navigateToStep('result');
    } else {
      // For other errors, continue to explore
      await handleNavigateToExplore();
    }
  };

  // Render current step
  const renderCurrentStep = () => {
    try {
      switch (currentStep) {
        case 'welcome':
          return <WelcomeScreenV4 onContinue={handleWelcomeContinue} />;
        
        case 'permissions':
          return <PermissionsScreenV4 onContinue={handlePermissionsContinue} />;
        
        case 'intent':
          return (
            <IntentCaptureScreen 
              options={INTENT_OPTIONS}
              onSelect={handleIntentSelection}
            />
          );
        
        case 'demo':
          const selectedIntentOption = INTENT_OPTIONS.find(opt => opt.id === onboardingState.selectedIntent);
          return (
            <CapabilityDemoScreen
              intent={selectedIntentOption}
              onContinue={handleDemoContinue}
            />
          );
        
        case 'showcase1':
          return (
            <ShowcaseBackgroundsScreen
              onContinue={handleShowcase1Continue}
              onSkip={handleShowcaseSkip}
            />
          );
        
        case 'showcase2':
          return (
            <ShowcaseOutfitsScreen
              onContinue={handleShowcase2Continue}
              onSkip={handleShowcaseSkip}
            />
          );
        
        case 'showcase3':
          return (
            <ShowcaseMemorialScreen
              onContinue={handleShowcase3Continue}
              onSkip={handleShowcaseSkip}
            />
          );
        
        default:
          return <WelcomeScreenV4 onContinue={handleWelcomeContinue} />;
      }
    } catch (error) {
      handleError(error as Error, currentStep);
      return null;
    }
  };

  return renderCurrentStep();
}

export default function OnboardingV4() {
  return (
    <OnboardingV4Provider>
      <OnboardingV4Flow />
    </OnboardingV4Provider>
  );
}