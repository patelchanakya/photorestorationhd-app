import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { SavingModal, type SavingModalRef } from '@/components/SavingModal';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { type FunctionType } from '@/services/photoGenerationV2';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { useCropModalStore } from '@/store/cropModalStore';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useRestorationScreenStore } from '@/store/restorationScreenStore';
import { useRestorationStore } from '@/store/restorationStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    SafeAreaView,
    ScrollView,
    Share,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


// Get screen dimensions for responsive design
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_HEIGHT < 700;

export default function RestorationScreen() {
  const { id, imageUri, functionType, imageSource, customPrompt } = useLocalSearchParams();
  
  // Use Zustand store for all state management
  const {
    restoration,
    setRestoration,
    loading,
    setLoading,
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
  const totalRestorations = useRestorationStore((state) => state.totalRestorations);
  const hasShownRatingPrompt = useRestorationStore((state) => state.hasShownRatingPrompt);
  const setHasShownRatingPrompt = useRestorationStore((state) => state.setHasShownRatingPrompt);
  const { isPro } = useRevenueCat();
  
  // Check if this is a new restoration request
  const isNewRestoration = !!imageUri && !!functionType;
  
  // Reset state on unmount
  useEffect(() => {
    return () => {
      resetState();
    };
  }, [resetState]);
  
  // Saving modal state
  const [showSavingModal, setShowSavingModal] = useState(false);
  const savingModalRef = useRef<SavingModalRef>(null);


  const loadRestoration = useCallback(async () => {
    try {
      let data = await restorationService.getById(id as string);
      
      // If not found by restoration ID, try prediction ID (for recovery system)
      if (!data) {
        if (__DEV__) {
          console.log('🔍 Restoration not found by ID, trying prediction ID:', id);
        }
        data = await restorationService.getByPredictionId(id as string);
      }
      
      setRestoration(data);
      
      // If this is a completed restoration being shown to user, clear activePredictionId
      // to prevent recovery system from showing it again
      if (data && data.status === 'completed' && (data.restored_filename || data.replicate_url)) {
        await AsyncStorage.removeItem('activePredictionId');
        if (__DEV__) {
          console.log('🧹 [RECOVERY] Cleared prediction state - completed restoration shown to user');
        }
      }
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

  const { setIsProcessing, setProgress, setCanCancel, setCurrentImageUri } = useCropModalStore();
  
  // Clean up text-edit context and flow flag if this restoration came from text-edits
  useEffect(() => {
    const cleanupTextEditContext = async () => {
      if (id) {
        try {
          const contextKey = `textEditContext_${id}`;
          const context = await AsyncStorage.getItem(contextKey);
          if (context) {
            await AsyncStorage.removeItem(contextKey);
            if (__DEV__) {
              console.log('🧹 [RESTORATION] Cleaned up text-edit context for prediction:', id);
            }
          }
          
          // Also clear the text-edits flow flag
          await AsyncStorage.removeItem('isTextEditsFlow');
          if (__DEV__) {
            console.log('🧹 [RESTORATION] Cleaned up text-edits flow flag');
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('⚠️ [RESTORATION] Failed to cleanup text-edit context:', error);
          }
        }
      }
    };
    
    cleanupTextEditContext();
  }, [id]);
  
  useEffect(() => {
    if (isNewRestoration) {
      const isVideoGeneration = functionType === 'backtolife';
      
      // Start processing with simple store
      setIsProcessing(true);
      setCurrentImageUri(imageUri as string);
      setProgress(0);
      setCanCancel(isVideoGeneration); // Only videos can be cancelled
      
      if (__DEV__) {
        console.log(`🚀 Started ${isVideoGeneration ? 'video' : 'photo'} processing`);
      }
      
      const startTime = Date.now();
      const estimatedDuration = isVideoGeneration ? 120 : 7; // seconds
      
      // Simple progress timer
      let progressIntervalId: ReturnType<typeof setInterval> | null = null;
      progressIntervalId = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(Math.floor((elapsed / estimatedDuration) * 95), 95);
        setProgress(progress);
        
        if (__DEV__ && progress % 10 === 0) {
          console.log(`📊 Progress: ${progress}%`);
        }
      }, 1000);
      
      // Start the actual processing in background
      photoRestoration.mutate({
        imageUri: imageUri as string,
        functionType: functionType as FunctionType,
        imageSource: (imageSource as 'camera' | 'gallery') || 'gallery',
        customPrompt: customPrompt ? decodeURIComponent(customPrompt as string) : undefined
      });

      // Cleanup progress timer on unmount or effect re-run
      return () => {
        if (progressIntervalId) {
          clearInterval(progressIntervalId);
        }
      };
    } else {
      // Load existing restoration
      loadRestoration();
      loadAllRestorations();
    }
  }, [isNewRestoration, imageUri, functionType, imageSource, customPrompt, loadRestoration, loadAllRestorations]);
  
  // Handle restoration success
  useEffect(() => {
    if (photoRestoration.isSuccess && photoRestoration.data) {
      const restorationData = photoRestoration.data;
      
      // Complete processing with 100% progress
      setProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
      }, 500); // Brief delay to show 100% completion
      
      // Check if this is a video result
      const isVideoResult = (restorationData as any).videoFilename;
      
      // Video usage tracking is handled server-side by webhook system
      const isBackToLifeMode = functionType === 'backtolife';
      
      if (isBackToLifeMode && __DEV__) {
        console.log('🎥 Back to Life video completed - usage already tracked server-side');
      }
      
      // Stay on current restoration page - results are shown inline
      if (__DEV__) {
        console.log('✅ Restoration completed, results shown inline');
      }
      
      // Check if we should show rating prompt (after 3rd restoration)
      if (totalRestorations >= 3 && !hasShownRatingPrompt) {
        // Additional delay to let the restoration screen load
        setTimeout(async () => {
          if (await StoreReview.hasAction()) {
            await StoreReview.requestReview();
            setHasShownRatingPrompt(true);
            if (__DEV__) {
              console.log('📱 Showed rating prompt after 3rd restoration');
            }
          }
        }, 1200); // Wait 1.2s after navigation
      }
    }
  }, [photoRestoration.isSuccess, photoRestoration.data, functionType, totalRestorations, hasShownRatingPrompt, setHasShownRatingPrompt]);
  
  // Clear progress immediately when error occurs
  useEffect(() => {
    if (photoRestoration.isError) {
      clearProcessingProgress();
      setIsProcessing(false);
      Alert.alert(
        'Processing Failed',
        photoRestoration.error?.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [photoRestoration.isError, photoRestoration.error, clearProcessingProgress, setIsProcessing]);
  
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

  // Helper function to clear active prediction state
  const clearActivePrediction = async () => {
    await AsyncStorage.removeItem('activePredictionId');
    if (__DEV__) {
      console.log('🧹 [RECOVERY] Cleared prediction state after user action');
    }
  };

  // Handler for dismissing the screen (back navigation)  
  const handleDismiss = async () => {
    await clearActivePrediction();
    router.dismissTo('/explore');
  };

  const handleExport = async () => {
    if (!restoration || !restoredUri) return;

    try {
      // Show saving modal
      setShowSavingModal(true);
      
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Use the determined URI (could be local file or Replicate URL)
      await photoStorage.exportToCameraRoll(restoredUri);
      
      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Trigger success state in modal
      savingModalRef.current?.showSuccess();
      
      // Clear active prediction state since user has saved the result
      await clearActivePrediction();
      
    } catch (err: any) {
      console.error('Failed to save photo to camera roll:', err);
      
      // Hide modal on error
      setShowSavingModal(false);
      
      // Error feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
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
    if (!restoration || !restoredUri) return;

    try {
      await Share.share({
        url: restoredUri,
        message: 'Check out my restored photo!',
      });
      
      // Clear active prediction state since user has shared the result
      await clearActivePrediction();
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
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center px-6">
        <IconSymbol name="exclamationmark.triangle" size={48} color="#ef4444" />
        <Text className="text-gray-800 text-lg mt-4 text-center">
          Cannot generate image
        </Text>
        <Text className="text-gray-600 text-sm mt-2 text-center px-4">
          {photoRestoration.error?.message || 'Please try again with a different image'}
        </Text>
        {!isPro && (
          <View className="mt-3 bg-green-50 px-4 py-2 rounded-lg">
            <Text className="text-green-700 text-sm text-center">
              ✓ Your free credit has been refunded
            </Text>
          </View>
        )}
        <TouchableOpacity 
          className="mt-4 px-6 py-3 bg-orange-500 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-medium">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Don't show any loading screen for new restorations - JobContext handles UI
  if (isNewRestoration) {
    return null; // JobContext components (PhotoProcessingModal/VideoProcessingToast) handle the UI
  }
  
  // Show loading state only for existing restorations being loaded
  if (loading) {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center px-6">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="text-gray-800 text-lg mt-4 text-center">
          Loading...
        </Text>
      </View>
    );
  }


  // Allow rendering if we have restoration data, even if status isn't 'completed' 
  // Recovery system might navigate here before local status is updated
  if (!restoration) {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center">
        <Text className="text-gray-800 text-lg">
          Restoration not found
        </Text>
      </View>
    );
  }
  
  // If status is not completed but we have restoration data, check if we have output URLs
  const hasOutputUrl = restoration.replicate_url || restoration.video_replicate_url;
  
  if (restoration.status !== 'completed' && !hasOutputUrl) {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center">
        <Text className="text-gray-800 text-lg">
          Still processing...
        </Text>
      </View>
    );
  }

  const originalUri = restoration ? photoStorage.getPhotoUri('original', restoration.original_filename) : '';
  
  // Determine the best URI to display: Replicate URL first, then local files when ready
  const getRestoredUri = () => {
    if (!restoration) return null;
    
    // If local files are ready, use local file (best quality, offline available)
    if (restoration.local_files_ready && restoration.restored_filename) {
      return photoStorage.getPhotoUri('restored', restoration.restored_filename);
    }
    
    // If video, check for video Replicate URL
    if (restoration.video_replicate_url) {
      return restoration.video_replicate_url;
    }
    
    // If image, check for image Replicate URL
    if (restoration.replicate_url) {
      return restoration.replicate_url;
    }
    
    // Fallback to local file if available (legacy support)
    if (restoration.restored_filename) {
      return photoStorage.getPhotoUri('restored', restoration.restored_filename);
    }
    
    return null;
  };
  
  const restoredUri = getRestoredUri();
  const isUsingReplicateUrl = restoration && (
    (restoration.replicate_url && !restoration.local_files_ready) || 
    (restoration.video_replicate_url && !restoration.local_files_ready)
  );

  // Debug logging
  if (__DEV__) {
    console.log('🖼️ Original URI:', originalUri);
    console.log('🖼️ Restored URI:', restoredUri);
    console.log('🔗 Using Replicate URL:', isUsingReplicateUrl);
    console.log('📁 Local files ready:', restoration?.local_files_ready);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
        {/* Clean Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
          <TouchableOpacity onPress={handleDismiss} style={{ padding: 8, marginLeft: -8 }}>
            <IconSymbol name="chevron.left" size={isSmallDevice ? 20 : 24} color="#EAEAEA" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={{ fontSize: isSmallDevice ? 14 : 16, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' }} numberOfLines={1}>
              {restoration?.function_type === 'repair' ? 'Repaired Photo' :
               restoration?.function_type === 'unblur' ? 'Enhanced Photo' : 
               restoration?.function_type === 'colorize' ? 'Colorized Photo' : 
               restoration?.function_type === 'descratch' ? 'Restored Photo' : 
               restoration?.function_type === 'enlighten' ? 'Brightened Photo' :
               restoration?.function_type === 'outfit' ? 'Outfit Changed' :
               restoration?.function_type === 'background' ? 'Background Changed' :
               restoration?.function_type === 'custom' ? 'Edited Photo' :
               (restoration?.function_type as any) === 'water_damage' ? 'Water Damage Fixed' :
               'Enhanced Photo'}
            </Text>
          </View>
          {/* Small camera icon for taking another photo with same mode */}
          <TouchableOpacity 
            onPress={async () => {
              if (isNavigating) return;
              setIsNavigating(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              
              // Open image picker to select new photo for same function type
              const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (res.status !== 'granted') {
                setIsNavigating(false);
                return;
              }
              
              const result = await ImagePicker.launchImageLibraryAsync({ 
                mediaTypes: ['images'], 
                allowsEditing: false, 
                quality: 1 
              });
              
              if (!result.canceled && result.assets[0]) {
                // Use QuickEditSheet with same function type and custom prompt if applicable
                const currentFunctionType = restoration?.function_type || functionType || 'restoration';
                const prompt = customPrompt ? decodeURIComponent(customPrompt as string) : undefined;
                useQuickEditStore.getState().openWithImage({
                  functionType: currentFunctionType as any,
                  imageUri: result.assets[0].uri,
                  customPrompt: prompt
                });
              } else {
                setIsNavigating(false);
              }
            }}
            style={{ padding: 8, marginRight: -8 }}
          >
            <IconSymbol name="camera" size={isSmallDevice ? 18 : 20} color="#9ca3af" />
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
              onPress={handleDismiss}
              className="bg-blue-500 px-6 py-3 rounded-full"
            >
              <Text className="text-white font-semibold">Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Content - ScrollView for small screens */}
        {filesExist && (
        <ScrollView 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {/* Before/After Slider */}
            <View style={{ paddingVertical: isTinyDevice ? 16 : 0, flex: isTinyDevice ? 0 : 1, justifyContent: isTinyDevice ? 'flex-start' : 'center' }}>
              <BeforeAfterSlider
                beforeUri={originalUri}
                afterUri={restoredUri || originalUri}
                style={{ marginVertical: isTinyDevice ? 10 : 20 }}
                simpleSlider={simpleSlider}
              />
            </View>

            {/* Primary Actions - 70/30 split */}
            <View style={{ paddingBottom: isTinyDevice ? 16 : 24 }}>
              <View className="flex-row" style={{ gap: 8 }}>
                {/* Save Button - 70% width */}
                <TouchableOpacity
                  style={{
                    flex: 7,
                    height: 56,
                    borderRadius: 28,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                  }}
                  onPress={handleExport}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#FF7A00', '#FFB54D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                    }}
                  />
                  <View>
                    <IconSymbol 
                      name="arrow.down.circle.fill" 
                      size={22} 
                      color="#fff" 
                    />
                  </View>
                  <Text style={{ 
                    color: '#fff', 
                    fontSize: 16, 
                    fontWeight: '700', 
                    marginLeft: 8,
                    letterSpacing: 0.3
                  }}>
                    Save to Photos
                  </Text>
                </TouchableOpacity>

                {/* Share Button - 30% width */}
                <TouchableOpacity
                  style={{
                    flex: 3,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={handleShare}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: '600',
                    letterSpacing: 0.3
                  }}>
                    Share
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Section - Removed */}
          </View>
        </ScrollView>
        )}
        
        {/* Saving Modal */}
        <SavingModal 
          ref={savingModalRef}
          visible={showSavingModal} 
          onComplete={() => setShowSavingModal(false)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}