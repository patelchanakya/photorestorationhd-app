import { Ionicons } from '@expo/vector-icons';
import { permissionsService } from '@/services/permissions';
import { supabase } from '@/services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useCropModalStore } from '@/store/cropModalStore';
import { useVideoToastStore } from '@/store/videoToastStore';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function PlayerView({ url }: { url: string }) {
  const source = { uri: url } as const;

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (!__DEV__) return;
    const checkPlayerStatus = () => {
      if (player) {
        // Dev-only lightweight status check
        // Avoid logging large objects frequently in production
        console.log('🎬 Player status:', player.status, Math.round(player.currentTime));
      }
    };
    const interval = setInterval(checkPlayerStatus, 4000);
    return () => clearInterval(interval);
  }, [player]);

  return (
    <VideoView
      player={player}
      style={{ 
        flex: 1, 
        backgroundColor: '#000'
      }}
      nativeControls={true}
      allowsFullscreen={true}
      contentFit="contain"
    />
  );
}

export default function VideoResultScreen() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  // Animation values for Save button
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(1);
  
  // Animated styles
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));

  // Spinner animation for Save button
  const spinnerRotation = useSharedValue(0);
  useEffect(() => {
    spinnerRotation.value = withRepeat(withTiming(360, { duration: 700 }), -1, false);
  }, []);
  const animatedSpinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinnerRotation.value}deg` }],
  }));
  
  // Clear toast and modal when user navigates to video page
  useEffect(() => {
    // Clear any existing toast/modal states since user is now viewing the video
    const cropModalStore = useCropModalStore.getState();
    const videoToastStore = useVideoToastStore.getState();
    
    if (cropModalStore.processingStatus === 'completed') {
      cropModalStore.setProcessingStatus(null);
      cropModalStore.setCompletedRestorationId(null);
      cropModalStore.setIsProcessing(false);
      
      if (__DEV__) {
        console.log('🔄 Cleared toast state - user is viewing video');
      }
    }
    
    // Clear video completion modal overlay
    if (videoToastStore.showCompletionModal) {
      videoToastStore.hideModal();
      
      if (__DEV__) {
        console.log('🔄 Cleared video modal overlay - user is viewing video');
      }
    }
  }, []);

  // Load video: try Replicate for real prediction IDs; otherwise fall back to local storage keys
  useEffect(() => {
    const loadVideoData = async () => {
      try {
        const rawId = typeof id === 'string' ? id : String(id);
        const predictionId = rawId.startsWith('video-') ? rawId.replace('video-', '') : rawId;
        const isLikelyLocalTimestamp = /^\d{10,}$/.test(predictionId);

        // Try Replicate only if it looks like a real prediction ID (UUID-like with hyphens)
        if (!isLikelyLocalTimestamp) {
          console.log('🔍 Loading video from Replicate API:', predictionId);
          const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
            headers: {
              // Newer Replicate docs prefer Bearer; support that here
              Authorization: `Bearer ${process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN}`,
            },
          });

          console.log('🔍 Replicate API response status:', response.status);

          if (response.ok) {
            const prediction = await response.json();
            console.log('🔍 Replicate API prediction:', {
              status: prediction.status,
              hasOutput: !!prediction.output,
              created_at: prediction.created_at,
              completed_at: prediction.completed_at,
            });

            if (prediction.status === 'succeeded' && prediction.output) {
              setVideoUrl(prediction.output);
              console.log('✅ Video loaded from Replicate API:', prediction.output);
              return;
            }
          } else {
            const errorText = await response.text();
            console.log('❌ Replicate API error:', response.status, errorText);
          }
        }

        // Fallback: AsyncStorage for legacy/local IDs and dev flows
        console.log('🔍 Trying AsyncStorage fallbacks');
        const tryKeys = [
          `video_video-${predictionId}`,
          `video_${predictionId}`,
          typeof id === 'string' ? `video_${id}` : undefined,
        ].filter(Boolean) as string[];

        for (const key of tryKeys) {
          const json = await AsyncStorage.getItem(key);
          if (json) {
            const data = JSON.parse(json);
            if (data?.url) {
              setVideoUrl(data.url);
              console.log('🎬 Video data loaded from AsyncStorage:', { key });
              return;
            }
          }
        }

        console.log('⚠️ No video found via Replicate or local storage');
      } catch (error) {
        console.log('❌ Could not load video data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadVideoData();
    }
  }, [id]);
  
  // Video player is mounted only when a valid URL exists, via PlayerView

  const getVideoUri = async () => {
    if (!videoUrl) {
      throw new Error('No video URL available');
    }
    
    // Check if we already have this video downloaded and cached
    const cacheKey = videoUrl.split('/').pop()?.split('?')[0] || 'unknown';
    const cachedUri = `${FileSystem.documentDirectory}cached_video_${cacheKey}.mp4`;
    
    // Check if cached version exists
    try {
      const cachedInfo = await FileSystem.getInfoAsync(cachedUri);
      if (cachedInfo.exists && cachedInfo.size && cachedInfo.size > 1000) {
        console.log('✅ Using cached video file:', cachedUri);
        return cachedUri;
      }
    } catch {
      // Cache check failed, proceed with download
    }
    
    try {
      console.log('⬇️ Downloading video for sharing/saving:', videoUrl);
      
      // Download with progress tracking
      const downloadResult = await FileSystem.downloadAsync(videoUrl, cachedUri);
      
      // Verify download was successful
      const downloadedInfo = await FileSystem.getInfoAsync(cachedUri);
      if (!downloadedInfo.exists || !downloadedInfo.size || downloadedInfo.size < 1000) {
        throw new Error('Downloaded video file is corrupted or empty');
      }
      
      console.log('✅ Video downloaded successfully:', Math.round(downloadedInfo.size / 1024), 'KB');
      return downloadResult.uri;
      
    } catch (error) {
      console.log('❌ Could not download video:', error);
      
      // Clean up failed download
      try {
        await FileSystem.deleteAsync(cachedUri, { idempotent: true });
      } catch {}
      
      if (error instanceof Error && error.message.includes('Network')) {
        throw new Error('Network error while downloading video. Please check your internet connection and try again.');
      }
      
      throw new Error('Could not download video for sharing/saving. Please try again.');
    }
  };

  const handleShareVideo = async () => {
    if (isSharing) return;

    setIsSharing(true);
    
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device.');
        return;
      }

      if (__DEV__) {
        console.log('🎬 Preparing video for sharing...');
      }

      const videoUri = await getVideoUri();
      
      await Sharing.shareAsync(videoUri, {
        mimeType: 'video/mp4',
        dialogTitle: 'Share Video',
      });

      if (__DEV__) {
        console.log('✅ Video shared successfully');
      }
      
      // Clean up the temporary file
      await FileSystem.deleteAsync(videoUri, { idempotent: true });
      
    } catch (error) {
      console.error('❌ Failed to share video:', error);
      const message = error.message.includes('not accessible') 
        ? 'Video sharing is not yet available. This feature will work with actual generated videos.'
        : 'Could not share video. Please try again.';
      
      Alert.alert(
        'Share Not Available',
        message,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveVideo = async () => {
    if (isSaving) return;

    // Check permission first using our centralized service
    if (!permissionsService.hasMediaLibraryPermission()) {
      const result = await permissionsService.requestSpecificPermission('mediaLibrary');
      if (result !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to save videos.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    // Start loading animation
    setIsSaving(true);
    buttonScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 15 })
    );
    
    try {
      if (__DEV__) {
        console.log('🎬 Preparing video for save to photos...');
      }
      
      const videoUri = await getVideoUri();

      // Save to media library
      const asset = await MediaLibrary.saveToLibraryAsync(videoUri);
      
      // Clean up the temporary file
      await FileSystem.deleteAsync(videoUri, { idempotent: true });
      
      // Success feedback
      buttonScale.value = withSequence(
        withTiming(1.05, { duration: 100 }),
        withSpring(1, { damping: 10 })
      );
      
      Alert.alert(
        'Success!',
        'Video saved to your Photos app.',
        [{ text: 'OK' }]
      );
      
      if (__DEV__) {
        console.log('✅ Video saved to photos:', asset);
      }
    } catch (error) {
      console.error('❌ Failed to save video:', error);
      
      const message = error.message.includes('not accessible') 
        ? 'Video saving is not yet available. This feature will work with actual generated videos.'
        : 'Could not save video to Photos. Please try again.';
      
      Alert.alert(
        'Save Not Available',
        message,
        [{ text: 'OK' }]
      );
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  if (loading || !videoUrl) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={{ color: '#fff', marginTop: 16 }}>
            {loading ? 'Loading video...' : 'No video available'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      {/* Header with X button - positioned absolutely */}
      <SafeAreaView style={{ position: 'absolute', top: 0, right: 0, zIndex: 20 }}>
        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.3)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Video Player - Full screen */}
      <PlayerView url={videoUrl} />

      {/* Action buttons with SafeAreaView */}
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15 }}>
        {/* Share Button */}
        <View style={{
          marginHorizontal: 20,
          marginBottom: 16,
          height: 56,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <TouchableOpacity
            style={{
              width: '100%',
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(26, 26, 26, 0.85)',
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.18)',
              flexDirection: 'row',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
            }}
            onPress={handleShareVideo}
            activeOpacity={isSharing ? 1 : 0.8}
            disabled={isSharing}
          >
            {isSharing ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text style={{ 
                  color: '#ffffff', 
                  fontSize: 16, 
                  fontWeight: '600',
                  marginLeft: 8,
                  letterSpacing: 0.3,
                }}>
                  Sharing...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="share-outline" size={18} color="white" />
                <Text style={{ 
                  color: '#ffffff', 
                  fontSize: 16, 
                  fontWeight: '600',
                  marginLeft: 8,
                  letterSpacing: 0.3,
                }}>
                  Share
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <View style={{
          marginHorizontal: 20,
          marginBottom: 16,
          height: 56,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <AnimatedTouchableOpacity
            style={[
              {
                width: '100%',
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSaving ? 'rgba(249,115,22,0.7)' : '#f97316',
                flexDirection: 'row',
                shadowColor: '#f97316',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isSaving ? 0.15 : 0.35,
                shadowRadius: 16,
                borderWidth: isSaving ? 0 : 0.5,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
              animatedButtonStyle
            ]}
            onPress={handleSaveVideo}
            activeOpacity={isSaving ? 1 : 0.85}
            disabled={isSaving}
          >
            {isSaving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Animated.View
                  style={[
                    {
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: 'rgba(255,255,255,0.25)',
                      borderTopColor: '#ffffff',
                    },
                    animatedSpinnerStyle,
                  ]}
                />
                <Text style={{ 
                  color: '#ffffff', 
                  fontSize: 16, 
                  fontWeight: '600', 
                  letterSpacing: 0.3 
                }}>
                  Saving…
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="white" />
                <Text style={{ 
                  color: '#ffffff', 
                  fontSize: 16,
                  fontWeight: '600',
                  marginLeft: 8,
                  letterSpacing: 0.3,
                }}>
                  Save to Photos
                </Text>
              </>
            )}
          </AnimatedTouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}