import { DeviceTwoRowCarousel } from '@/components/DeviceTwoRowCarousel';
import { FeatureCardsList } from '@/components/FeatureCardsList';
import { HeroBackToLifeExamples } from '@/components/HeroBackToLifeExamples';
import { QuickActionRail } from '@/components/QuickActionRail';
import { StyleSheet } from '@/components/StyleSheet';
// Removed ModeChips per product direction (do not touch carousel area)
import { IconSymbol } from '@/components/ui/IconSymbol';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeGalleryLikeScreen() {
  const [activeSheet, setActiveSheet] = React.useState<'bg' | 'clothes' | null>(null);
  
  // Memoize ALL callbacks to prevent re-renders
  const handleCloseSheet = React.useCallback(() => {
    setActiveSheet(null);
  }, []);
  
  const handleOpenBackgrounds = React.useCallback(() => {
    setActiveSheet('bg');
  }, []);
  
  const handleOpenClothes = React.useCallback(() => {
    setActiveSheet('clothes');
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#EAEAEA', fontSize: 28, fontWeight: '800' }}>Clever</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={{ backgroundColor: '#ef4444', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>PRO</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <IconSymbol name="gear" size={22} color="#EAEAEA" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Two tall examples side-by-side for Back to life (video friendly) */}
        <HeroBackToLifeExamples />

      {/* Repair section title */}
      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#EAEAEA', fontSize: 24, fontWeight: '800' }}>Repair ✨</Text>
        <TouchableOpacity
          onPress={async () => {
            const ImagePicker = await import('expo-image-picker');
            const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (res.status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
            if (!result.canceled && result.assets[0]) {
              const { router } = await import('expo-router');
              router.push(`/crop-modal?imageUri=${encodeURIComponent(result.assets[0].uri)}&functionType=restoration&imageSource=gallery`);
            }
          }}
          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <IconSymbol name="photo.stack" size={18} color="#EAEAEA" />
          </TouchableOpacity>
        </View>

        {/* Mode chips removed as requested */}

        {/* Two-row horizontally scrolling device photos (UNTOUCHED) */}
      <View style={{ paddingBottom: 10 }}>
          <DeviceTwoRowCarousel functionType="restoration" />
        </View>

                        {/* Poster-style feature cards (new) */}
                        <FeatureCardsList onOpenBackgrounds={handleOpenBackgrounds} onOpenClothes={handleOpenClothes} />
      </ScrollView>
      {/* Bottom quick action rail */}
      <QuickActionRail />
      
      {/* Always render sheet component with null check inside */}
      <StyleSheet type={activeSheet} onClose={handleCloseSheet} />
    </SafeAreaView>
  );
}


