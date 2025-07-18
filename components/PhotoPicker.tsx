import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image as RNImage,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

interface PhotoPickerProps {
  onPhotoSelected: (uri: string) => void;
  isProcessing?: boolean;
  functionType?: string;
}

export function PhotoPicker({ onPhotoSelected, isProcessing = false, functionType = 'restoration' }: PhotoPickerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const router = useRouter();

  // Reset state when screen comes into focus (e.g., when returning from restoration screen)
  useFocusEffect(
    React.useCallback(() => {
      if (!isProcessing) {
        setSelectedImage(null);
      }
    }, [isProcessing])
  );

  const requestPermissions = async (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    const hasPermission = await requestPermissions(source);
    
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        `Please grant ${source} permission to use this feature.`,
        [{ text: 'OK' }]
      );
      return;
    }

    let result;
    
    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 1,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 1,
      });
    }

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      // For both camera and gallery images, use crop modal for consistent UX
      router.push(`/crop-modal?imageUri=${encodeURIComponent(uri)}&functionType=${functionType}`);
    }
  };

  return (
    <View className="flex-1 px-2 py-4">
      {selectedImage ? (
        <View className="flex-1 relative">
          {/* Try React Native Image as fallback */}
          <RNImage
            source={{ uri: selectedImage }}
            style={{ flex: 1, borderRadius: 12, maxHeight: 384 }}
            resizeMode="contain"
            onError={(error) => {
              console.error('❌ PhotoPicker RN image loading error:', error);
              console.error('❌ Failed URI:', selectedImage);
            }}
            onLoad={() => {
              console.log('✅ PhotoPicker RN image loaded:', selectedImage);
            }}
            onLoadStart={() => {
              console.log('🔄 PhotoPicker RN image loading started:', selectedImage);
            }}
          />
          {!isProcessing && (
            <TouchableOpacity
              className="absolute bottom-4 self-center bg-blue-600 px-6 py-3 rounded-full shadow-lg"
              onPress={() => setSelectedImage(null)}
            >
              <Text className="text-white text-sm font-semibold">Change Photo</Text>
            </TouchableOpacity>
          )}
          {isProcessing && (
            <View className="absolute inset-0 bg-black/70 justify-center items-center rounded-xl">
              <ActivityIndicator size="large" color="#fff" />
              <Text className="text-white text-lg mt-3">Processing...</Text>
            </View>
          )}
        </View>
      ) : (
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-xl sm:text-2xl font-bold mb-8 text-center dark:text-white">
            Select a photo to restore
          </Text>
          
          <View className="flex-col sm:flex-row gap-4 w-full max-w-sm">
            <TouchableOpacity
              className="flex-1 min-h-32 bg-blue-600 rounded-2xl justify-center items-center p-4 shadow-lg active:scale-95"
              onPress={() => pickImage('camera')}
            >
              <IconSymbol name="camera" size={32} color="#fff" />
              <Text className="text-white text-sm mt-2 font-semibold">Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="flex-1 min-h-32 bg-purple-600 rounded-2xl justify-center items-center p-4 shadow-lg active:scale-95"
              onPress={() => pickImage('gallery')}
            >
              <IconSymbol name="photo" size={32} color="#fff" />
              <Text className="text-white text-sm mt-2 font-semibold">From Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}