import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { photoRestorationKeys } from '@/hooks/usePhotoRestoration';
import { analyticsService } from '@/services/analytics';
import { usePhotoUsage, type PhotoUsage } from '@/services/photoUsageService';
import { checkSubscriptionStatus, getAppUserId, presentPaywall, restorePurchasesSecure } from '@/services/revenuecat';
import { getUnifiedTrackingId } from '@/services/trackingIds';
import { photoStorage } from '@/services/storage';
import { localStorageHelpers } from '@/services/supabase';
import { useTranslation } from 'react-i18next';
import type { AvailableLanguage } from '@/src/locales/index';
import { languageNames, availableLanguages } from '@/src/locales/index';
import { useCropModalStore } from '@/store/cropModalStore';
import { useRestorationStore } from '@/store/restorationStore';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    AppState,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    Share,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Purchases from 'react-native-purchases';
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
  const { isPro, refreshCustomerInfo } = useRevenueCat();
  const [photoUsage, setPhotoUsage] = useState<PhotoUsage | null>(null);
  
  // Video processing state management
  const { isVideoProcessing, reset: resetCropModal } = useCropModalStore();
  
  // Local loading states
  const [isRestoring, setIsRestoring] = useState(false);
  const [isResettingIdentity, setIsResettingIdentity] = useState(false);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [revenueCatUserId, setRevenueCatUserId] = useState<string | null>(null);
  
  // Translation system
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language as AvailableLanguage;
  
  const setLanguage = async (language: AvailableLanguage) => {
    try {
      console.log('🔍 DEBUG: Attempting to change to:', language);
      console.log('🔍 DEBUG: Current language before:', i18n.language);
      console.log('🔍 DEBUG: Available resources:', Object.keys(i18n.store.data));
      console.log('🔍 DEBUG: Has Danish resource?', i18n.hasResourceBundle('da', 'translation'));

      // Change language in i18n
      await i18n.changeLanguage(language);

      console.log('🔍 DEBUG: Language after changeLanguage:', i18n.language);
      console.log('🔍 DEBUG: Test translation:', i18n.t('settings.items.emailSupport'));

      // Persist to AsyncStorage as manual selection
      await AsyncStorage.setItem('@app_language', language);
      await AsyncStorage.setItem('@app_language_manual', 'true');

      console.log('🔍 DEBUG: Saved to AsyncStorage:', language);
    } catch (error) {
      console.error('🔍 DEBUG: Failed to set language:', error);
    }
  };
  
  // Language flag mappings
  const languageFlags: Record<AvailableLanguage, string> = {
    'en-US': '🇺🇸',
    'ar': '🇸🇦',
    'hr': '🇭🇷',
    'da': '🇩🇰',
    'nl': '🇳🇱',
    'en-AU': '🇦🇺',
    'en-CA': '🇨🇦',
    'en-GB': '🇬🇧',
    'fi': '🇫🇮',
    'fr': '🇫🇷',
    'fr-CA': '🇨🇦',
    'de': '🇩🇪',
    'it': '🇮🇹',
    'ja': '🇯🇵',
    'ko': '🇰🇷',
    'no': '🇳🇴',
    'pl': '🇵🇱',
    'pt-BR': '🇧🇷',
    'pt-PT': '🇵🇹',
    'ru': '🇷🇺',
    'es-MX': '🇲🇽',
    'es-ES': '🇪🇸',
    'sv': '🇸🇪',
    'tr': '🇹🇷',
    'uk': '🇺🇦',
    'zh-CN': '🇨🇳',
  };
  
  // Ref to track restore operation for cancellation
  const restoreOperationRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Use TanStack Query hook for photo usage
  const { data: photoUsageFromQuery, refetch: refetchPhotoUsage } = usePhotoUsage();
  
  // Fetch video usage for Pro users only
  const fetchVideoUsageData = useCallback(async () => {
    try {
      if (isPro) {
        // Video usage tracking disabled
        if (__DEV__) {
          console.log('🎬 Settings: Video usage tracking disabled');
        }
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

  // Track screen view and refetch usage data when settings modal gets focus
  useFocusEffect(
    useCallback(() => {
      // Track screen view (fire and forget)
      analyticsService.trackScreenView('settings_modal', {
        is_pro: isPro ? 'true' : 'false',
        platform: Platform.OS
      });
      
      refetchPhotoUsage();
      fetchVideoUsageData();
    }, [refetchPhotoUsage, fetchVideoUsageData, isPro])
  );
  
  // Language selection handler
  const handleLanguageSelect = async (language: AvailableLanguage) => {
    try {
      // Track language change (fire and forget)
      analyticsService.track('settings_language_changed', {
        from_language: currentLanguage,
        to_language: language,
        is_pro: isPro ? 'true' : 'false'
      });

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setLanguage(language);
      setIsLanguageModalVisible(false);
    } catch (error) {
      if (__DEV__) {
        console.error('Error setting language:', error);
      }
      
      // Track language change error (fire and forget)
      analyticsService.track('settings_language_change_error', {
        error: error?.toString() || 'unknown_error',
        target_language: language,
        is_pro: isPro ? 'true' : 'false'
      });
    }
  };

  // Format time remaining with seconds for live countdown
  const formatTimeWithSeconds = (ms: number): string => {
    if (ms === 0) {
      return t('settings.time.availableNow');
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

  // AppState listener to cancel restore on backgrounding
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && isRestoring) {
        console.log('📱 App backgrounded during restore - marking operation as cancelled');
        restoreOperationRef.current.cancelled = true;
      }
    });

    return () => subscription?.remove();
  }, [isRestoring]);


  // Clear stuck video processing state
  const handleClearStuckVideo = async () => {
    try {
      console.log('🔧 [DEBUG] Clearing stuck video processing state...');
      
      // Show confirmation alert
      Alert.alert(
        t('alerts.settings.clearVideo.title'),
        t('alerts.settings.clearVideo.message'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('alerts.settings.clearVideo.buttons.clear'),
            style: 'destructive',
            onPress: () => {
              try {
                // Clear the crop modal state
                resetCropModal();
                
                // Clear any pending video and timestamp from AsyncStorage
                AsyncStorage.removeItem('pendingVideo').catch(() => {});
                AsyncStorage.removeItem('lastVideoProcessingTime').catch(() => {});
                
                console.log('✅ [DEBUG] Video processing state cleared');
                
                Alert.alert(
                  t('alerts.settings.clearVideo.success.title'),
                  t('alerts.settings.clearVideo.success.message'),
                  [{ text: t('common.ok') }]
                );
              } catch (error) {
                console.error('❌ [DEBUG] Failed to clear video state:', error);
                Alert.alert(
                  t('alerts.settings.clearVideo.error.title'),
                  t('alerts.settings.clearVideo.error.message'),
                  [{ text: t('common.ok') }]
                );
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ [DEBUG] Error in handleClearStuckVideo:', error);
    }
  };

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
      t('alerts.settings.deleteAllPhotos.title'),
      t('alerts.settings.deleteAllPhotos.message'),
      [
        {
          text: t('alerts.settings.deleteAllPhotos.buttons.cancel'),
          style: 'cancel',
        },
        {
          text: t('alerts.settings.deleteAllPhotos.buttons.delete'),
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
                t('alerts.settings.deleteAllPhotos.success.title'),
                t('alerts.settings.deleteAllPhotos.success.message', { count: recordsResult.deletedCount }),
                [{ text: t('common.ok'), style: 'default' }]
              );
            } catch (error) {
              if (__DEV__) {
                console.error('Error deleting all photos:', error);
              }
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              
              Alert.alert(
                t('alerts.settings.deleteAllPhotos.error.title'),
                t('alerts.settings.deleteAllPhotos.error.message'),
                [{ text: t('common.ok'), style: 'default' }]
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
      // Prevent double-tapping
      if (isRestoring) {
        console.log('🔒 Restore already in progress, ignoring tap');
        return;
      }

      // Track restore purchases attempt (fire and forget)
      analyticsService.track('settings_restore_purchases_attempted', {
        is_pro: isPro ? 'true' : 'false',
        platform: Platform.OS
      });

      // Add haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setIsRestoring(true);
      
      // Reset cancellation flag
      restoreOperationRef.current.cancelled = false;
      
      console.log('🔒 [SECURITY] Starting secure restore with Apple validation...');
      const result = await restorePurchasesSecure();
      
      // Check if operation was cancelled due to backgrounding
      if (restoreOperationRef.current.cancelled) {
        console.log('🚫 Restore operation was cancelled due to app backgrounding');
        Alert.alert(
          t('alerts.settings.restoreInterrupted.title'),
          t('alerts.settings.restoreInterrupted.message'),
          [{ text: t('common.ok') }]
        );
        return;
      }
      
      if (result.success) {
        if (result.hasActiveEntitlements) {
          console.log('✅ [SECURITY] Restore successful - subscription confirmed by Apple');
          
          // Track successful restore (fire and forget)
          analyticsService.track('settings_restore_purchases_success', {
            had_active_entitlements: 'true',
            platform: Platform.OS
          });
          
          // Refresh context to update UI state
          await refreshCustomerInfo();
          
          Alert.alert(
            t('alerts.settings.restore.success.title'),
            t('alerts.settings.restore.success.message'),
            [{ text: t('common.buttons.great') }]
          );
        } else {
          console.log('ℹ️ [SECURITY] Restore completed but no active subscriptions found');
          
          // Track no purchases found (fire and forget)
          analyticsService.track('settings_restore_purchases_no_entitlements', {
            platform: Platform.OS
          });
          
          Alert.alert(
            t('alerts.settings.restore.noPurchases.title'),
            t('alerts.settings.restore.noPurchases.message'),
            [{ text: t('common.ok') }]
          );
        }
      } else {
        // Enhanced error handling for security validation failures
        if (result.error === 'cancelled' && result.errorMessage?.includes('Apple ID')) {
          console.log('🚨 [SECURITY] Restore blocked - no subscription on current Apple ID');
          
          Alert.alert(
            t('alerts.settings.noSubscription.title'),
            t('alerts.settings.noSubscription.message'),
            [
              { text: t('common.ok'), style: 'default' },
              {
                text: t('common.buttons.howToFix'),
                style: 'default',
                onPress: () => {
                  Alert.alert(
                    t('alerts.settings.howToRestore.title'),
                    t('alerts.settings.howToRestore.message'),
                    [{ text: t('common.buttons.gotIt'), style: 'default' }]
                  );
                }
              }
            ]
          );
        } else {
          // Only show error alert for actual errors, not security blocks
          if (result.error !== 'cancelled') {
            Alert.alert(
              t('alerts.settings.restore.failed.title'),
              result.errorMessage || t('alerts.settings.restore.failed.message'),
              [{ text: t('common.ok') }]
            );
          }
        }
      }
    } catch (error) {
      // Only log errors in development builds
      if (__DEV__) {
        console.error('Error restoring purchases:', error);
      }
      Alert.alert(
        t('alerts.settings.restore.failed.title'),
        t('alerts.settings.restore.failed.message'),
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
      Alert.alert(t('alerts.settings.notAvailable.title'), t('alerts.settings.notAvailable.message'));
      return;
    }

    Alert.alert(
      t('alerts.settings.resetIdentity.title'),
      t('alerts.settings.resetIdentity.message'),
      [
        { text: t('alerts.settings.resetIdentity.buttons.cancel'), style: 'cancel' },
        {
          text: t('alerts.settings.resetIdentity.buttons.reset'),
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setIsResettingIdentity(true);

              if (__DEV__) {
                console.log('🔄 Manual subscription identity reset initiated');
              }

              // Force new anonymous ID creation for anonymous users
              
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
                t('alerts.settings.resetIdentity.success.title'),
                t('alerts.settings.resetIdentity.success.message'),
                [{ text: t('common.ok') }]
              );
              
            } catch (error) {
              if (__DEV__) {
                console.error('❌ Manual subscription reset failed:', error);
              }
              Alert.alert(
                t('alerts.settings.resetIdentity.error.title'),
                t('alerts.settings.resetIdentity.error.message'),
                [{ text: t('common.ok') }]
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
          t('alerts.settings.demoMode.title'),
          t('alerts.settings.demoMode.message'),
          [{ text: t('common.ok') }]
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
          t('alerts.settings.welcomeToPro.title'),
          t('alerts.settings.welcomeToPro.message'),
          [{ text: t('common.buttons.awesome') }]
        );
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to present paywall:', error);
      }
      Alert.alert(
        t('alerts.settings.paywallerror.title'),
        t('alerts.settings.paywallerror.message'),
        [{ text: t('common.ok') }]
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
      // Track social media click (fire and forget)
      analyticsService.track('settings_social_media_clicked', {
        platform: platform,
        is_pro: isPro ? 'true' : 'false'
      });

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
        const appStoreUrl = 'https://apps.apple.com/app/photo-restoration-hd/id6748838784';
        await Clipboard.setStringAsync(appStoreUrl);
        Alert.alert(
          t('sharing.linkCopied.title'),
          t('sharing.linkCopied.message'),
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
      // Get unified tracking ID (same as used in photo/video tracking)
      let supportId = 'Loading...';
      try {
        const trackingId = await getUnifiedTrackingId('photo');
        if (trackingId) {
          // Clean up the tracking ID - remove prefixes for cleaner support ID
          supportId = trackingId
            .replace('$RCAnonymousID:', '')
            .replace('orig:', '')
            .replace('store:', '')
            .replace('fallback:', '');
        } else if (revenueCatUserId) {
          // Fallback to cleaned RevenueCat ID if tracking service fails
          supportId = revenueCatUserId.replace('$RCAnonymousID:', '') || revenueCatUserId;
        }
      } catch (error) {
        console.error('Failed to get unified tracking ID for support:', error);
        if (revenueCatUserId) {
          supportId = revenueCatUserId.replace('$RCAnonymousID:', '') || revenueCatUserId;
        }
      }
      
      const body = `Hi there,

I need help with Clever.

Issue Description:
[Please describe your issue here]

SUPPORT ID: ${supportId}
Device: ${Platform.OS} ${Platform.Version}
App Version: 2.0.2

Please include the Support ID above in your message so we can assist you quickly.

Best regards`;

      const mailUrl = `mailto:photorestorationhd@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      const canOpen = await Linking.canOpenURL(mailUrl);
      if (canOpen) {
        await Linking.openURL(mailUrl);
      } else {
        // Fallback: copy email to clipboard
        await Clipboard.setStringAsync('photorestorationhd@gmail.com');
        Alert.alert(
          t('sharing.emailCopied.title'),
          t('sharing.emailCopied.message'),
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
          t('sharing.emailCopied.title'),
          t('sharing.emailCopied.message'),
          [{ text: t('common.ok'), style: 'default' }]
        );
      } catch (clipboardError) {
        if (__DEV__) {
          console.error('Error copying email to clipboard:', clipboardError);
        }
        Alert.alert(
          t('sharing.contactSupport.title'),
          t('sharing.contactSupport.message'),
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
            t('sharing.rateUs.title'),
            t('sharing.rateUs.message'),
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
        t('sharing.rateUs.title'),
        t('sharing.rateUs.message'),
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
          <TouchableOpacity
            onPress={handleClose}
            className="w-8 h-8 items-center justify-center"
          >
            <IconSymbol name="arrow.left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: 18, fontFamily: 'Lexend-SemiBold' }}>
            {t('settings.title')}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Content */}
        <ScrollView 
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 12, paddingTop: 24 }}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        >
          <View className="pt-0 pb-0">
            
            {/* Subscription Section */}
            <View className="mb-8">
              <Text style={{ color: '#f59e0b', fontSize: 16, fontFamily: 'Lexend-SemiBold', marginBottom: 16 }}>
                {t('settings.sections.subscription')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                

                {/* Subscription Status - Only show for Pro users */}
                {isPro && (
                  <View className="flex-row items-center p-4 border-b border-white/10">
                    <View className="w-9 h-9 bg-green-500/20 rounded-full items-center justify-center mr-3">
                      <IconSymbol name="crown.fill" size={18} color="#22c55e" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium' }}>
                        {t('settings.items.proMember')}
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
                      <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium' }}>
                        {photoUsage.limit === -1 ? t('settings.items.photosUsed') + ' (Unlimited)' : t('settings.items.photosUsed')}
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

                {/* BackToLife feature removed */}

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
                    <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium' }}>
                      {isRestoring ? t('settings.status.checkingAppStore') : t('settings.items.restorePurchases')}
                    </Text>
                    <Text className="text-white/60 text-sm">
                      {isRestoring ? t('settings.status.verifying') : t('settings.status.syncPurchases')}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>


              </View>
            </View>
            
            {/* Language Section */}
            <View className="mb-8">
              <Text style={{ color: '#f59e0b', fontSize: 16, fontFamily: 'Lexend-SemiBold', marginBottom: 16 }}>
                {t('settings.items.language')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                <TouchableOpacity 
                  className="flex-row items-center p-4"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsLanguageModalVisible(true);
                  }}
                >
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="globe" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium', flex: 1 }}>
                    {t('settings.items.language')}
                  </Text>
                  <View className="flex-row items-center">
                    <Text className="text-xl mr-2">{languageFlags[currentLanguage]}</Text>
                    <Text className="text-white/60 text-sm">{languageNames[currentLanguage]}</Text>
                  </View>
                  <View className="ml-2">
                    <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Connect & Support Section */}
            <View className="mb-8">
              <Text style={{ color: '#f59e0b', fontSize: 16, fontFamily: 'Lexend-SemiBold', marginBottom: 16 }}>
                {t('settings.sections.connectSupport')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                
                {/* Follow Us */}
                <TouchableOpacity className="flex-row items-center p-4 border-b border-white/10">
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="people" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium', flex: 1 }}>
                    {t('settings.sections.followUs')}
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
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium', flex: 1 }}>
                    {t('settings.items.emailSupport')}
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
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium', flex: 1 }}>
                    {t('settings.items.rateUs')}
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
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium', flex: 1 }}>
                    {t('settings.items.shareApp')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </AnimatedTouchableOpacity>
              </View>
            </View>
            

            {/* Debug Section - Development Only */}



            {/* Account & Legal Section */}
            <View className="mb-8">
              <Text style={{ color: '#f59e0b', fontSize: 16, fontFamily: 'Lexend-SemiBold', marginBottom: 16 }}>
                {t('settings.sections.accountLegal')}
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
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium', flex: 1 }}>
                    {t('settings.items.privacyPolicy')}
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
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium', flex: 1 }}>
                    {t('settings.items.termsOfService')}
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>


            {/* About Section */}
            <View className="mb-0">
              <Text style={{ color: '#f59e0b', fontSize: 16, fontFamily: 'Lexend-SemiBold', marginBottom: 16 }}>
                {t('settings.sections.about')}
              </Text>
              
              <View className="bg-white/5 rounded-xl overflow-hidden">
                
                {/* Version */}
                <View className="flex-row items-center p-4">
                  <View className="w-9 h-9 bg-amber-500/20 rounded-full items-center justify-center mr-3">
                    <IconSymbol name="info.circle" size={18} color="#f97316" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Lexend-Medium' }}>
                      {t('settings.items.version')}
                    </Text>
                    <Text className="text-white/60 text-sm">
                      2.0.2
                    </Text>
                  </View>
                </View>

              </View>
            </View>

          </View>
          
        </ScrollView>
        
        {/* Language Selection Modal */}
        <Modal
          visible={isLanguageModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsLanguageModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#111111', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: 'white', fontSize: 18, fontFamily: 'Lexend-SemiBold', flex: 1, textAlign: 'center' }}>
                  {t('settings.items.language')}
                </Text>
                <TouchableOpacity 
                  onPress={() => setIsLanguageModalVisible(false)}
                  style={{ position: 'absolute', right: 20, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}
                >
                  <IconSymbol name="xmark" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
              
              {/* Language List */}
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {availableLanguages.map((language) => (
                  <TouchableOpacity
                    key={language}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.05)'
                    }}
                    onPress={() => handleLanguageSelect(language)}
                  >
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{languageFlags[language]}</Text>
                    <Text style={{ 
                      color: 'white', 
                      fontSize: 16, 
                      fontFamily: 'Lexend-Medium',
                      flex: 1
                    }}>
                      {languageNames[language]}
                    </Text>
                    {currentLanguage === language && (
                      <IconSymbol name="checkmark" size={18} color="#22c55e" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        
      </View>
    </SafeAreaView>
  );
}