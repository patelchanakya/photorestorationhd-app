import React, { useEffect } from 'react';
import { View, Text, Image as RNImage } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming,
  interpolate
} from 'react-native-reanimated';
import { Restoration } from '@/types';
import { IconSymbol } from './ui/IconSymbol';

interface ProcessingJob extends Restoration {
  originalUri: string;
  isProcessing: boolean;
  progress: number;
  isComplete: boolean;
}

interface SkeletonRestorationCardProps {
  restoration: ProcessingJob;
}

export function SkeletonRestorationCard({ restoration }: SkeletonRestorationCardProps) {
  const shimmerOpacity = useSharedValue(0.3);
  const pulseScale = useSharedValue(1);
  const progressValue = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);
  
  useEffect(() => {
    // Shimmer animation for loading placeholder
    shimmerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
    
    // Subtle pulse for the loading area
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  // Update progress animation when progress changes
  useEffect(() => {
    progressValue.value = withTiming(restoration.progress, { duration: 500 });
  }, [restoration.progress]);

  // Show checkmark animation when complete
  useEffect(() => {
    if (restoration.isComplete) {
      checkmarkScale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
    }
  }, [restoration.isComplete]);

  const animatedShimmerStyle = useAnimatedStyle(() => {
    return {
      opacity: shimmerOpacity.value,
    };
  });

  const animatedPulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }],
    };
  });

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${progressValue.value * 3.6}deg` }],
    };
  });

  const animatedCheckmarkStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkmarkScale.value }],
      opacity: checkmarkScale.value > 0 ? 1 : 0,
    };
  });

  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <View className="flex-row gap-4">
        {/* Before Image (Original) */}
        <View className="flex-1">
          <Text className="text-gray-700 text-sm font-semibold text-center mb-2">Before</Text>
          <RNImage
            source={{ uri: restoration.originalUri }}
            style={{ width: '100%', height: 120, borderRadius: 12 }}
            resizeMode="cover"
          />
        </View>
        
        {/* After Image (Loading Skeleton) */}
        <View className="flex-1">
          <Text className="text-gray-700 text-sm font-semibold text-center mb-2">After</Text>
          <Animated.View
            style={[
              {
                width: '100%',
                height: 120,
                borderRadius: 12,
                backgroundColor: '#f3f4f6',
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
              },
              animatedPulseStyle,
            ]}
          >
            {/* Shimmer Overlay */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                },
                animatedShimmerStyle,
              ]}
            />
            
            {/* Progress Circle and Loading Spinner */}
            {!restoration.isComplete ? (
              <View style={{ position: 'relative' }}>
                {/* Progress Circle Background */}
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: '#e5e7eb',
                  }}
                />
                
                {/* Progress Circle */}
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: 'transparent',
                      borderTopColor: '#f97316',
                    },
                    animatedProgressStyle,
                  ]}
                />
                
                {/* Loading Spinner Center */}
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#f3f4f6',
                  }}
                />
              </View>
            ) : (
              /* Success Checkmark */
              <Animated.View
                style={[
                  {
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#10b981',
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                  animatedCheckmarkStyle,
                ]}
              >
                <IconSymbol name="checkmark" size={16} color="#ffffff" />
              </Animated.View>
            )}
            
            {/* Loading Text */}
            <Text className="text-gray-500 text-xs mt-2 font-medium">
              {restoration.isComplete 
                ? 'Complete!' 
                : `${Math.round(restoration.progress)}% ${restoration.function_type === 'restoration' ? 'Restoring...' : 'Removing blur...'}`
              }
            </Text>
          </Animated.View>
        </View>
      </View>
      
      <View className="flex-row justify-between items-center mt-4">
        <Text className="text-gray-500 text-sm">
          {new Date(restoration.created_at).toLocaleDateString()}
        </Text>
        <View className="flex-row items-center">
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#f97316',
              marginRight: 6,
            }}
          />
          <Text className="text-orange-600 text-sm font-medium">
            Processing
          </Text>
        </View>
      </View>
    </View>
  );
}