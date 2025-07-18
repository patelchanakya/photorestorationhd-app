import React, { useState } from 'react';
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
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { FunctionCards } from '@/components/FunctionCards';
import { SkeletonRestorationCard } from '@/components/SkeletonRestorationCard';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { photoStorage } from '@/services/storage';
import { Restoration } from '@/types';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { useRestorationHistory } from '@/hooks/useRestorationHistory';
import { useRefreshOnFocus } from '@/hooks/useScreenFocus';

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
          {new Date(item.created_at || item.createdAt).toLocaleDateString()}
        </Text>
        <Text className="text-orange-600 text-sm font-medium">
          View Details →
        </Text>
      </View>
    </AnimatedTouchableOpacity>
  );
}

export default function HomeScreen() {
  const [processingJobs, setProcessingJobs] = useState<Map<string, ProcessingJob>>(new Map());
  const [progressIntervals, setProgressIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map());
  
  // TanStack Query hooks
  const photoRestorationMutation = usePhotoRestoration();
  const { data: restorations = [], isLoading: loading, refetch, isFetching } = useRestorationHistory();
  
  // Refresh on screen focus
  useRefreshOnFocus(refetch);

  const loadRestorations = async () => {
    await refetch();
  };

  // Create artificial smooth progress animation
  const startProgressAnimation = (jobId: string) => {
    let currentProgress = 0;
    const targetProgress = 95; // Don't reach 100% until API completes
    const duration = 6000; // 6 seconds
    const intervalTime = 100; // Update every 100ms
    const increment = (targetProgress / duration) * intervalTime;

    const interval = setInterval(() => {
      currentProgress += increment;
      
      if (currentProgress >= targetProgress) {
        currentProgress = targetProgress;
        clearInterval(interval);
        setProgressIntervals(prev => {
          const newMap = new Map(prev);
          newMap.delete(jobId);
          return newMap;
        });
      }

      setProcessingJobs(prev => {
        const newMap = new Map(prev);
        const job = newMap.get(jobId);
        if (job && !job.isComplete) {
          newMap.set(jobId, { ...job, progress: Math.round(currentProgress) });
        }
        return newMap;
      });
    }, intervalTime);

    setProgressIntervals(prev => new Map(prev.set(jobId, interval)));
  };

  // Clear progress animation
  const clearProgressAnimation = (jobId: string) => {
    const interval = progressIntervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      setProgressIntervals(prev => {
        const newMap = new Map(prev);
        newMap.delete(jobId);
        return newMap;
      });
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
      // Create unique processing job ID
      const processingJobId = `temp_${Date.now()}`;
      
      // Show loading state while processing
      const processingJob: ProcessingJob = {
        id: processingJobId,
        user_id: 'anonymous',
        original_filename: '',
        restored_filename: undefined,
        thumbnail_filename: undefined,
        status: 'processing',
        function_type: functionType,
        processing_time_ms: undefined,
        created_at: new Date().toISOString(),
        completed_at: undefined,
        originalUri: uri,
        isProcessing: true,
        progress: 0,
        isComplete: false,
      };
      
      setProcessingJobs(prev => new Map(prev.set(processingJobId, processingJob)));
      
      // Start artificial smooth progress animation
      startProgressAnimation(processingJobId);
      
      // Use TanStack Query mutation for photo restoration
      photoRestorationMutation.mutate(uri, {
        onSuccess: (data) => {
          console.log('🎉 Photo restoration completed:', data);
          
          // Clear the artificial progress animation
          clearProgressAnimation(processingJobId);
          
          // Show completion state briefly
          setProcessingJobs(prev => {
            const newMap = new Map(prev);
            const job = newMap.get(processingJobId);
            if (job) {
              newMap.set(processingJobId, { ...job, progress: 100, isComplete: true });
            }
            return newMap;
          });
          
          // Remove processing job after completion animation
          setTimeout(() => {
            setProcessingJobs(prev => {
              const newMap = new Map(prev);
              newMap.delete(processingJobId);
              return newMap;
            });
          }, 1500); // Give time for completion animation
        },
        onError: (error) => {
          console.error('Photo restoration failed:', error);
          
          // Clear the artificial progress animation
          clearProgressAnimation(processingJobId);
          
          // Remove processing job on error
          setProcessingJobs(prev => {
            const newMap = new Map(prev);
            newMap.delete(processingJobId);
            return newMap;
          });
          
          Alert.alert(
            'Restoration Failed',
            'Something went wrong. Please try again.',
            [{ text: 'OK' }]
          );
        },
      });
      
    } catch (error) {
      console.error('Failed to start restoration:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };


  const handleRestorationPress = () => {
    showActionSheet('restoration');
  };

  const handleUnblurPress = () => {
    showActionSheet('unblur');
  };

  const renderRestoration = ({ item }: { item: any }) => {
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
            refreshing={isFetching}
            onRefresh={loadRestorations}
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