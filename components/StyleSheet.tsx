import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuickEditStore } from '@/store/quickEditStore';
import React from 'react';
import { Dimensions, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { analyticsService } from '@/services/analytics';

const BACKGROUNDS = [
  { 
    id: 'bg1', 
    title: 'Studio', 
    subtitle: 'Professional', 
    styleKey: 'studio_bg',
    image: require('../assets/images/onboarding/after-4.png')
  },
  { 
    id: 'bg2', 
    title: 'Heavenly', 
    subtitle: 'Soft & bright', 
    styleKey: 'heavenly_bg',
    image: require('../assets/images/onboarding/after-2.png')
  },
  { 
    id: 'bg3', 
    title: 'Library', 
    subtitle: 'Classic vintage', 
    styleKey: 'vintage_bg',
    image: require('../assets/images/onboarding/before-2.jpg')
  },
  { 
    id: 'bg4', 
    title: 'Outdoors', 
    subtitle: 'Natural light', 
    styleKey: 'outdoor_bg',
    image: require('../assets/images/onboarding/after-3.png')
  },
];

const CLOTHES = [
  { 
    id: 'cl1', 
    title: 'Wedding', 
    subtitle: 'Elegant attire', 
    styleKey: 'wedding_attire',
    image: require('../assets/images/onboarding/after-4.png')
  },
  { 
    id: 'cl2', 
    title: 'Suit', 
    subtitle: 'Formal wear', 
    styleKey: 'formal_suit',
    image: require('../assets/images/onboarding/before-3.jpg')
  },
  { 
    id: 'cl3', 
    title: 'Dress', 
    subtitle: 'Evening gown', 
    styleKey: 'formal_dress',
    image: require('../assets/images/onboarding/after-3.png')
  },
  { 
    id: 'cl4', 
    title: 'Jersey', 
    subtitle: 'Sports uniform', 
    styleKey: 'sports_jersey',
    image: require('../assets/images/onboarding/before-4.jpg')
  },
];

type StyleSheetProps = {
  type: 'bg' | 'clothes' | null;
  onClose: () => void;
};

const StyleSheetBase = ({ type, onClose }: StyleSheetProps) => {
  const router = useRouter();
  const translateY = useSharedValue(700);
  const overlayOpacity = useSharedValue(0);

  React.useLayoutEffect(() => {
    if (type) {
      requestAnimationFrame(() => {
        translateY.value = withTiming(0, { duration: 250 });
        overlayOpacity.value = withTiming(1, { duration: 200 });
      });
    }
  }, [type]);

  const handleClose = React.useCallback(() => {
    'worklet';
    translateY.value = withTiming(700, { duration: 200 });
    overlayOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(onClose)();
    });
  }, [onClose]);

  const selectOption = React.useCallback(async (styleKey: string) => {
    // Find the style item for tracking
    const items = type === 'bg' ? BACKGROUNDS : CLOTHES;
    const selectedItem = items.find(item => item.styleKey === styleKey);
    
    // Track style tile selection
    if (selectedItem) {
      analyticsService.trackTileUsage({
        category: 'style',
        tileName: selectedItem.title,
        tileId: selectedItem.id,
        functionType: type === 'bg' ? 'background' : 'outfit',
        styleKey: styleKey,
        stage: 'selected'
      });
    }
    
    // Open image picker directly - no closing or weird animations
    // No permission check needed on iOS 11+ - PHPickerViewController handles privacy
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'], 
      allowsEditing: false, 
      quality: 1,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.CURRENT,
      exif: false
    });
    
    if (!result.canceled && result.assets[0]) {
      // Open Quick Edit sheet prefilled, then close the style sheet
      try {
        useQuickEditStore.getState().openWithImage({ 
          functionType: type === 'bg' ? 'background' : 'outfit', 
          imageUri: result.assets[0].uri, 
          styleKey,
          styleName: selectedItem?.title 
        });
      } catch {}
      onClose();
    }
  }, [onClose, router, type]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    display: overlayOpacity.value === 0 ? 'none' : 'flex',
  }));

  const items = type === 'bg' ? BACKGROUNDS : CLOTHES;

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      pointerEvents: type ? 'auto' : 'none',
    }}>
      <Animated.View 
        style={[overlayStyle, {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }]}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>
      
      <Animated.View style={[sheetStyle, {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: Dimensions.get('window').height * 0.7,
        backgroundColor: '#0B0B0F',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }]}>
        {/* Simple Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.1)'
        }}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={{ color: 'white', fontSize: 24 }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ 
            color: 'white', 
            fontSize: 18, 
            fontFamily: 'Lexend-Bold',
            marginLeft: 16
          }}>
            {type === 'bg' ? 'Choose Background' : 'Choose Outfit'}
          </Text>
        </View>
        
        {/* Simple Grid */}
        <ScrollView 
          contentContainerStyle={{ padding: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {items.map(item => (
              <TouchableOpacity 
                key={item.id} 
                onPress={() => selectOption(item.styleKey)}
                activeOpacity={0.9}
                style={{ 
                  width: '48%',
                  marginBottom: 12,
                }}
              >
                <View style={{ 
                  height: 180,
                  borderRadius: 16,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)'
                }}>
                  <ExpoImage 
                    source={item.image}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 80,
                      justifyContent: 'flex-end',
                      padding: 12
                    }}
                  >
                    <Text style={{ 
                      color: 'white', 
                      fontSize: 16, 
                      fontFamily: 'Lexend-Bold',
                      marginBottom: 2
                    }}>
                      {item.title}
                    </Text>
                    <Text style={{ 
                      color: 'rgba(255,255,255,0.8)', 
                      fontSize: 12,
                    }}>
                      {item.subtitle}
                    </Text>
                  </LinearGradient>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export const StyleSheet = React.memo(StyleSheetBase);
StyleSheet.displayName = 'StyleSheet';