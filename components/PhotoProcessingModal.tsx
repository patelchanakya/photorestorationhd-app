import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';

interface PhotoProcessingModalProps {
  visible: boolean;
  imageUri?: string;
  progress?: number;
  onDismiss: () => void;
  canCancel?: boolean;
  onCancel?: () => void;
}

const { height } = Dimensions.get('window');

export function PhotoProcessingModal({ 
  visible, 
  imageUri, 
  progress = 0,
  onDismiss,
  canCancel = false,
  onCancel 
}: PhotoProcessingModalProps) {
  const insets = useSafeAreaInsets();
  // Minimal fast spinner (thin arc that rotates) - hooks must be before early returns
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);
  useEffect(() => {
    if (visible) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  }, [visible]);
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  
  if (!visible) return null;
  
  const title = progress < 8
    ? 'Uploading the photo…'
    : progress < 50
      ? 'Enhancing details…'
      : progress < 95
        ? 'Sharpening and cleanup…'
        : 'Finalizing…';
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        {/* Background overlay - NOT dismissible during processing */}
        <View className="absolute inset-0 bg-black/50" />
        
        {/* Bottom modal - dark theme to match app */}
        <View 
          className="rounded-t-3xl overflow-hidden"
          style={{ 
            height: height * 0.55, 
            backgroundColor: '#0B0B0F', 
            borderTopWidth: 2,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.15)',
            borderLeftColor: 'rgba(255,255,255,0.08)',
            borderRightColor: 'rgba(255,255,255,0.08)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
          }}
        >
          {/* Close button - only show if cancellable */}
          {canCancel && onCancel && (
            <View className="absolute top-4 right-4 z-10">
              <TouchableOpacity 
                onPress={() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}; onCancel(); }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(26, 26, 26, 0.9)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 18, fontWeight: '500' }}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          
           <View className="flex-1 p-6" style={{ paddingBottom: Math.max(12, insets.bottom + 6) }}>
          {/* Image preview area (fixed height, no overflow) */}
          {imageUri && (
            <View className="relative rounded-2xl overflow-hidden mb-4" style={{ height: 200, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
              <ExpoImage 
                source={{ uri: imageUri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
              />
              {/* Minimal spinner overlay */}
              <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
                <Animated.View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    borderWidth: 3,
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderTopColor: '#F59E0B',
                    borderRightColor: 'rgba(245,158,11,0.45)',
                    transform: [{ rotate: spin }],
                  }}
                />
              </View>
            </View>
          )}

          {/* Progress bar */}
          {typeof progress === 'number' && progress > 0 && (
            <View style={{ height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 12 }}>
              <View style={{ width: `${Math.min(100, Math.max(0, progress))}%`, height: '100%', backgroundColor: '#F59E0B' }} />
            </View>
          )}
            
            {/* Text below image - simple and clean */}
            <View className="items-center">
              <Text className="text-2xl font-semibold text-white mb-2">{title}</Text>
              <Text className="text-center text-gray-300 text-base">This usually takes 5–10 seconds.</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}