import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Image as RNImage,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { restorationService } from '@/services/supabase';
import { photoStorage } from '@/services/storage';
import { Restoration } from '@/types';

export default function RestorationScreen() {
  const { id } = useLocalSearchParams();
  const [restoration, setRestoration] = useState<Restoration | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);

  const loadRestoration = useCallback(async () => {
    try {
      const data = await restorationService.getById(id as string);
      setRestoration(data);
    } catch (error) {
      console.error('Failed to load restoration:', error);
      Alert.alert('Error', 'Failed to load restoration details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRestoration();
  }, [loadRestoration]);

  const handleExport = async () => {
    if (!restoration?.restored_filename) return;

    try {
      const uri = photoStorage.getPhotoUri('restored', restoration.restored_filename);
      await photoStorage.exportToCameraRoll(uri);
      Alert.alert('Success', 'Photo saved to your camera roll!');
    } catch (err) {
      console.error('Failed to save photo to camera roll:', err);
      Alert.alert('Error', 'Failed to save photo to camera roll');
    }
  };

  const handleShare = async () => {
    // Implement share functionality later
    Alert.alert('Coming Soon', 'Share functionality will be available soon!');
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!restoration || restoration.status !== 'completed') {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 justify-center items-center">
        <Text className="text-gray-800 dark:text-gray-200 text-lg">
          Restoration not found or still processing
        </Text>
      </View>
    );
  }

  const originalUri = photoStorage.getPhotoUri('original', restoration.original_filename);
  const restoredUri = restoration.restored_filename
    ? photoStorage.getPhotoUri('restored', restoration.restored_filename)
    : null;

  // Debug logging
  console.log('🖼️ Original URI:', originalUri);
  console.log('🖼️ Restored URI:', restoredUri);
  console.log('🖼️ Currently showing:', showOriginal ? 'original' : 'restored');

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 px-4 py-2">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <Text className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
            Restoration Complete
          </Text>
          <View className="w-6" />
        </View>

        <View className="flex-1 relative mb-4 max-h-96 sm:max-h-none">
          {/* Try React Native Image as fallback */}
          <RNImage
            source={{ uri: showOriginal ? originalUri : restoredUri }}
            style={{ flex: 1, borderRadius: 12 }}
            resizeMode="contain"
            onError={(error) => {
              console.error('❌ RN Image loading error:', error);
              console.error('❌ Failed URI:', showOriginal ? originalUri : restoredUri);
            }}
            onLoad={() => {
              console.log('✅ RN Image loaded successfully:', showOriginal ? originalUri : restoredUri);
            }}
            onLoadStart={() => {
              console.log('🔄 RN Image loading started:', showOriginal ? originalUri : restoredUri);
            }}
          />
          
          <TouchableOpacity
            className="absolute bottom-4 self-center bg-blue-600 px-4 py-2 rounded-full shadow-lg"
            onPress={() => setShowOriginal(!showOriginal)}
          >
            <Text className="text-white text-sm font-semibold">
              {showOriginal ? 'Show Restored' : 'Show Original'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="items-center mb-6">
          <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
            Processing Time
          </Text>
          <Text className="text-gray-600 dark:text-gray-300">
            {restoration.processing_time_ms
              ? `${(restoration.processing_time_ms / 1000).toFixed(1)}s`
              : 'N/A'}
          </Text>
        </View>

        <View className="flex-col sm:flex-row gap-3 mb-6">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center bg-green-600 p-3 rounded-xl gap-2 shadow-lg active:scale-95"
            onPress={handleExport}
          >
            <IconSymbol name="square.and.arrow.down" size={18} color="#fff" />
            <Text className="text-white text-sm font-semibold">Save to Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center bg-transparent border-2 border-blue-600 p-3 rounded-xl gap-2 active:scale-95"
            onPress={handleShare}
          >
            <IconSymbol name="square.and.arrow.up" size={18} color="#3B82F6" />
            <Text className="text-blue-600 text-sm font-semibold">Share</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className="items-center py-2"
          onPress={() => router.replace('/')}
        >
          <Text className="text-blue-600 text-sm font-medium">
            Restore Another Photo
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}