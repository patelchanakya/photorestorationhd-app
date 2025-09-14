import React from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { OnboardingV4Provider, useOnboardingV4Context } from '@/contexts/OnboardingV4Context';
import { useOnboardingV4Analytics } from '@/hooks/useOnboardingV4Analytics';
import { permissionsService } from '@/services/permissions';
import { presentPaywall } from '@/services/revenuecat';
import { useQuickEditStore } from '@/store/quickEditStore';
import { restorationService } from '@/services/supabase';

// V4 Screen Components
import { WelcomeScreenV4 } from '@/components/OnboardingV4/WelcomeScreen';
import { IntentCaptureScreen } from '@/components/OnboardingV4/IntentCaptureScreen';
import { CapabilityDemoScreen } from '@/components/OnboardingV4/CapabilityDemoScreen';
import { ShowcaseBackgroundsScreen } from '@/components/OnboardingV4/ShowcaseBackgroundsScreen';
import { ShowcaseOutfitsScreen } from '@/components/OnboardingV4/ShowcaseOutfitsScreen';
import { ShowcaseMemorialScreen } from '@/components/OnboardingV4/ShowcaseMemorialScreen';
import { ProcessingScreen } from '@/components/OnboardingV4/ProcessingScreen';
import { ResultConversionScreen } from '@/components/OnboardingV4/ResultConversionScreen';

// Intent options for user selection - photo restoration focused with "Just Exploring" option
const INTENT_OPTIONS = [
  { 
    id: 'fix-old-photos', 
    label: 'Fix Old Family Photos', 
    icon: '📸', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/family-photos.mp4'),
    image: require('../assets/images/teared.png'),
    functionType: 'restore_repair' as const 
  },
  {
    id: 'repair-torn',
    label: 'Repair Torn & Ripped Photos',
    icon: '📄',
    demoImages: [],
    video: require('../assets/videos/onboarding/torn-photos.mp4'),
    image: require('../assets/images/teared.png'),
    functionType: 'nano_banana' as const
  },
  { 
    id: 'colorize-bw', 
    label: 'Colorize Black & White', 
    icon: '🎨', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/color-images.mp4'),
    image: require('../assets/images/popular/colorize/pop-1.png'),
    functionType: 'colorize' as const 
  },
  {
    id: 'remove-water-damage',
    label: 'Remove Water Damage',
    icon: '💧',
    demoImages: [],
    video: require('../assets/videos/repair.mp4'),
    image: require('../assets/images/popular/stain/pop-7.png'),
    functionType: 'nano_banana' as const
  },
  { 
    id: 'sharpen-faces', 
    label: 'Clear Up Blurry Faces', 
    icon: '🔍', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/blur-photo.mp4'),
    image: require('../assets/images/popular/enhance/pop-3.png'),
    functionType: 'unblur' as const 
  },
  { 
    id: 'remove-scratches', 
    label: 'Remove Scratches & Marks', 
    icon: '✨', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/descratch-photo.mp4'),
    image: require('../assets/images/popular/descratch/pop-2.png'),
    functionType: 'descratch' as const 
  },
  { 
    id: 'brighten-dark', 
    label: 'Brighten Dark Photos', 
    icon: '☀️', 
    demoImages: [], 
    video: require('../assets/videos/onboarding/brighten-photo.mp4'),
    image: require('../assets/images/popular/brighten/pop-4.png'),
    functionType: 'enlighten' as const 
  },
  {
    id: 'just-explore',
    label: 'Just Exploring the App',
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
    navigateToStep('intent');
  };


  const handleIntentSelection = async (intentId: string) => {
    const selectedOption = INTENT_OPTIONS.find(opt => opt.id === intentId);
    console.log('🎯 [ONBOARDING-V4] Intent selected:', {
      intentId,
      functionType: selectedOption?.functionType,
      label: selectedOption?.label
    });

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

  const handleDemoContinue = async () => {
    await trackStepCompleted(4, 'demo');
    
    // After demo video, start photo selection and processing
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const photo = result.assets[0];
        const photoData = {
          uri: photo.uri,
          width: photo.width || 0,
          height: photo.height || 0
        };
        
        await selectPhoto(photoData);
        await trackPhotoSelected({
          source: 'gallery',
          width: photoData.width,
          height: photoData.height
        });
        
        // Start photo processing
        navigateToStep('processing');
      } else {
        // User cancelled photo selection, go to showcases
        navigateToStep('showcase1');
      }
    } catch (error) {
      console.error('Photo selection failed:', error);
      // On error, continue to showcases
      navigateToStep('showcase1');
    }
  };


  const handleShowcase1Continue = async () => {
    await trackStepCompleted(6, 'showcase1');
    navigateToStep('showcase2');
  };

  const handleShowcase2Continue = async () => {
    await trackStepCompleted(7, 'showcase2');
    navigateToStep('showcase3');
  };

  const handleShowcase3Continue = async () => {
    await trackStepCompleted(8, 'showcase3');
    await handleNavigateToExploreWithTour();
  };

  const handleShowcaseSkip = async () => {
    const stepNum = currentStep === 'showcase1' ? 6 : currentStep === 'showcase2' ? 7 : 8;
    await trackStepCompleted(stepNum, currentStep, { skipped: true });
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
      
      // Always continue to showcases after paywall (purchased or not)
      navigateToStep('showcase1');
    } catch (error) {
      console.error('Trial flow error:', error);
      navigateToStep('showcase1');
    }
  };

  const handleMaybeLater = async () => {
    await trackStepCompleted(7, 'result', { conversion: 'declined' });
    navigateToStep('showcase1');
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
        
        case 'processing':
          const selectedIntentForProcessing = INTENT_OPTIONS.find(opt => opt.id === onboardingState.selectedIntent);
          console.log('🎯 [ONBOARDING-V4] ProcessingScreen props:', {
            intent: onboardingState.selectedIntent,
            functionType: selectedIntentForProcessing?.functionType,
            hasPhoto: !!onboardingState.selectedPhoto,
            photoUri: onboardingState.selectedPhoto?.uri
          });
          return (
            <ProcessingScreen
              photo={onboardingState.selectedPhoto}
              intent={onboardingState.selectedIntent}
              functionType={selectedIntentForProcessing?.functionType || null}
              onComplete={handleProcessingComplete}
              onError={(error) => handleError(error, 'processing')}
            />
          );
        
        case 'result':
          return (
            <ResultConversionScreen
              beforePhoto={onboardingState.selectedPhoto}
              afterPhoto={onboardingState.processingResult}
              onStartTrial={handleTrialSelection}
              onMaybeLater={handleMaybeLater}
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