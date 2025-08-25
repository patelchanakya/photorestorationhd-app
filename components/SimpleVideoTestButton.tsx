import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

// Test component for the simplified video generation system (DISABLED)
export function SimpleVideoTestButton() {
  return (
    <View className="p-4 m-4 border border-gray-300 rounded-lg bg-white/10">
      <Text className="text-white text-lg font-bold mb-2">
        Simple Video Test (Disabled)
      </Text>
      
      <Text className="text-white/80 text-sm mb-2">
        Video functionality has been removed.
      </Text>
      
      <TouchableOpacity
        disabled={true}
        className="px-4 py-2 rounded-lg bg-gray-500"
      >
        <Text className="text-white/50 font-medium text-center">
          Disabled
        </Text>
      </TouchableOpacity>
    </View>
  );
}