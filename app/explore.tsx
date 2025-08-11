import { DeviceTwoRowCarousel } from '@/components/DeviceTwoRowCarousel';
import { FeatureCardsList } from '@/components/FeatureCardsList';
import { QuickActionRail } from '@/components/QuickActionRail';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { presentPaywall } from '@/services/revenuecat';
import { UserIdPersistenceService } from '@/services/userIdPersistence';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeGalleryLikeScreen() {
  const isPro = useSubscriptionStore((state) => state.isPro);
  const router = useRouter();
  
  // Lazy load heavy components after initial render
  const [componentsLoaded, setComponentsLoaded] = useState(false);
  const [AnimatedBackgrounds, setAnimatedBackgrounds] = useState<any>(null);
  const [AnimatedOutfits, setAnimatedOutfits] = useState<any>(null);
  const [HeroBackToLifeExamples, setHeroBackToLifeExamples] = useState<any>(null);
  
  useEffect(() => {
    // Load heavy components after a short delay to improve initial render
    const loadTimer = setTimeout(() => {
      Promise.all([
        import('@/components/AnimatedBackgrounds'),
        import('@/components/AnimatedOutfits'),
        import('@/components/HeroBackToLifeExamples')
      ]).then(([bgModule, outfitsModule, btlModule]) => {
        setAnimatedBackgrounds(() => bgModule.AnimatedBackgrounds);
        setAnimatedOutfits(() => outfitsModule.AnimatedOutfits);
        setHeroBackToLifeExamples(() => btlModule.HeroBackToLifeExamples);
        setComponentsLoaded(true);
      });
    }, 100); // Small delay to let initial UI render first
    
    return () => clearTimeout(loadTimer);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 }}>Clever</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity 
            onPress={async () => {
              if (isPro) {
                Alert.alert(
                  'Pro Member',
                  'You have unlimited access to all features!',
                  [{ text: 'Great!' }]
                );
              } else {
                const isExpoGo = Constants.appOwnership === 'expo';
                if (isExpoGo) {
                  Alert.alert(
                    'Demo Mode',
                    'Purchases are not available in Expo Go.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                const success = await presentPaywall();
                if (success) {
                  Alert.alert(
                    'Welcome to Pro!',
                    'You now have unlimited access!',
                    [{ text: 'Awesome!' }]
                  );
                }
              }
            }}
            style={{ 
              backgroundColor: isPro ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.9)', 
              borderRadius: 16, 
              paddingHorizontal: 12, 
              paddingVertical: 6,
              borderWidth: isPro ? 1 : 0,
              borderColor: '#f97316',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4
            }}>
            {isPro && <IconSymbol name="checkmark.circle.fill" size={14} color="#f97316" />}
            <Text style={{ color: isPro ? '#f97316' : '#fff', fontWeight: '600', fontSize: 12 }}>PRO</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings-modal')}
          >
            <IconSymbol name="gear" size={22} color="#EAEAEA" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        
        {/* Back to Life section title */}
        <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '600', letterSpacing: -0.3 }}>Back to Life</Text>
        </View>
        
        {/* Two tall examples side-by-side for Back to life (video friendly) */}
        {componentsLoaded && HeroBackToLifeExamples ? (
          <HeroBackToLifeExamples />
        ) : (
          <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color="#8B5CF6" />
          </View>
        )}

      {/* Repair section title */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '600', letterSpacing: -0.3 }}>Repair</Text>
        <TouchableOpacity
          onPress={async () => {
            // Validate premium access before proceeding
            const hasAccess = await validatePremiumAccess();
            if (__DEV__) {
              console.log('📱 Premium access validation:', hasAccess);
            }
            
            const ImagePicker = await import('expo-image-picker');
            const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (res.status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
            if (!result.canceled && result.assets[0]) {
              const { router } = await import('expo-router');
              router.push(`/crop-modal?imageUri=${encodeURIComponent(result.assets[0].uri)}&functionType=repair&imageSource=gallery`);
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
          <DeviceTwoRowCarousel functionType="repair" />
        </View>

        {/* Outfits Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '600', letterSpacing: -0.3 }}>Outfits</Text>
        </View>
        {componentsLoaded && AnimatedOutfits ? (
          <AnimatedOutfits />
        ) : (
          <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color="#8B5CF6" />
          </View>
        )}

        {/* Backgrounds Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '600', letterSpacing: -0.3 }}>Backgrounds</Text>
        </View>
        {componentsLoaded && AnimatedBackgrounds ? (
          <AnimatedBackgrounds />
        ) : (
          <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color="#8B5CF6" />
          </View>
        )}

        {/* Other AI Features - Enlighten, etc. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '600', letterSpacing: -0.3 }}>Magic</Text>
        </View>
        <FeatureCardsList />

      </ScrollView>
      {/* Bottom quick action rail */}
      <QuickActionRail />
    </SafeAreaView>
  );
}


