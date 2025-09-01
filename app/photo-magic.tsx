import { IconSymbol } from '@/components/ui/IconSymbol';
import { analyticsService } from '@/services/analytics';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhotoMagicUploadScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [isSelecting, setIsSelecting] = useState(false);

  // Video player setup
  const videoPlayer = useVideoPlayer(require('../assets/videos/text-edit.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // Track screen view on mount
  React.useEffect(() => {
    analyticsService.trackScreenView('photo_magic', {
      is_tablet: width > 768 ? 'true' : 'false'
    });
  }, [width]);

  const pickImage = async () => {
    if (isSelecting) return;
    setIsSelecting(true);

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow photo access to continue.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: false,
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
      }
    } catch (error) {
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
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow camera access to continue.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
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
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      console.error('Camera error:', error);
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
            {/* Primary Upload Button */}
            <TouchableOpacity 
              onPress={pickImage}
              activeOpacity={0.8} 
              disabled={isSelecting}
              style={{ 
                height: 64,
                borderRadius: 20, 
                overflow: 'hidden',
                shadowColor: '#F59E0B',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <LinearGradient 
                colors={['#F59E0B', '#FBBF24']} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 1 }} 
                style={{ 
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 24
                }}
              >
                {isSelecting ? (
                  <>
                    <View style={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: 10, 
                      borderWidth: 2, 
                      borderColor: '#0B0B0F', 
                      borderTopColor: 'transparent',
                      marginRight: 12
                    }} />
                    <Text style={{ color: '#0B0B0F', fontSize: 18, fontFamily: 'Lexend-Black' }}>
                      Opening Library...
                    </Text>
                  </>
                ) : (
                  <>
                    <IconSymbol name="photo.on.rectangle" size={24} color="#0B0B0F" />
                    <Text style={{ color: '#0B0B0F', fontSize: 18, fontFamily: 'Lexend-Black', marginLeft: 12 }}>
                      Choose from Library
                    </Text>
                  </>
                )}
              </LinearGradient>
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
                    Take New Photo
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}