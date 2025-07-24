import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { ProcessingScreen } from '@/components/ProcessingScreen';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { useRestorationStore } from '@/store/restorationStore';
import { useRestorationScreenStore } from '@/store/restorationScreenStore';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Get screen dimensions for responsive design
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_HEIGHT < 700;

export default function RestorationScreen() {
  const { id, imageUri, functionType } = useLocalSearchParams();
  
  // Use Zustand store for all state management
  const {
    restoration,
    setRestoration,
    loading,
    setLoading,
    downloadText,
    setDownloadText,
    allRestorations,
    setAllRestorations,
    isNavigating,
    setIsNavigating,
    filesExist,
    setFilesExist,
    clearProcessingProgress,
    completeProcessing,
    resetState
  } = useRestorationScreenStore();
  
  // Use the photo restoration hook
  const photoRestoration = usePhotoRestoration();
  const decrementRestorationCount = useRestorationStore((state) => state.decrementRestorationCount);
  const simpleSlider = useRestorationStore((state) => state.simpleSlider);
  
  // Check if this is a new restoration request
  const isNewRestoration = !!imageUri && !!functionType;
  
  // Reset state on unmount
  useEffect(() => {
    return () => {
      resetState();
    };
  }, [resetState]);
  
  // Animation values for the save button
  const buttonScale = useSharedValue(1);
  const iconScale = useSharedValue(1);
  const iconRotation = useSharedValue(0);
  const successBackground = useSharedValue(0);

  
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
      
      // Immediately complete the progress animation
      completeProcessing();
      
      // Add a small delay to show 100% completion before redirecting
      setTimeout(() => {
        // Navigate to the completed restoration view
        router.replace(`/restoration/${restorationData.id}`);
      }, 800); // 800ms delay to show completion
    }
  }, [photoRestoration.isSuccess, photoRestoration.data, completeProcessing]);
  
  // Clear progress immediately when error occurs
  useEffect(() => {
    if (photoRestoration.isError) {
      clearProcessingProgress();
    }
  }, [photoRestoration.isError, clearProcessingProgress]);
  
  // Check if files exist when viewing existing restoration
  useEffect(() => {
    const checkFiles = async () => {
      if (!restoration || isNewRestoration) return;
      
      try {
        const originalUri = photoStorage.getPhotoUri('original', restoration.original_filename);
        const restoredUri = restoration.restored_filename
          ? photoStorage.getPhotoUri('restored', restoration.restored_filename)
          : null;
          
        const originalInfo = await FileSystem.getInfoAsync(originalUri);
        const restoredInfo = restoredUri ? await FileSystem.getInfoAsync(restoredUri) : { exists: false };
        
        if (!originalInfo.exists || (restoredUri && !restoredInfo.exists)) {
          setFilesExist(false);
        } else {
          setFilesExist(true);
        }
      } catch (error) {
        console.error('Error checking files:', error);
        setFilesExist(false);
      }
    };
    
    checkFiles();
  }, [restoration, isNewRestoration, setFilesExist]);

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
      
      
      // Change text
      runOnJS(setDownloadText)('Saving...');
      
      const uri = photoStorage.getPhotoUri('restored', restoration.restored_filename);
      await photoStorage.exportToCameraRoll(uri);
      
      // Success feedback
      buttonScale.value = withSequence(
        withTiming(1.05, { duration: 100 }),
        withSpring(1, { damping: 10 })
      );
      
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success text
      runOnJS(setDownloadText)('Saved!');
      
      // Reset after delay
      setTimeout(() => {
        setDownloadText('Save');
      }, 1500);
      
    } catch (err: any) {
      // Error feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      runOnJS(resetAnimation)();
      console.error('Failed to save photo to camera roll:', err);
      
      // Check if it's a permission or Expo Go error
      if (err.message?.includes('NSPhotoLibraryAddUsageDescription') || 
          err.message?.includes('Expo Go')) {
        Alert.alert(
          'Expo Go Limitation', 
          'Saving to camera roll is not available in Expo Go. Please use the Share button to save your photo, or test in a development build.',
          [
            { text: 'Use Share Instead', onPress: handleShare },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else if (err.message?.includes('permission')) {
        Alert.alert(
          'Permission Required', 
          err.message || 'Please enable photo library permissions in Settings.',
          [
            { text: 'Try Share Instead', onPress: handleShare },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert(
          'Save Failed',
          `Failed to save photo to camera roll: ${err.message || 'Unknown error'}`,
          [
            { text: 'Try Share Instead', onPress: handleShare },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
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

  // Handle error state for new restorations immediately (only if currently processing)
  if (photoRestoration.isError && isNewRestoration && !photoRestoration.isIdle) {
    const getErrorText = () => {
      switch (functionType) {
        case 'unblur':
          return 'Unblur failed';
        case 'colorize':
          return 'Colorize failed';
        default:
          return 'Auto Restoration failed';
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

  // Show loading state for new restorations or while loading existing ones
  if (loading || photoRestoration.isPending) {
    // For new restorations, use the enhanced processing screen (only if no error)
    if (isNewRestoration && functionType && !photoRestoration.isError) {
      return (
        <ProcessingScreen
          functionType={functionType as 'restoration' | 'unblur' | 'colorize'}
          isProcessing={photoRestoration.isPending}
          isError={photoRestoration.isError}
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


  if (!restoration || restoration.status !== 'completed') {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center">
        <Text className="text-gray-800 text-lg">
          Restoration not found or still processing
        </Text>
      </View>
    );
  }

  const originalUri = restoration ? photoStorage.getPhotoUri('original', restoration.original_filename) : '';
  const restoredUri = restoration?.restored_filename
    ? photoStorage.getPhotoUri('restored', restoration.restored_filename)
    : null;

  // Debug logging
  console.log('🖼️ Original URI:', originalUri);
  console.log('🖼️ Restored URI:', restoredUri);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-white">
        {/* Clean Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <IconSymbol name="chevron.left" size={isSmallDevice ? 20 : 24} color="#000" />
          </TouchableOpacity>
          <View className="flex-1 mx-2">
            <Text className={`${isSmallDevice ? 'text-sm' : 'text-base'} font-semibold text-gray-900 text-center`} numberOfLines={1}>
              {restoration?.function_type === 'unblur' ? 'Unblurred Photo' : 
               restoration?.function_type === 'colorize' ? 'Colorized Photo' : 
               restoration?.function_type === 'descratch' ? 'Descratched Photo' : 'Auto Restored Photo'}
            </Text>
          </View>
          <TouchableOpacity onPress={showDeleteActionSheet} className="p-2 -mr-2">
            <IconSymbol name="trash" size={isSmallDevice ? 18 : 20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Error state when files are missing */}
        {!filesExist && (
          <View className="flex-1 items-center justify-center px-8">
            <IconSymbol name="exclamationmark.triangle" size={64} color="#ef4444" />
            <Text className="text-xl font-semibold text-gray-900 mt-4 mb-2">Photo Not Found</Text>
            <Text className="text-center text-gray-600 mb-6">
              The photo files have been deleted or moved. This restoration record will be cleaned up.
            </Text>
            <TouchableOpacity 
              onPress={() => router.back()}
              className="bg-blue-500 px-6 py-3 rounded-full"
            >
              <Text className="text-white font-semibold">Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Content - ScrollView for small screens */}
        {filesExist && (
        <ScrollView 
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View className="flex-1 px-4">
            {/* Before/After Slider */}
            <View className={`${isTinyDevice ? 'py-4' : 'flex-1 justify-center'}`}>
              <BeforeAfterSlider
                beforeUri={originalUri}
                afterUri={restoredUri || originalUri}
                style={{ marginVertical: isTinyDevice ? 10 : 20 }}
                simpleSlider={simpleSlider}
              />
            </View>

            {/* Primary Actions */}
            <View className={`${isTinyDevice ? 'pb-2' : 'pb-3'}`}>
              {/* Save & Share Buttons - Clean Row */}
              <View className={`flex-row ${isSmallDevice ? 'gap-2' : 'gap-3'} ${isTinyDevice ? 'mb-2' : 'mb-3'}`}>
                {/* Save Button */}
                <AnimatedTouchableOpacity
                  style={[
                    {
                      flex: 1,
                      height: isSmallDevice ? 48 : 52,
                      borderRadius: 14,
                      backgroundColor: '#f97316',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      position: 'relative',
                    },
                    animatedButtonStyle,
                    animatedSuccessStyle,
                  ]}
                  onPress={handleExport}
                >
                  {/* Simple icon and text */}
                  <Animated.View style={animatedIconStyle}>
                    <IconSymbol name="arrow.down.circle.fill" size={isSmallDevice ? 20 : 22} color="#fff" />
                  </Animated.View>
                  <Text style={{ color: '#fff', fontSize: isSmallDevice ? 14 : 16, fontWeight: '600', marginLeft: 6 }}>
                    {downloadText}
                  </Text>
                </AnimatedTouchableOpacity>

                {/* Share Button */}
                <TouchableOpacity
                  className={`flex-1 ${isSmallDevice ? 'h-[48px]' : 'h-[52px]'} bg-gray-100 rounded-[14px] flex-row items-center justify-center active:scale-95`}
                  onPress={handleShare}
                >
                  <IconSymbol name="square.and.arrow.up" size={isSmallDevice ? 18 : 20} color="#374151" />
                  <Text className={`text-gray-700 font-semibold ${isSmallDevice ? 'text-sm' : 'text-base'} ml-1.5`}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Section */}
            <View className={`${isTinyDevice ? 'pb-3' : 'pb-4'}`}>
              {/* Restore Another Photo Button */}
              <TouchableOpacity
                className={`w-full ${isSmallDevice ? 'h-12' : 'h-14'} bg-gray-900 rounded-2xl items-center justify-center flex-row active:scale-95`}
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
                <IconSymbol name="camera" size={isSmallDevice ? 18 : 20} color="#fff" />
                <Text className={`text-white font-semibold ${isSmallDevice ? 'text-sm' : 'text-base'} ml-2`}>
                  Take Another Photo
                </Text>
              </TouchableOpacity>

              {/* Other Restorations */}
              {allRestorations.length > 0 && (
                <View className={`${isTinyDevice ? 'mt-4' : 'mt-6'}`}>
                  <Text className={`text-gray-700 ${isSmallDevice ? 'text-xs' : 'text-sm'} font-medium ${isTinyDevice ? 'mb-2' : 'mb-3'}`}>
                    Recent Restorations
                  </Text>
                  <FlatList
                    data={allRestorations}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    removeClippedSubviews={true}
                    initialNumToRender={5}
                    maxToRenderPerBatch={3}
                    windowSize={5}
                    getItemLayout={(data, index) => ({
                      length: isSmallDevice ? 58 : 70,
                      offset: (isSmallDevice ? 58 : 70) * index,
                      index,
                    })}
                    renderItem={({ item }) => {
                      const thumbnailSize = isSmallDevice ? 50 : 60;
                      return (
                        <TouchableOpacity
                          className={`${isSmallDevice ? 'mr-2' : 'mr-3'} active:scale-95`}
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
                  <View className={`rounded-lg overflow-hidden ${item.id === id ? 'border-2 border-orange-500' : 'border border-gray-200'}`}>
                    <Image
                              source={{ uri: item.thumbnail_filename 
                                ? photoStorage.getPhotoUri('thumbnail', item.thumbnail_filename)
                                : photoStorage.getPhotoUri('restored', item.restored_filename!)
                              }}
                              style={{ width: thumbnailSize, height: thumbnailSize, opacity: item.id === id ? 0.6 : 1 }}
                              className="rounded-lg"
                            />
                            {item.id === id && (
                              <View className="absolute inset-0 bg-orange-500/20 rounded-lg" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                    contentContainerStyle={{ paddingRight: 16 }}
                  />
                </View>
              )}
            </View>
          </View>
        </ScrollView>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}