import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { presentPaywall } from '@/services/revenuecat';
import * as Haptics from 'expo-haptics';

interface ProUpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export function ProUpgradeModal({ 
  visible, 
  onClose, 
  title = "Upgrade to Pro", 
  message = "You've reached your video generation limit" 
}: ProUpgradeModalProps) {
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
        onClose();
      }
      
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Pro upgrade error:', error);
      }
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const proFeatures = [
    {
      icon: '🎬',
      title: 'Unlimited Back to Life Videos',
      description: 'Generate as many animated videos as you want'
    },
    {
      icon: '🚀',
      title: 'Priority Processing',
      description: 'Your photos and videos process faster'
    },
    {
      icon: '🎨',
      title: 'All Restoration Features',
      description: 'Access colorization, deblurring, and more'
    },
    {
      icon: '🔄',
      title: 'No Daily Limits',
      description: 'Create content anytime without restrictions'
    }
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 justify-center items-center px-6">
        <View className="bg-gray-900 rounded-3xl p-6 max-w-sm w-full border border-gray-800">
          {/* Header */}
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center mb-4">
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
                <View className="w-10 h-10 bg-gray-800 rounded-xl items-center justify-center mr-4 mt-0.5">
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
              className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl py-4 px-6"
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-bold text-lg">
                Get Pro Now
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCancel}
              className="bg-gray-800 rounded-2xl py-4 px-6"
              activeOpacity={0.8}
            >
              <Text className="text-gray-300 text-center font-semibold text-base">
                Maybe Later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}