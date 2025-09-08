import React from 'react';
import { View, Text, Modal } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const iconScale = useSharedValue(1);
  const modalOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      // Show modal
      modalOpacity.value = withTiming(1, { duration: 200 });
      
      // Start pulse animation
      iconScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1
      );
    } else {
      // Hide modal
      modalOpacity.value = withTiming(0, { duration: 200 });
      iconScale.value = 1;
    }
    
    // Cleanup animations on unmount
    return () => {
      cancelAnimation(iconScale);
      cancelAnimation(modalOpacity);
    };
  }, [visible]);

  const showSuccess = () => {
    // Hide modal after 300ms
    modalOpacity.value = withDelay(
      300,
      withTiming(0, { duration: 200 }, () => {
        runOnJS(onComplete)();
      })
    );
  };

  // Expose showSuccess method to parent
  React.useImperativeHandle(ref, () => ({
    showSuccess,
  }));

  const pulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: iconScale.value }],
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
          <Animated.View style={pulseStyle}>
            <IconSymbol name="square.and.arrow.down" size={20} color="#f97316" />
          </Animated.View>
          <Text className="text-white text-sm font-medium ml-3">
            {t('common.saved')}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
});