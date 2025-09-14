import { IconSymbol } from '@/components/ui/IconSymbol';
import { analyticsService } from '@/services/analytics';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useEvent } from 'expo';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useRef, useState } from 'react';
import { Alert, AppState, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhotoMagicUploadScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [isSelecting, setIsSelecting] = useState(false);
  const isMountedRef = useRef(true);
  const shouldBePlayingRef = useRef(false);

  // Video player setup - matches working components exactly
  const videoPlayer = useVideoPlayer(require('../assets/videos/text-edit.mp4'), (player) => {
    try {
      player.loop = true;
      player.muted = true;
      player.playbackRate = 1.0;
    } catch (error) {
      console.error('PhotoMagic video player init error:', error);
    }
  });

  // Monitor playback status
  const { isPlaying } = useEvent(videoPlayer, 'playingChange', { isPlaying: videoPlayer.playing });

  // Auto-recovery: restart video if it should be playing but isn't (with debounce)
  React.useEffect(() => {
    if (!isPlaying && shouldBePlayingRef.current && isMountedRef.current) {
      const recoveryTimeout = setTimeout(() => {
        try {
          if (videoPlayer && videoPlayer.status !== 'idle' && isMountedRef.current) {
            videoPlayer.play();
          }
        } catch (error) {
          // Ignore recovery errors - player may be released
        }
      }, 100);
      
      return () => clearTimeout(recoveryTimeout);
    }
  }, [isPlaying, videoPlayer]);

  // Track screen view on mount
  React.useEffect(() => {
    analyticsService.trackScreenView('photo_magic', {
      is_tablet: width > 768 ? 'true' : 'false'
    });
  }, [width]);

  // Initial playback setup
  React.useEffect(() => {
    if (!videoPlayer) return;
    
    const playTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      try {
        if (videoPlayer.status !== 'idle') {
          videoPlayer.play();
          shouldBePlayingRef.current = true;
        }
      } catch (error) {
        // Ignore initial play errors
      }
    }, 300);
    
    return () => clearTimeout(playTimer);
  }, [videoPlayer]);

  // Handle app state changes (backgrounding/foregrounding)
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && isMountedRef.current) {
        // Always try to resume video when app becomes active
        const resumeVideo = () => {
          try {
            if (videoPlayer && videoPlayer.status !== 'idle') {
              if (!videoPlayer.playing) {
                videoPlayer.play();
                shouldBePlayingRef.current = true;
                if (__DEV__) {
                  console.log('Video resumed on app active');
                }
              }
            }
          } catch (error) {
            if (__DEV__) {
              console.log('App state resume handled');
            }
          }
        };

        // Try multiple times with different delays to ensure resume
        resumeVideo();
        setTimeout(resumeVideo, 200);
        setTimeout(resumeVideo, 500);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [videoPlayer]);

  // Handle navigation focus (returning to screen)
  useFocusEffect(
    React.useCallback(() => {
      // Always ensure video is playing when screen is focused
      const resumeVideo = () => {
        try {
          if (isMountedRef.current && videoPlayer && videoPlayer.status !== 'idle') {
            if (!videoPlayer.playing) {
              videoPlayer.play();
              shouldBePlayingRef.current = true;
              if (__DEV__) {
                console.log('Video resumed on focus');
              }
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.log('Video focus resume handled');
          }
        }
      };

      // Try immediately and with a delay
      resumeVideo();
      const focusTimer = setTimeout(resumeVideo, 300);
      
      return () => clearTimeout(focusTimer);
    }, [videoPlayer])
  );

  // Cleanup video player on unmount
  React.useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;

    return () => {
      // Clear mounted flag
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
      
      // Cleanup video player
      try {
        if (videoPlayer && typeof videoPlayer.status !== 'undefined') {
          // Try to check status first as a validity check
          const status = videoPlayer.status;
          if (status !== 'idle') {
            videoPlayer.pause();
          }
          videoPlayer.release();
        }
      } catch (error) {
        // Silently handle cleanup errors as player may already be deallocated
        // This is expected when React Native garbage collects the player
        if (__DEV__) {
          console.log('Video player cleanup handled - this is normal');
        }
      }
    };
  }, []); // Empty deps - only run on mount/unmount

  const pickImage = async () => {
    if (isSelecting) return;
    setIsSelecting(true);

    try {
      // CTA analytics
      analyticsService.track('tile_cta_tapped', {
        placement: 'upload_library',
        cta_label: 'Choose Photo'
      });
      // Launch photo picker - works with limited access even if permissions denied
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: false,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.CURRENT,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        // Track magic tile selection for library pick
        analyticsService.trackTileUsage({
          category: 'popular',
          tileName: 'Photo Magic Library',
          tileId: 'magic-library',
          functionType: 'custom',
          stage: 'selected'
        });
        
        router.replace({
          pathname: '/text-edits',
          params: { 
            imageUri: result.assets[0].uri,
            fromUpload: 'true'
          }
        });
      } else if (result.canceled) {
        // Track image picker cancelled (fire and forget)
        analyticsService.track('photo_magic_picker_cancelled', {
          source: 'gallery'
        });
      }
    } catch (error) {
      // Track image picker error (fire and forget)
      analyticsService.track('photo_magic_picker_error', {
        source: 'gallery',
        error: error?.toString() || 'unknown_error'
      });
      
      Alert.alert(t('common.error'), t('photoMagic.failedToSelectImage'));
      console.error('Image picker error:', error);
    } finally {
      setIsSelecting(false);
    }
  };

  const takePhoto = async () => {
    if (isSelecting) return;
    setIsSelecting(true);

    try {
      // CTA analytics
      analyticsService.track('tile_cta_tapped', {
        placement: 'upload_camera',
        cta_label: 'Take Photo'
      });
      // Pause video to free up memory before camera launch
      try {
        if (videoPlayer && videoPlayer.status !== 'idle' && videoPlayer.playing) {
          videoPlayer.pause();
          shouldBePlayingRef.current = false;
        }
      } catch (pauseError) {
        // Continue even if pause fails
        if (__DEV__) {
          console.log('Video pause before camera handled');
        }
      }

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(t('photoMagic.permissionRequired'), t('photoMagic.cameraAccessMessage'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        // Track magic tile selection for camera
        analyticsService.trackTileUsage({
          category: 'popular',
          tileName: 'Photo Magic Camera',
          tileId: 'magic-camera',
          functionType: 'custom',
          stage: 'selected'
        });
        
        router.replace({
          pathname: '/text-edits',
          params: { 
            imageUri: result.assets[0].uri,
            fromUpload: 'true'
          }
        });
      } else if (result.canceled) {
        // Track camera cancelled (fire and forget)
        analyticsService.track('photo_magic_camera_cancelled', {
          source: 'camera'
        });
        
        // Resume video playback when camera is cancelled
        try {
          if (isMountedRef.current && videoPlayer && videoPlayer.status !== 'idle') {
            videoPlayer.play();
            shouldBePlayingRef.current = true;
          }
        } catch (videoError) {
          if (__DEV__) {
            console.log('Video resume after cancel handled');
          }
        }
      }
    } catch (error) {
      // Track camera error (fire and forget)  
      analyticsService.track('photo_magic_camera_error', {
        source: 'camera',
        error: error?.toString() || 'unknown_error'
      });
      
      Alert.alert(t('common.error'), t('photoMagic.failedToTakePhoto'));
      console.error('Camera error:', error);
      
      // Resume video playback on error if component is still mounted
      try {
        if (isMountedRef.current && videoPlayer && videoPlayer.status !== 'idle' && !videoPlayer.playing) {
          videoPlayer.play();
          shouldBePlayingRef.current = true;
        }
      } catch (videoError) {
        if (__DEV__) {
          console.log('Video resume handled');
        }
      }
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View
        style={{ 
          paddingHorizontal: 16, 
          paddingTop: 8, 
          paddingBottom: 8, 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}
      >
        <TouchableOpacity 
          onPress={() => router.back()}
          hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
          style={{ padding: 8 }}
        >
          <IconSymbol name="arrow.left" size={20} color="#EAEAEA" />
        </TouchableOpacity>
        
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 26, fontFamily: 'Lexend-Bold', letterSpacing: -0.5 }}>
            {t('photoMagic.title')}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '400', marginTop: 2 }}>
            {t('photoMagic.subtitle')}
          </Text>
        </View>
        
        <View style={{ width: 32 }} />
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Section */}
        <View style={{ 
          flex: 1,
          alignItems: 'center', 
          paddingTop: 20,
          paddingHorizontal: 10,
        }}>
          
          {/* Large Video Display */}
          <View 
            style={{ 
              width: width - 40,
              aspectRatio: 9/16,  // Typical vertical video aspect ratio
              maxHeight: height * 0.6,
              borderRadius: 32,
              overflow: 'hidden',
              backgroundColor: '#000',
            }}
          >
            <VideoView
              player={videoPlayer}
              style={{ 
                width: '100%',
                height: '100%',
              }}
              contentFit="cover"
              nativeControls={false}
              allowsFullscreen={false}
            />
          </View>
        </View>

        {/* Bottom Buttons */}
        <View 
          style={{ 
            paddingHorizontal: 20,
            paddingBottom: 40,
            gap: 16 
          }}
        >
            {/* Primary Upload Button (glass pill) */}
            <TouchableOpacity 
              onPress={pickImage}
              activeOpacity={0.8} 
              disabled={isSelecting}
              style={{ 
                height: 64,
                borderRadius: 20, 
                overflow: 'hidden',
                shadowColor: 'rgba(255,255,255,0.2)',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              onPressIn={() => {}}
              onPressOut={() => {}}
            >
              <BlurView intensity={10} tint="dark" style={{ flex: 1, borderRadius: 20 }}>
                <View style={{ 
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  paddingHorizontal: 24,
                  borderRadius: 20,
                }}>
                  <>
                    <IconSymbol name="photo.on.rectangle" size={24} color="rgba(255,255,255,0.95)" />
                    <Text style={{ 
                      color: 'rgba(255,255,255,0.95)', 
                      fontSize: 18, 
                      fontFamily: 'Lexend-Bold', 
                      marginLeft: 12 
                    }}>
                      {t('photoMagic.choosePhoto')}
                    </Text>
                  </>
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Camera Button */}
            <TouchableOpacity 
              onPress={takePhoto}
              activeOpacity={0.8} 
              disabled={isSelecting}
              style={{ 
                height: 64,
                borderRadius: 20, 
                overflow: 'hidden',
                shadowColor: 'rgba(255,255,255,0.2)',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              onPressIn={() => {}}
              onPressOut={() => {}}
            >
              <BlurView intensity={10} tint="dark" style={{ flex: 1, borderRadius: 20 }}>
                <View style={{ 
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  paddingHorizontal: 24,
                  borderRadius: 20,
                }}>
                  <IconSymbol name="camera" size={24} color="rgba(255,255,255,0.9)" />
                  <Text style={{ 
                    color: 'rgba(255,255,255,0.95)', 
                    fontSize: 18, 
                    fontFamily: 'Lexend-Bold', 
                    marginLeft: 12 
                  }}>
                    {t('photoMagic.takePhoto')}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}