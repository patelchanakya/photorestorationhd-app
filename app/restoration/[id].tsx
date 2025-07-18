import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { Restoration } from '@/types';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Share,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Image,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withSequence } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function RestorationScreen() {
  const { id } = useLocalSearchParams();
  const [restoration, setRestoration] = useState<Restoration | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadText, setDownloadText] = useState('Save to Photos');
  const [allRestorations, setAllRestorations] = useState<Restoration[]>([]);
  
  // Animation for the button
  const buttonScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  // Format date for header
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };
  
  useEffect(() => {
    // Subtle pulsing animation
    buttonScale.value = withRepeat(
      withSequence(
        withSpring(1.02, { damping: 15 }),
        withSpring(1, { damping: 15 })
      ),
      -1,
      true
    );
    
    glowOpacity.value = withRepeat(
      withSequence(
        withSpring(0.5, { damping: 15 }),
        withSpring(0.3, { damping: 15 })
      ),
      -1,
      true
    );
  }, []);
  
  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

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

  const loadAllRestorations = useCallback(async () => {
    try {
      // Always use 'anonymous' since we don't have auth
      const userId = 'anonymous';
      const data = await restorationService.getUserRestorations(userId);
      // Filter out current restoration and only show completed ones
      const otherRestorations = data.filter(r => 
        r.status === 'completed' && 
        r.id !== id &&
        r.restored_filename
      );
      setAllRestorations(otherRestorations);
    } catch (error) {
      console.error('Failed to load all restorations:', error);
    }
  }, [id]);

  useEffect(() => {
    loadRestoration();
    loadAllRestorations();
  }, [loadRestoration, loadAllRestorations]);

  const handleExport = async () => {
    if (!restoration?.restored_filename) return;

    try {
      const uri = photoStorage.getPhotoUri('restored', restoration.restored_filename);
      await photoStorage.exportToCameraRoll(uri);
      
      // Flash "Downloaded" text
      setDownloadText('Downloaded ✓');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Reset after 1.5 seconds
      setTimeout(() => {
        setDownloadText('Save to Photos');
      }, 1500);
    } catch (err) {
      console.error('Failed to save photo to camera roll:', err);
      Alert.alert('Error', 'Failed to save photo to camera roll');
    }
  };

  const handleShare = async () => {
    if (!restoration?.restored_filename) return;

    try {
      const uri = photoStorage.getPhotoUri('restored', restoration.restored_filename);
      await Share.share({
        url: uri,
        message: 'Check out my restored photo!',
      });
    } catch (error) {
      console.error('Failed to share photo:', error);
      Alert.alert('Error', 'Failed to share photo');
    }
  };

  const handleDelete = async () => {
    if (!restoration) return;

    try {
      // Delete files from storage
      await photoStorage.deleteRestoration(restoration);
      
      // Delete from database
      await restorationService.delete(restoration.id);
      
      // Navigate back to main screen
      router.back();
    } catch (error) {
      console.error('Failed to delete restoration:', error);
      Alert.alert('Error', 'Failed to delete restoration');
    }
  };

  const showDeleteActionSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Delete Photo'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: 'Are you sure you want to delete this restoration?',
          message: 'This action cannot be undone.',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleDelete();
          }
        }
      );
    } else {
      // Fallback for Android
      Alert.alert(
        'Delete Restoration',
        'Are you sure you want to delete this restoration? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: handleDelete },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!restoration || restoration.status !== 'completed') {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center">
        <Text className="text-gray-800 text-lg">
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-gray-100">
        <View className="flex-1 px-4 py-2">
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <IconSymbol name="chevron.left" size={24} color="#f97316" />
          </TouchableOpacity>
          <Text className="text-sm font-semibold text-gray-800 text-center flex-1">
            {restoration?.completed_at ? formatDate(restoration.completed_at) : formatDate(restoration.created_at)}
          </Text>
          <View className="w-6" />
        </View>

        {/* Before/After Slider */}
        <BeforeAfterSlider
          beforeUri={originalUri}
          afterUri={restoredUri || originalUri}
          style={{ marginBottom: 24 }}
        />

        {/* Action Buttons */}
        <View className="flex-row gap-4 mb-6">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center bg-orange-500 p-4 rounded-2xl gap-3 shadow-sm active:scale-95"
            onPress={handleExport}
          >
            <IconSymbol name="square.and.arrow.down" size={20} color="#fff" />
            <Text className="text-white text-lg font-semibold">{downloadText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center bg-white border-2 border-orange-500 p-4 rounded-2xl gap-3 active:scale-95"
            onPress={handleShare}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color="#f97316" />
            <Text className="text-orange-500 text-lg font-semibold">Share</Text>
          </TouchableOpacity>
        </View>

        {/* Carousel of Other Restorations */}
        {allRestorations.length > 0 && (
          <View className="mb-6">
            <Text className="text-gray-800 text-lg font-semibold mb-3">
              Other Restorations
            </Text>
            <FlatList
              data={allRestorations}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="mr-3 active:scale-95"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/restoration/${item.id}`);
                  }}
                >
                  <View className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <Image
                      source={{ uri: item.thumbnail_filename 
                        ? photoStorage.getPhotoUri('thumbnail', item.thumbnail_filename)
                        : photoStorage.getPhotoUri('restored', item.restored_filename!)
                      }}
                      style={{ width: 80, height: 80 }}
                      className="rounded-xl"
                    />
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingHorizontal: 0 }}
            />
          </View>
        )}

        {/* Restore Another Photo - Compact Button */}
        <View className="mt-2 mb-6">
          <Animated.View style={animatedButtonStyle}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                const functionType = restoration?.function_type || 'restoration';
                router.replace(`/?openModal=${functionType}`);
              }}
            >
              <LinearGradient
                colors={['#f97316', '#ec4899', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 16,
                  shadowColor: '#f97316',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
              <View className="items-center">
                <Text className="text-white text-lg font-bold text-center">
                  ✨ Restore Another Photo ✨
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          </Animated.View>
          
          {/* Social Proof - Creates FOMO */}
          <View className="items-center mt-2">
            <Text className="text-gray-500 text-xs">
              🔥 2,847 photos restored today
            </Text>
          </View>
        </View>

        {/* Delete Button */}
        <View className="items-center mt-6 mb-4">
          <TouchableOpacity
            onPress={showDeleteActionSheet}
            className="active:opacity-70"
          >
            <Text className="text-red-500 text-sm font-medium">
              Delete Photo
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}