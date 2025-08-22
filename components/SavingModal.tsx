import React from 'react';
import { View, Text, Modal } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  runOnJS,
  withSequence,
  withDelay,
  cancelAnimation
} from 'react-native-reanimated';

interface SavingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export interface SavingModalRef {
  showSuccess: () => void;
}

export const SavingModal = React.forwardRef<SavingModalRef, SavingModalProps>(function SavingModal({ visible, onComplete }, ref) {
  const rotation = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);
  const modalOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      // Show modal
      modalOpacity.value = withTiming(1, { duration: 200 });
      
      // Start loading animation
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1
      );
    } else {
      // Hide modal
      modalOpacity.value = withTiming(0, { duration: 200 });
      rotation.value = 0;
      checkmarkScale.value = 0;
    }
    
    // Cleanup animations on unmount
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(checkmarkScale);
      cancelAnimation(modalOpacity);
    };
  }, [visible]);

  const showSuccess = () => {
    // Stop loading animation and show checkmark
    rotation.value = withTiming(0, { duration: 200 });
    checkmarkScale.value = withSequence(
      withTiming(1.2, { duration: 150 }),
      withTiming(1, { duration: 100 })
    );
    
    // Hide modal after showing success
    modalOpacity.value = withDelay(
      800,
      withTiming(0, { duration: 200 }, () => {
        runOnJS(onComplete)();
      })
    );
  };

  // Expose showSuccess method to parent
  React.useImperativeHandle(ref, () => ({
    showSuccess,
  }));

  const rotationStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const checkmarkStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkmarkScale.value }],
    };
  });

  const modalStyle = useAnimatedStyle(() => {
    return {
      opacity: modalOpacity.value,
    };
  });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View className="flex-1 items-center justify-center">
        <Animated.View 
          style={modalStyle}
          className="bg-gray-900/80 px-6 py-4 rounded-lg flex-row items-center"
        >
          {checkmarkScale.value > 0 ? (
            <Animated.View style={checkmarkStyle}>
              <IconSymbol name="checkmark.circle.fill" size={20} color="#10b981" />
            </Animated.View>
          ) : (
            <Animated.View style={rotationStyle}>
              <IconSymbol name="arrow.clockwise" size={20} color="#f97316" />
            </Animated.View>
          )}
          <Text className="text-white text-sm font-medium ml-3">
            {checkmarkScale.value > 0 ? 'Saved' : 'Saving'}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
});