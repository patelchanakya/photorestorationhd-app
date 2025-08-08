import { IconSymbol } from '@/components/ui/IconSymbol';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { presentPaywall } from '@/services/revenuecat';
import { Video } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import React from 'react';
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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

async function pickVideo(isPro: boolean) {
  // Check current PRO status
  const currentIsPro = useSubscriptionStore.getState().isPro;
  
  // If not PRO, show paywall
  if (!currentIsPro) {
    const success = await presentPaywall();
    if (!success) return;
    
    // After successful purchase, check if status was updated
    const updatedIsPro = useSubscriptionStore.getState().isPro;
    if (!updatedIsPro) {
      // Wait a moment for the listener to update
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (res.status !== 'granted') return;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
  if (!result.canceled && result.assets[0]) {
    Alert.alert('Video selected', 'Video flow coming soon');
  }
}

async function handleRequestIdea() {
  try {
    const subject = 'Clever - Animation Request';
    const body = `Hi Clever team!

I'd love to see this animation added to Back to Life:

[Describe your animation idea here - e.g., "Dancing", "Jumping", "Waving", etc.]

Why I want this:
[Tell us why this would be cool]

Thanks!`;

    const mailUrl = `mailto:photorestorationhd@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    const canOpen = await Linking.canOpenURL(mailUrl);
    if (canOpen) {
      await Linking.openURL(mailUrl);
    } else {
      Alert.alert(
        'Request Animation',
        'Send your ideas to:\nphotorestorationhd@gmail.com',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    Alert.alert(
      'Request Animation',
      'Send your ideas to:\nphotorestorationhd@gmail.com',
      [{ text: 'OK' }]
    );
  }
}

export function HeroBackToLifeExamples({ examples = DEFAULT_EXAMPLES }: { examples?: ExampleItem[] }) {
  const isPro = useSubscriptionStore((state) => state.isPro);
  
  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {/* Existing animation tiles */}
        {examples.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: 120, marginRight: 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => pickVideo(isPro)}
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
            
            {/* PRO badge for non-pro users - minimal style */}
            {!isPro && (
              <View style={{ 
                position: 'absolute', 
                top: 8, 
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 3,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                borderWidth: 0.5,
                borderColor: 'rgba(249,115,22,0.5)'
              }}>
                <IconSymbol name="crown" size={10} color="#f97316" />
                <Text style={{ color: '#f97316', fontSize: 9, fontWeight: '600', letterSpacing: 0.3 }}>PRO</Text>
              </View>
            )}
            
            {/* Bottom label */}
            <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{item.title}</Text>
            </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
        
        {/* Request/Suggest new animation tile */}
        <Animated.View
          entering={FadeIn.delay(examples.length * 100).duration(800)}
          style={{ width: 120, marginRight: 0 }}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleRequestIdea}
            style={{ 
              width: 120, 
              aspectRatio: 9/16, 
              borderRadius: 16, 
              overflow: 'hidden', 
              borderWidth: 1.5, 
              borderColor: 'rgba(249,115,22,0.3)', 
              backgroundColor: 'rgba(249,115,22,0.05)',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Gradient background */}
            <LinearGradient
              colors={["rgba(249,115,22,0.1)", "rgba(249,115,22,0.05)", "rgba(0,0,0,0.8)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: 'absolute', inset: 0 as any }}
            />
            
            {/* Plus icon in center */}
            <View style={{ 
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(249,115,22,0.15)',
              borderWidth: 1.5,
              borderColor: 'rgba(249,115,22,0.4)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8
            }}>
              <IconSymbol name="plus" size={24} color="#f97316" />
            </View>
            
            {/* Text */}
            <Text style={{ 
              color: '#f97316', 
              fontWeight: '600', 
              fontSize: 12,
              textAlign: 'center',
              paddingHorizontal: 10
            }}>
              Request
            </Text>
            <Text style={{ 
              color: 'rgba(255,255,255,0.5)', 
              fontSize: 10,
              textAlign: 'center',
              paddingHorizontal: 10,
              marginTop: 2
            }}>
              Tell us your idea
            </Text>
          </TouchableOpacity>
        </Animated.View>
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


