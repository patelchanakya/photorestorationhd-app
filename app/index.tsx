import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Image as RNImage,
  RefreshControl,
  ScrollView,
  StatusBar,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { FunctionCards } from '@/components/FunctionCards';
import { SkeletonRestorationCard } from '@/components/SkeletonRestorationCard';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { restorePhoto } from '@/services/replicate';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { Restoration } from '@/types';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface ProcessingJob extends Restoration {
  originalUri: string;
  isProcessing: boolean;
  progress: number;
  isComplete: boolean;
}

interface RestorationCardProps {
  item: Restoration;
  thumbnailUri: string | null;
  originalUri: string | null;
  onPress: () => void;
}

function RestorationCard({ item, thumbnailUri, originalUri, onPress }: RestorationCardProps) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <AnimatedTouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        {
          backgroundColor: '#ffffff',
          borderRadius: 20,
          padding: 16,
          marginBottom: 16,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        },
        animatedStyle,
      ]}
    >
      <View className="flex-row gap-4">
        {/* Before Image */}
        <View className="flex-1">
          <Text className="text-gray-700 text-sm font-semibold text-center mb-2">Before</Text>
          {originalUri && (
            <RNImage
              source={{ uri: originalUri }}
              style={{ width: '100%', height: 120, borderRadius: 12 }}
              resizeMode="cover"
            />
          )}
        </View>
        
        {/* After Image */}
        <View className="flex-1">
          <Text className="text-gray-700 text-sm font-semibold text-center mb-2">After</Text>
          {thumbnailUri && (
            <RNImage
              source={{ uri: thumbnailUri }}
              style={{ width: '100%', height: 120, borderRadius: 12 }}
              resizeMode="cover"
            />
          )}
        </View>
      </View>
      
      <View className="flex-row justify-between items-center mt-4">
        <Text className="text-gray-500 text-sm">
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Text className="text-orange-600 text-sm font-medium">
          View Details →
        </Text>
      </View>
    </AnimatedTouchableOpacity>
  );
}

export default function HomeScreen() {
  const { openModal } = useLocalSearchParams();
  const [restorations, setRestorations] = useState<Restoration[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingJobs, setProcessingJobs] = useState<Map<string, ProcessingJob>>(new Map());

  useEffect(() => {
    loadRestorations();
  }, []);

  const loadRestorations = async () => {
    try {
      // Always use 'anonymous' since we don't have auth
      const data = await restorationService.getUserRestorations('anonymous');
      setRestorations(data.filter(r => r.status === 'completed').sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (err) {
      console.error('Failed to load restorations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const requestPermissions = async (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  };

  const pickImage = async (source: 'camera' | 'gallery', functionType: 'restoration' | 'unblur') => {
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
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
    }

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      await handlePhotoSelected(uri, functionType);
    }
  };

  const showActionSheet = (functionType: 'restoration' | 'unblur') => {
    const title = functionType === 'restoration' ? 'Restore Photo' : 'Unblur Photo';
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
          title,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImage('camera', functionType);
          } else if (buttonIndex === 2) {
            pickImage('gallery', functionType);
          }
        }
      );
    } else {
      // Fallback for Android
      Alert.alert(
        title,
        'Select photo source',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => pickImage('camera', functionType) },
          { text: 'Choose from Library', onPress: () => pickImage('gallery', functionType) },
        ]
      );
    }
  };

  const handlePhotoSelected = async (uri: string, functionType: 'restoration' | 'unblur') => {
    try {
      // Always use 'anonymous' since we don't have auth

      // Save original photo locally
      const originalFilename = await photoStorage.saveOriginal(uri);

      // Create restoration record in database
      const restoration = await restorationService.create({
        user_id: 'anonymous',
        original_filename: originalFilename,
        status: 'processing',
        function_type: functionType,
      });

      // Add to processing jobs (for skeleton display)
      const processingJob: ProcessingJob = {
        ...restoration,
        originalUri: uri,
        isProcessing: true,
        progress: 0,
        isComplete: false,
      };
      
      setProcessingJobs(prev => new Map(prev.set(restoration.id, processingJob)));

      // Process photo in background
      processPhotoInBackground(uri, restoration, originalFilename);
      
    } catch (error) {
      console.error('Failed to start restoration:', error);
      Alert.alert('Error', 'Failed to start photo restoration. Please try again.');
    }
  };

  const processPhotoInBackground = async (uri: string, restoration: Restoration, originalFilename: string) => {
    try {
      const startTime = Date.now();

      // Progress update function
      const updateProgress = (progress: number) => {
        setProcessingJobs(prev => {
          const newMap = new Map(prev);
          const job = newMap.get(restoration.id);
          if (job) {
            newMap.set(restoration.id, { ...job, progress });
          }
          return newMap;
        });
      };

      // Stage 1: Initial processing (20% at 1 second)
      setTimeout(() => updateProgress(20), 1000);
      
      // Stage 2: Image analysis (40% at 2 seconds)
      setTimeout(() => updateProgress(40), 2000);
      
      // Stage 3: AI processing (80% at 3 seconds)
      setTimeout(() => updateProgress(80), 3000);

      // Process photo with Replicate
      const restoredUrl = await restorePhoto(uri);
      console.log('🎉 Photo restored successfully, URL:', restoredUrl);

      // Complete progress (100%)
      updateProgress(100);

      // Save restored photo locally
      const restoredFilename = await photoStorage.saveRestored(restoredUrl, originalFilename);
      console.log('💾 Restored photo saved locally:', restoredFilename);

      // Get the URI for the restored photo
      const restoredUri = photoStorage.getPhotoUri('restored', restoredFilename);
      console.log('📍 Restored photo URI:', restoredUri);

      // Create thumbnails
      const thumbnailFilename = await photoStorage.createThumbnail(
        restoredUri,
        'restored'
      );
      console.log('🖼️ Thumbnail created:', thumbnailFilename);

      // Update restoration record
      const updatedRestoration = await restorationService.update(restoration.id, {
        restored_filename: restoredFilename,
        thumbnail_filename: thumbnailFilename,
        status: 'completed',
        processing_time_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      });

      // Mark as complete for success animation
      setProcessingJobs(prev => {
        const newMap = new Map(prev);
        const job = newMap.get(restoration.id);
        if (job) {
          newMap.set(restoration.id, { ...job, isComplete: true });
        }
        return newMap;
      });

      // Remove from processing jobs after success animation (1 second)
      setTimeout(() => {
        setProcessingJobs(prev => {
          const newMap = new Map(prev);
          newMap.delete(restoration.id);
          return newMap;
        });

        // Reload restorations to show completed result
        loadRestorations();
      }, 1000);
      
    } catch (error) {
      console.error('Background processing error:', error);
      
      // Remove from processing jobs
      setProcessingJobs(prev => {
        const newMap = new Map(prev);
        newMap.delete(restoration.id);
        return newMap;
      });

      let errorMessage = 'Unable to restore your photo. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Authentication failed')) {
          errorMessage = 'Authentication failed. Please check your API token.';
        } else if (error.message.includes('Network request failed')) {
          errorMessage = 'Network connection failed. Please check your internet connection.';
        } else if (error.message.includes('does not exist')) {
          errorMessage = 'File system error. Please restart the app and try again.';
        } else if (error.message.includes('Download failed')) {
          errorMessage = 'Failed to download restored photo. Please try again.';
        }
      }
      
      Alert.alert(
        'Restoration Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };

  const handleRestorationPress = () => {
    showActionSheet('restoration');
  };

  const handleUnblurPress = () => {
    showActionSheet('unblur');
  };

  const renderRestoration = ({ item }: { item: Restoration }) => {
    const thumbnailUri = item.thumbnail_filename
      ? photoStorage.getPhotoUri('thumbnail', item.thumbnail_filename)
      : null;
    const originalUri = item.original_filename
      ? photoStorage.getPhotoUri('original', item.original_filename)
      : null;

    return (
      <RestorationCard
        item={item}
        thumbnailUri={thumbnailUri}
        originalUri={originalUri}
        onPress={() => router.push(`/restoration/${item.id}`)}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-orange-50 to-white">
      <StatusBar barStyle="dark-content" backgroundColor="#fff7ed" />
      
      
      {/* Function Cards */}
      <FunctionCards
        onRestorationPress={handleRestorationPress}
        onUnblurPress={handleUnblurPress}
      />

      {/* Main Content */}
      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRestorations();
            }}
            tintColor="#f97316"
          />
        }
      >

        {/* Restorations List */}
        {loading ? (
          <View className="items-center py-12">
            <View className="bg-white rounded-2xl p-8 shadow-sm">
              <Text className="text-gray-600 text-lg font-medium text-center">
                Loading your transformations...
              </Text>
            </View>
          </View>
        ) : restorations.length === 0 ? (
          <View className="items-center py-12 px-6">
            <View className="bg-white rounded-3xl p-8 shadow-sm items-center max-w-sm">
              <View className="w-20 h-20 bg-gradient-to-br from-orange-400 to-purple-500 rounded-full items-center justify-center mb-4">
                <IconSymbol name="photo" size={32} color="#ffffff" />
              </View>
              <Text className="text-gray-800 text-xl font-bold mb-2 text-center">
                Get Started
              </Text>
              <Text className="text-gray-600 text-center mb-6 leading-relaxed">
                Select a function above to begin
              </Text>
            </View>
          </View>
        ) : (
          <View className="px-4">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">
                Recent
              </Text>
              <Text className="text-gray-500 text-sm">
                {restorations.length + processingJobs.size} {restorations.length + processingJobs.size === 1 ? 'photo' : 'photos'}
              </Text>
            </View>
            
            {/* Processing Jobs (Skeleton Cards) */}
            {Array.from(processingJobs.values()).map((processingJob) => (
              <SkeletonRestorationCard
                key={processingJob.id}
                restoration={processingJob}
              />
            ))}
            
            {/* Completed Restorations */}
            {restorations.map((item) => (
              <View key={item.id}>
                {renderRestoration({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}