import { DeviceTwoRowCarousel } from '@/components/DeviceTwoRowCarousel';
import { HeroRepairTile } from '@/components/HeroRepairTile';
import { ModesGallery } from '@/components/ModesGallery';
// Removed ModeChips per product direction (do not touch carousel area)
import { IconSymbol } from '@/components/ui/IconSymbol';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeGalleryLikeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>Clever</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={{ backgroundColor: '#ef4444', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>PRO</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <IconSymbol name="gear" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Hero Repair tile (additive, does not touch carousel) */}
        <HeroRepairTile />

        {/* Repair section title */}
        <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>Repair ✨</Text>
          <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <IconSymbol name="rectangle.stack" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Mode chips removed as requested */}

        {/* Two-row horizontally scrolling device photos (UNTOUCHED) */}
        <View style={{ paddingBottom: 10 }}>
          <DeviceTwoRowCarousel functionType="restoration" />
        </View>

        {/* Modes Gallery: grid of presets (clothing/background/etc) */}
        <ModesGallery />
      </ScrollView>
    </SafeAreaView>
  );
}


