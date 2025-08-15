import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuickEditStore } from '@/store/quickEditStore';
import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ModesFilterBar, type ModeCategory } from './ModesFilterBar';

type ModePreset = {
  id: string;
  title: string;
  subtitle?: string;
  category: 'repair' | 'clothing' | 'background' | 'style';
  styleKey: string; // passed through to crop-modal as query param
  image: any; // require('...')
};

// Placeholder presets – scalable to dozens of variants later
const PRESETS: ModePreset[] = [
  { id: 'p1', title: 'Wedding Attire', subtitle: 'Formal look', category: 'clothing', styleKey: 'wedding_attire', image: require('../assets/images/onboarding/after-4.png') },
  { id: 'p2', title: 'Sports Jersey', subtitle: 'Athletic vibe', category: 'clothing', styleKey: 'sports_jersey', image: require('../assets/images/onboarding/after-3.png') },
  { id: 'p3', title: 'Heavenly Background', subtitle: 'Soft glow sky', category: 'background', styleKey: 'heavenly_bg', image: require('../assets/images/onboarding/after-2.png') },
  { id: 'p4', title: 'Classic Studio', subtitle: 'Neutral portrait', category: 'background', styleKey: 'studio_bg', image: require('../assets/images/onboarding/before-4.jpg') },
  { id: 'p5', title: 'Vintage Repair', subtitle: 'Historic look', category: 'repair', styleKey: 'vintage_repair', image: require('../assets/images/onboarding/before-2.jpg') },
  { id: 'p6', title: 'Glam Portrait', subtitle: 'Beauty retouch', category: 'style', styleKey: 'glam_portrait', image: require('../assets/images/onboarding/before-3.jpg') },
];

export function ModesGallery() {
  const [category, setCategory] = useState<ModeCategory>('all');

  const filtered = useMemo(() => {
    // Defensive: ensure we never return empty due to bad category
    const list = category === 'all' ? PRESETS : PRESETS.filter(p => p.category === category);
    return list.length > 0 ? list : PRESETS;
  }, [category]);

  const openPicker = async (styleKey: string) => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      // Pass styleKey through for backend prompt mapping later
      useQuickEditStore.getState().openWithImage({ 
        functionType: 'restoration', 
        imageUri: uri,
        styleKey: styleKey
      });
    }
  };

  function PosterCard({ title, subtitle, image, onPress }: { title: string; subtitle?: string; image: any; onPress: () => void }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={{ width: '100%', height: 150, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111216' }}
      >
        {/* Background image with RN fallback */}
        <ExpoImage
          source={image}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={0}
        />
        {/* Stronger bottom gradient to avoid faint lines from image edges */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10 }}>
          <Text style={{ color: '#EAEAEA', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>{title}</Text>
          {!!subtitle && (
            <Text style={{ color: '#BFC3CF', fontSize: 11 }} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 2, paddingBottom: 16 }}>
      {/* Category filters */}
      <ModesFilterBar category={category} onChange={setCategory} />

      {/* Two-column grid (stable, no layout animation to prevent collapse) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {filtered.map((p) => (
          <Animated.View key={p.id} entering={FadeIn.duration(120)} style={{ width: '48%', marginBottom: 10 }}>
            <PosterCard title={p.title} subtitle={p.subtitle} image={p.image} onPress={() => openPicker(p.styleKey)} />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}


