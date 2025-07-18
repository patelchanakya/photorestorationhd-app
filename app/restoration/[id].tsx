import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { ProcessingScreen } from '@/components/ProcessingScreen';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { useRestorationStore } from '@/store/restorationStore';
import { Restoration } from '@/types';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring } from 'react-native-reanimated';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function RestorationScreen() {
  const { id, imageUri, functionType } = useLocalSearchParams();
  const [restoration, setRestoration] = useState<Restoration | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadText, setDownloadText] = useState('Save to Photos');
  const [allRestorations, setAllRestorations] = useState<Restoration[]>([]);
  
  // Use the photo restoration hook
  const photoRestoration = usePhotoRestoration();
  const decrementRestorationCount = useRestorationStore((state) => state.decrementRestorationCount);
  
  // Check if this is a new restoration request
  const isNewRestoration = !!imageUri && !!functionType;
  
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
    if (isNewRestoration) {
      // Start restoration process for new images
      photoRestoration.mutate({
        imageUri: imageUri as string,
        functionType: functionType as 'restoration' | 'unblur' | 'colorize'
      });
    } else {
      // Load existing restoration
      loadRestoration();
      loadAllRestorations();
    }
  }, [isNewRestoration, imageUri, functionType, loadRestoration, loadAllRestorations]);
  
  // Handle restoration success
  useEffect(() => {
    if (photoRestoration.isSuccess && photoRestoration.data) {
      const restorationData = photoRestoration.data;
      // Navigate to the completed restoration view
      router.replace(`/restoration/${restorationData.id}`);
    }
  }, [photoRestoration.isSuccess, photoRestoration.data]);

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
      
      // Decrement restoration count in Zustand
      decrementRestorationCount();

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

  // Show loading state for new restorations or while loading existing ones
  if (loading || photoRestoration.isPending) {
    // For new restorations, use the enhanced processing screen
    if (isNewRestoration && functionType) {
      return (
        <ProcessingScreen
          functionType={functionType as 'restoration' | 'unblur' | 'colorize'}
          isProcessing={photoRestoration.isPending}
        />
      );
    }
    
    // For loading existing restorations, use simple loading
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center px-6">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="text-gray-800 text-lg mt-4 text-center">
          Loading...
        </Text>
      </View>
    );
  }

  // Handle error state for new restorations
  if (photoRestoration.isError) {
    const getErrorText = () => {
      switch (functionType) {
        case 'unblur':
          return 'Unblur failed';
        case 'colorize':
          return 'Colorize failed';
        default:
          return 'Restoration failed';
      }
    };
    
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center px-6">
        <IconSymbol name="exclamationmark.triangle" size={48} color="#ef4444" />
        <Text className="text-gray-800 text-lg mt-4 text-center">
          {getErrorText()}
        </Text>
        <Text className="text-gray-600 text-sm mt-2 text-center">
          {photoRestoration.error?.message || 'Please try again'}
        </Text>
        <TouchableOpacity 
          className="mt-4 px-6 py-3 bg-orange-500 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-medium">Go Back</Text>
        </TouchableOpacity>
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
          <View className="flex-1 items-center">
            <Text className="text-lg font-bold text-gray-800">
              {restoration?.function_type === 'unblur' ? 'Unblurred' : 
               restoration?.function_type === 'colorize' ? 'Colorized' : 'Restored'}
            </Text>
            <Text className="text-sm font-medium text-gray-600">
              {restoration?.completed_at ? formatDate(restoration.completed_at) : formatDate(restoration.created_at)}
            </Text>
          </View>
          <View className="w-6" />
        </View>

        {/* Before/After Slider */}
        <BeforeAfterSlider
          beforeUri={originalUri}
          afterUri={restoredUri || originalUri}
          style={{ marginBottom: 24 }}
        />

        {/* Action Buttons */}
        <View className="items-center mb-4">
          {/* Large Circular Save Button */}
          <TouchableOpacity
            className="w-16 h-16 bg-orange-500 rounded-full items-center justify-center mb-4 active:scale-95"
            onPress={handleExport}
          >
            <IconSymbol name="square.and.arrow.down" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Secondary Action Buttons */}
          <View className="flex-row gap-6">
            <TouchableOpacity
              className="flex-row items-center justify-center px-4 py-2 rounded-lg gap-2 active:scale-95"
              onPress={handleShare}
            >
              <IconSymbol name="square.and.arrow.up" size={16} color="#f97316" />
              <Text className="text-orange-500 font-medium">Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-center px-4 py-2 rounded-lg gap-2 active:scale-95"
              onPress={showDeleteActionSheet}
            >
              <IconSymbol name="trash" size={16} color="#ef4444" />
              <Text className="text-red-500 font-medium">Delete</Text>
            </TouchableOpacity>
          </View>
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
        <View className="mt-2 mb-4">
          <TouchableOpacity
            className="bg-orange-500 px-6 py-3 rounded-xl active:scale-95"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              const functionType = restoration?.function_type || 'restoration';
              router.replace(`/?openModal=${functionType}`);
            }}
          >
            <Text className="text-white font-semibold text-center">
              Restore Another Photo
            </Text>
          </TouchableOpacity>
        </View>

        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}