import { IconSymbol } from '@/components/ui/IconSymbol';
import { photoRestorationKeys } from '@/hooks/usePhotoRestoration';
import { photoStorage } from '@/services/storage';
import { localStorageHelpers } from '@/services/supabase';
import { deviceTrackingService } from '@/services/deviceTracking';
import { useRestorationStore } from '@/store/restorationStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { restorePurchasesDetailed, presentPaywall } from '@/services/revenuecat';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import React, { useState, useEffect } from 'react';
import { useTranslation, getSupportedLanguages } from '@/i18n';
import { LanguageSelectionModal } from '@/components/LanguageSelectionModal';
import Constants from 'expo-constants';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function SettingsModalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showFlashButton, toggleFlashButton, setRestorationCount, galleryViewMode, setGalleryViewMode, simpleSlider, setSimpleSlider } = useRestorationStore();
  const { isPro, freeRestorationsUsed, freeRestorationsLimit, expirationDate } = useSubscriptionStore();
  
  // Local loading states
  const [isRestoring, setIsRestoring] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('Available now');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const { t, currentLanguage } = useTranslation();
  const supportedLanguages = getSupportedLanguages();
  
  // Get current language info
  const getCurrentLanguageInfo = () => {
    return supportedLanguages.find(lang => lang.code === currentLanguage) || supportedLanguages[0];
  };

  // Update countdown timer for free users
  useEffect(() => {
    const updateCountdown = async () => {
      if (!isPro) {
        const formattedTime = await deviceTrackingService.getFormattedTimeUntilNext();
        setTimeUntilNext(formattedTime);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isPro]);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  };


  // Delete all photos handler
  const handleDeleteAllPhotos = async () => {
    Alert.alert(
      'Delete All Photos',
      'This will permanently delete all photos in your gallery. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              // Haptic feedback
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              
              // Delete all files and records
              const [, recordsResult] = await Promise.all([
                photoStorage.deleteAllPhotos(),
                localStorageHelpers.deleteAllLocalRestorations(),
              ]);
              
              // Remove queries completely from cache to prevent stale data
              queryClient.removeQueries({ queryKey: ['storage-info'] });
              queryClient.removeQueries({ queryKey: ['restorations'] });
              queryClient.removeQueries({ queryKey: photoRestorationKeys.history() });
              
              // Clean up any orphaned records
              await localStorageHelpers.cleanupOrphanedRecords();
              
              // Force immediate refetch to update restoration count
              await queryClient.refetchQueries({ queryKey: photoRestorationKeys.history() });
              
              // Also refetch storage info
              await queryClient.refetchQueries({ queryKey: ['storage-info'] });
              
              // The refetch above will trigger useRestorationHistory which sets the count to 0
              // But we'll also set it immediately for instant UI feedback
              setRestorationCount(0);
              
              // Success feedback
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              Alert.alert(
                'Photos Deleted',
                `Successfully deleted ${recordsResult.deletedCount} photos.`,
                [{ text: 'OK', style: 'default' }]
              );
            } catch (error) {
              if (__DEV__) {
                console.error('Error deleting all photos:', error);
              }
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              
              Alert.alert(
                'Error',
                'Failed to delete all photos. Please try again.',
                [{ text: 'OK', style: 'default' }]
              );
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Animation values for social media buttons
  const pinterestScale = useSharedValue(1);
  const facebookScale = useSharedValue(1);
  const instagramScale = useSharedValue(1);
  const tiktokScale = useSharedValue(1);
  
  // Animation values for settings buttons
  const shareScale = useSharedValue(1);
  const emailScale = useSharedValue(1);
  const rateScale = useSharedValue(1);

  const handleClose = () => {
    router.back();
  };

  // Subscription handlers
  const handleRestorePurchases = async () => {
    try {
      // Add haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setIsRestoring(true);
      
      const result = await restorePurchasesDetailed();
      
      if (result.success) {
        if (result.hasActiveEntitlements) {
          Alert.alert(
            'Restored!',
            t('alerts.purchasesRestored'),
            [{ text: 'Great!' }]
          );
        } else {
          Alert.alert(
            'No Purchases Found',
            t('alerts.noPurchasesFound'),
            [{ text: t('common.ok') }]
          );
        }
      } else {
        // Only show error alert for actual errors, not cancellations
        if (result.error !== 'cancelled') {
          Alert.alert(
            t('alerts.restoreFailed'),
            result.errorMessage || 'Unable to restore purchases. Please try again.',
            [{ text: t('common.ok') }]
          );
        }
      }
    } catch (error) {
      // Only log errors in development builds
      if (__DEV__) {
        console.error('Error restoring purchases:', error);
      }
      Alert.alert(
        t('common.error'),
        'Failed to restore purchases. Please try again.',
        [{ text: t('common.ok') }]
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const url = Platform.OS === 'ios' 
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
      
      await Linking.openURL(url);
    } catch (error) {
      if (__DEV__) {
        console.error('Error opening subscription management:', error);
      }
      Alert.alert(
        t('common.error'),
        'Unable to open subscription management. Please check your device settings.',
        [{ text: t('common.ok') }]
      );
    }
  };

  // Handle paywall presentation
  const handleShowPaywall = async () => {
    try {
      if (__DEV__) {
        console.log('🎯 Free restoration clicked - showing native paywall');
      }
      
      // Check if we're in Expo Go
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        Alert.alert(
          'Demo Mode',
          'Purchases are not available in Expo Go. Build a development client to test real purchases.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Use native paywall in production builds
      const success = await presentPaywall();
      if (success) {
        if (__DEV__) {
          console.log('✅ Pro subscription activated via native paywall!');
        }
        Alert.alert(
          'Welcome to Pro!',
          'You now have unlimited photo restorations!',
          [{ text: 'Awesome!' }]
        );
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to present paywall:', error);
      }
      Alert.alert(
        'Error',
        'Unable to show subscription options. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Format subscription status
  const getSubscriptionStatus = () => {
    if (isPro) {
      if (expirationDate) {
        const expDate = new Date(expirationDate);
        const isExpired = expDate < new Date();
        
        if (isExpired) {
          return 'Expired';
        } else {
          return `Active until ${expDate.toLocaleDateString()}`;
        }
      }
      return 'Active';
    }
    
    // This should only be shown for free users now
    const status = `Free (${freeRestorationsUsed}/${freeRestorationsLimit} used)`;
    if (timeUntilNext === 'Available now') {
      return status;
    }
    return `${status} • Next in ${timeUntilNext}`;
  };

  // Social media URLs
  const socialMediaUrls = {
    pinterest: 'https://www.pinterest.com/photorestorationhd/',
    facebook: 'https://www.facebook.com/photorestorationhd/',
    instagram: 'https://www.instagram.com/photorestorationhd/',
    tiktok: 'https://www.tiktok.com/@photorestorationhd.com'
  };

  // Animated social media button handler
  const handleSocialMediaPress = async (platform: keyof typeof socialMediaUrls, scaleValue: any) => {
    try {
      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Animation
      scaleValue.value = withSpring(0.9, { damping: 15, stiffness: 300 }, () => {
        scaleValue.value = withSpring(1, { damping: 15, stiffness: 300 });
      });
      
      // Open URL
      await WebBrowser.openBrowserAsync(socialMediaUrls[platform], {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        controlsColor: '#f97316',
        browserPackage: undefined // Let system choose best browser
      });
      
    } catch (error) {
      if (__DEV__) {
        console.error(`Error opening ${platform}:`, error);
      }
      // Fallback haptic feedback for error
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Share app handler
  const handleShareApp = async () => {
    try {
      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Animation
      shareScale.value = withSpring(0.9, { damping: 15, stiffness: 300 }, () => {
        shareScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      });

      // App Store URLs (use placeholders during development)
      const appStoreUrls = {
        ios: 'https://apps.apple.com/app/photo-restoration-hd/id[APP_ID]',
        android: 'https://play.google.com/store/apps/details?id=com.photorestorationhd.app',
        fallback: 'https://photorestorationhd.com' // Fallback URL
      };

      const shareOptions = Platform.select({
        ios: {
          title: 'Photo Restoration HD',
          message: 'Transform your old photos with AI! ✨',
          url: appStoreUrls.ios,
          subject: 'Check out this amazing photo restoration app!'
        },
        android: {
          title: 'Photo Restoration HD',
          message: `Transform your old photos with AI! Check out Photo Restoration HD ✨\n\n${appStoreUrls.android}`,
          dialogTitle: 'Share Photo Restoration HD'
        },
        default: {
          title: 'Photo Restoration HD',
          message: `Transform your old photos with AI! Check out Photo Restoration HD ✨\n\n${appStoreUrls.fallback}`,
          dialogTitle: 'Share Photo Restoration HD'
        }
      });

      const result = await Share.share(shareOptions);
      
      if (result.action === Share.sharedAction) {
        if (__DEV__) {
          console.log('App shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        if (__DEV__) {
          console.log('Share dismissed');
        }
      }
      
    } catch (error) {
      if (__DEV__) {
        console.error('Error sharing app:', error);
      }
      // Fallback haptic feedback for error
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Fallback: copy URL to clipboard
      try {
        const fallbackUrl = 'https://photorestorationhd.com';
        await Clipboard.setStringAsync(fallbackUrl);
        Alert.alert(
          'Link Copied',
          'The app link has been copied to your clipboard!',
          [{ text: t('common.ok'), style: 'default' }]
        );
      } catch (clipboardError) {
        if (__DEV__) {
          console.error('Error copying to clipboard:', clipboardError);
        }
      }
    }
  };

  // Email support handler
  const handleEmailSupport = async () => {
    try {
      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Animation
      emailScale.value = withSpring(0.9, { damping: 15, stiffness: 300 }, () => {
        emailScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      });

      const subject = 'Photo Restoration HD - Support Request';
      const body = `Hi there,

I need help with Photo Restoration HD.

Device: ${Platform.OS} ${Platform.Version}
App Version: 1.0.0

Issue Description:
[Please describe your issue here]

Best regards`;

      const mailUrl = `mailto:photorestorationhd@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      const canOpen = await Linking.canOpenURL(mailUrl);
      if (canOpen) {
        await Linking.openURL(mailUrl);
      } else {
        // Fallback: copy email to clipboard
        await Clipboard.setStringAsync('photorestorationhd@gmail.com');
        Alert.alert(
          'Email Copied',
          'Support email address has been copied to your clipboard!\n\nphotorestorationhd@gmail.com',
          [{ text: t('common.ok'), style: 'default' }]
        );
      }
      
    } catch (error) {
      if (__DEV__) {
        console.error('Error opening email:', error);
      }
      // Fallback haptic feedback for error
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Fallback: copy email to clipboard
      try {
        await Clipboard.setStringAsync('photorestorationhd@gmail.com');
        Alert.alert(
          'Email Copied',
          'Support email address has been copied to your clipboard!\n\nphotorestorationhd@gmail.com',
          [{ text: t('common.ok'), style: 'default' }]
        );
      } catch (clipboardError) {
        if (__DEV__) {
          console.error('Error copying email to clipboard:', clipboardError);
        }
        Alert.alert(
          'Contact Support',
          'Please contact us at: photorestorationhd@gmail.com',
          [{ text: t('common.ok'), style: 'default' }]
        );
      }
    }
  };

  // Rate us handler
  const handleRateUs = async () => {
    try {
      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Animation
      rateScale.value = withSpring(0.9, { damping: 15, stiffness: 300 }, () => {
        rateScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      });

      if (Platform.OS === 'ios') {
        // Check if native review is available
        const isAvailable = await StoreReview.isAvailableAsync();
        if (isAvailable) {
          await StoreReview.requestReview();
        } else {
          // Fallback to App Store
          const appStoreUrl = 'https://apps.apple.com/app/photo-restoration-hd/id[APP_ID]?action=write-review';
          const canOpen = await Linking.canOpenURL(appStoreUrl);
          if (canOpen) {
            await Linking.openURL(appStoreUrl);
          } else {
            Alert.alert(
              'Rate Us',
              'Thank you for using Photo Restoration HD! Please rate us on the App Store.',
              [{ text: t('common.ok'), style: 'default' }]
            );
          }
        }
      } else {
        // Android: Direct to Play Store rating
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.photorestorationhd.app&showAllReviews=true';
        const canOpen = await Linking.canOpenURL(playStoreUrl);
        if (canOpen) {
          await Linking.openURL(playStoreUrl);
        } else {
          Alert.alert(
            'Rate Us',
            'Thank you for using Photo Restoration HD! Please rate us on Google Play Store.',
            [{ text: t('common.ok'), style: 'default' }]
          );
        }
      }
      
    } catch (error) {
      if (__DEV__) {
        console.error('Error opening rating:', error);
      }
      // Fallback haptic feedback for error
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      Alert.alert(
        'Rate Us',
        'Thank you for using Photo Restoration HD! Please rate us on the App Store.',
        [{ text: t('common.ok'), style: 'default' }]
      );
    }
  };

  // Animated styles for social media buttons
  const pinterestStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pinterestScale.value }]
  }));

  const facebookStyle = useAnimatedStyle(() => ({
    transform: [{ scale: facebookScale.value }]
  }));

  const instagramStyle = useAnimatedStyle(() => ({
    transform: [{ scale: instagramScale.value }]
  }));

  const tiktokStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tiktokScale.value }]
  }));

  // Animated styles for settings buttons
  const shareStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shareScale.value }]
  }));

  const emailStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emailScale.value }]
  }));

  const rateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rateScale.value }]
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      <Animated.View entering={FadeIn} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          paddingHorizontal: 16, 
          paddingVertical: 12, 
          borderBottomWidth: 1, 
          borderBottomColor: 'rgba(255,255,255,0.1)' 
        }}>
          <View style={{ width: 32 }} />
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
            {t('settings.title')}
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            style={{ 
              width: 32, 
              height: 32, 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <IconSymbol name="chevron.down" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView 
          style={{ flex: 1, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingVertical: 20 }}>
            
            {/* Subscription Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                {t('settings.subscription')}
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Free Restoration Status */}
                {!isPro && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.1)'
                    }}
                    onPress={handleShowPaywall}
                  >
                    <View style={{
                      width: 36,
                      height: 36,
                      backgroundColor: freeRestorationsUsed >= freeRestorationsLimit && timeUntilNext !== 'Available now' 
                        ? 'rgba(239,68,68,0.2)' 
                        : 'rgba(34,197,94,0.2)',
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12
                    }}>
                      <IconSymbol 
                        name={freeRestorationsUsed >= freeRestorationsLimit && timeUntilNext !== 'Available now' 
                          ? "clock" 
                          : "gift"} 
                        size={18} 
                        color={freeRestorationsUsed >= freeRestorationsLimit && timeUntilNext !== 'Available now' 
                          ? "#ef4444" 
                          : "#22c55e"} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                        {t('settings.freeRestorations')}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                        1 every 48 hours • {timeUntilNext === 'Available now' ? t('language.availableNow') : t('language.nextIn', { time: timeUntilNext })}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: freeRestorationsUsed >= freeRestorationsLimit && timeUntilNext !== 'Available now' 
                        ? 'rgba(239,68,68,0.2)' 
                        : 'rgba(34,197,94,0.2)',
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      marginRight: 8
                    }}>
                      <Text style={{
                        color: freeRestorationsUsed >= freeRestorationsLimit && timeUntilNext !== 'Available now' 
                          ? '#ef4444' 
                          : '#22c55e',
                        fontSize: 12,
                        fontWeight: '600'
                      }}>
                        {freeRestorationsUsed}/{freeRestorationsLimit}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}

                {/* Subscription Status - Only show for Pro users */}
                {isPro && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.1)'
                  }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      backgroundColor: 'rgba(34,197,94,0.2)',
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12
                    }}>
                      <IconSymbol 
                        name="crown.fill"
                        size={18} 
                        color="#22c55e"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                        {t('settings.proSubscription')}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                        {getSubscriptionStatus()}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Restore Purchases */}
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: isPro ? 1 : 0,
                    borderBottomColor: 'rgba(255,255,255,0.1)',
                    opacity: isRestoring ? 0.7 : 1
                  }}
                  onPress={handleRestorePurchases}
                  disabled={isRestoring}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    {isRestoring ? (
                      <ActivityIndicator size="small" color="#f97316" />
                    ) : (
                      <IconSymbol name="arrow.clockwise" size={18} color="#f97316" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      {isRestoring ? t('common.loading') : t('settings.restorePurchases')}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      {isRestoring ? t('common.loading') : t('settings.restorePurchasesDescription')}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Manage Subscription */}
                {isPro && (
                  <TouchableOpacity 
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 16
                    }}
                    onPress={handleManageSubscription}
                  >
                    <View style={{
                      width: 36,
                      height: 36,
                      backgroundColor: 'rgba(249,115,22,0.2)',
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12
                    }}>
                      <IconSymbol name="gear" size={18} color="#f97316" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                        {t('settings.manageSubscription')}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                        {t('settings.manageSubscriptionDescription')}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {/* Connect & Support Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                {t('settings.connectSupport')}
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Follow Us */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.1)'
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="people" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    {t('settings.followUs')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <AnimatedTouchableOpacity
                      style={pinterestStyle}
                      onPress={() => handleSocialMediaPress('pinterest', pinterestScale)}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Visit Pinterest page"
                      accessibilityHint="Opens Pinterest page in browser"
                    >
                      <FontAwesome5 name="pinterest" size={20} color="rgba(255,255,255,0.8)" />
                    </AnimatedTouchableOpacity>
                    <AnimatedTouchableOpacity
                      style={facebookStyle}
                      onPress={() => handleSocialMediaPress('facebook', facebookScale)}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Visit Facebook page"
                      accessibilityHint="Opens Facebook page in browser"
                    >
                      <FontAwesome5 name="facebook" size={20} color="rgba(255,255,255,0.8)" />
                    </AnimatedTouchableOpacity>
                    <AnimatedTouchableOpacity
                      style={instagramStyle}
                      onPress={() => handleSocialMediaPress('instagram', instagramScale)}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Visit Instagram page"
                      accessibilityHint="Opens Instagram page in browser"
                    >
                      <FontAwesome5 name="instagram" size={20} color="rgba(255,255,255,0.8)" />
                    </AnimatedTouchableOpacity>
                    <AnimatedTouchableOpacity
                      style={tiktokStyle}
                      onPress={() => handleSocialMediaPress('tiktok', tiktokScale)}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Visit TikTok page"
                      accessibilityHint="Opens TikTok page in browser"
                    >
                      <FontAwesome5 name="tiktok" size={20} color="rgba(255,255,255,0.8)" />
                    </AnimatedTouchableOpacity>
                  </View>
                </TouchableOpacity>

                {/* Email Support */}
                <AnimatedTouchableOpacity 
                  style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.1)'
                  }, emailStyle]}
                  onPress={handleEmailSupport}
                  activeOpacity={0.8}
                  accessibilityLabel="Email support"
                  accessibilityHint="Opens email to contact support"
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="mail" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    {t('settings.emailSupport')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </AnimatedTouchableOpacity>

                {/* Rate Us */}
                <AnimatedTouchableOpacity 
                  style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.1)'
                  }, rateStyle]}
                  onPress={handleRateUs}
                  activeOpacity={0.8}
                  accessibilityLabel="Rate us"
                  accessibilityHint="Opens rating prompt or app store page"
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="star" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    {t('settings.rateUs')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </AnimatedTouchableOpacity>

                {/* Share App */}
                <AnimatedTouchableOpacity 
                  style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16
                  }, shareStyle]}
                  onPress={handleShareApp}
                  activeOpacity={0.8}
                  accessibilityLabel="Share app"
                  accessibilityHint="Opens share sheet to share app with others"
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="share-social" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    {t('settings.shareApp')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </AnimatedTouchableOpacity>
              </View>
            </View>
            
            {/* Preferences Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                {t('settings.preferences')}
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Language */}
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.1)'
                  }}
                  onPress={() => setShowLanguageModal(true)}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="globe" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    {t('settings.language')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 20 }}>{getCurrentLanguageInfo().flag}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{getCurrentLanguageInfo().nativeName}</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                
                {/* Show Flash Toggle */}
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16
                  }}
                  onPress={toggleFlashButton}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="flash" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      {t('settings.showFlashButton')}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      {t('settings.showFlashButtonDescription')}
                    </Text>
                  </View>
                  <View style={{
                    width: 44,
                    height: 24,
                    backgroundColor: showFlashButton ? '#f97316' : 'rgba(255,255,255,0.2)',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: showFlashButton ? 'flex-end' : 'flex-start',
                    flexDirection: 'row',
                    paddingHorizontal: 2
                  }}>
                    <View style={{
                      width: 20,
                      height: 20,
                      backgroundColor: 'white',
                      borderRadius: 10
                    }} />
                  </View>
                </TouchableOpacity>
                
                {/* Grid View Mode */}
                <TouchableOpacity 
                  onPress={() => setGalleryViewMode(galleryViewMode === 'list' ? 'grid' : 'list')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: __DEV__ ? 1 : 0,
                    borderBottomColor: 'rgba(255,255,255,0.1)'
                  }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol 
                      name="square.grid.2x2" 
                      size={18} 
                      color="#f97316" 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      {t('settings.gridView')}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      {t('settings.gridViewDescription')}
                    </Text>
                  </View>
                  <View style={{
                    width: 44,
                    height: 24,
                    backgroundColor: galleryViewMode === 'grid' ? '#f97316' : 'rgba(255,255,255,0.2)',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: galleryViewMode === 'grid' ? 'flex-end' : 'flex-start',
                    flexDirection: 'row',
                    paddingHorizontal: 2
                  }}>
                    <View style={{
                      width: 20,
                      height: 20,
                      backgroundColor: 'white',
                      borderRadius: 10
                    }} />
                  </View>
                </TouchableOpacity>
                
                {/* Simple Slider Toggle */}
                <TouchableOpacity 
                  onPress={() => setSimpleSlider(!simpleSlider)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: __DEV__ ? 1 : 0,
                    borderBottomColor: 'rgba(255,255,255,0.1)'
                  }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol 
                      name="slider.horizontal.3" 
                      size={18} 
                      color="#f97316" 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Simple Slider
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      Clean line slider without arrows
                    </Text>
                  </View>
                  <View style={{
                    width: 44,
                    height: 24,
                    backgroundColor: simpleSlider ? '#f97316' : 'rgba(255,255,255,0.2)',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: simpleSlider ? 'flex-end' : 'flex-start',
                    flexDirection: 'row',
                    paddingHorizontal: 2
                  }}>
                    <View style={{
                      width: 20,
                      height: 20,
                      backgroundColor: 'white',
                      borderRadius: 10
                    }} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>


            {/* Storage Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                {t('settings.storage')}
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                

                {/* Delete All Photos */}
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16
                  }}
                  onPress={handleDeleteAllPhotos}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(239,68,68,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      {t('settings.deleteAllPhotos')}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      {t('settings.deleteAllPhotosDescription')}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Account & Legal Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                {t('settings.accountLegal')}
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Privacy Policy */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.1)'
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="lock-closed" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    {t('settings.privacyPolicy')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Terms of Use */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="document-text" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    {t('settings.termsOfUse')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* About Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                {t('settings.about')}
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Version */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: 0
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol name="info.circle" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      {t('settings.version')}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      1.0.0
                    </Text>
                  </View>
                </View>

                {/* Help & Support */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol name="questionmark.circle" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      {t('settings.helpSupport')}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      {t('settings.helpSupportDescription')}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>

          </View>
          
          {/* Language Selection Modal */}
          <LanguageSelectionModal 
            visible={showLanguageModal}
            onClose={() => setShowLanguageModal(false)}
          />
          
          {/* Version Info */}
          <View style={{ 
            alignItems: 'center', 
            paddingVertical: 20,
            marginTop: 10
          }}>
            <Text style={{ 
              color: 'rgba(255,255,255,0.4)', 
              fontSize: 14,
              fontWeight: '400'
            }}>
              App version: 3.2 (1)
            </Text>
          </View>
          
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}