import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

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
  const router = useRouter();
  const [category, setCategory] = useState<'all' | 'repair' | 'clothing' | 'background' | 'style'>('all');

  const filtered = useMemo(() => {
    if (category === 'all') return PRESETS;
    return PRESETS.filter(p => p.category === category);
  }, [category]);

  const openPicker = async (styleKey: string) => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      // Pass styleKey through for backend prompt mapping later
      router.push(`/crop-modal?imageUri=${encodeURIComponent(uri)}&functionType=restoration&styleKey=${encodeURIComponent(styleKey)}&imageSource=gallery`);
    }
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: '#EAEAEA', fontSize: 20, fontWeight: '800' }}>Modes</Text>
        <Text style={{ color: '#BFC3CF', fontSize: 12 }}>{filtered.length} presets</Text>
      </View>
      {/* Category filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, gap: 8 }}>
        {([
          { key: 'all', label: 'All' },
          { key: 'repair', label: 'Repair' },
          { key: 'clothing', label: 'Clothing' },
          { key: 'background', label: 'Background' },
          { key: 'style', label: 'Style' },
        ] as const).map((c) => {
          const isActive = category === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              onPress={() => setCategory(c.key)}
              activeOpacity={0.9}
              style={{
                height: 36,
                paddingHorizontal: 14,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)'
              }}
            >
              <Text style={{ color: '#EAEAEA', fontWeight: '700', fontSize: 13 }}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Two-column grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {filtered.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => openPicker(p.styleKey)}
            activeOpacity={0.9}
            style={{ width: '48%', height: 150, borderRadius: 16, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <ExpoImage source={p.image} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: 'rgba(0,0,0,0.45)' }}>
              <Text style={{ color: '#EAEAEA', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>{p.title}</Text>
              {!!p.subtitle && (
                <Text style={{ color: '#BFC3CF', fontSize: 11 }} numberOfLines={1}>{p.subtitle}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}


