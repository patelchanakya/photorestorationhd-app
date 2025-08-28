import { MODE_TILES, type ModeKey } from '@/constants/modes';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuickEditStore } from '@/store/quickEditStore';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { IconSymbol } from './ui/IconSymbol';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface ModeTilesProps {
  compact?: boolean; // smaller tiles for dense layout
}

export function ModeTiles({ compact = false }: ModeTilesProps) {

  // Placeholder images (using onboarding assets) until custom art provided
  const MODE_TILE_IMAGES: Record<ModeKey, any> = {
    restoration: require('../assets/images/onboarding/after-2.png'),
    unblur: require('../assets/images/onboarding/before-3.jpg'),
    colorize: require('../assets/images/onboarding/after-3.png'),
    descratch: require('../assets/images/onboarding/before-4.jpg'),
  };

  const openPickerForMode = async (mode: ModeKey) => {
    try {
      // Request permission first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        useQuickEditStore.getState().openWithImage({ 
          functionType: mode as any, 
          imageUri: uri 
        });
      }
    } catch (err) {
      if (__DEV__) {
        console.error('ModeTiles picker error:', err);
      }
    }
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {MODE_TILES.map((mode) => (
          <Tile
            key={mode.key}
            title={mode.title}
            description={mode.description}
            icon={mode.icon}
            imageSource={MODE_TILE_IMAGES[mode.key]}
            onPress={() => openPickerForMode(mode.key)}
            compact={compact}
          />
        ))}
      </View>
    </View>
  );
}

interface TileProps {
  title: string;
  description: string;
  icon: string;
  imageSource: any;
  onPress: () => void;
  compact?: boolean;
}

function Tile({ title, description, icon, imageSource, onPress, compact = false }: TileProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const width = compact ? '47.5%' : '48%';
  const height = compact ? 130 : 150;
  const radius = 18;

  return (
    <AnimatedTouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[{ width, height, borderRadius: radius, overflow: 'hidden' }, animatedStyle]}
      activeOpacity={0.9}
    >
      {/* Full-bleed background image */}
      <ExpoImage
        source={imageSource}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        contentFit="cover"
        transition={0}
        allowDownscaling
        cachePolicy="memory-disk"
      />

      {/* Top-to-bottom fade for text legibility */}
      <LinearGradient
        colors={["rgba(0,0,0,0.12)", "rgba(0,0,0,0.55)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Foreground content */}
      <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
          <IconSymbol name={icon as any} size={18} color="#fff" />
        </View>

        <View>
          <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 12, marginTop: 2 }}>{description}</Text>
        </View>
      </View>
    </AnimatedTouchableOpacity>
  );
}


