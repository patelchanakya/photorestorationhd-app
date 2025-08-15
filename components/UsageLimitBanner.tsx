import { usePhotoUsage, useInvalidatePhotoUsage } from '@/services/photoUsageService';
import { presentPaywall } from '@/services/revenuecat';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';

interface UsageLimitBannerProps {
  onUpgradeSuccess?: () => void;
  className?: string;
}

export function UsageLimitBanner({ onUpgradeSuccess, className = "" }: UsageLimitBannerProps) {
  const { data: photoUsage, isLoading, error } = usePhotoUsage();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const invalidatePhotoUsage = useInvalidatePhotoUsage();

  const handleUpgrade = async () => {
    try {
      setIsUpgrading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const success = await presentPaywall();
      if (success) {
        // Invalidate cache to refetch fresh usage data
        invalidatePhotoUsage();
        onUpgradeSuccess?.();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to show upgrade paywall:', error);
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  // Show loading state for initial load
  if (isLoading && !photoUsage) {
    return (
      <View className={`mx-4 p-4 rounded-xl bg-gray-500/10 border border-gray-500/30 ${className}`}>
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#9ca3af" className="mr-3" />
          <Text className="text-white/70 text-sm">Loading usage...</Text>
        </View>
      </View>
    );
  }

  // Don't show banner on error or if user has unlimited photos
  if (error || !photoUsage || photoUsage.limit === -1) {
    return null;
  }

  // Only show for free users who are close to or at their limit
  if (photoUsage.planType !== 'free') {
    return null;
  }

  const remainingPhotos = photoUsage.limit - photoUsage.used;
  const isAtLimit = remainingPhotos <= 0;
  const isCloseToLimit = remainingPhotos <= 2 && remainingPhotos > 0;

  // Don't show if user has plenty of photos left
  if (!isAtLimit && !isCloseToLimit) {
    return null;
  }

  return (
    <TouchableOpacity
      className={`mx-4 p-4 rounded-xl border ${isAtLimit ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'} ${className}`}
      onPress={handleUpgrade}
      disabled={isUpgrading}
    >
      <View className="flex-row items-center">
        <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isAtLimit ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
          <IconSymbol 
            name={isAtLimit ? "exclamationmark.circle.fill" : "info.circle.fill"} 
            size={16} 
            color={isAtLimit ? "#ef4444" : "#f59e0b"} 
          />
        </View>
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm">
            {isAtLimit ? 'Photo Limit Reached' : `${remainingPhotos} Photo${remainingPhotos === 1 ? '' : 's'} Remaining`}
          </Text>
          <Text className="text-white/70 text-xs">
            {isAtLimit ? 'Upgrade to Pro for unlimited photos' : 'Upgrade for unlimited photo restoration'}
          </Text>
        </View>
        <View className="flex-row items-center">
          {isUpgrading ? (
            <ActivityIndicator size="small" color={isAtLimit ? "#ef4444" : "#f59e0b"} />
          ) : (
            <>
              <Text className={`text-xs font-semibold mr-2 ${isAtLimit ? 'text-red-500' : 'text-amber-500'}`}>
                {photoUsage.used}/{photoUsage.limit}
              </Text>
              <IconSymbol 
                name="chevron.right" 
                size={14} 
                color={isAtLimit ? "#ef4444" : "#f59e0b"} 
              />
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}