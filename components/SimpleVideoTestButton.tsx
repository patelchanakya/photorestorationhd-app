import React from 'react';
import { Text, TouchableOpacity, View, Alert } from 'react-native';
import { useSimpleBackToLife } from '../hooks/useSimpleBackToLife';
import { useAutoSimpleVideoRecovery } from '../hooks/useSimpleVideoRecovery';
import { useSimpleVideoStore } from '../store/simpleVideoStore';

// Test component for the simplified video generation system
export function SimpleVideoTestButton() {
  const { mutate: generateVideo, isPending } = useSimpleBackToLife();
  const { status, progress, currentGeneration } = useSimpleVideoStore();
  
  // Initialize recovery system
  useAutoSimpleVideoRecovery();

  const handleTestVideo = () => {
    // Use a test image URI (you can replace with actual image)
    const testImageUri = 'https://via.placeholder.com/512x512/FF6B6B/FFFFFF?text=Test+Image';
    const testPrompt = 'bring this photo to life with natural animation';

    Alert.alert(
      'Test Simple Video Generation',
      'This will test the new simplified video generation system.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Generate', 
          onPress: () => generateVideo({ 
            imageUri: testImageUri, 
            animationPrompt: testPrompt 
          })
        }
      ]
    );
  };

  const getStatusText = () => {
    if (!currentGeneration) return 'No video generation';
    
    switch (status) {
      case 'starting': return 'Starting...';
      case 'processing': return `Processing... ${Math.round(progress)}%`;
      case 'completed': return 'Completed!';
      case 'failed': return 'Failed';
      case 'expired': return 'Expired';
      default: return 'Idle';
    }
  };

  return (
    <View className="p-4 m-4 border border-gray-300 rounded-lg bg-white/10">
      <Text className="text-white text-lg font-bold mb-2">
        Simple Video Test
      </Text>
      
      <Text className="text-white/80 text-sm mb-2">
        Status: {getStatusText()}
      </Text>
      
      {currentGeneration && (
        <Text className="text-white/60 text-xs mb-3">
          ID: {currentGeneration.predictionId.substring(0, 8)}...
        </Text>
      )}
      
      <TouchableOpacity
        onPress={handleTestVideo}
        disabled={isPending || status === 'starting' || status === 'processing'}
        className={`px-4 py-2 rounded-lg ${
          isPending || status === 'starting' || status === 'processing'
            ? 'bg-gray-500' 
            : 'bg-blue-500'
        }`}
      >
        <Text className="text-white font-medium text-center">
          {isPending ? 'Generating...' : 'Test Simple Video'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}