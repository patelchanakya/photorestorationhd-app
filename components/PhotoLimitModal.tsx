import React from 'react';
import { View, Text, TouchableOpacity, Modal, Platform, Dimensions } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTranslation } from 'react-i18next';
import { presentPaywall } from '@/services/revenuecat';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
  cancelAnimation
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface PhotoLimitModalProps {
  visible: boolean;
  onClose: () => void;
  onTrialStart: () => void;
}

export function PhotoLimitModal({ 
  visible, 
  onClose, 
  onTrialStart
}: PhotoLimitModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = Dimensions.get('window');
  
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const badgePulse = useSharedValue(1);

  React.useEffect(() => {
    if (visible) {
      // Show modal with spring animation
      opacity.value = withTiming(1, { duration: 250 });
      scale.value = withSpring(1, { damping: 18, stiffness: 300 });
      
      // Start icon pulse animation
      iconScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
          withTiming(1, { duration: 800, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        ),
        -1
      );
      
      // Start badge pulse animation
      badgePulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
          withTiming(1, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        ),
        -1
      );
    } else {
      // Hide modal
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 200 });
      
      // Stop animations
      cancelAnimation(iconScale);
      cancelAnimation(badgePulse);
      iconScale.value = 1;
      badgePulse.value = 1;
    }
    
    return () => {
      cancelAnimation(iconScale);
      cancelAnimation(badgePulse);
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [visible]);

  const handleStartTrial = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await presentPaywall();
      
      if (success) {
        // Success haptic
        try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        onTrialStart();
        handleClose();
      }
      
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Trial start error:', error);
      }
    }
  };

  const handleClose = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    
    scale.value = withTiming(0.9, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onClose)();
    });
  };

  const modalStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePulse.value }],
  }));

  const proFeatures = [
    {
      icon: '🚀',
      title: t('modals.photoLimit.features.unlimited.title'),
      description: t('modals.photoLimit.features.unlimited.description')
    },
    {
      icon: '⚡',
      title: t('modals.photoLimit.features.priority.title'),
      description: t('modals.photoLimit.features.priority.description')
    },
    {
      icon: '🪄',
      title: t('modals.photoLimit.features.advanced.title'),
      description: t('modals.photoLimit.features.advanced.description')
    },
    {
      icon: '💾',
      title: t('modals.photoLimit.features.download.title'),
      description: t('modals.photoLimit.features.download.description')
    }
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={{ 
        flex: 1, 
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24
      }}>
        {/* Background blur and dim */}
        {Platform.OS === 'ios' && (
          <BlurView intensity={12} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        )}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' }} />
        
        <Animated.View style={[modalStyle]}>
          <View style={{ 
            borderRadius: 24,
            overflow: 'hidden',
            maxWidth: Math.min(screenWidth - 48, 380),
            width: '100%'
          }}>
            {/* Glassmorphic background */}
            {Platform.OS === 'ios' && (
              <BlurView 
                intensity={25} 
                tint="dark"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
            )}
            
            <View style={{ 
              backgroundColor: 'rgba(12,12,14,0.95)',
              padding: 28
            }}>

              {/* Header */}
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                
                {/* Trial badge */}
                <Animated.View style={[badgeStyle, { marginBottom: 16 }]}>
                  <LinearGradient
                    colors={['#F59E0B', '#F97316']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 6,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.2)'
                    }}
                  >
                    <Text style={{
                      color: '#0B0B0F',
                      fontFamily: 'Lexend-Black',
                      fontSize: 14,
                      textAlign: 'center'
                    }}>
                      {t('modals.photoLimit.badge')}
                    </Text>
                  </LinearGradient>
                </Animated.View>

                <Text style={{
                  fontSize: 24,
                  fontFamily: 'Lexend-Bold',
                  color: '#FFFFFF',
                  textAlign: 'center',
                  marginBottom: 12
                }}>
                  {t('modals.photoLimit.title')}
                </Text>

                <Text style={{
                  fontSize: 16,
                  fontFamily: 'Lexend-Regular',
                  color: 'rgba(255, 255, 255, 0.85)',
                  textAlign: 'center',
                  lineHeight: 22
                }}>
                  {t('modals.photoLimit.message')}
                </Text>
              </View>

              {/* Pro Features */}
              <View style={{ marginBottom: 28 }}>
                {proFeatures.map((feature, index) => (
                  <View key={index} style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    marginBottom: index < proFeatures.length - 1 ? 16 : 0
                  }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12
                    }}>
                      <Text style={{ fontSize: 18 }}>{feature.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ 
                        color: '#FFFFFF', 
                        fontFamily: 'Lexend-SemiBold', 
                        fontSize: 15,
                        marginBottom: 2
                      }}>
                        {feature.title}
                      </Text>
                      <Text style={{ 
                        color: 'rgba(255, 255, 255, 0.7)', 
                        fontSize: 13,
                        fontFamily: 'Lexend-Regular',
                        lineHeight: 16
                      }}>
                        {feature.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={{ gap: 12 }}>
                {/* Start Trial Button */}
                <TouchableOpacity
                  onPress={handleStartTrial}
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 16,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.2)'
                  }}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#F97316']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{
                      color: '#0B0B0F',
                      fontFamily: 'Lexend-Bold',
                      fontSize: 17
                    }}>
                      {t('modals.photoLimit.buttons.startTrial')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Maybe Later Button */}
                <TouchableOpacity
                  onPress={handleClose}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderRadius: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    alignItems: 'center'
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 16,
                    fontFamily: 'Lexend-SemiBold'
                  }}>
                    {t('modals.photoLimit.buttons.later')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}