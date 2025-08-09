import React from 'react';
import { View, Text, Modal, TouchableOpacity, Dimensions } from 'react-native';

interface JobBlockingModalProps {
  visible: boolean;
  jobType?: 'photo' | 'video';
  onDismiss: () => void;
}

const { width } = Dimensions.get('window');

export function JobBlockingModal({ visible, jobType = 'video', onDismiss }: JobBlockingModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/50 items-center justify-center px-4">
        <View className="bg-white dark:bg-gray-900 rounded-3xl p-8 w-full max-w-sm">
          {/* Illustration Area */}
          <View className="items-center mb-6">
            <View className="w-32 h-32 bg-gradient-to-br from-pink-100 to-orange-100 dark:from-pink-900/20 dark:to-orange-900/20 rounded-3xl items-center justify-center mb-6">
              {/* Gear icons */}
              <View className="relative">
                <View className="w-12 h-12 bg-gray-400 rounded-full items-center justify-center opacity-60">
                  <View className="w-8 h-8 bg-gray-300 rounded-full border-4 border-gray-400" />
                </View>
                <View className="absolute -right-3 -top-3 w-8 h-8 bg-gray-500 rounded-full items-center justify-center">
                  <View className="w-5 h-5 bg-gray-400 rounded-full border-2 border-gray-500" />
                </View>
              </View>
              
              {/* Photo mockups */}
              <View className="absolute bottom-2 left-4">
                <View className="w-8 h-6 bg-gray-300 rounded border-2 border-white shadow-sm" />
              </View>
              <View className="absolute bottom-2 right-4">
                <View className="w-8 h-6 bg-gray-300 rounded border-2 border-white shadow-sm" />
              </View>
              
              {/* Decorative dots */}
              <View className="absolute top-2 right-2 w-2 h-2 bg-pink-400 rounded-full" />
              <View className="absolute bottom-8 left-2 w-1.5 h-1.5 bg-orange-400 rounded-full" />
            </View>
          </View>
          
          {/* Title */}
          <Text className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-3">
            We're still generating your results
          </Text>
          
          {/* Description */}
          <Text className="text-base text-gray-600 dark:text-gray-400 text-center leading-6 mb-8">
            You need to wait for your current generation to finish before requesting additional content. Please try again later!
          </Text>
          
          {/* Action Button */}
          <TouchableOpacity
            onPress={onDismiss}
            className="bg-gray-900 dark:bg-white rounded-2xl py-4 px-6"
            activeOpacity={0.8}
          >
            <Text className="text-white dark:text-gray-900 font-semibold text-center text-lg">
              OK, Got It
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}