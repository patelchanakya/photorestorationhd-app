import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Dimensions, Pressable, SafeAreaView, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
  useAnimatedScrollHandler,
  interpolateColor,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useOnboarding } from '@/contexts/OnboardingContext';
import * as Haptics from 'expo-haptics';
import { presentPaywall } from '@/services/revenuecat';
import CurtainRevealImage, { CurtainRevealImageRef } from '@/components/CurtainRevealImage';

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
    gradientColors: ['#1e1e1e', '#2a2a2a'],
    iconName: 'photo.on.rectangle',
  },
  {
    id: 1,
    title: 'Fix Even the Most Damaged Photos',
    subtitle: 'Scratches, tears, water damage all fixed instantly',
    gradientColors: ['#1a1a2e', '#16213e'],
    beforeImage: require('@/assets/images/onboarding/before-4.jpg'),
    afterImage: require('@/assets/images/onboarding/after-4.png'),
  },
  {
    id: 2,
    title: 'Repair Faces & Details',
    subtitle: 'Restore missing facial features, fix blurry faces, and bring back lost details',
    gradientColors: ['#7c2d12', '#ea580c'],
    beforeImage: require('@/assets/images/onboarding/before-2.jpg'),
    afterImage: require('@/assets/images/onboarding/after-2.png'),
  },
  {
    id: 3,
    title: 'Enhance Colors & Clarity',
    subtitle: 'Bring vibrancy back to faded memories',
    gradientColors: ['#4c1d95', '#7c3aed'],
    beforeImage: require('@/assets/images/onboarding/before-3.jpg'),
    afterImage: require('@/assets/images/onboarding/after-3.png'),
  },
  {
    id: 4,
    title: 'Go Pro for Unlimited',
    subtitle: 'Try free or upgrade to Pro with weekly or monthly plans',
    gradientColors: ['#1e1e1e', '#16a34a'],
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
      
      // Auto-advance after animation completes
      setTimeout(() => {
        if (currentPage < pages.length - 1) {
          scrollRef.current?.scrollTo({ x: (currentPage + 1) * SCREEN_WIDTH, animated: true });
        }
      }, 1200);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await completeOnboarding();
    
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
          {/* Show different button layout for last page */}
          {currentPage === pages.length - 1 ? (
            // Last page: Big centered "Start Restoring" button
            <View className="items-center">
              <Pressable
                onPress={handleStartRestoring}
                className="bg-green-500 px-12 py-5 rounded-2xl w-full max-w-sm items-center"
              >
                <Text className="text-white text-xl font-bold">
                  Start Restoring
                </Text>
              </Pressable>
            </View>
          ) : (
            // Other pages: Skip and Next buttons
            <View className="flex-row justify-between items-center">
              {/* Hide skip button on first screen */}
              {currentPage === 0 ? (
                <View className="p-4" />
              ) : (
                <Pressable onPress={handleSkip} className="p-4">
                  <Text className="text-gray-400 text-base">Skip</Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleNext}
                className="bg-orange-500 px-8 py-4 rounded-full flex-row items-center"
              >
                <Text className="text-white text-base font-semibold mr-2">
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
                <View className="w-32 h-32 bg-white/10 rounded-full items-center justify-center">
                  <IconSymbol
                    name={page.iconName}
                    size={64}
                    color="white"
                  />
                </View>
              </Animated.View>
            ) : null}

            <Text className="text-white text-3xl font-bold text-center mb-4">
              {page.title}
            </Text>
            <Text className="text-gray-300 text-base text-center max-w-sm">
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
      ['#4a4a4a', '#f97316', '#4a4a4a']
    );

    return {
      width,
      backgroundColor,
    };
  });

  return (
    <Animated.View
      style={animatedStyle}
      className="h-2 rounded-full mx-1"
    />
  );
}