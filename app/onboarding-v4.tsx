import React from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { OnboardingV4Provider, useOnboardingV4Context } from '@/contexts/OnboardingV4Context';
import { useOnboardingV4Analytics } from '@/hooks/useOnboardingV4Analytics';
import { permissionsService } from '@/services/permissions';
import { presentPaywall } from '@/services/revenuecat';
import { useQuickEditStore } from '@/store/quickEditStore';
import { restorationService } from '@/services/restoration';

// V4 Screen Components
import { WelcomeScreenV4 } from '@/components/OnboardingV4/WelcomeScreen';
import { PermissionsScreenV4 } from '@/components/OnboardingV4/PermissionsScreen';
import { IntentCaptureScreen } from '@/components/OnboardingV4/IntentCaptureScreen';
import { CapabilityDemoScreen } from '@/components/OnboardingV4/CapabilityDemoScreen';
import { ProcessingScreen } from '@/components/OnboardingV4/ProcessingScreen';
import { ResultConversionScreen } from '@/components/OnboardingV4/ResultConversionScreen';

// Intent options for user selection
const INTENT_OPTIONS = [
  { id: 'fix_old_family', label: 'Fix old family photos', icon: '👨‍👩‍👧‍👦', demoImages: ['family_before.jpg', 'family_after.jpg'] },
  { id: 'remove_scratches', label: 'Remove scratches', icon: '🔧', demoImages: ['scratch_before.jpg', 'scratch_after.jpg'] },
  { id: 'restore_grandparents', label: "Restore grandparents'", icon: '👴👵', demoImages: ['grandparents_before.jpg', 'grandparents_after.jpg'] },
  { id: 'fix_water_damage', label: 'Fix water damage', icon: '💧', demoImages: ['water_before.jpg', 'water_after.jpg'] },
  { id: 'colorize_memories', label: 'Colorize memories', icon: '🎨', demoImages: ['bw_before.jpg', 'colorized_after.jpg'] },
  { id: 'repair_torn', label: 'Repair torn photos', icon: '🩹', demoImages: ['torn_before.jpg', 'torn_after.jpg'] }
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
    navigateToStep('demo');
  };

  const handleDemoContinue = async () => {
    await trackStepCompleted(4, 'demo');
    
    // Open image picker for photo selection (Screen 5)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: undefined,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const photo = result.assets[0];
        await selectPhoto({
          uri: photo.uri,
          width: photo.width,
          height: photo.height
        });
        
        await trackPhotoSelected({
          source: 'gallery',
          width: photo.width,
          height: photo.height
        });

        // Navigate to processing screen
        navigateToStep('processing');
      } else {
        // User cancelled photo selection - skip to demo mode
        navigateToStep('processing');
      }
    } catch (error) {
      console.error('Photo selection failed:', error);
      // Continue to processing with demo mode
      navigateToStep('processing');
    }
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
          const mode = getEditModeFromIntent(onboardingState.selectedIntent!);
          useQuickEditStore.getState().openWithImage({
            functionType: mode as any,
            imageUri: onboardingState.selectedPhoto!.uri,
            styleName: INTENT_OPTIONS.find(opt => opt.id === onboardingState.selectedIntent)?.label || 'Photo Restoration'
          });
        }, 500);
      }
    } catch (error) {
      console.error('Navigation to explore failed:', error);
      router.replace('/explore');
    }
  };

  const getEditModeFromIntent = (intentId: string): string => {
    const intentModeMap: Record<string, string> = {
      'fix_old_family': 'restoration',
      'remove_scratches': 'restoration', 
      'restore_grandparents': 'restoration',
      'fix_water_damage': 'restoration',
      'colorize_memories': 'colorize',
      'repair_torn': 'restoration'
    };
    return intentModeMap[intentId] || 'restoration';
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
        
        case 'processing':
          return (
            <ProcessingScreen
              photo={onboardingState.selectedPhoto}
              intent={onboardingState.selectedIntent}
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