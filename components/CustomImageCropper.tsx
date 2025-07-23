import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import ExpoImageCropTool, { OpenCropperResult } from 'expo-image-crop-tool';

interface CustomImageCropperProps {
  imageUri: string;
  onEditingComplete: (result: { uri: string }) => void;
  onEditingCancel: () => void;
}

export function CustomImageCropper({
  imageUri,
  onEditingComplete,
  onEditingCancel,
}: CustomImageCropperProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const openCropper = async () => {
      if (!imageUri) {
        onEditingCancel();
        return;
      }

      setIsProcessing(true);

      try {
        const result: OpenCropperResult = await ExpoImageCropTool.openCropperAsync({
          imageUri: imageUri,
          aspectRatio: undefined, // Free-form cropping
          shape: 'rectangle',
          compressImageQuality: 1, // High quality
          format: 'jpeg',
        });

        if (__DEV__) {
          console.log('🎯 Crop result:', result);
        }

        // The result contains a 'path' property with the cropped image URI
        if (result && result.path) {
          onEditingComplete({ uri: result.path });
        } else {
          onEditingCancel();
        }
      } catch (error) {
        // Check if user cancelled
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as Error).message;
          if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
            // User cancelled - this is normal behavior, no error logging needed
            onEditingCancel();
            return;
          }
        }

        // Only log actual errors (not user cancellations)
        if (__DEV__) {
          console.error('❌ Crop error:', error);
        }

        // Show error alert for other errors
        Alert.alert('Error', 'Failed to crop image. Please try again.');
        onEditingCancel();
      } finally {
        setIsProcessing(false);
      }
    };

    openCropper();
  }, [imageUri, onEditingComplete, onEditingCancel]);

  // Show loading state while the modal is being prepared/processed
  return (
    <View className="flex-1 bg-black justify-center items-center">
      <ActivityIndicator size="large" color="#f97316" />
      <Text className="text-white mt-4 text-center">
        {isProcessing ? 'Processing...' : 'Opening cropper...'}
      </Text>
    </View>
  );
}