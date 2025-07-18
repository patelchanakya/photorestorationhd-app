import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { ProcessingScreen } from '@/components/ProcessingScreen';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { useRestorationStore } from '@/store/restorationStore';
import { Restoration } from '@/types';
import * as Haptics from 'expo-haptics';
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
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function RestorationScreen() {
  const { id, imageUri, functionType } = useLocalSearchParams();
  const [restoration, setRestoration] = useState<Restoration | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadText, setDownloadText] = useState('Save');
  const [allRestorations, setAllRestorations] = useState<Restoration[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Use the photo restoration hook
  const photoRestoration = usePhotoRestoration();
  const decrementRestorationCount = useRestorationStore((state) => state.decrementRestorationCount);
  
  // Check if this is a new restoration request
  const isNewRestoration = !!imageUri && !!functionType;
  
  // Animation values for the save button
  const buttonScale = useSharedValue(1);
  const iconScale = useSharedValue(1);
  const iconRotation = useSharedValue(0);
  const progressScale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const successBackground = useSharedValue(0);

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
  
  // Animated styles for save button
  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: iconScale.value },
        { rotate: `${iconRotation.value}deg` }
      ],
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
    };
  });

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: progressScale.value }],
      opacity: progressScale.value,
    };
  });

  const animatedSuccessStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: successBackground.value === 1 ? '#10b981' : '#f97316',
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

  // Reset animation function
  const resetAnimation = () => {
    setDownloadText('Save');
  };

  const handleExport = async () => {
    if (!restoration?.restored_filename) return;

    try {
      // Start animation sequence
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Button press animation
      buttonScale.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withSpring(1.05, { damping: 15 })
      );
      
      // Icon animation - bounce and rotate
      iconScale.value = withSequence(
        withTiming(1.2, { duration: 150 }),
        withSpring(1, { damping: 10 })
      );
      
      iconRotation.value = withSequence(
        withTiming(10, { duration: 100 }),
        withTiming(-10, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
      
      // Glow effect
      glowOpacity.value = withSequence(
        withTiming(0.8, { duration: 200 }),
        withTiming(0.3, { duration: 300 })
      );
      
      // Progress animation
      progressScale.value = withTiming(1, { duration: 800 });
      
      // Change text
      runOnJS(setDownloadText)('Saving...');
      
      const uri = photoStorage.getPhotoUri('restored', restoration.restored_filename);
      await photoStorage.exportToCameraRoll(uri);
      
      // Success animation
      progressScale.value = withTiming(0, { duration: 300 });
      
      // Green highlight effect
      successBackground.value = withTiming(1, { duration: 300 });
      
      buttonScale.value = withSequence(
        withTiming(1.1, { duration: 200 }),
        withSpring(1, { damping: 10 })
      );
      
      // Heavy haptic for success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success text
      runOnJS(setDownloadText)('Saved!');
      
      // Reset after delay
      setTimeout(() => {
        glowOpacity.value = withTiming(0, { duration: 300 });
        successBackground.value = withTiming(0, { duration: 300 });
        setDownloadText('Save');
      }, 1500);
      
    } catch (err) {
      // Error animation
      buttonScale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withSpring(1, { damping: 15 })
      );
      
      iconRotation.value = withSequence(
        withTiming(20, { duration: 100 }),
        withTiming(-20, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      progressScale.value = withTiming(0, { duration: 300 });
      runOnJS(resetAnimation)();
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
          {/* Large Animated Save Button */}
          <AnimatedTouchableOpacity
            style={[
              {
                width: 140,
                height: 50,
                borderRadius: 25,
                backgroundColor: '#f97316',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                position: 'relative',
                paddingHorizontal: 16,
                marginBottom: 16,
              },
              animatedButtonStyle,
              animatedSuccessStyle,
            ]}
            onPress={handleExport}
          >
            {/* Glow effect */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 160,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: '#f97316',
                  opacity: 0.3,
                },
                animatedGlowStyle,
              ]}
            />
            
            {/* Progress ring */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 150,
                  height: 60,
                  borderRadius: 30,
                  borderWidth: 3,
                  borderColor: '#fff',
                  backgroundColor: 'transparent',
                },
                animatedProgressStyle,
              ]}
            />
            
            {/* Main icon */}
            <Animated.View style={animatedIconStyle}>
              <IconSymbol name="arrow.down.to.line" size={22} color="#fff" />
            </Animated.View>
            
            {/* Save text inside button */}
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8, textAlign: 'center' }}>
              {downloadText}
            </Text>
          </AnimatedTouchableOpacity>

          {/* Secondary Action Buttons */}
          <View className="flex-row gap-8">
            <TouchableOpacity
              className="flex-row items-center justify-center px-2 py-2 gap-1 active:scale-95"
              onPress={handleShare}
            >
              <IconSymbol name="square.and.arrow.up" size={16} color="#f97316" />
              <Text className="text-orange-500 font-medium text-sm">Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-center px-2 py-2 gap-1 active:scale-95"
              onPress={showDeleteActionSheet}
            >
              <IconSymbol name="trash" size={16} color="#ef4444" />
              <Text className="text-red-500 font-medium text-sm">Delete</Text>
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
                    // Prevent navigating to the same restoration
                    if (item.id === id) return;
                    
                    // Prevent multiple rapid taps
                    if (isNavigating) return;
                    
                    setIsNavigating(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    
                    // Replace instead of push to avoid stacking
                    router.replace(`/restoration/${item.id}`);
                    
                    // Reset navigation state after a delay
                    setTimeout(() => setIsNavigating(false), 1000);
                  }}
                >
                  <View className={`rounded-xl shadow-sm overflow-hidden ${item.id === id ? 'border-2 border-orange-500' : 'bg-white'}`}>
                    <Image
                      source={{ uri: item.thumbnail_filename 
                        ? photoStorage.getPhotoUri('thumbnail', item.thumbnail_filename)
                        : photoStorage.getPhotoUri('restored', item.restored_filename!)
                      }}
                      style={{ width: 80, height: 80, opacity: item.id === id ? 0.7 : 1 }}
                      className="rounded-xl"
                    />
                    {item.id === id && (
                      <View className="absolute inset-0 bg-orange-500/20 rounded-xl" />
                    )}
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
            onPress={async () => {
              // Prevent multiple rapid taps
              if (isNavigating) return;
              
              setIsNavigating(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              
              // Simply dismiss all modals and go back to the camera (home screen)
              if (router.canGoBack()) {
                router.dismissAll();
              } else {
                // If we can't go back, replace with home
                router.replace('/');
              }
              
              // Reset navigation state after a delay
              setTimeout(() => setIsNavigating(false), 1000);
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