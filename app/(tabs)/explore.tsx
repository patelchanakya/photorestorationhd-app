// COMMENTED OUT - Using main app/index.tsx now
/*
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, SafeAreaView, Image as RNImage } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { restorationService } from '@/services/supabase';
import { photoStorage } from '@/services/storage';
import { Restoration } from '@/types';

export default function GalleryScreen() {
  const [restorations, setRestorations] = useState<Restoration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRestorations();
  }, []);

  const loadRestorations = async () => {
    try {
      // Always use 'anonymous' since we don't have auth
      const userId = 'anonymous';
      
      const data = await restorationService.getUserRestorations(userId);
      setRestorations(data.filter(r => r.status === 'completed'));
    } catch (err) {
      console.error('Failed to load restorations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestorationPress = (restoration: Restoration) => {
    router.push(`/restoration/${restoration.id}`);
  };

  const handleDeleteRestoration = async (restoration: Restoration) => {
    Alert.alert(
      'Delete Restoration',
      'Are you sure you want to delete this restoration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await photoStorage.deleteRestoration(restoration);
              await restorationService.delete(restoration.id);
              loadRestorations();
            } catch (err) {
              console.error('Failed to delete restoration:', err);
              Alert.alert('Error', 'Failed to delete restoration');
            }
          },
        },
      ]
    );
  };

  const renderRestoration = ({ item }: { item: Restoration }) => {
    const thumbnailUri = item.thumbnail_filename
      ? photoStorage.getPhotoUri('thumbnail', item.thumbnail_filename)
      : null;

    // Debug logging for gallery
    console.log('📷 Gallery thumbnail URI:', thumbnailUri);

    return (
      <TouchableOpacity
        className="flex-1 m-1 bg-white/10 rounded-2xl shadow-md overflow-hidden border border-white/20"
        onPress={() => handleRestorationPress(item)}
      >
        {thumbnailUri && (
          <RNImage
            source={{ uri: thumbnailUri }}
            style={{ width: '100%', height: 128 }}
            resizeMode="cover"
            onError={(error) => {
              console.error('❌ Gallery thumbnail loading error:', error);
              console.error('❌ Failed thumbnail URI:', thumbnailUri);
            }}
            onLoad={() => {
              console.log('✅ Gallery thumbnail loaded:', thumbnailUri);
            }}
            onLoadStart={() => {
              console.log('🔄 Gallery thumbnail loading started:', thumbnailUri);
            }}
          />
        )}
        <View className="p-2">
          <Text className="text-xs sm:text-sm text-white/80 mb-1">
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
          <Text className="text-xs text-white/60">
            {item.processing_time_ms
              ? `${(item.processing_time_ms / 1000).toFixed(1)}s`
              : 'N/A'}
          </Text>
        </View>
        <TouchableOpacity
          className="absolute top-2 right-2 bg-red-600 w-7 h-7 rounded-full justify-center items-center"
          onPress={() => handleDeleteRestoration(item)}
        >
          <IconSymbol name="trash" size={14} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gradient-to-b from-orange-400 to-black justify-center items-center">
        <Text className="text-white text-lg">Loading gallery...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-orange-400 to-black">
      <View className="px-6 py-4 border-b border-white/20">
        <Text className="text-2xl font-bold text-white">
          Your Restorations
        </Text>
        <Text className="text-white/70 mt-1">
          {restorations.length} photo{restorations.length !== 1 ? 's' : ''} restored
        </Text>
      </View>

      {restorations.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <View className="mb-4">
            <IconSymbol name="photo" size={64} color="#fff" />
          </View>
          <Text className="text-xl font-bold text-white mt-4 mb-2 text-center">
            No Restorations Yet
          </Text>
          <Text className="text-white/70 text-center mb-6">
            Start by restoring your first photo to see it here.
          </Text>
          <TouchableOpacity
            className="bg-white/20 border border-white/30 px-6 py-3 rounded-2xl"
            onPress={() => router.push('/')}
          >
            <Text className="text-white font-semibold">Restore a Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={restorations}
          renderItem={renderRestoration}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 6 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
*/

// Placeholder to prevent errors
import React from 'react';
import { View } from 'react-native';

export default function ExploreTab() {
  return <View />;
}