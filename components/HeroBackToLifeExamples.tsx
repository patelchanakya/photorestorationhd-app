import { IconSymbol } from '@/components/ui/IconSymbol';
import { Video } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface ExampleItem {
  id: string;
  image?: any; // require('...') for images
  video?: any; // require('...') for videos
  title?: string;
  type?: 'image' | 'video';
  yOffset?: number; // vertical nudge in pixels (positive pushes content down)
}

const DEFAULT_EXAMPLES: ExampleItem[] = [
  // Video presets for different animations
  { id: 'ex-c', video: require('../assets/videos/btl-3.mp4'), title: 'Hug', type: 'video' },
  { id: 'ex-e', video: require('../assets/videos/btl-5.mp4'), title: 'Group', type: 'video' },
  { id: 'ex-d', video: require('../assets/videos/btl-4.mp4'), title: 'Love', type: 'video' },
  { id: 'ex-a', video: require('../assets/videos/btl-1.mp4'), title: 'Dance', type: 'video' },
  { id: 'ex-b', video: require('../assets/videos/btl-2.mp4'), title: 'Fun', type: 'video' },
  { id: 'ex-smile', video: require('../assets/videos/btl-0.mp4'), title: 'Smile', type: 'video' },
  
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
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {examples.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: 120, marginRight: index === examples.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={pickVideo}
              style={{ width: 120, aspectRatio: 9/16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0b0b0f' }}
            >
              {/* Render video or image based on type */}
              {item.type === 'video' && item.video ? (
                <Video
                  source={item.video}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                  shouldPlay
                  isLooping
                  isMuted
                  useNativeControls={false}
                  rate={[1.0, 0.9, 1.1, 0.85, 1.05, 0.95][index] || 1.0} // Varied playback speeds
                  positionMillis={[0, 3500, 1500, 5000, 2500, 4000][index] || index * 2000} // Different start positions
                />
              ) : (
                <ExpoImage source={item.image} style={{ width: '100%', height: '100%', transform: [{ translateY: (item.yOffset ?? 32) }] }} contentFit="cover" transition={0} />
              )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
              start={{ x: 0.5, y: 0.3 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: 'absolute', inset: 0 as any }}
            />
            {/* Removed badge overlay */}
            {/* Bottom label */}
            <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{item.title}</Text>
            </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
      {/* Right edge gradient to show scrollability */}
      <LinearGradient
        colors={['transparent', '#0B0B0F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 30, pointerEvents: 'none' }}
      />
    </View>
  );
}


