import { IconSymbol } from '@/components/ui/IconSymbol';
import { useBackToLife } from '@/hooks/useBackToLife';
import { backToLifeService } from '@/services/backToLifeService';
import { presentPaywall } from '@/services/revenuecat';
import { useCropModalStore } from '@/store/cropModalStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { Alert, AppState, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

interface ExampleItem {
  id: string;
  image?: any; // require('...') for images
  video?: any; // require('...') for videos
  title?: string;
  type?: 'image' | 'video';
  yOffset?: number; // vertical nudge in pixels (positive pushes content down)
  animationPrompt?: string; // The prompt to apply this animation
}

const DEFAULT_EXAMPLES: ExampleItem[] = [
  // Video presets optimized for Kling v2.1 video generation with natural, cinematic prompts
  { 
    id: 'ex-c', 
    video: require('../assets/videos/btl-3.mp4'), 
    title: 'Hug', 
    type: 'video', 
    animationPrompt: 'Let the scene express warmth and closeness through a natural hug or embrace. The motion should feel smooth and genuine, whether it\'s two people sharing a soft side hug, a small group leaning in together, or friends pulling each other close. Keep movements fluid and unforced, with slight posture adjustments and natural timing. Let the moment feel connected and comfortable, adapting to the number of people in the scene. Background remains still.' 
  },
  { 
    id: 'ex-e', 
    video: require('../assets/videos/btl-5.mp4'), 
    title: 'Group', 
    type: 'video', 
    animationPrompt: 'Bring the group to life with small, natural movements that reflect connection and presence. People may shift slightly, glance at each other, share a laugh, or adjust their posture. Movements should feel relaxed and unposed, like a real moment between friends or family. Let each person have their own subtle variation in motion, creating a layered, lifelike scene. Background stays still.' 
  },
  { 
    id: 'ex-b', 
    video: require('../assets/videos/btl-2.mp4'), 
    title: 'Fun', 
    type: 'video', 
    animationPrompt: 'Bring a sense of fun and joy to the scene through a natural, fitting gesture. For example, friends might laugh together, a parent might lift a child, someone might clap, wave, or lean playfully toward another. Let the action match the energy and context of the image, keeping it smooth, warm, and spontaneous. Background remains still.' 
  },
  { 
    id: 'ex-d', 
    video: require('../assets/videos/btl-4.mp4'), 
    title: 'Love', 
    type: 'video', 
    animationPrompt: 'Let the scene express affection naturally — this could be a gentle kiss, a soft lean-in, or an intimate glance, depending on the relationship in the image. Movements should be smooth, minimal, and emotionally grounded. If a kiss happens, let it be brief and warm, with natural timing. Keep everything feeling sincere and comfortable. Background remains still.' 
  },
  { 
    id: 'ex-a', 
    video: require('../assets/videos/btl-1.mp4'), 
    title: 'Dance', 
    type: 'video', 
    animationPrompt: 'Add a moment of playful movement that fits the scene — this could be a quick spin, a light sway, or another gentle dance-like gesture. Keep the motion fluid and joyful, without exaggerated speed. Allow clothing and hair to respond naturally. Let Kling choose a motion that feels appropriate for the pose and number of people. Background remains still.' 
  },
  { 
    id: 'ex-smile', 
    video: require('../assets/videos/btl-0.mp4'), 
    title: 'Smile', 
    type: 'video', 
    animationPrompt: 'Let the subject\'s expression shift gently into a soft, natural smile. The movement should be minimal and unforced, as if sparked by a small happy thought or connection. Keep the face relaxed, with a smooth transition into the smile. Background and posture remain unchanged.' 
  },
];

// VideoView component with player hook and AppState handling
const VideoViewWithPlayer = ({ video, index, style }: { video: any; index: number; style: any }) => {
  const player = useVideoPlayer(video, (player) => {
    player.loop = true;
    player.muted = true;
    player.playbackRate = [1.0, 0.95, 1.05, 0.9, 1.1, 0.98][index] || 1.0;
    player.play();
  });

  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Resume video playback when app returns to foreground
        if (player && !player.playing) {
          player.play();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
};

const pickVideoWithHook = (backToLife: any) => async (isPro: boolean, animationPrompt?: string) => {
  console.log('🎬 FUCK IT: Starting simple flow');
  
  try {
    // Get permission
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') return;
    
    // Launch picker with basic options
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 1,
    });
    
    console.log('🎬 PICKER RESULT:', result.canceled);
    
    if (!result.canceled && result.assets?.[0]) {
      console.log('🎬 STARTING PROCESSING NOW');
      
      const { setIsProcessing, setCurrentImageUri, setProgress, setCanCancel, setProcessingStatus, setCompletedRestorationId } = useCropModalStore.getState();
      const uri = result.assets[0].uri;
      
      setIsProcessing(true);
      setCurrentImageUri(uri);
      setProgress(1);
      setCanCancel(true);
      setProcessingStatus('loading');
      setCompletedRestorationId(null);
      
      backToLife.mutate({
        imageUri: uri,
        animationPrompt: animationPrompt || 'bring this photo to life',
        imageSource: 'gallery',
      });
    }
  } catch (error) {
    console.error('🎬 FUCK ERROR:', error);
  }
};

// OLD CODE BELOW (commented out for testing)
/*
async function pickVideoOLD(isPro: boolean, animationPrompt?: string) {
  const { setIsProcessing, setCurrentImageUri, setProgress, setCanCancel } = useCropModalStore.getState();
  // Check current PRO status
  const currentIsPro = useSubscriptionStore.getState().isPro;
  console.log('🎬 Back to Life: Current PRO status:', currentIsPro);
  
  // If not PRO, show paywall
  if (!currentIsPro) {
    console.log('🎬 Back to Life: Not PRO, showing paywall');
    const success = await presentPaywall();
    console.log('🎬 Back to Life: Paywall result:', success);
    if (!success) return;
    
    // After successful purchase, check if status was updated
    const updatedIsPro = useSubscriptionStore.getState().isPro;
    if (!updatedIsPro) {
      // Wait a moment for the listener to update
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Check usage limits for Pro users (skip in debug mode)
  const debugUnlimited = process.env.EXPO_PUBLIC_DEBUG_BTL_UNLIMITED === '1';
  console.log('🎬 Back to Life: Debug unlimited enabled?', debugUnlimited);
  
  if (currentIsPro && !debugUnlimited) {
    console.log('🎬 Back to Life: PRO user, checking usage limits');
    try {
      console.log('🎬 Back to Life: Calling backToLifeService.checkUsage()');
      const usage = await backToLifeService.checkUsage();
      console.log('🎬 Back to Life: Usage check result:', usage);
      
      if (!usage.canUse) {
        let title, message;
        
        if (!usage.canUseToday) {
          // User already used their daily video
          title = 'Daily Limit Reached';
          message = 'You can generate 1 Back to Life video per day. Come back tomorrow for your next video!';
        } else {
          // User reached monthly/weekly limit
          const periodText = usage.planType === 'weekly' ? 'week' : 'month';
          const now = new Date();
          const resetDate = new Date(usage.nextResetDate);
          const daysUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          title = 'Period Limit Reached';
          message = `You've used all ${usage.limit} Back to Life videos this billing ${periodText}. Your limit will reset ${daysUntilReset <= 0 ? 'today' : daysUntilReset === 1 ? 'tomorrow' : `in ${daysUntilReset} days`}.`;
        }
        
        Alert.alert(
          title,
          message,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Upgrade Plan',
              style: 'default',
              onPress: () => {
                // Future: Show upgrade to higher tier
                Alert.alert('Coming Soon', 'Higher usage tiers coming soon!');
              }
            }
          ]
        );
        return;
      }
      
      // Show remaining count if getting close to limit  
      const remaining = usage.limit - usage.used;
      if (remaining <= (usage.planType === 'weekly' ? 1 : 3)) {
        const periodText = usage.planType === 'weekly' ? 'billing week' : 'billing month';
        Alert.alert(
          'Usage Reminder',
          `You have ${remaining} Back to Life videos remaining this ${periodText}.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', style: 'default', onPress: () => proceedWithImagePicker() }
          ]
        );
        return;
      }
    } catch (error) {
      console.error('❌ Back to Life: Failed to check video usage availability:', error);
      // Continue with image picker if error checking usage
    }
  } else if (debugUnlimited) {
    console.log('🎬 Back to Life: Skipping usage check - debug unlimited mode');
  }
  
  // Proceed with image picker
  console.log('🎬 Back to Life: Proceeding with image picker');
  await proceedWithImagePicker();

  async function proceedWithImagePicker() {
    console.log('🎬 Back to Life: Requesting media permissions');
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('🎬 Back to Life: Permission result:', res.status);
    if (res.status !== 'granted') return;
    
    // For now, we'll use image picker and apply animation prompts to still images
    // Future: Add video picker when video animation is supported
    console.log('🎬 Back to Life: Launching image picker');
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 1 
    });
    
    console.log('🎬 Back to Life: Image picker result:', { canceled: result.canceled, hasAssets: !!result.assets?.[0] });
    if (!result.canceled && result.assets[0]) {
      // Start Back to Life directly (skip crop modal)
      const uri = result.assets[0].uri;
      setIsProcessing(true);
      setCurrentImageUri(uri);
      setProgress(1);
      setCanCancel(true);
      backToLife.mutate({
        imageUri: uri,
        animationPrompt: animationPrompt || 'bring this photo to life with natural animation',
        imageSource: 'gallery',
      });
    }
  }
}
*/

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

// Create animated tile component with glow effect
const AnimatedTile = ({ item, index, isPro, backToLife }: { item: ExampleItem; index: number; isPro: boolean; backToLife: any }) => {
  // Subtle glow animation
  const glowOpacity = useSharedValue(0.5);
  
  React.useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000 + index * 200 }),
        withTiming(0.5, { duration: 2000 + index * 200 })
      ),
      -1,
      true
    );
  }, []);
  
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));
  
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 120).duration(1000).springify().damping(20)}
      style={{ width: 120, marginRight: 10 }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => pickVideoWithHook(backToLife)(isPro, item.animationPrompt)}
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
          <VideoViewWithPlayer 
            video={item.video} 
            index={index}
            style={{ width: '100%', height: '100%', opacity: 0.98 }}
          />
        ) : (
          <ExpoImage source={item.image} style={{ width: '100%', height: '100%', transform: [{ translateY: (item.yOffset ?? 32) }] }} contentFit="cover" transition={0} />
        )}
        
        {/* Bottom gradient - softer */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.7)"]}
          start={{ x: 0.5, y: 0.45 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', inset: 0 as any }}
        />
        
        {/* Top subtle glow for luminescence */}
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%' }, glowStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
        
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
        
        {/* Bottom label with soft glow */}
        <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
          <Text style={{ 
            color: '#FFFFFF', 
            fontWeight: '700', 
            fontSize: 15, 
            textShadowColor: 'rgba(255,255,255,0.25)', 
            textShadowOffset: { width: 0, height: 0 }, 
            textShadowRadius: 4,
            letterSpacing: 0.3
          }}>
            {item.title}
          </Text>
          <Text style={{ 
            color: 'rgba(255,255,255,0.4)', 
            fontSize: 9, 
            marginTop: 1,
            letterSpacing: 0.8,
            fontWeight: '500'
          }}>
            TAP TO ANIMATE
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export function HeroBackToLifeExamples({ examples = DEFAULT_EXAMPLES }: { examples?: ExampleItem[] }) {
  const isPro = useSubscriptionStore((state) => state.isPro);
  const backToLife = useBackToLife();
  
  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {/* Existing animation tiles */}
        {examples.map((item, index) => (
          <AnimatedTile key={item.id} item={item} index={index} isPro={isPro} backToLife={backToLife} />
        ))}
        
        {/* Request/Suggest new animation tile */}
        <Animated.View
          entering={FadeInDown.delay(examples.length * 120).duration(1000).springify().damping(20)}
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