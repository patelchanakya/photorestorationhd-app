import { MemorialFeatures } from '@/components/AnimatedBackgrounds';
import { AnimatedOutfits } from '@/components/AnimatedOutfits';
import { DeviceTwoRowCarousel } from '@/components/DeviceTwoRowCarousel';
import { FeatureCardsList } from '@/components/FeatureCardsList';
import { PopularExamples } from '@/components/PopularExamples';
import { QuickActionRail } from '@/components/QuickActionRail';
import { QuickEditSheet } from '@/components/QuickEditSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analyticsService } from '@/services/analytics';
import { presentPaywall, restorePurchasesSecure, validatePremiumAccess } from '@/services/revenuecat';
import { restorationService } from '@/services/supabase';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useAppInitStore } from '@/store/appInitStore';
import { useT } from '@/src/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeGalleryLikeScreen() {
  const settingsNavLock = React.useRef(false);
  const insets = useSafeAreaInsets();
  const t = useT();
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = longestSide <= 700;
  const railApproxHeight = isSmallPhone ? 58 : 86;
  const basePadding = isTabletLike ? 154 : (isSmallPhone ? 45 : 112); // Reduced by ~30%
  const bottomPadding = Math.max(basePadding, (insets?.bottom || 0) + railApproxHeight);
  const openQuick = (functionType: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'background' | 'outfit' | 'custom' | 'restore_repair' | 'water_damage', styleKey?: string | null) => {
    try {
      useQuickEditStore.getState().open({ functionType, styleKey: styleKey ?? null });
    } catch {}
  };
  const { isPro, forceRefresh, refreshCustomerInfo } = useRevenueCat();
  const router = useRouter();
  

  // Subtle drop-back effect for screen when launching picker (Remini-like feedback)
  const dropProgress = useSharedValue(0);
  // Removed engageDropEffect and releaseDropEffect since Back to Life is disabled

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

  // Track screen view on mount
  React.useEffect(() => {
    analyticsService.trackScreenView('explore', {
      is_tablet: isTabletLike ? 'true' : 'false',
      is_pro: isPro ? 'true' : 'false'
    });
  }, [isTabletLike, isPro]);

  // Handle recovery after app initialization (centralized in appInitStore)
  React.useEffect(() => {
    const handleRecovery = async () => {
      const { recoveryState, clearRecoveryState } = useAppInitStore.getState();
      
      if (recoveryState.hasRecovery) {
        if (recoveryState.recoveryType === 'textEdit' && recoveryState.recoveryData?.route) {
          console.log('📝 [EXPLORE] Executing text-edit recovery navigation:', recoveryState.recoveryData.route);
          clearRecoveryState();
          router.push(recoveryState.recoveryData.route);
        } else if (recoveryState.recoveryType === 'quickEdit' && recoveryState.recoveryData?.predictionId && recoveryState.recoveryData?.restoredUri) {
          console.log('📱 [EXPLORE] Executing Quick Edit recovery:', recoveryState.recoveryData.predictionId);
          clearRecoveryState();
          
          try {
            // Try to update existing restoration record with the recovered URL
            const restoration = await restorationService.getByPredictionId(recoveryState.recoveryData.predictionId);
            if (restoration) {
              console.log('🔧 [EXPLORE] Updating restoration record with fresh recovered URL');
              await restorationService.update(restoration.id, {
                replicate_url: recoveryState.recoveryData.restoredUri,
                status: 'completed',
                completed_at: new Date().toISOString()
              });
              console.log('✅ [EXPLORE] Restoration record updated for recovery');
            } else {
              console.log('📝 [EXPLORE] No restoration record found - will show Quick Edit Sheet only');
            }
          } catch (error) {
            console.warn('⚠️ [EXPLORE] Failed to update restoration record during recovery:', error);
          }
          
          const { setResult } = useQuickEditStore.getState();
          setResult(recoveryState.recoveryData.predictionId, recoveryState.recoveryData.restoredUri);
          useQuickEditStore.setState({ visible: true });
          console.log('✅ [EXPLORE] Quick Edit Sheet opened with recovered result');
        }
      }
    };

    handleRecovery();
  }, [router]);

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimationStyle]}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 26, fontFamily: 'Lexend-Bold', letterSpacing: -0.5 }}>{t('app.name')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity 
            onPress={async () => {
              if (isPro) {
                // Pro users: refresh subscription status with cache invalidation
                console.log('🔒 [SECURITY] Pro icon tapped - refreshing subscription status...');
                
                try {
                  // Force refresh RevenueCat context first
                  await forceRefresh();
                  
                  // Then validate with fresh data 
                  const hasValidAccess = await validatePremiumAccess(true);
                  
                  if (hasValidAccess) {
                    Alert.alert(
                      t('explore.alerts.proMember.title'),
                      t('explore.alerts.proMember.message'),
                      [{ text: t('explore.alerts.proMember.button') }]
                    );
                  } else {
                    // If validation fails, try restore as fallback
                    console.log('🔄 Pro status validation failed, trying restore...');
                    const result = await restorePurchasesSecure();
                    
                    if (result.success && result.hasActiveEntitlements) {
                      // Refresh context to update UI state
                      await refreshCustomerInfo();
                      
                      Alert.alert(
                        t('explore.alerts.proMember.title'),
                        t('explore.alerts.proMember.message'),
                        [{ text: t('explore.alerts.proMember.button') }]
                      );
                    } else if (result.success && !result.hasActiveEntitlements) {
                      Alert.alert(
                        t('explore.alerts.subscriptionStatus.title'),
                        t('explore.alerts.subscriptionStatus.noActiveMessage'),
                        [{ text: t('explore.alerts.subscriptionStatus.button') }]
                      );
                    } else if (result.error === 'cancelled' && result.errorMessage?.includes('Apple ID')) {
                      Alert.alert(
                        t('explore.alerts.subscriptionCheck.title'),
                        t('explore.alerts.subscriptionCheck.message'),
                        [
                          { text: t('common.ok'), style: 'default' },
                          {
                            text: t('explore.alerts.subscriptionCheck.howToFix'),
                            style: 'default',
                            onPress: () => {
                              Alert.alert(
                                t('explore.alerts.subscriptionCheck.howToFixTitle'),
                                t('explore.alerts.subscriptionCheck.howToFixMessage'),
                                [{ text: t('explore.alerts.subscriptionCheck.gotIt'), style: 'default' }]
                              );
                            }
                          }
                        ]
                      );
                    } else {
                      Alert.alert(
                        t('explore.alerts.proStatusCheck.title'),
                        t('explore.alerts.proStatusCheck.message'),
                        [{ text: t('common.ok') }]
                      );
                    }
                  }
                } catch (error) {
                  console.error('❌ [SECURITY] Pro icon status check failed:', error);
                  Alert.alert(
                    t('explore.alerts.proMember.title'),
                    t('explore.alerts.proMember.message'),
                    [{ text: t('explore.alerts.proMember.button') }]
                  );
                }
              } else {
                // Non-Pro users: show paywall
                const isExpoGo = Constants.appOwnership === 'expo';
                if (isExpoGo) {
                  Alert.alert(
                    t('explore.alerts.demoMode.title'),
                    t('explore.alerts.demoMode.message'),
                    [{ text: t('common.ok') }]
                  );
                  return;
                }
                const success = await presentPaywall();
                if (success) {
                  Alert.alert(
                    t('explore.alerts.welcomeToPro.title'),
                    t('explore.alerts.welcomeToPro.message'),
                    [{ text: t('explore.alerts.welcomeToPro.button') }]
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
            <Text style={{ color: isPro ? '#f97316' : '#fff', fontFamily: 'Lexend-SemiBold', fontSize: 12 }}>{t('explore.header.pro')}</Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPadding }}>
        
        
        {/* Popular section title */}
        <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: 'Lexend-SemiBold', letterSpacing: -0.3 }}>{t('explore.sections.popular')}</Text>
        </View>
        
        {/* Popular examples using outfit assets as placeholders */}
        <PopularExamples />

{/* BackToLife feature removed */}

      {/* Fix My Image section title */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: 'Lexend-SemiBold', letterSpacing: -0.3 }}>{t('explore.sections.fixMyPhoto')}</Text>
        <TouchableOpacity
          onPress={async () => {
            // Validate premium access before proceeding
            const hasAccess = await validatePremiumAccess();
            if (__DEV__) {
              console.log('📱 Premium access validation:', hasAccess);
            }
            
            // Launch image picker - no permission check needed on iOS 11+
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
            if (!result.canceled && result.assets[0]) {
              useQuickEditStore.getState().openWithImage({ 
                functionType: 'restore_repair', 
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
          <DeviceTwoRowCarousel functionType="restore_repair" />
        </View>


        {/* Memorial Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: 'Lexend-SemiBold', letterSpacing: -0.3 }}>{t('explore.sections.memorial')}</Text>
        </View>
        <MemorialFeatures />

        {/* Outfits Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: 'Lexend-SemiBold', letterSpacing: -0.3 }}>{t('explore.sections.outfits')}</Text>
        </View>
        <AnimatedOutfits />

        {/* Other AI Features - Enlighten, etc. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: 'Lexend-SemiBold', letterSpacing: -0.3 }}>{t('explore.sections.magic')}</Text>
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


