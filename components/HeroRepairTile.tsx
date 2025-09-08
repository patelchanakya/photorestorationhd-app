import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuickEditStore } from '@/store/quickEditStore';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import { useEvent } from 'expo';
import React from 'react';
import { AppState, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

interface HeroRepairTileProps {
  title?: string;
  subtitle?: string;
}

export function HeroRepairTile({
  title = 'Back to life',
  subtitle = 'Fix damage & enhance',
}: HeroRepairTileProps) {
  const isMountedRef = React.useRef(true);
  const shouldBePlayingRef = React.useRef(false);

  // Video player setup - matches AnimatedOutfits pattern exactly
  const videoPlayer = useVideoPlayer(require('../assets/videos/repair.webm'), (player) => {
    try {
      player.loop = true;
      player.muted = true;
      player.playbackRate = 1.0;
    } catch (error) {
      console.error('HeroRepairTile video player init error:', error);
    }
  });

  // Monitor playback status with expo's useEvent hook
  const { isPlaying } = useEvent(videoPlayer, 'playingChange', { isPlaying: videoPlayer.playing });

  // Auto-recovery: restart video if it should be playing but isn't
  React.useEffect(() => {
    if (!isPlaying && shouldBePlayingRef.current && isMountedRef.current) {
      try {
        if (videoPlayer && videoPlayer.status !== 'idle') {
          videoPlayer.play();
        }
      } catch (error) {
        // Ignore recovery errors
      }
    }
  }, [isPlaying, videoPlayer]);

  // Cleanup video player on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
      
      try {
        if (videoPlayer) {
          const status = videoPlayer.status;
          if (status !== 'idle') {
            videoPlayer.pause();
          }
          videoPlayer.release();
        }
      } catch (error) {
        if (__DEV__) {
          console.log('HeroRepairTile video cleanup handled');
        }
      }
    };
  }, []);

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
      } catch (e) {
        // Ignore initial play errors
      }
    }, 300);
    
    return () => clearTimeout(playTimer);
  }, [videoPlayer]);

  // Handle app state changes (backgrounding/foregrounding)
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (videoPlayer && !videoPlayer.playing && videoPlayer.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current) {
                videoPlayer.play();
              }
            }, 100);
          }
        } catch (error) {
          // Ignore resume errors
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [videoPlayer]);

  // Handle navigation focus (returning to screen)
  useFocusEffect(
    React.useCallback(() => {
      if (shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (videoPlayer && !videoPlayer.playing && videoPlayer.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current) {
                videoPlayer.play();
              }
            }, 100);
          }
        } catch (error) {
          // Ignore focus resume errors
        }
      }
    }, [videoPlayer])
  );

  const handlePick = async () => {
    try {
      // Launch photo picker - works with limited access even if permissions denied
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.CURRENT,
        exif: false,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        useQuickEditStore.getState().openWithImage({ 
          functionType: 'repair', 
          imageUri: uri 
        });
      }
    } catch (e) {
      if (__DEV__) console.error('HeroRepairTile picker error:', e);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePick}
      activeOpacity={0.9}
      style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 8, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', height: 180 }}
    >
      <VideoView
        player={videoPlayer}
        style={{ position: 'absolute', inset: 0 as any, width: '100%', height: '100%', opacity: 0.95 }}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.65)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', inset: 0 as any }}
      />

      {/* Content */}
      <View style={{ flex: 1, padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <IconSymbol name="wand.and.stars" size={20} color="#EAEAEA" />
          </View>
          <TouchableOpacity
            onPress={() => {
              // Navigation-only placeholder; wire to full grid later
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.9}
            style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <Text style={{ color: '#EAEAEA', fontFamily: 'Lexend-Bold', fontSize: 13 }}>Video</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Text style={{ color: '#BFC3CF', fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}


