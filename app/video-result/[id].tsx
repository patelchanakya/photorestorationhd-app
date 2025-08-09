import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function PlayerView({ url }: { url: string }) {
  const source = { uri: url } as const;

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    const checkPlayerStatus = () => {
      if (player) {
        console.log('🎬 Player status:', {
          status: player.status,
          duration: player.duration,
          currentTime: player.currentTime,
        });
      }
    };

    const interval = setInterval(checkPlayerStatus, 2000);
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
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  
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
  
  // Load video data from AsyncStorage
  useEffect(() => {
    const loadVideoData = async () => {
      try {
        const videoDataJson = await AsyncStorage.getItem(`video_${id}`);
        if (videoDataJson) {
          const videoData = JSON.parse(videoDataJson);
          setVideoUrl(videoData.url);
          console.log('🎬 Video data loaded:', videoData);
        }
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

    // Check permission first
    if (!permissionResponse?.granted) {
      const permission = await requestPermission();
      if (!permission.granted) {
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