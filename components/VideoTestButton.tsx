import React, { useState } from 'react';
import { TouchableOpacity, Text, View, Alert } from 'react-native';
import { generateVideo, getServiceInfo, isUsingMockVideo } from '@/services/videoServiceProxy';
import { useVideoToastStore } from '@/store/videoToastStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VideoTestButtonProps {
  imageUri?: string;
  testPrompt?: string;
}

export function VideoTestButton({ 
  imageUri = 'https://picsum.photos/400/600', // Placeholder image
  testPrompt = 'animate with a warm smile'
}: VideoTestButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { showToast, setProcessingStatus, setCurrentVideoId } = useVideoToastStore();
  
  const serviceInfo = getServiceInfo();

  const storeVideoData = async (videoUrl: string) => {
    try {
      // Create video metadata
      const videoId = `video-${Date.now()}`;
      const videoData = {
        id: videoId,
        url: videoUrl,
        originalImage: imageUri,
        prompt: testPrompt || 'animate with a warm smile',
        created_at: new Date().toISOString(),
        status: 'completed',
        service: isUsingMockVideo() ? 'mock' : 'real'
      };

      // Store in AsyncStorage for the video result screen to find
      await AsyncStorage.setItem(`video_${videoId}`, JSON.stringify(videoData));

      // Also store the current video ID so the toast can navigate to it
      setCurrentVideoId(videoId);

      if (__DEV__) {
        console.log('🎬 Video data stored:', videoData);
        console.log('🎬 Video ID set for toast navigation:', videoId);
      }

    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to store video data:', error);
      }
    }
  };

  const handleTestVideoGeneration = async () => {
    if (isGenerating) return;

    try {
      setIsGenerating(true);
      showToast();
      setProcessingStatus('loading');

      if (__DEV__) {
        console.log('🧪 Starting video generation test');
        console.log('📸 Using image:', imageUri);
        console.log('🎬 Using prompt:', testPrompt);
        console.log('🔧 Service:', serviceInfo.serviceName);
      }

      const resultUrl = await generateVideo(imageUri, testPrompt, {
        mode: 'standard',
        duration: 5
      });

      if (__DEV__) {
        console.log('✅ Video generation test completed:', resultUrl);
      }

      // Simulate completion state
      setProcessingStatus('completed');
      
      // Store video data for later retrieval
      await storeVideoData(resultUrl);
      
      if (__DEV__) {
        console.log('🎬 Video ready! Toast will show completion state.');
        console.log('🎬 Tap the toast to view the video.');
      }
      
      // Keep completed state visible - toast will handle navigation
      setTimeout(() => {
        setProcessingStatus(null);
      }, 3000); // Give user time to see and tap the toast

    } catch (error) {
      if (__DEV__) {
        console.error('❌ Video generation test failed:', error);
      }

      setProcessingStatus('error');
      
      Alert.alert(
        'Generation Failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        [
          {
            text: 'OK',
            onPress: () => {
              setProcessingStatus(null);
            }
          }
        ]
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View className={`p-4 rounded-xl m-4 border-2 ${
      isUsingMockVideo() 
        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600' 
        : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600'
    }`}>
      <View className="mb-3">
        <Text className={`text-lg font-bold mb-2 ${
          isUsingMockVideo() 
            ? 'text-green-800 dark:text-green-200' 
            : 'text-red-800 dark:text-red-200'
        }`}>
          🎬 Video Service Test
        </Text>
        <Text className={`text-sm font-semibold mb-1 ${
          isUsingMockVideo() 
            ? 'text-green-700 dark:text-green-300' 
            : 'text-red-700 dark:text-red-300'
        }`}>
          {isUsingMockVideo() ? '🎭 MOCK MODE' : '⚡ LIVE API MODE'}
        </Text>
        <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Service: {serviceInfo.serviceName}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-500">
          {serviceInfo.description}
        </Text>
        {isUsingMockVideo() && (
          <Text className="text-xs font-semibold text-green-600 dark:text-green-400 mt-2">
            ✅ Safe to test - No API costs, uses local videos
          </Text>
        )}
        {!isUsingMockVideo() && (
          <Text className="text-xs font-semibold text-red-600 dark:text-red-400 mt-2">
            ⚠️ WARNING: Will make real API calls and cost money!
          </Text>
        )}
      </View>
      
      <TouchableOpacity
        onPress={handleTestVideoGeneration}
        disabled={isGenerating}
        className={`py-3 px-6 rounded-lg ${
          isGenerating
            ? 'bg-gray-400 dark:bg-gray-600'
            : isUsingMockVideo()
            ? 'bg-green-500 dark:bg-green-600 active:bg-green-600 dark:active:bg-green-700'
            : 'bg-red-500 dark:bg-red-600 active:bg-red-600 dark:active:bg-red-700'
        }`}
      >
        <Text className="text-white font-semibold text-center">
          {isGenerating ? 'Generating...' : isUsingMockVideo() ? '🎭 Test Mock Video (Safe)' : '⚡ Test Real API (Costs Money!)'}
        </Text>
      </TouchableOpacity>
      
      <Text className="text-xs text-gray-500 dark:text-gray-500 mt-2 text-center">
        Processing time: {isUsingMockVideo() ? '7 seconds (mock)' : '2-5 minutes (real API)'}
      </Text>
    </View>
  );
}