import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { OnboardingContainer } from './shared/OnboardingContainer';

interface SetupAnimationScreenProps {
  onComplete: () => void;
}

interface SetupStep {
  id: string;
  title: string;
  icon: string;
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: 'profile',
    title: '', // Will be translated in component
    icon: 'person.circle'
  },
  {
    id: 'models',
    title: '', // Will be translated in component
    icon: 'brain.head.profile'
  },
  {
    id: 'workspace',
    title: '', // Will be translated in component
    icon: 'slider.horizontal.3'
  }
];

export function SetupAnimationScreen({ onComplete }: SetupAnimationScreenProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [allComplete, setAllComplete] = React.useState(false);

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const celebrationOpacity = useSharedValue(0);
  const celebrationScale = useSharedValue(0.5);

  React.useEffect(() => {
    // Title animation
    titleOpacity.value = withTiming(1, { duration: 500 });
    titleTranslateY.value = withSpring(0, { damping: 15, stiffness: 200 });

    // Start the setup sequence
    startSetupSequence();
  }, []);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const celebrationAnimatedStyle = useAnimatedStyle(() => ({
    opacity: celebrationOpacity.value,
    transform: [{ scale: celebrationScale.value }],
  }));

  const startSetupSequence = () => {
    let stepIndex = 0;
    const stepDurations = [2000, 1800, 2200]; // Varied times: 2s, 1.8s, 2.2s
    
    const processNextStep = () => {
      if (stepIndex < SETUP_STEPS.length) {
        setCurrentStep(stepIndex);
        const duration = stepDurations[stepIndex] || 2000;
        stepIndex++;
        // Each step takes varied time
        setTimeout(processNextStep, duration);
      } else if (stepIndex === SETUP_STEPS.length) {
        // Mark all steps as completed by setting currentStep beyond the last index
        setCurrentStep(SETUP_STEPS.length);
        stepIndex++;
        // Give time for the final checkmark animation to complete
        setTimeout(processNextStep, 1000);
      } else {
        // All animations complete, show celebration
        setAllComplete(true);
        showCelebration();
      }
    };

    // Start first step after small delay
    setTimeout(processNextStep, 500);
  };

  const showCelebration = () => {
    celebrationOpacity.value = withTiming(1, { duration: 600 });
    celebrationScale.value = withSequence(
      withSpring(1.2, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 250 })
    );

    // Auto-advance after celebration - extended duration to let users see the success state
    setTimeout(() => {
      onComplete();
    }, 2500);
  };

  return (
    <OnboardingContainer>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        {!allComplete ? (
          <>
            {/* Title */}
            <Animated.View style={[
              { alignItems: 'center', marginBottom: 60 }, 
              titleAnimatedStyle
            ]}>
              <Text style={{ 
                fontSize: 34, 
                fontFamily: 'Lexend-Bold', 
                color: '#FFFFFF',
                textAlign: 'center',
                marginBottom: 8,
              }}>
                {t('onboarding.setup.settingUp')}
              </Text>
              <Text style={{ 
                fontSize: 18, 
                color: '#9CA3AF',
                textAlign: 'center',
              }}>
                {t('onboarding.setup.wontTakeLong')}
              </Text>
            </Animated.View>

            {/* Setup Steps */}
            <View style={{ width: '100%', maxWidth: 320 }}>
              {SETUP_STEPS.map((step, index) => (
                <SetupStepItem
                  key={step.id}
                  step={step}
                  isActive={index === currentStep}
                  isCompleted={index < currentStep}
                  isUpcoming={index > currentStep}
                />
              ))}
            </View>
          </>
        ) : (
          /* Celebration Screen */
          <Animated.View style={[
            { alignItems: 'center' }, 
            celebrationAnimatedStyle
          ]}>
            <View style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
              borderWidth: 2,
              borderColor: '#10B981',
              shadowColor: '#10B981',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}>
              <IconSymbol name="checkmark.circle.fill" size={60} color="#10B981" />
            </View>

            <Text style={{ 
              fontSize: 36, 
              fontFamily: 'Lexend-Bold', 
              color: '#FFFFFF',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              {t('onboarding.setup.allSet')}
            </Text>
            
            <Text style={{ 
              fontSize: 18, 
              color: '#9CA3AF',
              textAlign: 'center',
              lineHeight: 24,
            }}>
              {t('onboarding.setup.readyToCreate')}
            </Text>
          </Animated.View>
        )}
      </View>
    </OnboardingContainer>
  );
}

interface SetupStepItemProps {
  step: SetupStep;
  isActive: boolean;
  isCompleted: boolean;
  isUpcoming: boolean;
}

function SetupStepItem({ step, isActive, isCompleted, isUpcoming }: SetupStepItemProps) {
  const { t } = useTranslation();
  const containerOpacity = useSharedValue(isUpcoming ? 0.3 : 1);
  const iconScale = useSharedValue(1);
  const checkmarkOpacity = useSharedValue(0);
  const checkmarkScale = useSharedValue(0.5);
  const loadingRotation = useSharedValue(0);
  const dotScale = useSharedValue(1);
  const dotOpacity = useSharedValue(1);

  const getTranslatedTitle = (stepId: string) => {
    switch (stepId) {
      case 'profile':
        return t('onboarding.setup.settingUpSpace');
      case 'models':
        return t('onboarding.setup.loadingSystems');
      case 'workspace':
        return t('onboarding.setup.preparingTools');
      default:
        return step.title;
    }
  };

  React.useEffect(() => {
    if (isActive) {
      containerOpacity.value = withTiming(1, { duration: 300 });
      // Gentle pulse animation instead of rotation
      iconScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
      // Pulsing dot animation
      dotScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
      dotOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    } else if (isCompleted) {
      containerOpacity.value = withTiming(1, { duration: 150 });
      // Show checkmark - faster animation
      checkmarkOpacity.value = withTiming(1, { duration: 150 });
      checkmarkScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 300 })
      );
    } else if (isUpcoming) {
      containerOpacity.value = withTiming(0.4, { duration: 300 });
    }
  }, [isActive, isCompleted, isUpcoming]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const checkmarkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: checkmarkOpacity.value,
    transform: [{ scale: checkmarkScale.value }],
  }));

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <Animated.View style={[
      {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 8,
        borderRadius: 16,
        backgroundColor: isActive 
          ? 'rgba(250, 204, 21, 0.1)' 
          : isCompleted
            ? 'rgba(16, 185, 129, 0.05)'
            : 'rgba(255, 255, 255, 0.03)',
        borderWidth: (isActive || isCompleted) ? 1 : 0,
        borderColor: isActive 
          ? 'rgba(250, 204, 21, 0.3)'
          : isCompleted 
            ? 'rgba(16, 185, 129, 0.3)'
            : 'transparent',
        shadowColor: isActive 
          ? '#FACC15'
          : isCompleted 
            ? '#10B981'
            : 'transparent',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: (isActive || isCompleted) ? 0.2 : 0,
        shadowRadius: 8,
        elevation: (isActive || isCompleted) ? 3 : 0,
      },
      containerAnimatedStyle
    ]}>
      {/* Icon/Status */}
      <View style={{ 
        width: 40, 
        height: 40, 
        borderRadius: 20,
        backgroundColor: isCompleted 
          ? 'rgba(16, 185, 129, 0.2)' 
          : isActive 
            ? 'rgba(250, 204, 21, 0.2)' 
            : 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center', 
        justifyContent: 'center',
        marginRight: 16,
        position: 'relative'
      }}>
          {/* Icon with enhanced styling */}
        <Animated.View style={iconAnimatedStyle}>
          <IconSymbol 
            name={step.icon as any} 
            size={22} 
            color={
              isCompleted 
                ? '#FFFFFF' // White when completed (will be covered by checkmark)
                : isActive 
                  ? '#FACC15'
                  : '#9CA3AF'
            }
          />
        </Animated.View>

        {/* Checkmark overlay */}
        {isCompleted && (
          <Animated.View style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#10B981',
              borderRadius: 20,
            },
            checkmarkAnimatedStyle
          ]}>
            <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
          </Animated.View>
        )}
      </View>
      
      {/* Title */}
      <View style={{ flex: 1 }}>
        <Text style={{ 
          fontSize: 16, 
          fontFamily: 'Lexend-SemiBold', 
          color: isCompleted 
            ? '#10B981' 
            : isActive 
              ? '#FACC15' 
              : '#9CA3AF',
        }}>
          {getTranslatedTitle(step.id)}
        </Text>
      </View>

      {/* Status indicator */}
      <View style={{ 
        marginLeft: 8,
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isActive && (
          <Animated.View style={[
            {
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#FACC15',
            },
            dotAnimatedStyle
          ]} />
        )}
        {isCompleted && (
          <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
        )}
      </View>
    </Animated.View>
  );
}