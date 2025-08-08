import { Video } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface ExampleItem {
  id: string;
  image?: any; // require('...') for images
  video?: any; // require('...') for videos
  title?: string;
  type?: 'image' | 'video';
}

const DEFAULT_EXAMPLES: ExampleItem[] = [
  // Using the new video files
  { id: 'ex-a', video: require('../assets/videos/btl-1.mp4'), title: 'Back to life', type: 'video' },
  { id: 'ex-b', video: require('../assets/videos/btl-2.mp4'), title: 'Restore memories', type: 'video' },
  
  // Fallback option if video doesn't work:
  // { id: 'ex-a', image: require('../assets/images/onboarding/after-3.png'), title: 'Back to life', type: 'image' },
  // { id: 'ex-b', image: require('../assets/images/onboarding/after-4.png'), title: 'Back to life', type: 'image' },
];

async function pickVideo() {
  const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (res.status !== 'granted') return;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
  if (!result.canceled && result.assets[0]) {
    Alert.alert('Video selected', 'Video flow coming soon');
  }
}

export function HeroBackToLifeExamples({ examples = DEFAULT_EXAMPLES }: { examples?: ExampleItem[] }) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {examples.slice(0, 2).map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 300).duration(600)}
            style={{ width: '48%' }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={pickVideo}
              style={{ width: '100%', height: 240, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0b0b0f' }}
            >
              {/* Render video or image based on type */}
              {item.type === 'video' && item.video ? (
                <Video
                  source={item.video}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  shouldPlay
                  isLooping
                  isMuted
                  useNativeControls={false}
                  rate={index === 0 ? 1.0 : 0.95} // Slightly different playback speeds
                  positionMillis={index * 2000} // Start at different positions
                />
              ) : (
                <ExpoImage source={item.image} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
              )}
            <LinearGradient
              colors={["rgba(0,0,0,0.12)", "rgba(0,0,0,0.65)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: 'absolute', inset: 0 as any }}
            />
            {/* Top-right Video pill - only show for actual videos */}
            {item.type === 'video' && (
              <View style={{ position: 'absolute', top: 10, right: 10 }}>
                <View style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ color: '#EAEAEA', fontWeight: '800', fontSize: 13 }}>Video</Text>
                </View>
              </View>
            )}
            {/* Bottom-left text */}
            <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
              <Text style={{ color: '#EAEAEA', fontWeight: '800', fontSize: 18, letterSpacing: -0.2 }} numberOfLines={1}>
                {item.title || 'Back to life'}
              </Text>
              <Text style={{ color: '#BFC3CF', fontSize: 12 }}>Fix damage & enhance</Text>
            </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}


