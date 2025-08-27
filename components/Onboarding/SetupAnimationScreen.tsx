import React from 'react';
import { View, Text } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withDelay,
  withTiming,
  withSequence,
  runOnJS 
} from 'react-native-reanimated';
import { OnboardingContainer } from './shared/OnboardingContainer';

interface SetupAnimationScreenProps {
  onComplete: () => void;
}

interface SetupStep {
  id: string;
  title: string;
  icon: string;
  emoji: string;
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: 'profile',
    title: 'Creating your profile',
    icon: 'person.circle',
    emoji: '✨'
  },
  {
    id: 'models',
    title: 'Preparing AI models',
    icon: 'brain.head.profile',
    emoji: '🎨'
  },
  {
    id: 'workspace',
    title: 'Optimizing your workspace',
    icon: 'slider.horizontal.3',
    emoji: '📸'
  }
];

export function SetupAnimationScreen({ onComplete }: SetupAnimationScreenProps) {
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
    
    const processNextStep = () => {
      if (stepIndex < SETUP_STEPS.length) {
        setCurrentStep(stepIndex);
        stepIndex++;
        // Each step takes 1.5 seconds
        setTimeout(processNextStep, 1500);
      } else {
        // All steps complete, show celebration
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

    // Auto-advance after celebration
    setTimeout(() => {
      onComplete();
    }, 2000);
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
                fontSize: 28, 
                fontWeight: 'bold', 
                color: '#FFFFFF',
                textAlign: 'center',
                marginBottom: 8,
              }}>
                Setting up your creative studio...
              </Text>
              <Text style={{ 
                fontSize: 16, 
                color: '#9CA3AF',
                textAlign: 'center',
              }}>
                This will only take a moment
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
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
              borderWidth: 3,
              borderColor: '#10B981',
            }}>
              <IconSymbol name="checkmark.circle.fill" size={60} color="#10B981" />
            </View>

            <Text style={{ 
              fontSize: 36, 
              fontWeight: 'bold', 
              color: '#FFFFFF',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              You're all set! 🎉
            </Text>
            
            <Text style={{ 
              fontSize: 18, 
              color: '#9CA3AF',
              textAlign: 'center',
              lineHeight: 24,
            }}>
              Ready to start creating magic with your photos
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
  const containerOpacity = useSharedValue(isUpcoming ? 0.3 : 1);
  const iconScale = useSharedValue(1);
  const checkmarkOpacity = useSharedValue(0);
  const checkmarkScale = useSharedValue(0.5);
  const loadingRotation = useSharedValue(0);

  React.useEffect(() => {
    if (isActive) {
      containerOpacity.value = withTiming(1, { duration: 300 });
      // Gentle loading rotation
      loadingRotation.value = withSequence(
        withTiming(360, { duration: 1000 }),
        withTiming(720, { duration: 1000 }),
        withTiming(1080, { duration: 1000 })
      );
    } else if (isCompleted) {
      containerOpacity.value = withTiming(1, { duration: 300 });
      // Show checkmark
      checkmarkOpacity.value = withTiming(1, { duration: 300 });
      checkmarkScale.value = withSequence(
        withSpring(1.2, { damping: 10, stiffness: 300 }),
        withSpring(1, { damping: 15, stiffness: 250 })
      );
    } else if (isUpcoming) {
      containerOpacity.value = withTiming(0.4, { duration: 300 });
    }
  }, [isActive, isCompleted, isUpcoming]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: isActive ? `${loadingRotation.value}deg` : '0deg' }
    ],
  }));

  const checkmarkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: checkmarkOpacity.value,
    transform: [{ scale: checkmarkScale.value }],
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
          : 'rgba(255, 255, 255, 0.05)',
        borderWidth: isActive ? 1 : 0,
        borderColor: 'rgba(250, 204, 21, 0.3)',
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
        {/* Loading/Emoji icon */}
        <Animated.View style={iconAnimatedStyle}>
          <Text style={{ fontSize: 18 }}>
            {step.emoji}
          </Text>
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
              backgroundColor: 'rgba(16, 185, 129, 0.9)',
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
          fontWeight: '600', 
          color: isCompleted 
            ? '#10B981' 
            : isActive 
              ? '#FACC15' 
              : '#9CA3AF',
        }}>
          {step.title}
        </Text>
      </View>

      {/* Status indicator */}
      <View style={{ marginLeft: 8 }}>
        {isActive && (
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#FACC15',
          }} />
        )}
        {isCompleted && (
          <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
        )}
      </View>
    </Animated.View>
  );
}