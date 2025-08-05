import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CircularProgress } from './CircularProgress';
import { useRestorationScreenStore } from '@/store/restorationScreenStore';

interface ProcessingScreenProps {
  functionType: 'restoration' | 'unblur' | 'colorize';
  isProcessing: boolean;
  isError?: boolean;
}

const ProcessingScreenComponent = ({ functionType, isProcessing, isError }: ProcessingScreenProps) => {
  const { processingProgress, setProcessingProgress, clearProcessingProgress } = useRestorationScreenStore();
  
  // Track haptic feedback milestones to avoid duplicates
  const hapticMilestones = useRef<Set<number>>(new Set());
  
  // Animation values for text
  const textOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.9);

  // Get mode-specific data
  const getModeData = () => {
    switch (functionType) {
      case 'unblur':
        return {
          icon: 'eye',
          title: 'Unblurring your photo...',
          description: 'Removing blur and sharpening details'
        };
      case 'colorize':
        return {
          icon: 'paintbrush',
          title: 'Colorizing your photo...',
          description: 'Adding vibrant colors to your image'
        };
      default:
        return {
          icon: 'wand.and.stars',
          title: 'Restoring your photo...',
          description: 'Enhancing quality and fixing imperfections'
        };
    }
  };

  const modeData = getModeData();

  // Clean up progress on unmount or error
  useEffect(() => {
    return () => {
      clearProcessingProgress();
    };
  }, [clearProcessingProgress]);

  // Haptic feedback at progress milestones
  useEffect(() => {
    const milestones = [25, 50, 75];
    
    // Check if we've crossed any new milestones
    milestones.forEach(milestone => {
      if (processingProgress >= milestone && !hapticMilestones.current.has(milestone)) {
        // Add milestone to completed set
        hapticMilestones.current.add(milestone);
        
        // Trigger subtle haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        console.log(`✨ Haptic milestone reached: ${milestone}%`);
      }
    });
    
    // Reset milestones if progress goes back to 0 (new restoration)
    if (processingProgress === 0) {
      hapticMilestones.current.clear();
    }
  }, [processingProgress]);

  // Animate text in when component mounts
  useEffect(() => {
    textOpacity.value = withTiming(1, { duration: 800 });
    titleScale.value = withTiming(1, { duration: 600 });
  }, []);

  useEffect(() => {
    if (!isProcessing || isError) {
      // Reset progress only if not processing and no error
      if (!isProcessing && !isError) {
        clearProcessingProgress();
      }
      // If there's an error, keep current progress and return early to stop animation
      return;
    }

    // Simulate progress over ~4.5 seconds
    const intervals = [
      { progress: 10, delay: 150 },
      { progress: 25, delay: 600 },
      { progress: 45, delay: 800 },
      { progress: 65, delay: 1000 },
      { progress: 80, delay: 1200 },
      { progress: 90, delay: 1300 },
      { progress: 95, delay: 400 },
    ];

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let cumulativeDelay = 0;

    intervals.forEach(({ progress: targetProgress, delay }) => {
      cumulativeDelay += delay;
      const timeout = setTimeout(() => {
        setProcessingProgress(targetProgress);
      }, cumulativeDelay);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isProcessing, isError, setProcessingProgress]);

  // Animated styles
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  return (
    <LinearGradient
      colors={['#fafafa', '#f4f4f5', '#f1f5f9']}
      style={{ flex: 1 }}
    >
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        paddingHorizontal: 32 
      }}>
        <CircularProgress
          progress={processingProgress}
          size={140}
          strokeWidth={10}
          color="#f97316"
          backgroundColor="#f3f4f6"
          showPercentage={true}
          icon={modeData.icon}
          iconSize={40}
          iconColor="#f97316"
        />
        
        <Animated.Text style={[
          { 
            fontSize: 22, 
            fontWeight: '600', 
            color: '#1f2937',
            marginTop: 32,
            textAlign: 'center',
            letterSpacing: -0.5,
          },
          titleStyle
        ]}>
          {modeData.title}
        </Animated.Text>
        
        <Animated.Text style={[
          { 
            fontSize: 16, 
            color: '#6b7280',
            marginTop: 8,
            textAlign: 'center',
            lineHeight: 24,
          },
          textStyle
        ]}>
          {modeData.description}
        </Animated.Text>
        
        <Animated.Text style={[
          { 
            fontSize: 14, 
            color: '#9ca3af',
            marginTop: 16,
            textAlign: 'center',
          },
          textStyle
        ]}>
          This usually takes 5-10 seconds
        </Animated.Text>
      </View>
    </LinearGradient>
  );
};

export const ProcessingScreen = React.memo(ProcessingScreenComponent);