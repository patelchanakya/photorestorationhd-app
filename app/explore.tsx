import { MemorialFeatures } from '@/components/AnimatedMemorial';
import { AnimatedBackgrounds } from '@/components/AnimatedBackgrounds';
import { AnimatedFaceBody } from '@/components/AnimatedFaceBody';
import { AnimatedOutfits } from '@/components/AnimatedOutfits';
import { DeviceTwoRowCarousel } from '@/components/DeviceTwoRowCarousel';
import { FeatureCardsList } from '@/components/FeatureCardsList';
import { NavigationPills } from '@/components/NavigationPills';
import { QuickActionRail } from '@/components/QuickActionRail';
import { QuickEditSheet } from '@/components/QuickEditSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analyticsService } from '@/services/analytics';
import { featureRequestService } from '@/services/featureRequestService';
import { presentPaywall, restorePurchasesSecure, validatePremiumAccess } from '@/services/revenuecat';
import { restorationService } from '@/services/supabase';
import { useTranslation } from 'react-i18next';
import { useAppInitStore } from '@/store/appInitStore';
import { useQuickEditStore } from '@/store/quickEditStore';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Platform, Text, TouchableOpacity, View, useWindowDimensions, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExploreTourOverlay } from '@/components/ExploreTour/ExploreTourOverlay';

interface SectionData {
  id: string;
  type: 'fixMyPhoto' | 'backgrounds' | 'faceBody' | 'memorial' | 'outfits' | 'magic' | 'requestFeature';
  title?: string;
}

const sections: SectionData[] = [
  { id: 'fixMyPhoto', type: 'fixMyPhoto' },
  { id: 'backgrounds', type: 'backgrounds' },
  { id: 'faceBody', type: 'faceBody' },
  { id: 'memorial', type: 'memorial' },
  { id: 'outfits', type: 'outfits' },
  { id: 'magic', type: 'magic' },
  { id: 'requestFeature', type: 'requestFeature' }
];

export default function HomeGalleryLikeScreen() {
  const settingsNavLock = React.useRef(false);
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { showTour } = useLocalSearchParams();
  
  // Force re-render when language changes
  const currentLanguage = i18n.language;
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = longestSide <= 700;
  // No rail anymore, so minimal bottom padding
  const bottomPadding = Math.max(20, (insets?.bottom || 0) + 8);

  // Tour state
  const [showTourOverlay, setShowTourOverlay] = React.useState(false);
  const [tourStep, setTourStep] = React.useState(0);
  
  // Refs for tour highlighting
  const navigationRef = React.useRef<View>(null);
  const firstTileRef = React.useRef<View>(null);
  const repairTileRef = React.useRef<View>(null);
  const backgroundTileRef = React.useRef<View>(null);
  const imagePickerRef = React.useRef<any>(null);
  const generateButtonRef = React.useRef<any>(null);
  
  // Tour steps configuration
  const tourSteps = [
    {
      id: 'restoration',
      title: 'Choose a Photo',
      description: 'Pick any photo to restore, enhance, or repair damage.',
      duration: 4000,
    },
    {
      id: 'generate',
      title: 'Tap to Generate',
      description: 'Hit the checkmark to create your result.',
      duration: 5000,
    },
  ];

  const [highlightArea, setHighlightArea] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius?: number;
  } | null>(null);

  // Request permissions when reaching explore for auto-restore features
  React.useEffect(() => {
    const requestPermissions = async () => {
      try {
        const { status } = await MediaLibrary.getPermissionsAsync();
        if (status !== 'granted') {
          await MediaLibrary.requestPermissionsAsync();
        }
      } catch (error) {
        console.error('Failed to request permissions:', error);
      }
    };

    // Only request on first visit to explore
    requestPermissions();
  }, []);

  // Initialize tour when showTour parameter is present
  React.useEffect(() => {
    if (showTour === 'true') {
      setTimeout(() => {
        // Auto-scroll to Photo Restoration section first
        console.log('🎯 Auto-scrolling to Photo Restoration section for tour');
        scrollToSection('magic');
        
        // Show tour overlay and measure after scroll completes
        setTimeout(() => {
          setShowTourOverlay(true);
          measureElementForStep(0);
        }, 800); // Extra delay for scroll to complete
      }, 500); // Small delay to ensure elements are rendered
    }
  }, [showTour]);

  // Measure element positions for highlighting
  const measureElementForStep = (stepIndex: number) => {
    const step = tourSteps[stepIndex];
    if (!step) return;

    let targetRef: React.RefObject<any>;
    
    switch (step.id) {
      case 'restoration':
        targetRef = repairTileRef;
        break;
      case 'generate':
        // For generate step, we'll handle QuickEditSheet differently
        return;
      default:
        return;
    }

    if (targetRef.current) {
      targetRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setHighlightArea({
          x: pageX,
          y: pageY,
          width,
          height,
          borderRadius: 12,
        });
      });
    }
  };

  // Tour handlers
  const handleTourNext = () => {
    const nextStep = tourStep + 1;
    if (nextStep < tourSteps.length) {
      setTourStep(nextStep);
      const nextStepObj = tourSteps[nextStep];
      
      if (nextStepObj.id === 'generate') {
        console.log('🎯 Step 2 - showing tour sheet inside overlay');
        // Clear highlight area since we'll show the sheet instead
        setHighlightArea(null);
      } else {
        measureElementForStep(nextStep);
      }
    } else {
      handleTourComplete();
    }
  };

  const handleTourSkip = () => {
    console.log('🎯 Tour skipped - cleaning up');
    setShowTourOverlay(false);
    setTourStep(0);
    setHighlightArea(null);
  };

  const handleTourComplete = () => {
    console.log('🎯 Tour completed - cleaning up');
    
    // Close QuickEditSheet if it's open (tour mode)
    const quickEditState = useQuickEditStore.getState();
    if (quickEditState.visible && quickEditState.tourMode) {
      console.log('🎯 Closing tour mode QuickEditSheet');
      quickEditState.close();
    }
    
    setShowTourOverlay(false);
    setTourStep(0);
    setHighlightArea(null);
    // Clear tour parameter without navigation refresh
    router.setParams({ showTour: undefined });
  };

  const handleTourCTA = async () => {
    console.log('🎯 Tour CTA clicked - showing Pro paywall');
    
    try {
      analyticsService.track('tour_cta_pro_upgrade_clicked', {
        is_pro: isPro ? 'true' : 'false',
        source: 'tour_completion'
      });
      
      // Show paywall
      const success = await presentPaywall();
      if (success) {
        console.log('🎯 User upgraded to Pro from tour CTA');
      }
      
      // Close tour after paywall is dismissed (whether upgraded or not)
      handleTourComplete();
    } catch (error) {
      console.error('Error showing paywall from tour CTA:', error);
      // Still close tour even if paywall failed
      handleTourComplete();
    }
  };

  // Refs for each section to enable smooth scrolling
  const scrollViewRef = React.useRef<FlashList<SectionData>>(null);
  // Track active section for pill highlighting
  const [activeSectionId, setActiveSectionId] = React.useState<string>('backgrounds');

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    
    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    if (sectionIndex !== -1) {
      scrollViewRef.current?.scrollToIndex({ index: sectionIndex, animated: true });
    }
    
    // For individual magic features, scroll to magic section
    if (['waterDamage', 'clarify', 'repair', 'colorize', 'descratch', 'brighten'].includes(sectionId)) {
      const magicIndex = sections.findIndex(s => s.id === 'magic');
      if (magicIndex !== -1) {
        scrollViewRef.current?.scrollToIndex({ index: magicIndex, animated: true });
      }
    }
  };
  const openQuick = React.useCallback((functionType: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'background' | 'outfit' | 'custom' | 'restore_repair' | 'water_damage', styleKey?: string | null) => {
    try {
      useQuickEditStore.getState().open({ functionType, styleKey: styleKey ?? null });
    } catch {}
  }, []); // No dependencies - this function is stable
  const { isPro, forceRefresh, refreshCustomerInfo } = useRevenueCat();
  

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

  const renderSectionHeader = React.useCallback((sectionType: SectionData['type']) => {
    switch (sectionType) {
      case 'fixMyPhoto':
        return (
          <View style={exploreStyles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={exploreStyles.sectionTitle}>{t('explore.sections.fixMyPhoto')}</Text>
              <Text style={exploreStyles.byCleverText}>{t('explore.byClever')}</Text>
            </View>
            <TouchableOpacity
              ref={imagePickerRef}
              onPress={async () => {
                analyticsService.track('explore_fix_photo_picker_clicked', {
                  is_pro: isPro ? 'true' : 'false',
                  section: 'fix_my_photo'
                });

                const hasAccess = await validatePremiumAccess();
                if (__DEV__) {
                  console.log('📱 Premium access validation:', hasAccess);
                }
                
                const result = await ImagePicker.launchImageLibraryAsync({ 
                  mediaTypes: ['images'], 
                  allowsEditing: false, 
                  quality: 1,
                  presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
                  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
                  exif: false
                });
                if (!result.canceled && result.assets[0]) {
                  analyticsService.track('explore_fix_photo_image_selected', {
                    is_pro: isPro ? 'true' : 'false',
                    image_source: 'gallery'
                  });
                  
                  useQuickEditStore.getState().openWithImage({ 
                    functionType: 'restore_repair', 
                    imageUri: result.assets[0].uri 
                  });
                } else if (!result.canceled) {
                  analyticsService.track('explore_fix_photo_picker_cancelled', {
                    is_pro: isPro ? 'true' : 'false'
                  });
                }
              }}
              style={exploreStyles.pickerButton}
            >
              <IconSymbol name="photo.stack" size={18} color="#EAEAEA" />
            </TouchableOpacity>
          </View>
        );
      case 'backgrounds':
        return (
          <View style={exploreStyles.sectionHeader}>
            <Text style={exploreStyles.sectionTitle}>{t('explore.sections.backgrounds')}</Text>
          </View>
        );
      case 'faceBody':
        return (
          <View style={exploreStyles.sectionHeader}>
            <Text style={exploreStyles.sectionTitle}>{t('explore.sections.faceBody')}</Text>
          </View>
        );
      case 'memorial':
        return (
          <View style={exploreStyles.sectionHeader}>
            <Text style={exploreStyles.sectionTitle}>{t('explore.sections.memorial')}</Text>
          </View>
        );
      case 'outfits':
        return (
          <View style={exploreStyles.sectionHeader}>
            <Text style={exploreStyles.sectionTitle}>{t('explore.sections.outfits')}</Text>
          </View>
        );
      case 'magic':
        return (
          <View style={exploreStyles.sectionHeader}>
            <Text style={exploreStyles.sectionTitle}>{t('explore.sections.magic')}</Text>
          </View>
        );
      default:
        return null;
    }
  }, [t, isPro, router, currentLanguage]);

  const renderSectionContent = React.useCallback((sectionType: SectionData['type']) => {
    switch (sectionType) {
      case 'fixMyPhoto':
        return (
          <View style={{ paddingBottom: 10 }}>
            <DeviceTwoRowCarousel functionType="restore_repair" firstTileRef={firstTileRef} />
          </View>
        );
      case 'backgrounds':
        return <AnimatedBackgrounds firstTileRef={backgroundTileRef} />;
      case 'faceBody':
        return <AnimatedFaceBody />;
      case 'memorial':
        return <MemorialFeatures />;
      case 'outfits':
        return <AnimatedOutfits />;
      case 'magic':
        return <FeatureCardsList compact onOpenBackgrounds={() => openQuick('background')} onOpenClothes={() => openQuick('outfit')} firstTileRef={repairTileRef} />;
      case 'requestFeature':
        return (
          <View style={exploreStyles.requestSection}>
            {/* Rate Us - First */}
            <TouchableOpacity 
              style={exploreStyles.requestButton}
              activeOpacity={0.7}
              onPress={async () => {
                // Track rate us click
                analyticsService.track('rate_us_clicked', {
                  source: 'explore_page',
                  is_pro: isPro ? 'true' : 'false'
                });
                
                try {
                  // Request the native iOS in-app review directly
                  await StoreReview.requestReview();
                } catch {
                  // If native review fails, show fallback
                  Alert.alert(
                    'Rate Clever',
                    'Thank you for using Clever! Please visit the App Store to rate us.',
                    [{ text: 'Got it!' }]
                  );
                }
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconSymbol name="star.fill" size={14} color="rgba(255,255,255,0.8)" />
                <View style={{ flex: 1 }}>
                  <Text style={exploreStyles.requestButtonTitle}>
                    {t('explore.rateUs.title')}
                  </Text>
                  <Text style={exploreStyles.requestButtonSubtitle}>
                    {t('explore.rateUs.subtitle')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={exploreStyles.requestButton}
              activeOpacity={0.7}
              onPress={() => {
                analyticsService.track('request_feature_clicked', {
                  source: 'explore_page',
                  is_pro: isPro ? 'true' : 'false'
                });
                
                Alert.prompt(
                  'Request Feature',
                  'What feature would you like to see added?',
                  async (text) => {
                    if (text && text.trim()) {
                      try {
                        const result = await featureRequestService.submitRequest(text, undefined, isPro, 'feature');
                        if (result.success) {
                          Alert.alert(
                            'Thank You!',
                            'Your feature request has been submitted. We\'ll review it and consider it for future updates.'
                          );
                        } else {
                          Alert.alert('Error', result.error || 'Failed to submit request');
                        }
                      } catch (error) {
                        Alert.alert('Error', 'An unexpected error occurred');
                      }
                    }
                  },
                  'plain-text',
                  '',
                  'Describe the feature you\'d like to see...'
                );
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconSymbol name="lightbulb" size={14} color="rgba(255,255,255,0.8)" />
                <View style={{ flex: 1 }}>
                  <Text style={exploreStyles.requestButtonTitle}>
                    {t('explore.requestFeature.title')}
                  </Text>
                  <Text style={exploreStyles.requestButtonSubtitle}>
                    {t('explore.requestFeature.subtitle')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={exploreStyles.requestButton}
              activeOpacity={0.7}
              onPress={() => {
                analyticsService.track('bug_report_clicked', {
                  source: 'explore_page',
                  is_pro: isPro ? 'true' : 'false'
                });
                
                Alert.prompt(
                  'Report Bug',
                  'What bug did you encounter?',
                  async (text) => {
                    if (text && text.trim()) {
                      try {
                        const result = await featureRequestService.submitRequest(text, undefined, isPro, 'bug');
                        if (result.success) {
                          Alert.alert(
                            'Thank You!',
                            'Your bug report has been submitted. We\'ll investigate and work on a fix.'
                          );
                        } else {
                          Alert.alert('Error', result.error || 'Failed to submit bug report');
                        }
                      } catch (error) {
                        Alert.alert('Error', 'An unexpected error occurred');
                      }
                    }
                  },
                  'plain-text',
                  '',
                  'Describe the bug you encountered...'
                );
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconSymbol name="exclamationmark.triangle" size={14} color="rgba(255,255,255,0.8)" />
                <View style={{ flex: 1 }}>
                  <Text style={exploreStyles.requestButtonTitle}>
                    {t('explore.reportBug.title')}
                  </Text>
                  <Text style={exploreStyles.requestButtonSubtitle}>
                    {t('explore.reportBug.subtitle')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  }, [isPro, openQuick, router, t]);

  const renderItem = React.useCallback(({ item }: { item: SectionData }) => (
    <View style={exploreStyles.sectionContainer}>
      {renderSectionHeader(item.type)}
      {renderSectionContent(item.type)}
    </View>
  ), [renderSectionHeader, renderSectionContent]);

  const keyExtractor = React.useCallback((item: SectionData) => `${item.id}-${i18n.language}`, [i18n.language]);

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
          router.push(recoveryState.recoveryData.route as any);
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
              // Track Pro button click (fire and forget)
              analyticsService.track('explore_pro_button_clicked', {
                is_pro: isPro ? 'true' : 'false',
                section: 'header'
              });

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
              
              // Track settings button click (fire and forget)
              analyticsService.track('explore_settings_button_clicked', {
                is_pro: isPro ? 'true' : 'false'
              });
              
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

      {/* Navigation Pills */}
      <NavigationPills
        ref={navigationRef}
        activeSectionId={activeSectionId}
        sections={[
          { id: 'fixMyPhoto', titleKey: 'explore.sections.fixMyPhoto', onPress: () => {
            analyticsService.track('explore_navigation_pill_clicked', {
              section_id: 'fixMyPhoto',
              is_pro: isPro ? 'true' : 'false'
            });
            scrollToSection('fixMyPhoto');
          }},
          { id: 'magic', titleKey: 'explore.sections.magic', onPress: () => {
            analyticsService.track('explore_navigation_pill_clicked', {
              section_id: 'magic',
              is_pro: isPro ? 'true' : 'false'
            });
            scrollToSection('magic');
          }},
          { id: 'memorial', titleKey: 'explore.sections.memorial', onPress: () => {
            analyticsService.track('explore_navigation_pill_clicked', {
              section_id: 'memorial',
              is_pro: isPro ? 'true' : 'false'
            });
            scrollToSection('memorial');
          }},
          { id: 'faceBody', titleKey: 'explore.sections.faceBody', onPress: () => {
            analyticsService.track('explore_navigation_pill_clicked', {
              section_id: 'faceBody',
              is_pro: isPro ? 'true' : 'false'
            });
            scrollToSection('faceBody');
          }},
          { id: 'backgrounds', titleKey: 'explore.sections.backgrounds', onPress: () => {
            analyticsService.track('explore_navigation_pill_clicked', {
              section_id: 'backgrounds',
              is_pro: isPro ? 'true' : 'false'
            });
            scrollToSection('backgrounds');
          }},
          { id: 'outfits', titleKey: 'explore.sections.outfits', onPress: () => {
            analyticsService.track('explore_navigation_pill_clicked', {
              section_id: 'outfits',
              is_pro: isPro ? 'true' : 'false'
            });
            scrollToSection('outfits');
          }},
        ]}
      />

      <FlashList
        key={i18n.language} // Force re-render when language changes
        ref={scrollViewRef}
        data={sections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={600} // More accurate estimate for video sections
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        initialNumToRender={1} // Only render first section initially
        maxToRenderPerBatch={1} // Render one section at a time
        windowSize={3} // Reduce memory window (was 5)
        removeClippedSubviews={true}
        getItemType={() => 'section'} // Help FlashList optimize
      />
      {/* Bottom quick action rail */}
      <QuickActionRail />
    </SafeAreaView>
    <QuickEditSheet generateButtonRef={generateButtonRef} />
    {Platform.OS === 'ios' && (
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
          overlayAnimationStyle,
        ]}
      />
    )}

    {/* Tour Overlay - only render when needed */}
    {showTourOverlay && (
      <ExploreTourOverlay
        visible={showTourOverlay}
        currentStep={tourStep}
        steps={tourSteps}
        highlightArea={highlightArea}
        showSheet={tourSteps[tourStep]?.id === 'generate'}
        generateButtonRef={generateButtonRef}
        insets={insets}
        onNext={handleTourNext}
        onSkip={handleTourSkip}
        onComplete={handleTourComplete}
        onCTAPress={handleTourCTA}
      />
    )}

    </Animated.View>
  );
}

const exploreStyles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 4
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Lexend-SemiBold',
    letterSpacing: -0.3
  },
  byCleverText: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'Lexend-Medium',
    letterSpacing: -0.1
  },
  pickerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  requestSection: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 8
  },
  requestButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  requestButtonTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Lexend-Medium'
  },
  requestButtonSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: 'Lexend-Regular'
  }
});

