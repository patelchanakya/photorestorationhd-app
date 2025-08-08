import { IconSymbol } from '@/components/ui/IconSymbol';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { presentPaywall } from '@/services/revenuecat';
import { Video } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface OutfitItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  title: string;
  type?: 'video' | 'image';
  outfitPrompt?: string; // The prompt to apply this outfit
}

// Add your outfit transformation videos here
const DEFAULT_OUTFITS: OutfitItem[] = [
  // Example items - replace with your actual videos
  { id: 'outfit-1', title: 'Business', type: 'image', image: require('../assets/images/onboarding/after-3.png'), outfitPrompt: 'professional business suit' },
  { id: 'outfit-2', title: 'Casual', type: 'image', image: require('../assets/images/onboarding/after-4.png'), outfitPrompt: 'casual streetwear' },
  { id: 'outfit-3', title: 'Formal', type: 'image', image: require('../assets/images/onboarding/after-3.png'), outfitPrompt: 'formal evening wear' },
  { id: 'outfit-4', title: 'Sport', type: 'image', image: require('../assets/images/onboarding/after-4.png'), outfitPrompt: 'athletic sportswear' },
  { id: 'outfit-5', title: 'Vintage', type: 'image', image: require('../assets/images/onboarding/after-3.png'), outfitPrompt: 'vintage retro style' },
  { id: 'outfit-6', title: 'Modern', type: 'image', image: require('../assets/images/onboarding/after-4.png'), outfitPrompt: 'modern trendy outfit' },
];

export function AnimatedOutfits({ outfits = DEFAULT_OUTFITS }: { outfits?: OutfitItem[] }) {
  const router = useRouter();
  const isPro = useSubscriptionStore((state) => state.isPro);

  const handleOutfitSelect = async (outfit: OutfitItem) => {
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
    
    // Launch image picker for user to select photo
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      // Navigate to processing with outfit prompt
      router.push({
        pathname: '/text-edits',
        params: {
          imageUri: result.assets[0].uri,
          prompt: outfit.outfitPrompt || outfit.title,
          mode: 'outfit'
        }
      });
    }
  };

  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {outfits.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: 120, marginRight: index === outfits.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleOutfitSelect(item)}
              style={{ 
                width: 120, 
                aspectRatio: 9/16, 
                borderRadius: 16, 
                overflow: 'hidden', 
                borderWidth: 1, 
                borderColor: 'rgba(255,255,255,0.08)', 
                backgroundColor: '#0b0b0f' 
              }}
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
                  rate={1.0}
                />
              ) : (
                <ExpoImage 
                  source={item.image} 
                  style={{ width: '100%', height: '100%' }} 
                  contentFit="cover" 
                  transition={0} 
                />
              )}
              
              {/* Gradient overlay */}
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
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontWeight: '600', 
                  fontSize: 14, 
                  textShadowColor: 'rgba(0,0,0,0.8)', 
                  textShadowOffset: { width: 0, height: 1 }, 
                  textShadowRadius: 3 
                }}>
                  {item.title}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
      
      {/* Right edge gradient */}
      <LinearGradient
        colors={['transparent', '#0B0B0F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ 
          position: 'absolute', 
          right: 0, 
          top: 0, 
          bottom: 0, 
          width: 30, 
          pointerEvents: 'none' 
        }}
      />
    </View>
  );
}