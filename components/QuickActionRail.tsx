import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from './ui/IconSymbol';

const ACTIONS: { route: string; labelKey: string; icon: string }[] = [];

export function QuickActionRail() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  // Animation values - always call hooks first
  const buttonScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const badgePulse = useSharedValue(0);
  
  React.useEffect(() => {
    // Start pulsing animation for NEW badge only if there are actions
    if (ACTIONS.length > 0) {
      badgePulse.value = withRepeat(
        withTiming(1, { duration: 2000 }),
        -1,
        true
      );
    }
  }, [badgePulse]);
  
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));
  
  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));
  
  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(badgePulse.value, [0, 1], [1, 1.05]) }
    ],
    opacity: interpolate(badgePulse.value, [0, 1], [0.8, 1]),
  }));
  
  // Don't render if no actions - after all hooks are called
  if (ACTIONS.length === 0) {
    return null;
  }

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 12, stiffness: 200 });
    glowOpacity.value = withTiming(0.6, { duration: 150 });
  };
  
  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    glowOpacity.value = withTiming(0, { duration: 300 });
  };

  const go = async (route: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await router.push(route as any);
    } finally {
      // Small delay to prevent rapid re-entry if animations stack
      setTimeout(() => setBusy(false), 400);
    }
  };

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        paddingBottom: insets?.bottom || 0,
      }}
    >
      {/* Gradient fade at top */}
      <LinearGradient
        colors={['transparent', 'rgba(11,11,15,0.8)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 120,
          zIndex: -1,
        }}
      />
      
      <View
        style={{
          marginHorizontal: 20,
          marginBottom: 12,
          backgroundColor: 'rgba(20,20,24,0.96)',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
          minWidth: '90%',
          maxWidth: 400,
        }}
      >
        {/* Rainbow gradient border effect */}
        <LinearGradient
          colors={['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#FD79A8', '#A29BFE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            left: -1,
            right: -1,
            top: -1,
            height: 3,
            opacity: 0.8,
          }}
        />
        
        <View style={{ 
          paddingHorizontal: 10, 
          paddingVertical: 8,
        }}>
          {ACTIONS.map((a, index) => (
            <Animated.View key={a.route} style={[buttonAnimatedStyle, { position: 'relative' }]}>
              {/* Glow effect background */}
              <Animated.View 
                style={[
                  glowAnimatedStyle,
                  {
                    position: 'absolute',
                    inset: -4,
                    borderRadius: 18,
                    backgroundColor: '#F59E0B',
                    opacity: 0.3,
                  }
                ]}
              />
              <TouchableOpacity
                onPress={() => go(a.route)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
                accessibilityRole="button"
                style={{
                  height: 54,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexDirection: 'row',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  paddingHorizontal: 14,
                  marginTop: index === 0 ? 0 : 8,
                  borderWidth: 1,
                  borderColor: 'rgba(245,158,11,0.2)',
                }}
              >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ 
                  width: 38, 
                  height: 38, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                }}>
                  <IconSymbol name={a.icon as any} size={20} color={'rgba(255,255,255,0.7)'} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontFamily: 'Lexend-SemiBold', fontSize: 15, letterSpacing: 0.2 }}>{t(a.labelKey)}</Text>
                    {a.labelKey === 'quickAction.photoMagic' && (
                      <Animated.View
                        style={[
                          badgeAnimatedStyle,
                          {
                            marginLeft: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: 'rgba(245,158,11,0.4)',
                            backgroundColor: 'rgba(245,158,11,0.15)',
                          }
                        ]}
                        accessibilityLabel="New feature"
                      >
                        <Text style={{ 
                          color: '#F59E0B', 
                          fontSize: 10, 
                          fontFamily: 'Lexend-ExtraBold', 
                          letterSpacing: 0.8 
                        }}>
                          NEW
                        </Text>
                      </Animated.View>
                    )}
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 }}>{t('textEdit.customTextEdits')}</Text>
                </View>
              </View>
              <View style={{ 
                width: 28, 
                height: 28, 
                borderRadius: 14, 
                backgroundColor: 'rgba(255,255,255,0.05)',
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <IconSymbol name={'arrow.right'} size={14} color={'rgba(255,255,255,0.6)'} />
              </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );
}


