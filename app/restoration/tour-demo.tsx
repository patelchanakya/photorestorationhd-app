import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { SavingModal, type SavingModalRef } from '@/components/SavingModal';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRestorationStore } from '@/store/restorationStore';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Asset } from 'expo-asset';
import { presentPaywall } from '@/services/revenuecat';
import { analyticsService } from '@/services/analytics';
import { clarityService } from '@/services/clarityService';
import React, { useRef, useState, useEffect } from 'react';
import {
  Dimensions,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Platform,
  Linking,
  Image, // React Native Image for resolveAssetSource
  Modal
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing
} from 'react-native-reanimated';

// Get screen dimensions for responsive design
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_HEIGHT < 700;

export default function TourDemoScreen() {
  const { tourComplete } = useLocalSearchParams();
  const simpleSlider = useRestorationStore((state) => state.simpleSlider);
  const safeAreaInsets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Modal states
  const [showSavingModal, setShowSavingModal] = useState(false);
  const [showTourSuccessModal, setShowTourSuccessModal] = useState(false);
  const [hasShownSuccessModal, setHasShownSuccessModal] = useState(false);
  const savingModalRef = useRef<SavingModalRef>(null);

  // Success animation values
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.8);

  const isTourMode = tourComplete === 'true';

  // Track tour demo started on mount
  useEffect(() => {
    try {
      analyticsService.track('tour_demo_started', {
        tour_complete: isTourMode ? 'true' : 'false',
        screen_width: SCREEN_WIDTH,
        screen_height: SCREEN_HEIGHT,
        is_small_device: isSmallDevice ? 'true' : 'false'
      });
      clarityService.setCustomTag('tour_demo_session', 'active');
    } catch (error) {
      console.error('Failed to track tour demo started:', error);
    }
  }, [isTourMode]);

  // Helper function to show success modal with animation
  const showSuccessModal = () => {
    if (!hasShownSuccessModal) {
      // Track success modal shown
      try {
        analyticsService.track('tour_demo_success_modal_shown', {
          tour_complete: isTourMode ? 'true' : 'false'
        });
      } catch (error) {
        console.error('Failed to track success modal:', error);
      }

      setShowTourSuccessModal(true);
      setHasShownSuccessModal(true);
      // Start animation
      successOpacity.value = withSpring(1, { damping: 20, stiffness: 80 });
      successScale.value = withSpring(1, { damping: 18, stiffness: 100 });
    }
  };

  // Direct asset URIs - no resolution needed
  const beforeImage = require('../../assets/images/bw.jpeg');
  const afterImage = require('../../assets/images/clr.jpeg');


  const handleDismiss = () => {
    try {
      analyticsService.track('tour_demo_dismissed', {
        tour_complete: isTourMode ? 'true' : 'false',
        action_type: 'back_button'
      });
    } catch (error) {
      console.error('Failed to track tour demo dismissed:', error);
    }
    router.dismissTo('/explore');
  };

  const handleExport = async () => {
    try {
      // Track save button tapped
      analyticsService.track('tour_demo_save_tapped', {
        tour_complete: isTourMode ? 'true' : 'false'
      });

      // Show saving modal
      setShowSavingModal(true);

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      console.log('🎯 Tour demo save - starting save process...');
      
      // Request permissions first
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Photo library access denied');
      }
      
      // Load the bundled asset using expo-asset
      const asset = Asset.fromModule(afterImage);
      await asset.downloadAsync();
      
      console.log('🎯 Asset downloaded:', asset.localUri || asset.uri);
      
      // Save to camera roll using the local URI
      const mediaAsset = await MediaLibrary.createAssetAsync(asset.localUri || asset.uri);
      console.log('🎯 Asset saved to camera roll:', mediaAsset.id);
      
      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Trigger success state in modal
      savingModalRef.current?.showSuccess();

      // Track successful save
      analyticsService.track('tour_demo_saved_successfully', {
        tour_complete: isTourMode ? 'true' : 'false',
        save_method: 'camera_roll'
      });
      
    } catch (err: any) {
      console.error('Save failed, attempting fallback to share:', err);
      
      // Hide modal on error
      setShowSavingModal(false);
      
      // Error feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Check if it's a permission error and show helpful dialog
      if (err.message?.includes('Photo library access denied') || err.message?.includes('permission')) {
        Alert.alert(
          t('alerts.errors.permissions.photos.title'),
          t('alerts.errors.permissions.photos.message'),
          [
            {
              text: t('common.openSettings'),
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                }
              }
            },
            {
              text: t('common.shareInstead'),
              onPress: () => {
                handleShare();
              }
            },
            { text: t('common.cancel'), style: 'cancel' }
          ]
        );
      } else {
        // For other errors, auto-fallback to share
        handleShare();
      }
    }
  };

  // Animated styles for success modal
  const successCardStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [
      { scale: successScale.value },
      { translateY: (1 - successOpacity.value) * 30 }
    ],
  }));


  const handleShare = async () => {
    try {
      // Track share button tapped
      analyticsService.track('tour_demo_share_tapped', {
        tour_complete: isTourMode ? 'true' : 'false'
      });

      console.log('🎯 Tour demo share - starting share process...');
      
      // Load the bundled asset using expo-asset
      const asset = Asset.fromModule(afterImage);
      await asset.downloadAsync();
      
      const imageUri = asset.localUri || asset.uri;
      console.log('🎯 Asset ready for sharing:', imageUri);
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }
      
      // Use expo-sharing directly with local file
      await Sharing.shareAsync(imageUri, {
        mimeType: 'image/jpeg',
        dialogTitle: t('common.shareRestoredPhoto'),
      });

      // Track successful share
      analyticsService.track('tour_demo_shared_successfully', {
        tour_complete: isTourMode ? 'true' : 'false',
        share_method: 'expo_sharing'
      });

      // Show success modal after share modal closes (regardless of whether they shared or cancelled)
      if (isTourMode && !hasShownSuccessModal) {
        setTimeout(() => showSuccessModal(), 300);
      }
      
    } catch (error: any) {
      console.error('Expo-sharing failed, trying React Native Share:', error);
      
      // Fallback to React Native Share
      try {
        const imageUri = Image.resolveAssetSource(afterImage).uri;
        
        const shareResult = await Share.share({
          url: imageUri,
          message: t('sharing.defaultMessage'),
        });

        // Track fallback share
        analyticsService.track('tour_demo_shared_successfully', {
          tour_complete: isTourMode ? 'true' : 'false',
          share_method: 'react_native_share'
        });

        // Show success modal after share modal closes (regardless of share/cancel)
        if (isTourMode && !hasShownSuccessModal) {
          setTimeout(() => showSuccessModal(), 300);
        }
        
        console.log('📤 React Native Share result:', shareResult);
        
      } catch (rnShareError: any) {
        console.error('Both share methods failed:', rnShareError);
        Alert.alert(t('alerts.errors.sharing.failed'), t('alerts.errors.sharing.message'));
      }
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
        {/* Clean Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          paddingHorizontal: 16, 
          paddingVertical: 12, 
          borderBottomWidth: 1, 
          borderBottomColor: 'rgba(255,255,255,0.08)' 
        }}>
          <TouchableOpacity onPress={handleDismiss} style={{ padding: 8, marginLeft: -8 }}>
            <IconSymbol name="chevron.left" size={isSmallDevice ? 20 : 24} color="#EAEAEA" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={{ 
              fontSize: isSmallDevice ? 14 : 16, 
              fontWeight: '600', 
              color: '#FFFFFF', 
              textAlign: 'center' 
            }} numberOfLines={1}>
              {t('onboardingV4.tourDemo.screen.title')}
            </Text>
          </View>
          {/* Placeholder for right side */}
          <View style={{ width: isSmallDevice ? 36 : 40 }} />
        </View>

        {/* Main Content */}
        <ScrollView 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {/* Before/After Slider */}
            <View style={{ 
              paddingVertical: isTinyDevice ? 16 : 0, 
              flex: isTinyDevice ? 0 : 1, 
              justifyContent: isTinyDevice ? 'flex-start' : 'center' 
            }}>
              <BeforeAfterSlider
                beforeUri={Image.resolveAssetSource(beforeImage).uri}
                afterUri={Image.resolveAssetSource(afterImage).uri}
                style={{ marginVertical: isTinyDevice ? 10 : 20 }}
                simpleSlider={simpleSlider}
              />
            </View>

            {/* Primary Actions - 70/30 split */}
            <View style={{ paddingBottom: isTinyDevice ? 16 : 24 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Share Button - Green gradient like real restoration */}
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 56,
                    borderRadius: 28,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.25)'
                  }}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#059669', '#10b981']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#0B0B0F', fontWeight: '900', fontSize: 16 }}>{t('onboardingV4.tourDemo.actions.share')}</Text>
                  </View>
                </TouchableOpacity>

                {/* Save Button - Transparent like real restoration */}
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onPress={handleExport}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{t('onboardingV4.tourDemo.actions.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
        
        {/* Saving Modal */}
        <SavingModal
          ref={savingModalRef}
          visible={showSavingModal}
          onComplete={() => {
            setShowSavingModal(false);
            // Show success modal after save completes (only in tour mode)
            if (isTourMode && !hasShownSuccessModal) {
              setTimeout(() => showSuccessModal(), 300);
            }
          }}
        />

        {/* Tour Success Modal - Full Success Card */}
        {showTourSuccessModal && (
          <Modal
            visible={showTourSuccessModal}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={() => setShowTourSuccessModal(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingTop: safeAreaInsets.top + 40,
                paddingBottom: safeAreaInsets.bottom + 40,
                paddingHorizontal: 20,
              }}
            >
              <Animated.View 
                style={[
                  {
                    width: '100%',
                    maxWidth: 400,
                    backgroundColor: '#0B0B0F',
                    borderRadius: 32,
                    padding: 32,
                    borderWidth: 1.5,
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.4,
                    shadowRadius: 20,
                    elevation: 10,
                  },
                  successCardStyle
                ]}
              >
                {/* Success Icon */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: '#10B981',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12
                  }}>
                    <IconSymbol name="checkmark" size={28} color="#FFFFFF" />
                  </View>
                  
                  <Text style={{
                    fontSize: 20,
                    fontFamily: 'Lexend-SemiBold',
                    color: '#FFFFFF',
                    textAlign: 'center',
                    marginBottom: 8
                  }}>
                    {t('onboardingV4.tourDemo.success.title')}
                  </Text>
                  
                  <Text style={{
                    fontSize: 14,
                    color: '#A1A1AA',
                    textAlign: 'center',
                    lineHeight: 20
                  }}>
                    {t('onboardingV4.tourDemo.success.description')}
                  </Text>
                </View>

                {/* Progress indicator */}
                <View style={{ 
                  alignItems: 'center', 
                  marginBottom: 20,
                  paddingHorizontal: 20 
                }}>
                  <View style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(16, 185, 129, 0.2)'
                  }}>
                    <Text style={{
                      fontSize: 13,
                      color: '#10B981',
                      textAlign: 'center',
                      fontFamily: 'Lexend-Medium'
                    }}>
                      {t('onboardingV4.tourDemo.success.complete')}
                    </Text>
                  </View>
                </View>

                {/* Pro upgrade section */}
                <View style={{
                  backgroundColor: 'rgba(249, 115, 22, 0.08)',
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(249, 115, 22, 0.15)'
                }}>
                  <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconSymbol name="sparkles" size={18} color="#10B981" />
                      <Text style={{
                        fontSize: 16,
                        fontFamily: 'Lexend-SemiBold',
                        color: '#10B981',
                        marginLeft: 6
                      }}>
                        {t('onboardingV4.tourDemo.upgrade.title')}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={{
                    fontSize: 13,
                    color: '#A1A1AA',
                    lineHeight: 19,
                    marginBottom: 16,
                    textAlign: 'center'
                  }}>
                    {t('onboardingV4.tourDemo.upgrade.features')}
                  </Text>
                  
                  <TouchableOpacity
                    style={{
                      height: 50,
                      borderRadius: 25,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onPress={async () => {
                      console.log('🎯 Tour demo CTA clicked');
                      try {
                        // Show paywall
                        await presentPaywall();
                      } catch (error) {
                        console.error('🎯 Paywall error:', error);
                      }
                      // After paywall (success or error), just close modal - stay on restoration screen
                      setShowTourSuccessModal(false);
                    }}
                  >
                    <LinearGradient
                      colors={['#FF7A00', '#FFB54D']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                      }}
                    />
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 15,
                      fontFamily: 'Lexend-Bold'
                    }}>
                      {t('onboardingV4.tourDemo.upgrade.action')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Skip option */}
                <TouchableOpacity
                  onPress={() => {
                    setShowTourSuccessModal(false);
                  }}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={{
                    color: '#6B7280',
                    fontSize: 14,
                    textAlign: 'center',
                    fontFamily: 'Lexend-Medium'
                  }}>
                    {t('onboardingV4.tourDemo.upgrade.skip')}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}