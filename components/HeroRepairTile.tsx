import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuickEditStore } from '@/store/quickEditStore';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

interface HeroRepairTileProps {
  title?: string;
  subtitle?: string;
  image?: any; // require('...')
}

export function HeroRepairTile({
  title = 'Back to life',
  subtitle = 'Fix damage & enhance',
  image = require('../assets/images/onboarding/after-2.png'),
}: HeroRepairTileProps) {

  const handlePick = async () => {
    try {
      // Launch photo picker - works with limited access even if permissions denied
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        useQuickEditStore.getState().openWithImage({ 
          functionType: 'repair', 
          imageUri: uri 
        });
      }
    } catch (e) {
      if (__DEV__) console.error('HeroRepairTile picker error:', e);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePick}
      activeOpacity={0.9}
      style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 8, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', height: 180 }}
    >
      <ExpoImage
        source={image}
        style={{ position: 'absolute', inset: 0 as any, width: '100%', height: '100%' }}
        contentFit="cover"
        transition={0}
        allowDownscaling
        cachePolicy="memory-disk"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.65)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', inset: 0 as any }}
      />

      {/* Content */}
      <View style={{ flex: 1, padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <IconSymbol name="wand.and.stars" size={20} color="#EAEAEA" />
          </View>
          <TouchableOpacity
            onPress={() => {
              // Navigation-only placeholder; wire to full grid later
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.9}
            style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <Text style={{ color: '#EAEAEA', fontFamily: 'Lexend-Bold', fontSize: 13 }}>Video</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Text style={{ color: '#BFC3CF', fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}


