import { LanguageSelectionModal } from '@/components/LanguageSelectionModal';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { photoRestorationKeys } from '@/hooks/usePhotoRestoration';
import { getSupportedLanguages, useTranslation } from '@/i18n';
import { getAppUserId, restorePurchasesSimple, checkSubscriptionStatus } from '@/services/revenuecat';
import { photoStorage } from '@/services/storage';
import { localStorageHelpers } from '@/services/supabase';
import { useRestorationStore } from '@/store/restorationStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { backToLifeService, type BackToLifeUsage } from '@/services/backToLifeService';
import { usePhotoUsage, type PhotoUsage } from '@/services/photoUsageService';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
// Using React Native SafeAreaView to avoid double-insetting
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function SettingsModalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setRestorationCount } = useRestorationStore();
  const { isPro } = useSubscriptionStore();
  const [backToLifeUsage, setBackToLifeUsage] = useState<BackToLifeUsage | null>(null);
  const [photoUsage, setPhotoUsage] = useState<PhotoUsage | null>(null);
  
  // Local loading states
  const [isRestoring, setIsRestoring] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [revenueCatUserId, setRevenueCatUserId] = useState<string | null>(null);
  const { t, currentLanguage } = useTranslation();
  const supportedLanguages = getSupportedLanguages();

  // Use TanStack Query hook for photo usage
  const { data: photoUsageFromQuery, refetch: refetchPhotoUsage } = usePhotoUsage();
  
  // Fetch video usage for Pro users only
  const fetchVideoUsageData = useCallback(async () => {
    try {
      if (isPro) {
        const videoUsageData = await backToLifeService.checkUsage();
        setBackToLifeUsage(videoUsageData);
        if (__DEV__) {
          console.log('🎬 Settings: Updated video usage:', videoUsageData);
        }
      } else {
        setBackToLifeUsage(null);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to fetch video usage data:', error);
      }
    }
  }, [isPro]);

  // Update photo usage from TanStack Query
  useEffect(() => {
    if (photoUsageFromQuery) {
      setPhotoUsage(photoUsageFromQuery);
      if (__DEV__) {
        console.log('📸 Settings: Updated photo usage from query:', photoUsageFromQuery);
      }
    }
  }, [photoUsageFromQuery]);

  // Initial fetch on mount
  useEffect(() => {
    fetchVideoUsageData();
  }, [fetchVideoUsageData]);

  // Refetch usage data when settings modal gets focus (after video generation)
  useFocusEffect(
    useCallback(() => {
      refetchPhotoUsage();
      fetchVideoUsageData();
    }, [refetchPhotoUsage, fetchVideoUsageData])
  );
  
  // Get current language info
  const getCurrentLanguageInfo = () => {
    return supportedLanguages.find(lang => lang.code === currentLanguage) || supportedLanguages[0];
  };

  // Format time remaining with seconds for live countdown
  const formatTimeWithSeconds = (ms: number): string => {
    if (ms === 0) {
      return 'Available now';
    }
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours === 0 && minutes === 0) {
      return `${seconds}s`;
    } else if (hours === 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
  };

  // Note: Countdown timer functionality removed - now using lifetime limits instead of time-based limits

  // Fetch RevenueCat user ID on mount
  useEffect(() => {
    const fetchRevenueCatUserId = async () => {
      try {
        const userId = await getAppUserId();
        setRevenueCatUserId(userId);
        if (__DEV__) {
          console.log('📱 RevenueCat User ID:', userId);
        }
      } catch (error) {
        if (__DEV__) {
          console.log('⚠️ Could not fetch RevenueCat User ID:', error);
        }
        setRevenueCatUserId('Unable to load ID');
      }
    };

    fetchRevenueCatUserId();
  }, []);

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
      
      const result = await restorePurchasesSimple();
      
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

  // Reset subscription identity - safe way to clear RevenueCat cache/anonymous ID
  const handleResetSubscriptionIdentity = async () => {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      Alert.alert('Not Available', 'This feature is not available in Expo Go.');
      return;
    }

    Alert.alert(
      'Reset Subscription Identity',
      'This will reset your RevenueCat identity and sync with the current Apple ID. Use this if you\'re having subscription issues. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setIsResettingIdentity(true);

              if (__DEV__) {
                console.log('🔄 Manual subscription identity reset initiated');
              }

              // Force new anonymous ID creation for anonymous users
              const { default: Purchases } = await import('react-native-purchases');
              
              try {
                // Try logout first (works for identified users)
                await Purchases.logOut();
              } catch (logoutError: any) {
                if (logoutError.message?.includes('anonymous')) {
                  if (__DEV__) {
                    console.log('🔄 User is anonymous - forcing new identity creation');
                  }
                  
                  // For anonymous users, we need to force a complete reset
                  // This is the nuclear option that creates a fresh anonymous ID
                  try {
                    await Purchases.invalidateCustomerInfoCache();
                    
                    // Reconfigure RevenueCat to force new anonymous ID
                    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
                    if (apiKey) {
                      await Purchases.configure({ 
                        apiKey: apiKey,
                        useAmazon: false,
                      });
                    }
                  } catch (reconfigError) {
                    if (__DEV__) {
                      console.log('⚠️ Reconfigure failed, continuing with cache invalidation only');
                    }
                  }
                } else {
                  throw logoutError; // Re-throw non-anonymous errors
                }
              }
              
              await Purchases.invalidateCustomerInfoCache();
              
              // @ts-ignore - method available at runtime  
              await (Purchases as any).syncPurchases?.();
              
              await checkSubscriptionStatus();

              if (__DEV__) {
                console.log('✅ Manual subscription identity reset complete');
              }

              Alert.alert(
                'Reset Complete',
                'Subscription identity has been reset and synced with your current Apple ID.',
                [{ text: 'OK' }]
              );
              
            } catch (error) {
              if (__DEV__) {
                console.error('❌ Manual subscription reset failed:', error);
              }
              Alert.alert(
                'Reset Failed',
                'Unable to reset subscription identity. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsResettingIdentity(false);
            }
          }
        }
      ]
    );
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



  // Subscription status helper no longer needed in UI (subtitle removed)

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

      // App Store URL for iOS
      const appStoreUrl = 'https://apps.apple.com/app/photo-restoration-hd/id6748838784';

      const shareOptions = {
        title: 'Clever',
        message: 'Transform your old photos with AI! ✨',
        url: appStoreUrl,
        subject: 'Check out this amazing photo restoration app!'
      };

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
        await Clipboard.setStringAsync(appStoreUrl);
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

      const subject = 'Clever - Support Request';
      // Clean up the RevenueCat ID to show only the unique part
      let supportId = 'Loading...';
      if (revenueCatUserId) {
        // Remove the $RCAnonymousID: prefix if present, otherwise use full ID
        supportId = revenueCatUserId.replace('$RCAnonymousID:', '') || revenueCatUserId;
      }
      
      const body = `Hi there,

I need help with Clever.

SUPPORT ID: ${supportId}
Device: ${Platform.OS} ${Platform.Version}
App Version: 1.0.5

Please include the Support ID above in your message so we can assist you quickly.

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

      // Check if native review is available
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      } else {
        // Fallback to App Store
        const appStoreUrl = 'https://apps.apple.com/app/photo-restoration-hd/id6748838784?action=write-review';
        const canOpen = await Linking.canOpenURL(appStoreUrl);
        if (canOpen) {
          await Linking.openURL(appStoreUrl);
        } else {
          Alert.alert(
            'Rate Us',
            'Thank you for using Clever! Please rate us on the App Store.',
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
        'Thank you for using Clever! Please rate us on the App Store.',
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
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-white/10">
          <View style={{ width: 32 }} />
          <Text className="text-white text-lg font-semibold">
            {t('settings.title')}
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            className="w-8 h-8 items-center justify-center"
          >
            <IconSymbol name="chevron.down" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView 
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 12, paddingTop: 0 }}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        >
          <View className="pt-0 pb-0">
            
            {/* Subscription Section */}
            <View className="mb-8">
              <Text className="text-amber-500 text-base font-semibold mb-4">
                {t('settings.subscription')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                

                {/* Subscription Status - Only show for Pro users */}
                {isPro && (
                  <View className="flex-row items-center p-4 border-b border-white/10">
                    <View className="w-9 h-9 bg-green-500/20 rounded-full items-center justify-center mr-3">
                      <IconSymbol name="crown.fill" size={18} color="#22c55e" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white text-base font-medium">
                        {t('settings.proSubscription')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Photo Usage - Show for all users (free users have limits) */}
                {photoUsage && (
                  <TouchableOpacity 
                    className="flex-row items-center p-4 border-b border-white/10"
                    onPress={async () => {
                      try {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (__DEV__) {
                          console.log('🔄 Refreshing photo usage from TanStack Query...');
                        }
                        await refetchPhotoUsage();
                      } catch (error) {
                        if (__DEV__) {
                          console.error('❌ Failed to refresh photo usage:', error);
                        }
                      }
                    }}
                  >
                    <View className="w-9 h-9 bg-blue-500/20 rounded-full items-center justify-center mr-3">
                      <IconSymbol name="photo.fill" size={18} color="#3b82f6" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white text-base font-medium">
                        {photoUsage.limit === -1 ? 'Photo Restoration (Unlimited)' : 'Photo Restoration'}
                      </Text>
                      <Text className="text-white/60 text-sm">
                        {photoUsage.planType === 'free' ? 'Tap to refresh' : 'Pro subscription active'}
                      </Text>
                    </View>
                    <View className={`${
                      photoUsage.limit === -1 
                        ? 'bg-blue-500/20' 
                        : !photoUsage.canUse 
                          ? 'bg-red-500/20' 
                          : 'bg-green-500/20'
                    } px-2 py-1 rounded-xl`}>
                      <Text className={`${
                        photoUsage.limit === -1 
                          ? 'text-blue-500' 
                          : !photoUsage.canUse 
                            ? 'text-red-500' 
                            : 'text-green-500'
                      } text-xs font-semibold`}>
                        {photoUsage.limit === -1 ? '∞' : `${photoUsage.used}/${photoUsage.limit}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Video Usage - Only show for Pro users */}
                {isPro && backToLifeUsage && (
                  <TouchableOpacity 
                    className="flex-row items-center p-4 border-b border-white/10"
                    onPress={async () => {
                      try {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (__DEV__) {
                          console.log('🔄 Refreshing Back to Life usage from Supabase...');
                        }
                        await fetchVideoUsageData();
                      } catch (error) {
                        if (__DEV__) {
                          console.error('❌ Failed to refresh video usage data:', error);
                        }
                      }
                    }}
                  >
                    <View className="w-9 h-9 bg-purple-500/20 rounded-full items-center justify-center mr-3">
                      <IconSymbol name="video.fill" size={18} color="#a855f7" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white text-base font-medium">Back to Life Videos</Text>
                      <Text className="text-white/60 text-sm">Tap to refresh</Text>
                    </View>
                    <View className={`${!backToLifeUsage.canUse ? 'bg-red-500/20' : 'bg-green-500/20'} px-2 py-1 rounded-xl`}>
                      <Text className={`${!backToLifeUsage.canUse ? 'text-red-500' : 'text-green-500'} text-xs font-semibold`}>
                        {backToLifeUsage.used}/{backToLifeUsage.limit}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Restore Purchases */}
                <TouchableOpacity 
                  className={`flex-row items-center p-4 ${isPro ? 'border-b border-white/10' : ''}`}
                  onPress={handleRestorePurchases}
                  disabled={isRestoring}
                >
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    {isRestoring ? (
                      <ActivityIndicator size="small" color="#f97316" />
                    ) : (
                      <IconSymbol name="arrow.clockwise" size={18} color="#f97316" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-base font-medium">
                      {isRestoring ? t('common.loading') : t('settings.restorePurchases')}
                    </Text>
                    <Text className="text-white/60 text-sm">
                      {isRestoring ? t('common.loading') : t('settings.restorePurchasesDescription')}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>


              </View>
            </View>
            
            {/* Connect & Support Section */}
            <View className="mb-8">
              <Text className="text-amber-500 text-base font-semibold mb-4">
                {t('settings.connectSupport')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                
                {/* Follow Us */}
                <TouchableOpacity className="flex-row items-center p-4 border-b border-white/10">
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="people" size={18} color="#f97316" />
                  </View>
                  <Text className="text-white text-base font-medium flex-1">
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
                  style={emailStyle}
                  className="flex-row items-center p-4 border-b border-white/10"
                  onPress={handleEmailSupport}
                  activeOpacity={0.8}
                  accessibilityLabel="Email support"
                  accessibilityHint="Opens email to contact support"
                >
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="mail" size={18} color="#f97316" />
                  </View>
                  <Text className="text-white text-base font-medium flex-1">
                    {t('settings.emailSupport')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </AnimatedTouchableOpacity>

                {/* Rate Us */}
                <AnimatedTouchableOpacity 
                  style={rateStyle}
                  className="flex-row items-center p-4 border-b border-white/10"
                  onPress={handleRateUs}
                  activeOpacity={0.8}
                  accessibilityLabel="Rate us"
                  accessibilityHint="Opens rating prompt or app store page"
                >
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="star" size={18} color="#f97316" />
                  </View>
                  <Text className="text-white text-base font-medium flex-1">
                    {t('settings.rateUs')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </AnimatedTouchableOpacity>

                {/* Share App */}
                <AnimatedTouchableOpacity 
                  style={shareStyle}
                  className="flex-row items-center p-4"
                  onPress={handleShareApp}
                  activeOpacity={0.8}
                  accessibilityLabel="Share app"
                  accessibilityHint="Opens share sheet to share app with others"
                >
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="share-social" size={18} color="#f97316" />
                  </View>
                  <Text className="text-white text-base font-medium flex-1">
                    {t('settings.shareApp')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </AnimatedTouchableOpacity>
              </View>
            </View>
            
            {/* Preferences Section */}
            <View className="mb-8">
              <Text className="text-amber-500 text-base font-semibold mb-4">
                {t('settings.preferences')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                
                {/* Language */}
                <TouchableOpacity 
                  className="flex-row items-center p-4"
                  onPress={() => setShowLanguageModal(true)}
                >
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="globe" size={18} color="#f97316" />
                  </View>
                  <Text className="text-white text-base font-medium flex-1">
                    {t('settings.language')}
                  </Text>
                  <View className="flex-row items-center">
                    <Text className="text-xl mr-1">{getCurrentLanguageInfo().flag}</Text>
                    <Text className="text-white/60 text-sm">{getCurrentLanguageInfo().nativeName}</Text>
                  </View>
                  <View className="ml-2">
                    <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                  </View>
                </TouchableOpacity>
                



              </View>
            </View>


            {/* Storage Section */}
            <View className="mb-8">
              <Text className="text-amber-500 text-base font-semibold mb-4">
                {t('settings.storage')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                

                {/* Delete All Photos */}
                <TouchableOpacity 
                  className="flex-row items-center p-4"
                  onPress={handleDeleteAllPhotos}>
                  <View className="w-9 h-9 bg-red-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-base font-medium">
                      {t('settings.deleteAllPhotos')}
                    </Text>
                    <Text className="text-white/60 text-sm">
                      {t('settings.deleteAllPhotosDescription')}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>


            {/* Account & Legal Section */}
            <View className="mb-8">
              <Text className="text-amber-500 text-base font-semibold mb-4">
                {t('settings.accountLegal')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                
                {/* Privacy Policy */}
                <TouchableOpacity 
                  onPress={() => WebBrowser.openBrowserAsync('https://cleverapp.lovable.app/privacy-policy')}
                  className="flex-row items-center p-4 border-b border-white/10"
                >
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="lock-closed" size={18} color="#f97316" />
                  </View>
                  <Text className="text-white text-base font-medium flex-1">
                    {t('settings.privacyPolicy')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Terms of Use */}
                <TouchableOpacity 
                  onPress={() => WebBrowser.openBrowserAsync('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
                  className="flex-row items-center p-4"
                >
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="document-text" size={18} color="#f97316" />
                  </View>
                  <Text className="text-white text-base font-medium flex-1">
                    {t('settings.termsOfUse')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* About Section */}
            <View className="mb-0">
              <Text className="text-amber-500 text-base font-semibold mb-4">
                {t('settings.about')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                
                {/* Version */}
                <View className="flex-row items-center p-4">
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <IconSymbol name="info.circle" size={18} color="#f97316" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-base font-medium">
                      {t('settings.version')}
                    </Text>
                    <Text className="text-white/60 text-sm">
                      1.0.5
                    </Text>
                  </View>
                </View>

              </View>
            </View>

          </View>
          
          {/* Language Selection Modal */}
          <LanguageSelectionModal 
            visible={showLanguageModal}
            onClose={() => setShowLanguageModal(false)}
          />
          
          
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}