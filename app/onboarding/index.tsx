import CurtainRevealImage, { CurtainRevealImageRef } from '@/components/CurtainRevealImage';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { presentPaywall } from '@/services/revenuecat';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, SafeAreaView, Text, View } from 'react-native';
import Animated, {
  Extrapolate,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingPage {
  id: number;
  title: string;
  subtitle: string;
  icon?: string;
  beforeImage?: any;
  afterImage?: any;
  gradientColors: [string, string];
  iconName?: React.ComponentProps<typeof IconSymbol>['name'];
}

const pages: OnboardingPage[] = [
  {
    id: 0,
    title: 'Welcome to PastPix',
    subtitle: 'Turn faded, cracked, damaged photos into memories that last forever',
    gradientColors: ['#0a0a0a', '#1a0b2e'],
    iconName: 'photo.on.rectangle',
  },
  {
    id: 1,
    title: 'Fix Damaged Portraits',
    subtitle: 'Scratches, tears, water damage all fixed instantly',
    gradientColors: ['#0d1421', '#1e3a8a'],
    beforeImage: require('@/assets/images/onboarding/before-4.jpg'),
    afterImage: require('@/assets/images/onboarding/after-4.png'),
  },
  {
    id: 2,
    title: 'Repair Faces & Details',
    subtitle: 'Restore missing facial features, fix blurry faces, and bring back lost details',
    gradientColors: ['#1a0b0b', '#dc2626'],
    beforeImage: require('@/assets/images/onboarding/before-2.jpg'),
    afterImage: require('@/assets/images/onboarding/after-2.png'),
  },
  {
    id: 3,
    title: 'Enhance Colors & Clarity',
    subtitle: 'Bring vibrancy back to faded memories',
    gradientColors: ['#1e0a37', '#a855f7'],
    beforeImage: require('@/assets/images/onboarding/before-3.jpg'),
    afterImage: require('@/assets/images/onboarding/after-3.png'),
  },
  {
    id: 4,
    title: 'Go Pro for Unlimited',
    subtitle: 'Try free or upgrade to Pro with weekly or monthly plans',
    gradientColors: ['#064e3b', '#10b981'],
    iconName: 'crown.fill',
  },
];

export default function OnboardingScreen() {
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const curtainRefs = useRef<(CurtainRevealImageRef | null)[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [revealedScreens, setRevealedScreens] = useState<boolean[]>(new Array(pages.length).fill(false));
  const { completeOnboarding } = useOnboarding();
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  // Animation values for Start Restoring button
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(1);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      const pageIndex = Math.round(event.contentOffset.x / SCREEN_WIDTH);
      runOnJS(setCurrentPage)(pageIndex);
    },
  });

  const handleNext = () => {
    const currentPageData = pages[currentPage];
    
    // If current page has images and hasn't been revealed yet
    if (currentPageData.beforeImage && currentPageData.afterImage && !revealedScreens[currentPage]) {
      // Trigger curtain reveal
      curtainRefs.current[currentPage]?.startReveal();
      
      // Mark as revealed
      const newRevealedScreens = [...revealedScreens];
      newRevealedScreens[currentPage] = true;
      setRevealedScreens(newRevealedScreens);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // No auto-advance - let users enjoy the transformation
    } else {
      // Regular navigation for pages without images or already revealed
      if (currentPage < pages.length - 1) {
        scrollRef.current?.scrollTo({ x: (currentPage + 1) * SCREEN_WIDTH, animated: true });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        handleComplete();
      }
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleComplete();
  };

  const handleComplete = async () => {
    await completeOnboarding();
    router.replace('/');
    
    // Show paywall after navigating to home
    timeoutRef.current = setTimeout(() => {
      presentPaywall();
    }, 500);
  };

  const handleStartRestoring = async () => {
    // Light haptic on press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Scale down animation
    buttonScale.value = withSpring(0.95, { damping: 20, stiffness: 300 });
    
    // Heavy haptic after short delay
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 100);
    
    // Scale up with bounce
    setTimeout(() => {
      buttonScale.value = withSpring(1.05, { damping: 15, stiffness: 200 }, () => {
        buttonScale.value = withSpring(1, { damping: 20, stiffness: 300 });
      });
    }, 150);
    
    await completeOnboarding();
    
    // Success haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Present paywall immediately, then navigate
    await presentPaywall();
    router.replace('/');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <View className="flex-1 bg-black">
      {/* Page Indicators at Top */}
      <SafeAreaView className="absolute top-0 left-0 right-0 z-10">
        <View className="px-8 pt-4">
          <View className="flex-row justify-center">
            {pages.map((_, index) => (
              <PageIndicator
                key={index}
                index={index}
                scrollX={scrollX}
                currentPage={currentPage}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        bounces={false}
      >
        {pages.map((page, index) => (
          <OnboardingPage
            key={page.id}
            page={page}
            index={index}
            scrollX={scrollX}
            curtainRef={(ref) => (curtainRefs.current[index] = ref)}
          />
        ))}
      </Animated.ScrollView>

      <SafeAreaView className="absolute bottom-0 left-0 right-0">
        <View className="px-8 pb-8">
          {/* Show different button layouts for different screens */}
          {currentPage === 0 ? (
            // First page: Large centered "Become a Memory Keeper" button
            <View className="items-center">
              <Pressable
                onPress={handleNext}
                style={{
                  backgroundColor: 'transparent',
                  paddingHorizontal: 48,
                  paddingVertical: 20,
                  borderRadius: 16,
                  width: '100%',
                  maxWidth: 350,
                  alignItems: 'center',
                }}
              >
                <LinearGradient
                  colors={['#f97316', '#ea580c']}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 16,
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text 
                  className="text-white text-xl font-bold"
                  style={{
                    textShadowColor: 'rgba(0, 0, 0, 0.5)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  Become a Memory Keeper
                </Text>
              </Pressable>
            </View>
          ) : currentPage === pages.length - 1 ? (
            // Last page: Big centered "Start Restoring" button with animation
            <View className="items-center" style={{ width: '100%', maxWidth: 350 }}>
              <Animated.View
                style={[
                  {
                    transform: [{ scale: buttonScale }],
                    opacity: buttonOpacity,
                    width: '100%',
                  }
                ]}
              >
                <Pressable
                  onPress={handleStartRestoring}
                  style={{
                    backgroundColor: 'transparent',
                    paddingHorizontal: 48,
                    paddingVertical: 20,
                    borderRadius: 16,
                    width: '100%',
                    alignItems: 'center',
                  }}
                >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 16,
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text 
                  className="text-white text-xl font-bold"
                  style={{
                    textShadowColor: 'rgba(0, 0, 0, 0.5)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  Start Restoring
                </Text>
              </Pressable>
              </Animated.View>
            </View>
          ) : (
            // Middle pages: Skip and Next buttons
            <View className="flex-row justify-between items-center">
              <Pressable onPress={handleSkip} className="p-4">
                <Text className="text-gray-400 text-base">Skip</Text>
              </Pressable>

              <Pressable
                onPress={handleNext}
                style={{
                  backgroundColor: 'transparent',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 25,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <LinearGradient
                  colors={['#f97316', '#ea580c']}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 25,
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text 
                  className="text-white text-base font-semibold mr-2"
                  style={{
                    textShadowColor: 'rgba(0, 0, 0, 0.5)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  Next
                </Text>
                <IconSymbol
                  name="arrow.forward"
                  size={20}
                  color="white"
                />
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

interface OnboardingPageProps {
  page: OnboardingPage;
  index: number;
  scrollX: Animated.SharedValue<number>;
  curtainRef?: (ref: CurtainRevealImageRef | null) => void;
}

function OnboardingPage({ page, index, scrollX, curtainRef }: OnboardingPageProps) {
  const inputRange = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [SCREEN_WIDTH * 0.25, 0, -SCREEN_WIDTH * 0.25],
      Extrapolate.CLAMP
    );

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1, 0.8],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateX }, { scale }],
      opacity,
    };
  });

  const iconAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      scrollX.value,
      inputRange,
      [-30, 0, 30],
      Extrapolate.CLAMP
    );

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1.2, 0.8],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ rotate: `${rotate}deg` }, { scale }],
    };
  });

  return (
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
      <LinearGradient
        colors={page.gradientColors}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Rich black overlay for depth */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <SafeAreaView className="flex-1 justify-center items-center px-8">
          <Animated.View style={animatedStyle} className="items-center">
            {/* Show image pairs for screens with before/after images */}
            {page.beforeImage && page.afterImage ? (
              <Animated.View style={iconAnimatedStyle} className="mb-16">
                <CurtainRevealImage
                  ref={curtainRef}
                  beforeImage={page.beforeImage}
                  afterImage={page.afterImage}
                />
              </Animated.View>
            ) : page.iconName ? (
              <Animated.View style={iconAnimatedStyle} className="mb-16">
                {page.id === 0 ? (
                  // First screen: Use app icon
                  <View 
                    className="w-40 h-40 rounded-full items-center justify-center overflow-hidden"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      shadowColor: 'rgba(255, 255, 255, 0.2)',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 12,
                    }}
                  >
                    <Image
                      source={require('@/assets/images/icon.png')}
                      style={{
                        width: 170,
                        height: 170,
                        borderRadius: 85,
                      }}
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  // Other screens: Use system icons
                  <View 
                    className="w-40 h-40 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      shadowColor: 'rgba(255, 255, 255, 0.2)',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 12,
                    }}
                  >
                    <IconSymbol
                      name={page.iconName}
                      size={80}
                      color="white"
                    />
                  </View>
                )}
              </Animated.View>
            ) : null}

            <Text 
              className="text-white text-3xl font-bold text-center mb-4"
              style={{
                textShadowColor: 'rgba(255, 255, 255, 0.3)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 10,
              }}
            >
              {page.title}
            </Text>
            <Text 
              className="text-gray-200 text-lg text-center max-w-sm"
              style={{
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}
            >
              {page.subtitle}
            </Text>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

interface PageIndicatorProps {
  index: number;
  scrollX: Animated.SharedValue<number>;
  currentPage: number;
}

function PageIndicator({ index, scrollX, currentPage }: PageIndicatorProps) {
  const inputRange = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];

  const animatedStyle = useAnimatedStyle(() => {
    const width = interpolate(
      scrollX.value,
      inputRange,
      [8, 24, 8],
      Extrapolate.CLAMP
    );

    const backgroundColor = interpolateColor(
      scrollX.value,
      inputRange,
      ['rgba(255, 255, 255, 0.3)', '#f97316', 'rgba(255, 255, 255, 0.3)']
    );

    return {
      width,
      backgroundColor,
    };
  });

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          height: 8,
          borderRadius: 4,
          marginHorizontal: 4,
          shadowColor: '#f97316',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: currentPage === index ? 0.6 : 0,
          shadowRadius: 8,
        }
      ]}
    />
  );
}