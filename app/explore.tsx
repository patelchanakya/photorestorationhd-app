import { DeviceTwoRowCarousel } from '@/components/DeviceTwoRowCarousel';
import { QuickEditSheet } from '@/components/QuickEditSheet';
import { useQuickEditStore } from '@/store/quickEditStore';
import { FeatureCardsList } from '@/components/FeatureCardsList';
import { QuickActionRail } from '@/components/QuickActionRail';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { presentPaywall, validatePremiumAccess } from '@/services/revenuecat';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeGalleryLikeScreen() {
  const settingsNavLock = React.useRef(false);
  const openQuick = (functionType: 'restoration' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'background' | 'outfit' | 'custom', styleKey?: string | null) => {
    try {
      useQuickEditStore.getState().open({ functionType, styleKey: styleKey ?? null });
    } catch {}
  };
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

  // Subtle drop-back effect for screen when launching picker (Remini-like feedback)
  const dropProgress = useSharedValue(0);
  const engageDropEffect = useCallback(() => {
    dropProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [dropProgress]);
  const releaseDropEffect = useCallback(() => {
    dropProgress.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [dropProgress]);

  const screenAnimationStyle = useAnimatedStyle(() => ({
    transform: [
      // Avoid double animation with native picker on iOS
      { scale: 1 - (Platform.OS === 'ios' ? 0 : 0.04) * dropProgress.value },
      { translateY: (Platform.OS === 'ios' ? 0 : 12) * dropProgress.value },
    ],
  }));

  // iOS-only subtle dark overlay to avoid double transform with native picker
  const overlayAnimationStyle = useAnimatedStyle(() => ({
    opacity: Platform.OS === 'ios' ? 0.08 * dropProgress.value : 0,
  }));

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimationStyle]}>
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
            onPress={async () => {
              if (settingsNavLock.current) return;
              settingsNavLock.current = true;
              try {
                await router.push('/settings-modal');
              } finally {
                setTimeout(() => { settingsNavLock.current = false; }, 400);
              }
            }}
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
          <HeroBackToLifeExamples onBeforePicker={engageDropEffect} onAfterPicker={releaseDropEffect} />
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
              const { useQuickEditStore } = await import('@/store/quickEditStore');
              useQuickEditStore.getState().openWithImage({ 
                functionType: 'restoration', 
                imageUri: result.assets[0].uri 
              });
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
        <FeatureCardsList onOpenBackgrounds={() => openQuick('background')} onOpenClothes={() => openQuick('outfit')} />

      </ScrollView>
      {/* Bottom quick action rail */}
      <QuickActionRail />
    </SafeAreaView>
    <QuickEditSheet />
    {Platform.OS === 'ios' && (
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
          overlayAnimationStyle,
        ]}
      />
    )}
    </Animated.View>
  );
}


