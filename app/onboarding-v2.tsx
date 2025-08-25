import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { onboardingUtils, ONBOARDING_FEATURES } from '@/utils/onboarding';
import { onboardingTrackingService } from '@/services/onboardingTracking';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { presentPaywall } from '@/services/revenuecat';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

export default function OnboardingV2() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const photoRestoration = usePhotoRestoration();
  const { isPro } = useRevenueCat();

  const [step, setStep] = useState<0 | 1>(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overlay, setOverlay] = useState<{ show: boolean; uri?: string; text: string; cursor: boolean }>({ show: false, text: '', cursor: true });

  const MOCK = (process.env.EXPO_PUBLIC_ONBOARDING_MOCK_FREE === '1') || __DEV__;

  React.useEffect(() => {
    if (!overlay.show) return;
    const t = setInterval(() => setOverlay((o) => ({ ...o, cursor: !o.cursor })), 500);
    return () => clearInterval(t);
  }, [overlay.show]);

  const addTyped = (line: string) => {
    return new Promise<void>((resolve) => {
      let i = 0;
      const timer = setInterval(() => {
        i++;
        setOverlay((o) => ({ ...o, text: o.text + line.slice(i - 1, i) }));
        if (i >= line.length) {
          clearInterval(timer);
          setTimeout(resolve, 300);
        }
      }, 24);
    });
  };

  const onToggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onNext = async () => {
    if (selected.length === 0) {
      await onboardingUtils.completeOnboarding();
      router.replace('/explore');
      return;
    }

    const selectedDefs = ONBOARDING_FEATURES.filter((f) => selected.includes(f.id));
    const hasOnlyVideo = selectedDefs.every((f) => f.mapsTo === 'back_to_life');
    const primaryNonVideo = selectedDefs.find((f) => f.mapsTo !== 'back_to_life');
    const primaryInterest = primaryNonVideo?.id ?? selected[0];

    await onboardingUtils.saveOnboardingSelections(selected, primaryInterest);
    onboardingTrackingService.saveOnboardingSelections({ selectedFeatures: selected, primaryInterest }).catch(() => {});

    if (hasOnlyVideo) {
      if (isPro) {
        await onboardingUtils.completeOnboarding();
        router.replace('/explore');
        return;
      }
      try {
        const purchased = await presentPaywall();
        if (purchased) {
          await onboardingUtils.completeOnboarding();
          router.replace('/explore');
        }
      } catch {}
      return;
    }

    setStep(1);
  };

  const onPickAndRun = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to continue.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;

    const primary = ONBOARDING_FEATURES.find((f) => selected.includes(f.id) && f.mapsTo !== 'back_to_life') || ONBOARDING_FEATURES.find((f) => selected.includes(f.id));
    if (!primary || primary.mapsTo === 'back_to_life') {
      Alert.alert('Error', 'Please pick a photo feature.');
      return;
    }

    setIsProcessing(true);
    setOverlay({ show: true, uri: res.assets[0].uri, text: '', cursor: true });

    if (MOCK) {
      await addTyped('image uploaded ✓');
      await addTyped('\nbooting up GPUs (on the house)…');
      await addTyped('\nwarming up models…');
      await addTyped('\nenhancing details…');
      await new Promise((r) => setTimeout(r, 500));
      await onboardingUtils.completeOnboarding();
      setOverlay({ show: false, text: '', cursor: true });
      setIsProcessing(false);
      router.replace('/explore');
      return;
    }

    try {
      await addTyped('image uploaded ✓');
      await addTyped('\nbooting up GPUs (on the house)…');
      await addTyped('\nwarming up models…');
      await addTyped('\nenhancing details…');

      const result = await photoRestoration.mutateAsync({ imageUri: res.assets[0].uri, functionType: primary.mapsTo as any, imageSource: 'gallery' });
      await onboardingUtils.markFreeAttemptUsed(primary.id);
      onboardingTrackingService.markFreeAttemptUsed(primary.id).catch(() => {});
      await onboardingUtils.completeOnboarding();
      router.replace(`/restoration/${result.id}`);
    } catch (e: any) {
      setIsProcessing(false);
      setOverlay({ show: false, text: '', cursor: true });
      Alert.alert('Processing Failed', e?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-gray-900">
      <View style={{ paddingTop: insets.top + 8 }}>
        <View className="px-5 pb-4">
          <Text className="text-white text-3xl font-bold text-center">Welcome</Text>
          <Text className="text-gray-400 text-center mt-1">Select what interests you</Text>
        </View>
      </View>

      {step === 0 && (
        <View className="flex-1 px-5">
          {ONBOARDING_FEATURES.map((f) => {
            const picked = selected.includes(f.id);
            return (
              <TouchableOpacity key={f.id} onPress={() => onToggle(f.id)} className={`rounded-xl border mb-3 ${picked ? 'border-amber-400 bg-white/5' : 'border-white/10 bg-white/0'}`} style={{ padding: 14 }}>
                <Text className="text-white text-base font-medium">{f.name}</Text>
                <Text className="text-white/60 text-xs mt-1">{f.description}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity onPress={onNext} disabled={isProcessing} className={`mt-4 rounded-2xl py-4 ${isProcessing ? 'bg-gray-600' : 'bg-amber-400'}`}>
            <Text className={`text-center text-lg font-bold ${isProcessing ? 'text-gray-300' : 'text-black'}`}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 1 && (
        <View className="flex-1 px-5">
          <Text className="text-white text-xl font-semibold text-center mb-3">Try a free restoration</Text>
          <TouchableOpacity onPress={onPickAndRun} disabled={isProcessing} className={`rounded-2xl py-4 ${isProcessing ? 'bg-gray-600' : 'bg-amber-400'}`}>
            <Text className={`text-center text-lg font-bold ${isProcessing ? 'text-gray-300' : 'text-black'}`}>{isProcessing ? 'Processing…' : 'Select Photo & Try Free'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {overlay.show && (
        <View style={{ position: 'absolute', inset: 0 as any }} pointerEvents="none">
          <LinearGradient colors={["#0B0B0F", "#0B0B0F"]} style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
            {overlay.uri && (
              <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 16 }}>
                <View style={{ backgroundColor: '#111318', paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 6 }} />
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', marginRight: 6 }} />
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                  <Text style={{ color: '#9CA3AF', marginLeft: 8, fontSize: 12 }}>restoration.log</Text>
                </View>
                <ExpoImage source={{ uri: overlay.uri }} style={{ width: '100%', height: 220 }} contentFit="cover" />
              </View>
            )}
            <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0E1015', padding: 14 }}>
              <Text style={{ color: '#A3E635', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as any, fontSize: 13, lineHeight: 20 }}>
                $ {overlay.text}
                {overlay.cursor ? '|' : ' '}
              </Text>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}
