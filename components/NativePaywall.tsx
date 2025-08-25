import React, { useEffect } from 'react';
import { View, Alert, Platform } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import Constants from 'expo-constants';

interface NativePaywallProps {
  visible: boolean;
  onDismiss: () => void;
  onPurchaseCompleted?: () => void;
  onRestoreCompleted?: () => void;
}

export function NativePaywall({ 
  visible, 
  onDismiss, 
  onPurchaseCompleted,
  onRestoreCompleted 
}: NativePaywallProps) {
  const { refreshCustomerInfo, checkSubscriptionStatus } = useRevenueCat();
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    if (!visible || isExpoGo) return;

    // Log when paywall is shown
    console.log('📱 Native paywall component mounted');
  }, [visible, isExpoGo]);

  if (!visible || isExpoGo) {
    return null;
  }

  const handlePurchaseStarted = () => {
    console.log('🛒 Purchase started in native paywall');
  };

  const handlePurchaseCompleted = async () => {
    console.log('✅ Purchase completed in native paywall');
    
    // Refresh subscription status via context
    await refreshCustomerInfo();
    const isProNow = await checkSubscriptionStatus();
    
    if (isProNow) {
      Alert.alert(
        'Welcome to Pro!',
        'You now have unlimited photo restorations!',
        [
          {
            text: 'Awesome!',
            onPress: () => {
              onPurchaseCompleted?.();
              onDismiss();
            }
          }
        ]
      );
    }
  };

  const handlePurchaseError = (error: any) => {
    console.error('❌ Purchase error in native paywall:', error);
    
    // Don't show error for user cancellation
    if (error?.userCancelled) {
      return;
    }
    
    Alert.alert(
      'Purchase Failed',
      'Something went wrong. Please try again.',
      [{ text: 'OK' }]
    );
  };

  const handleRestoreStarted = () => {
    console.log('🔄 Restore started in native paywall');
  };

  const handleRestoreCompleted = async () => {
    console.log('✅ Restore completed in native paywall');
    
    // Refresh subscription status via context
    await refreshCustomerInfo();
    const isProNow = await checkSubscriptionStatus();
    
    if (isProNow) {
      Alert.alert(
        'Restored!',
        'Your Pro subscription has been restored.',
        [
          {
            text: 'Great!',
            onPress: () => {
              onRestoreCompleted?.();
              onDismiss();
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'No Purchases Found',
        'No previous purchases were found to restore.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleRestoreError = (error: any) => {
    console.error('❌ Restore error in native paywall:', error);
    Alert.alert(
      'Restore Failed',
      'Unable to restore purchases. Please try again.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0,
      zIndex: 9999 
    }}>
      <RevenueCatUI.Paywall
        onPurchaseStarted={handlePurchaseStarted}
        onPurchaseCompleted={handlePurchaseCompleted}
        onPurchaseError={handlePurchaseError}
        onRestoreStarted={handleRestoreStarted}
        onRestoreCompleted={handleRestoreCompleted}
        onRestoreError={handleRestoreError}
        onDismiss={onDismiss}
      />
    </View>
  );
}