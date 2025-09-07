import { IconSymbol } from '@/components/ui/IconSymbol';
import { analyticsService } from '@/services/analytics';
import { useTranslation } from '@/src/hooks/useTranslation';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhotoMagicUploadScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [isSelecting, setIsSelecting] = useState(false);
  const isMountedRef = useRef(true);

  // Video player setup
  const videoPlayer = useVideoPlayer(require('../assets/videos/text-edit.mp4'), (player) => {
    try {
      player.loop = true;
      player.muted = true;
      player.play();
    } catch (error) {
      console.error('Video player initialization error:', error);
    }
  });

  // Track screen view on mount
  React.useEffect(() => {
    analyticsService.trackScreenView('photo_magic', {
      is_tablet: width > 768 ? 'true' : 'false'
    });
  }, [width]);

  // Cleanup video player on unmount
  React.useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;

    return () => {
      // Clear mounted flag
      isMountedRef.current = false;
      
      // Cleanup video player
      try {
        if (videoPlayer) {
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
      
      Alert.alert('Error', 'Failed to select image. Please try again.');
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
      }
    } catch (error) {
      // Track camera error (fire and forget)  
      analyticsService.track('photo_magic_camera_error', {
        source: 'camera',
        error: error?.toString() || 'unknown_error'
      });
      
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      console.error('Camera error:', error);
      
      // Resume video playback on error if component is still mounted
      try {
        if (isMountedRef.current && videoPlayer && videoPlayer.status !== 'idle' && !videoPlayer.playing) {
          videoPlayer.play();
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
        <TouchableOpacity onPress={() => router.back()}>
          <IconSymbol name="arrow.left" size={20} color="#EAEAEA" />
        </TouchableOpacity>
        
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 26, fontFamily: 'Lexend-Bold', letterSpacing: -0.5 }}>
            Photo Magic
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '400', marginTop: 2 }}>
            Just tell it what to change
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
                  {isSelecting ? (
                    <>
                      <View style={{ 
                        width: 20, 
                        height: 20, 
                        borderRadius: 10, 
                        borderWidth: 2, 
                        borderColor: 'rgba(255,255,255,0.9)', 
                        borderTopColor: 'transparent',
                        marginRight: 12
                      }} />
                      <Text style={{ 
                        color: 'rgba(255,255,255,0.95)', 
                        fontSize: 18, 
                        fontFamily: 'Lexend-Bold' 
                      }}>
                        Opening Library...
                      </Text>
                    </>
                  ) : (
                    <>
                      <IconSymbol name="photo.on.rectangle" size={24} color="rgba(255,255,255,0.95)" />
                      <Text style={{ 
                        color: 'rgba(255,255,255,0.95)', 
                        fontSize: 18, 
                        fontFamily: 'Lexend-Bold', 
                        marginLeft: 12 
                      }}>
                        Choose Photo
                      </Text>
                    </>
                  )}
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
                    Take Photo
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}