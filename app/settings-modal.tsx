import { LanguageSelectionModal } from '@/components/LanguageSelectionModal';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { photoRestorationKeys } from '@/hooks/usePhotoRestoration';
import { getSupportedLanguages, useTranslation } from '@/i18n';
import { deviceTrackingService } from '@/services/deviceTracking';
import { restorationTrackingService } from '@/services/restorationTracking';
import { getAppUserId, presentPaywall, restorePurchasesDetailed, restorePurchasesSimple } from '@/services/revenuecat';
import { photoStorage } from '@/services/storage';
import { localStorageHelpers } from '@/services/supabase';
import { useRestorationStore } from '@/store/restorationStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { backToLifeService, type BackToLifeUsage } from '@/services/backToLifeService';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
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
  const { setRestorationCount } = useRestorationStore();
  const { isPro, freeRestorationsUsed, freeRestorationsLimit, expirationDate } = useSubscriptionStore();
  const [backToLifeUsage, setBackToLifeUsage] = useState<BackToLifeUsage | null>(null);
  
  // Local loading states
  const [isRestoring, setIsRestoring] = useState(false);
  const [isResettingAppleId, setIsResettingAppleId] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('Available now');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [revenueCatUserId, setRevenueCatUserId] = useState<string | null>(null);
  const [msRemaining, setMsRemaining] = useState<number>(0);
  const { t, currentLanguage } = useTranslation();
  const supportedLanguages = getSupportedLanguages();

  // Fetch Back to Life usage data for Pro users
  useEffect(() => {
    const fetchUsageData = async () => {
      if (isPro) {
        try {
          const usage = await backToLifeService.checkUsage();
          setBackToLifeUsage(usage);
        } catch (error) {
          if (__DEV__) {
            console.error('❌ Failed to fetch Back to Life usage:', error);
          }
        }
      }
    };

    fetchUsageData();
  }, [isPro]);
  
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

  // Update countdown timer for free users
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const initializeCountdown = async () => {
      if (!isPro) {
        // Get initial time remaining from device tracking (only once)
        const initialMsRemaining = await deviceTrackingService.getTimeUntilNextFreeRestoration();
        setMsRemaining(initialMsRemaining);
        setTimeUntilNext(formatTimeWithSeconds(initialMsRemaining));
        
        // Start live countdown that decrements locally every second
        interval = setInterval(() => {
          setMsRemaining(prev => {
            const newMs = Math.max(0, prev - 1000); // Subtract 1 second
            const formattedTime = formatTimeWithSeconds(newMs);
            setTimeUntilNext(formattedTime);
            return newMs;
          });
        }, 1000);
      }
    };

    initializeCountdown();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPro]);

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

  const handleResetAppleId = async () => {
    try {
      // Show confirmation dialog first
      Alert.alert(
        'Reset Apple ID Identity',
        'This will reset your RevenueCat identity to prevent subscription issues when switching Apple IDs. You can restore your purchases afterward if needed.\n\nAre you sure you want to continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Reset', 
            style: 'destructive',
            onPress: async () => {
              try {
                setIsResettingAppleId(true);
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                
                if (__DEV__) {
                  console.log('📱 User triggered Apple ID reset');
                }
                
                // Import RevenueCat and reset identity
                const { default: Purchases } = await import('react-native-purchases');
                await Purchases.logOut();
                
                
                Alert.alert(
                  'Identity Reset',
                  'RevenueCat identity has been reset. If you had a subscription, tap "Restore Purchases" to regain access.',
                  [{ text: 'OK' }]
                );
                
                if (__DEV__) {
                  console.log('✅ Apple ID reset completed successfully');
                }
              } catch (error) {
                if (__DEV__) {
                  console.error('❌ Failed to reset Apple ID:', error);
                }
                
                Alert.alert(
                  'Reset Failed',
                  'Unable to reset Apple ID identity. Please try again.',
                  [{ text: 'OK' }]
                );
              } finally {
                setIsResettingAppleId(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Error in reset Apple ID handler:', error);
      }
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
                        {timeUntilNext === 'Available now' ? t('language.availableNow') : t('language.nextIn', { time: timeUntilNext })}
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

                {/* Video Usage - Only show for Pro users */}
                {isPro && backToLifeUsage && (
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
                      backgroundColor: 'rgba(168,85,247,0.2)',
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12
                    }}>
                      <IconSymbol 
                        name="video.fill"
                        size={18}
                        color="#a855f7"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                        Back to Life Videos
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: !backToLifeUsage.canUse ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12
                    }}>
                      <Text style={{
                        color: !backToLifeUsage.canUse ? '#ef4444' : '#22c55e',
                        fontSize: 12,
                        fontWeight: '600'
                      }}>
                        {backToLifeUsage.used}/{backToLifeUsage.limit}
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

                {/* Reset Apple ID Identity */}
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: isPro ? 1 : 0,
                    borderBottomColor: 'rgba(255,255,255,0.1)',
                    opacity: isResettingAppleId ? 0.7 : 1
                  }}
                  onPress={handleResetAppleId}
                  disabled={isResettingAppleId}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(239,68,68,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    {isResettingAppleId ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <IconSymbol name="person.crop.circle.badge.minus" size={18} color="#ef4444" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      {isResettingAppleId ? 'Resetting...' : 'Reset Apple ID Identity'}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      Fix subscription issues after Apple ID switch
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
                    padding: 16
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
                <TouchableOpacity 
                  onPress={() => WebBrowser.openBrowserAsync('https://cleverapp.lovable.app/privacy-policy')}
                  style={{
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
                <TouchableOpacity 
                  onPress={() => WebBrowser.openBrowserAsync('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
                  style={{
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
      </Animated.View>
    </SafeAreaView>
  );
}