import React from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
  runOnJS
} from 'react-native-reanimated';

interface NetworkErrorModalProps {
  visible: boolean;
  onClose: () => void;
  onRetry: () => Promise<void>;
  message?: string;
}

export function NetworkErrorModal({ 
  visible, 
  onClose, 
  onRetry, 
  message = "You need an internet connection to continue" 
}: NetworkErrorModalProps) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const [isRetrying, setIsRetrying] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.8, { duration: 150 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleRetry = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleClose = () => {
    scale.value = withTiming(0.8, { duration: 150 });
    opacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(onClose)();
    });
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={{ 
        flex: 1, 
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24
      }}>
        <Animated.View style={[animatedStyle]}>
          <BlurView 
            intensity={20} 
            tint="dark"
            style={{ 
              borderRadius: 20,
              overflow: 'hidden',
              maxWidth: Math.min(screenWidth - 48, 320),
              width: '100%'
            }}
          >
            <View style={{ 
              backgroundColor: 'rgba(20, 20, 24, 0.95)',
              paddingHorizontal: 24,
              paddingVertical: 32,
              alignItems: 'center'
            }}>
              {/* Icon */}
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}>
                <IconSymbol 
                  name="wifi.slash" 
                  size={28} 
                  color="#EF4444" 
                />
              </View>

              {/* Title */}
              <Text style={{ 
                fontSize: 20, 
                fontFamily: 'Lexend-Bold', 
                color: '#FFFFFF',
                textAlign: 'center',
                marginBottom: 8
              }}>
                No Internet Connection
              </Text>

              {/* Message */}
              <Text style={{ 
                fontSize: 16, 
                fontFamily: 'Lexend-Regular',
                color: 'rgba(255, 255, 255, 0.8)',
                textAlign: 'center',
                lineHeight: 22,
                marginBottom: 24
              }}>
                {message}
              </Text>

              {/* Buttons */}
              <View style={{ width: '100%', gap: 12 }}>
                {/* Retry Button */}
                <TouchableOpacity
                  onPress={handleRetry}
                  disabled={isRetrying}
                  style={{
                    backgroundColor: '#F59E0B',
                    borderRadius: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    opacity: isRetrying ? 0.7 : 1
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    {isRetrying && (
                      <View style={{ 
                        width: 16, 
                        height: 16, 
                        borderRadius: 8, 
                        borderWidth: 2, 
                        borderColor: '#0B0B0F', 
                        borderTopColor: 'transparent',
                        marginRight: 8
                      }} />
                    )}
                    <Text style={{ 
                      color: '#0B0B0F', 
                      fontSize: 16, 
                      fontFamily: 'Lexend-Bold' 
                    }}>
                      {isRetrying ? 'Checking...' : 'Try Again'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Close Button */}
                <TouchableOpacity
                  onPress={handleClose}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)'
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    fontSize: 16, 
                    fontFamily: 'Lexend-Medium',
                    textAlign: 'center'
                  }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default NetworkErrorModal;