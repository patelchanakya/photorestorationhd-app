import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { getOfferings, purchasePackage, restorePurchasesSecure, RevenueCatOfferings } from '@/services/revenuecat';
import { PurchasesPackage } from 'react-native-purchases';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function Paywall({ visible, onClose, onSuccess }: PaywallProps) {
  const [offerings, setOfferings] = useState<RevenueCatOfferings>({});
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (visible) {
      loadOfferings();
    }
  }, [visible]);

  const handleClose = () => {
    // Reset all states before closing to prevent RevenueCat backend errors
    setPurchasing(null);
    setIsRestoring(false);
    onClose();
  };

  const loadOfferings = async () => {
    try {
      setLoading(true);
      
      // Add timeout to prevent hanging on backend errors
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
      });
      
      // Check if we're in Expo Go
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        if (__DEV__) {
          console.log('⚠️ Running in Expo Go - showing demo paywall');
        }
        // Set mock offerings for Expo Go demo
        setOfferings({});
        setLoading(false);
        Alert.alert(
          'Demo Mode',
          'Purchases are not available in Expo Go. Build a development client to test real purchases.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const fetchedOfferings = await getOfferings();
      setOfferings(fetchedOfferings);
      if (__DEV__) {
        console.log('💰 Loaded offerings for paywall:', fetchedOfferings);
      }
    } catch (error) {
      // Only log errors in development builds
      if (__DEV__) {
        console.error('❌ Failed to load offerings:', error);
      }
      Alert.alert('Error', 'Failed to load subscription options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageToPurchase: PurchasesPackage) => {
    try {
      setPurchasing(packageToPurchase.identifier);
      if (__DEV__) {
        console.log('🛒 Starting purchase for:', packageToPurchase.identifier);
      }
      
      const success = await purchasePackage(packageToPurchase);
      
      if (success) {
        if (__DEV__) {
          console.log('✅ Purchase completed successfully');
        }
        Alert.alert(
          'Welcome to Pro!',
          'You now have unlimited photo restorations!',
          [
            {
              text: 'Continue',
              onPress: () => {
                onSuccess();
                onClose();
              },
            },
          ]
        );
      } else {
        // Purchase was cancelled or failed - this is normal user behavior
        // No need to log cancellations as they are expected user actions
      }
    } catch (error) {
      // Only log errors in development builds
      if (__DEV__) {
        console.error('❌ Purchase error:', error);
      }
      // Don't show error alert for user cancellations
      if (!error.userCancelled && error.code !== '1') {
        Alert.alert(
          'Purchase Failed', 
          'Something went wrong. Please try again.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Close paywall on error acknowledgment
                handleClose();
              }
            }
          ]
        );
      } else {
        // For cancellations, just close the paywall
        handleClose();
      }
    } finally {
      setPurchasing(null);
    }
  };

  const formatPrice = (price: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(price);
  };

  const calculateSavings = () => {
    if (!offerings.monthly || !offerings.weekly) return null;
    
    const weeklyPrice = offerings.weekly.product.price;
    const monthlyPrice = offerings.monthly.product.price;
    const weeklyYearlyEquivalent = weeklyPrice * 52; // 52 weeks in a year
    const monthlyYearlyEquivalent = monthlyPrice * 12; // 12 months in a year
    
    const savings = ((weeklyYearlyEquivalent - monthlyYearlyEquivalent) / weeklyYearlyEquivalent) * 100;
    return Math.round(savings);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-white dark:bg-gray-900">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <View className="w-8" />
          <Text className="text-lg font-bold dark:text-white">Upgrade to Pro</Text>
          <TouchableOpacity onPress={handleClose} className="p-1">
            <IconSymbol name="xmark" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {/* Hero Section */}
          <View className="items-center mb-8">
            <View className="bg-blue-100 dark:bg-blue-900 p-4 rounded-full mb-4">
              <IconSymbol name="star.fill" size={32} color="#3B82F6" />
            </View>
            <Text className="text-2xl font-bold text-center mb-2 dark:text-white">
              Unlimited Photo Restoration
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 text-center text-base">
              Remove the daily limit and restore as many photos as you want
            </Text>
          </View>

          {/* Features */}
          <View className="mb-8 space-y-4">
            <View className="flex-row items-center">
              <View className="bg-green-100 dark:bg-green-900 p-2 rounded-full mr-3">
                <IconSymbol name="checkmark" size={16} color="#16A34A" />
              </View>
              <Text className="flex-1 text-gray-700 dark:text-gray-300">
                Unlimited photo restorations
              </Text>
            </View>
            
            <View className="flex-row items-center">
              <View className="bg-green-100 dark:bg-green-900 p-2 rounded-full mr-3">
                <IconSymbol name="checkmark" size={16} color="#16A34A" />
              </View>
              <Text className="flex-1 text-gray-700 dark:text-gray-300">
                No daily limits
              </Text>
            </View>
            
            <View className="flex-row items-center">
              <View className="bg-green-100 dark:bg-green-900 p-2 rounded-full mr-3">
                <IconSymbol name="checkmark" size={16} color="#16A34A" />
              </View>
              <Text className="flex-1 text-gray-700 dark:text-gray-300">
                Priority processing
              </Text>
            </View>
            
            <View className="flex-row items-center">
              <View className="bg-green-100 dark:bg-green-900 p-2 rounded-full mr-3">
                <IconSymbol name="checkmark" size={16} color="#16A34A" />
              </View>
              <Text className="flex-1 text-gray-700 dark:text-gray-300">
                Support app development
              </Text>
            </View>
          </View>

          {/* Pricing Options */}
          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-600 dark:text-gray-400 mt-2">Loading options...</Text>
            </View>
          ) : (
            <View className="space-y-3">
              {/* Monthly Option */}
              {offerings.monthly && (
                <TouchableOpacity
                  onPress={() => handlePurchase(offerings.monthly!)}
                  disabled={purchasing !== null}
                  className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-2xl shadow-lg active:scale-95"
                >
                  {calculateSavings() && (
                    <View className="absolute -top-2 -right-2 bg-amber-500 px-3 py-1 rounded-full">
                      <Text className="text-white text-xs font-bold">
                        Save {calculateSavings()}%
                      </Text>
                    </View>
                  )}
                  
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-white text-lg font-bold">Monthly Pro</Text>
                      <Text className="text-blue-100 text-sm">Billed monthly</Text>
                    </View>
                    
                    <View className="items-end">
                      <Text className="text-white text-xl font-bold">
                        {formatPrice(
                          offerings.monthly.product.price,
                          offerings.monthly.product.currencyCode
                        )}
                      </Text>
                      <Text className="text-blue-100 text-sm">per month</Text>
                    </View>
                  </View>
                  
                  {purchasing === offerings.monthly.identifier && (
                    <View className="absolute inset-0 bg-black/20 rounded-2xl items-center justify-center">
                      <ActivityIndicator size="small" color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Weekly Option */}
              {offerings.weekly && (
                <TouchableOpacity
                  onPress={() => handlePurchase(offerings.weekly!)}
                  disabled={purchasing !== null}
                  className="bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl border border-gray-300 dark:border-gray-600 active:scale-95"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-gray-900 dark:text-white text-lg font-bold">
                        Weekly Pro
                      </Text>
                      <Text className="text-gray-600 dark:text-gray-400 text-sm">
                        Billed weekly
                      </Text>
                    </View>
                    
                    <View className="items-end">
                      <Text className="text-gray-900 dark:text-white text-xl font-bold">
                        {formatPrice(
                          offerings.weekly.product.price,
                          offerings.weekly.product.currencyCode
                        )}
                      </Text>
                      <Text className="text-gray-600 dark:text-gray-400 text-sm">per week</Text>
                    </View>
                  </View>
                  
                  {purchasing === offerings.weekly.identifier && (
                    <View className="absolute inset-0 bg-black/20 rounded-2xl items-center justify-center">
                      <ActivityIndicator size="small" color="#666" />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Restore Purchases Button */}
          <TouchableOpacity
            onPress={async () => {
              try {
                // Add haptic feedback
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                
                setIsRestoring(true);
                
                console.log('🔒 [SECURITY] Starting secure paywall restore with Apple validation...');
                const result = await restorePurchasesSecure();
                
                if (result.success) {
                  if (result.hasActiveEntitlements) {
                    console.log('✅ [SECURITY] Paywall restore successful - subscription confirmed by Apple');
                    Alert.alert(
                      'Restored!',
                      'Your Pro subscription has been restored.',
                      [
                        {
                          text: 'Great!',
                          onPress: () => {
                            onSuccess();
                            onClose();
                          }
                        }
                      ]
                    );
                  } else {
                    console.log('ℹ️ [SECURITY] Paywall restore completed but no active subscriptions found');
                    Alert.alert(
                      'No Purchases Found',
                      'No previous purchases were found to restore.',
                      [{ text: 'OK' }]
                    );
                  }
                } else {
                  // Enhanced error handling for security validation failures
                  if (result.error === 'cancelled' && result.errorMessage?.includes('Apple ID')) {
                    console.log('🚨 [SECURITY] Paywall restore blocked - no subscription on current Apple ID');
                    
                    Alert.alert(
                      'No Subscription Found',
                      'No active subscription found on this Apple ID. Please sign in with the Apple ID used for purchase.',
                      [
                        { text: 'OK', style: 'default' },
                        {
                          text: 'How to Fix',
                          style: 'default',
                          onPress: () => {
                            Alert.alert(
                              'How to Restore Purchases',
                              '1. Go to Settings → App Store\n2. Sign in with the Apple ID used for purchase\n3. Return to Clever and tap Restore Purchases again',
                              [{ text: 'Got it', style: 'default' }]
                            );
                          }
                        }
                      ]
                    );
                  } else {
                    // Only show error alert for actual errors, not security blocks
                    if (result.error !== 'cancelled') {
                      Alert.alert(
                        'Restore Failed',
                        result.errorMessage || 'Unable to restore purchases. Please try again.',
                        [{ text: 'OK' }]
                      );
                    }
                  }
                }
              } catch (error) {
                // Only log errors in development builds
                if (__DEV__) {
                  console.error('❌ Failed to restore purchases:', error);
                }
                Alert.alert(
                  'Restore Failed',
                  'Unable to restore purchases. Please try again.',
                  [{ text: 'OK' }]
                );
              } finally {
                setIsRestoring(false);
              }
            }}
            className="mt-4 py-3 px-6 items-center"
            disabled={isRestoring}
            style={{ opacity: isRestoring ? 0.7 : 1 }}
          >
            {isRestoring ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text className="text-blue-600 dark:text-blue-400 font-medium ml-2">
                  Restoring...
                </Text>
              </View>
            ) : (
              <Text className="text-blue-600 dark:text-blue-400 font-medium">
                Restore Purchases
              </Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Text className="text-xs text-gray-500 dark:text-gray-400 text-center leading-4">
              Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
              You can cancel anytime in your App Store account settings.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}