import { IconSymbol } from '@/components/ui/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

interface PresetCardProps {
  label: string;
  icon: string;
  isSelected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  category?: string;
  disabled?: boolean;
}

export function PresetCard({ 
  label, 
  icon, 
  isSelected, 
  onPress, 
  onLongPress, 
  category, 
  disabled = false 
}: PresetCardProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    try { Haptics.selectionAsync(); } catch {}
    scale.value = withSpring(0.96, { damping: 12, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const handlePress = () => {
    if (disabled) return;
    onPress();
  };

  React.useEffect(() => {
    opacity.value = withTiming(disabled ? 0.5 : 1, { duration: 200 });
  }, [disabled]);

  return (
    <Animated.View style={[animatedStyle, { marginBottom: 8 }]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onLongPress}
        disabled={disabled}
        activeOpacity={0.9}
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          minHeight: 48,
          alignSelf: 'stretch',
        }}
      >
        {/* Background with gradient for selected state */}
        {isSelected ? (
          <LinearGradient
            colors={['#F59E0B', '#FBBF24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 16,
              flex: 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <View style={{ 
                width: 28, 
                height: 28, 
                borderRadius: 14, 
                backgroundColor: 'rgba(0,0,0,0.15)',
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <IconSymbol name={icon as any} size={14} color="#0B0B0F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: '#0B0B0F', 
                  fontSize: 13, 
                  fontFamily: 'Lexend-Bold',
                  textAlign: 'center',
                  lineHeight: 16
                }} numberOfLines={2} ellipsizeMode="tail">
                  {label}
                </Text>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 16,
            flex: 1,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <View style={{ 
                width: 28, 
                height: 28, 
                borderRadius: 14, 
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <IconSymbol name={icon as any} size={14} color="rgba(255,255,255,0.8)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: 'rgba(255,255,255,0.9)', 
                  fontSize: 13, 
                  fontFamily: 'Lexend-SemiBold',
                  textAlign: 'center',
                  lineHeight: 16
                }} numberOfLines={2} ellipsizeMode="tail">
                  {label}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Subtle glow effect for selected cards */}
        {isSelected && (
          <View style={{
            position: 'absolute',
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            borderRadius: 22,
            backgroundColor: 'rgba(245,158,11,0.2)',
            zIndex: -1,
          }} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}