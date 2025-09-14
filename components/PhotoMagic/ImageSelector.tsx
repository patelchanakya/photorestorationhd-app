import { IconSymbol } from '@/components/ui/IconSymbol';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

interface ImageSelectorProps {
  selectedImage?: string;
  onImageSelected: (uri: string) => void;
  disabled?: boolean;
  showReadyIndicator?: boolean;
}

export function ImageSelector({ selectedImage, onImageSelected, disabled = false, showReadyIndicator = false }: ImageSelectorProps) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const borderOpacity = useSharedValue(0.12);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,255,255,${borderOpacity.value})`,
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.98, { damping: 12, stiffness: 200 });
    borderOpacity.value = withTiming(0.25, { duration: 150 });
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    borderOpacity.value = withTiming(0.12, { duration: 150 });
  };

  const openPicker = async () => {
    if (disabled) return;
    
    try {
      console.log('📸 Opening image picker...');
      
      // iOS 11+ doesn't need permission check - PHPickerViewController handles it automatically
      
      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ['images'], 
        allowsEditing: false, 
        quality: 1,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.CURRENT,
        exif: false
      });
      
      console.log('📸 Picker result:', result);
      
      if (!result.canceled && result.assets[0]) {
        console.log('📸 Image selected:', result.assets[0].uri);
        onImageSelected(result.assets[0].uri);
      } else {
        console.log('📸 Picker was canceled or no image selected');
      }
    } catch (error) {
      console.error('📸 Error opening image picker:', error);
    }
  };

  return (
    <View style={{ marginBottom: 24 }}>
      
      <Animated.View style={[animatedStyle]}>
        <TouchableOpacity
          onPress={() => {
            console.log('📸 ImageSelector touched!');
            openPicker();
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          activeOpacity={0.9}
          style={{
            borderRadius: 24,
            overflow: 'hidden',
            aspectRatio: 16/10,
            backgroundColor: selectedImage ? 'transparent' : 'rgba(255,255,255,0.04)',
          }}
        >
          <Animated.View style={[
            {
              flex: 1,
              borderRadius: 24,
              borderWidth: 2,
              borderStyle: 'dashed',
            },
            borderAnimatedStyle
          ]}>
            {selectedImage ? (
              // Image preview with overlay
              <View style={{ flex: 1, position: 'relative' }}>
                <ExpoImage 
                  source={{ uri: selectedImage }} 
                  style={{ width: '100%', height: '100%', borderRadius: 22 }} 
                  contentFit="contain" 
                />
                
                {/* Overlay with change button */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                  start={{ x: 0.5, y: 0.4 }}
                  end={{ x: 0.5, y: 1 }}
                  style={{ position: 'absolute', inset: 0, borderRadius: 22 }}
                />
                
                <View style={{ 
                  position: 'absolute', 
                  bottom: 16, 
                  right: 16,
                }}>
                  <BlurView intensity={20} tint="dark" style={{ borderRadius: 18, overflow: 'hidden' }}>
                    <View style={{ 
                      backgroundColor: 'rgba(0,0,0,0.3)', 
                      paddingHorizontal: 14, 
                      paddingVertical: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <IconSymbol name="arrow.2.squarepath" size={16} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontFamily: 'Lexend-SemiBold' }}>
                        {t('imageSelector.changePhoto')}
                      </Text>
                    </View>
                  </BlurView>
                </View>

              </View>
            ) : (
              // Empty state with drag-drop styling
              <View style={{ 
                flex: 1, 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: 24,
              }}>
                <View style={{ 
                  width: 64, 
                  height: 64, 
                  borderRadius: 32, 
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <IconSymbol name="photo.on.rectangle.angled" size={28} color="rgba(255,255,255,0.6)" />
                </View>
                
                <Text style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 16,
                  fontFamily: 'Lexend-SemiBold',
                  textAlign: 'center',
                  marginBottom: 6,
                }}>
                  {t('imageSelector.selectPhoto')}
                </Text>

                <Text style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 13,
                  textAlign: 'center',
                  lineHeight: 18,
                }}>
                  {t('imageSelector.chooseFromLibrary')}
                </Text>

                {/* Decorative elements */}
                <View style={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  width: 16,
                  height: 16,
                  borderTopWidth: 2,
                  borderLeftWidth: 2,
                  borderColor: 'rgba(245,158,11,0.4)',
                  borderRadius: 4,
                }} />
                
                <View style={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  width: 16,
                  height: 16,
                  borderTopWidth: 2,
                  borderRightWidth: 2,
                  borderColor: 'rgba(245,158,11,0.4)',
                  borderRadius: 4,
                }} />
                
                <View style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 20,
                  width: 16,
                  height: 16,
                  borderBottomWidth: 2,
                  borderLeftWidth: 2,
                  borderColor: 'rgba(245,158,11,0.4)',
                  borderRadius: 4,
                }} />
                
                <View style={{
                  position: 'absolute',
                  bottom: 20,
                  right: 20,
                  width: 16,
                  height: 16,
                  borderBottomWidth: 2,
                  borderRightWidth: 2,
                  borderColor: 'rgba(245,158,11,0.4)',
                  borderRadius: 4,
                }} />
              </View>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}