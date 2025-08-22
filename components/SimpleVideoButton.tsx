import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { useSimpleBackToLife } from '../hooks/useSimpleBackToLife';
import { useVideoGenerationStore } from '../store/videoGenerationStore';

interface SimpleVideoButtonProps {
  title: string;
  animationPrompt: string;
  onPress?: () => void;
}

export function SimpleVideoButton({ title, animationPrompt, onPress }: SimpleVideoButtonProps) {
  const backToLife = useSimpleBackToLife();
  const { isGenerating, hasUnviewedVideo } = useVideoGenerationStore();

  const handlePress = async () => {
    try {
      onPress?.();

      // Simple check
      if (isGenerating) {
        Alert.alert('Please wait', 'Video is already generating');
        return;
      }
      
      if (hasUnviewedVideo) {
        Alert.alert('Video Ready', 'Please view your completed video before generating a new one. Check the notification at the top.');
        return;
      }

      // Get image
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 1,
      });
      
      if (result.canceled || !result.assets?.[0]) return;

      // Pro and usage checking is now handled in useSimpleBackToLife

      // Generate video
      backToLife.mutate({
        imageUri: result.assets[0].uri,
        animationPrompt
      });

    } catch (error) {
      console.error('Video button error:', error);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isGenerating}
      className={`p-4 rounded-lg ${isGenerating ? 'bg-gray-600' : 'bg-blue-600'}`}
    >
      <Text className="text-white font-semibold text-center">
        {isGenerating ? 'Generating...' : title}
      </Text>
    </TouchableOpacity>
  );
}