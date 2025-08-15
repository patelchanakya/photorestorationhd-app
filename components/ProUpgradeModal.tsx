import React from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { presentPaywall } from '@/services/revenuecat';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

interface ProUpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  ctaLabel?: string;
  onSuccess?: () => void;
}

export function ProUpgradeModal({ 
  visible, 
  onClose, 
  title = "Upgrade to Pro", 
  message = "You've reached your video generation limit",
  ctaLabel = 'Get Pro Now',
  onSuccess,
}: ProUpgradeModalProps) {
  const insets = useSafeAreaInsets();
  const handleGetPro = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (__DEV__) {
        console.log('🎯 Opening Pro paywall from upgrade modal');
      }
      
      const success = await presentPaywall();
      
      if (success) {
        if (__DEV__) {
          console.log('✅ Pro purchase successful');
        }
        // Haptic confirmation
        try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        try { onSuccess?.(); } catch {}
        onClose();
      }
      
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Pro upgrade error:', error);
      }
    }
  };

  const handleCancel = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    onClose();
  };

  const proFeatures = [
    {
      icon: '🎬',
      title: 'Back to Life Animated Videos',
      description: 'Create animated videos from your photos'
    },
    {
      icon: '🚀',
      title: 'Priority Processing',
      description: 'Your photos and videos process faster'
    },
    {
      icon: '🪄',
      title: 'Text Edits Magic',
      description: 'Unlock the Text Edits magic feature'
    }
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center px-6">
        {/* Subtle iOS blur + dim overlay */}
        {Platform.OS === 'ios' && (
          <BlurView intensity={12} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        )}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        <View className="rounded-3xl p-6 max-w-sm w-full" style={{ backgroundColor: '#0B0B0F', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingBottom: Math.max(16, insets.bottom + 8) }}>
          {/* Header */}
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-400 rounded-full items-center justify-center mb-4">
              <IconSymbol name="crown.fill" size={28} color="#FFFFFF" />
            </View>
            <Text className="text-white text-2xl font-bold text-center mb-2">
              {title}
            </Text>
            <Text className="text-gray-400 text-base text-center leading-relaxed">
              {message}
            </Text>
          </View>

          {/* Pro Features */}
          <View className="mb-8">
            {proFeatures.map((feature, index) => (
              <View key={index} className="flex-row items-start mb-4">
                <View className="w-10 h-10 rounded-xl items-center justify-center mr-4 mt-0.5 bg-white/10 border border-white/15">
                  <Text className="text-lg">{feature.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-base mb-1">
                    {feature.title}
                  </Text>
                  <Text className="text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View className="space-y-3">
            <TouchableOpacity
              onPress={handleGetPro}
              className="bg-gradient-to-r from-amber-500 to-amber-500 rounded-2xl py-4 px-6"
              activeOpacity={0.8}
            >
              <Text className="text-black text-center font-bold text-lg">{ctaLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCancel}
              className="bg-white/10 border border-white/15 rounded-2xl py-4 px-6"
              activeOpacity={0.8}
            >
              <Text className="text-white/90 text-center font-semibold text-base">
                Maybe Later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}