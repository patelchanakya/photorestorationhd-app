import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { UserIdPersistenceService } from '@/services/userIdPersistence';
import { restorePurchases } from '@/services/revenuecat';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { IconSymbol } from './ui/IconSymbol';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

/**
 * Shows a restore purchases hint for users who might have lost their subscription
 * This appears when:
 * 1. User is not PRO
 * 2. No saved user ID exists (likely new device)
 * 3. User hasn't dismissed the hint
 */
export function RestorePurchasesHint() {
  const [showHint, setShowHint] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { isPro } = useRevenueCat();

  useEffect(() => {
    checkIfShouldShowHint();
  }, [isPro]);

  const checkIfShouldShowHint = async () => {
    // Don't show if user is already PRO
    if (isPro) {
      setShowHint(false);
      return;
    }

    // Check if this might be a new device (no saved ID)
    const savedId = await UserIdPersistenceService.getSavedUserId();
    const hadPro = await UserIdPersistenceService.getHadProStatus();
    
    // Show hint if no saved ID (new device) or if they had PRO before
    if (!savedId || hadPro) {
      setShowHint(true);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        setShowHint(false);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDismiss = () => {
    setShowHint(false);
  };

  if (!showHint) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      className="mx-4 mb-4"
    >
      <View className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
        <View className="flex-row items-start">
          <IconSymbol name="info.circle.fill" size={20} color="#3B82F6" />
          <View className="flex-1 ml-3">
            <Text className="text-white font-semibold mb-1">
              Already purchased PRO?
            </Text>
            <Text className="text-white/70 text-sm mb-3">
              If you&apos;ve purchased on another device or reinstalled the app, restore your purchase to regain access.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleRestore}
                disabled={isRestoring}
                className="bg-blue-500 px-4 py-2 rounded-full"
              >
                <Text className="text-white font-semibold">
                  {isRestoring ? "Restoring..." : "Restore Purchases"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDismiss}
                className="px-4 py-2 rounded-full"
              >
                <Text className="text-white/50">
                  Dismiss
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}