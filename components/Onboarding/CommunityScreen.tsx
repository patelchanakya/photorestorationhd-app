import { analyticsService } from '@/services/analytics';
import { presentPaywall } from '@/services/revenuecat';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import React from 'react';
import { Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingButton } from './shared/OnboardingButton';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { ONBOARDING_SPACING } from './shared/constants';


interface CommunityScreenProps {
  onContinue: () => void;
}

export function CommunityScreen({ onContinue }: CommunityScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Background animation values
  const backgroundPulse = useSharedValue(0);
  
  // Hero animations
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.95);
  const photo1Rotate = useSharedValue(-8);
  const photo2Rotate = useSharedValue(12);
  const photo3Rotate = useSharedValue(-5);
  const heroGlow = useSharedValue(0);
  
  // Content animations
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslateY = useSharedValue(20);
  const statsOpacity = useSharedValue(0);
  const statsScale = useSharedValue(0.9);
  const buttonOpacity = useSharedValue(0);
  
  // Simple, clean animations
  const benefitsOpacity = useSharedValue(0);
  const benefitsTranslateY = useSharedValue(30);
  
  // Showcase animations
  const showcaseHeaderOpacity = useSharedValue(0);
  const showcaseHeaderTranslateY = useSharedValue(30);
  const memorialOpacity = useSharedValue(0);
  const memorialTranslateY = useSharedValue(30);
  const repairOpacity = useSharedValue(0);
  const repairTranslateY = useSharedValue(30);
  const backgroundOpacity = useSharedValue(0);
  const backgroundTranslateY = useSharedValue(30);
  const customOpacity = useSharedValue(0);
  const customTranslateY = useSharedValue(30);

  // Animated values for stats counting
  const stat1Value = useSharedValue(0);
  const stat2Value = useSharedValue(0);
  const stat3Value = useSharedValue(0);
  const counterGlow = useSharedValue(0);
  const statsBgPulse = useSharedValue(0);

  // @ts-ignore
  React.useEffect(() => {
    // Track screen view (fire and forget)
    analyticsService.trackScreenView('onboarding_community', {
      onboarding_version: 'v3',
      screen_height: screenHeight.toString()
    });

    // Background pulse animation - continuous subtle effect
    backgroundPulse.value = withRepeat(
      withTiming(1, { duration: 4000 }),
      -1,
      true
    );

    // Stats background pulse animation
    statsBgPulse.value = withRepeat(
      withTiming(1, { duration: 2000 }),
      -1,
      true
    );

    // Hero animations with stagger
    heroOpacity.value = withDelay(200, withTiming(1, { duration: 800 }));
    heroScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 180 }));
    heroGlow.value = withDelay(400, withTiming(1, { duration: 1000 }));
    
    // Photo rotation animations
    photo1Rotate.value = withDelay(300, withSpring(-5, { damping: 20, stiffness: 150 }));
    photo2Rotate.value = withDelay(500, withSpring(8, { damping: 20, stiffness: 150 }));
    photo3Rotate.value = withDelay(700, withSpring(-3, { damping: 20, stiffness: 150 }));
    
    // Title animation with more dramatic entrance
    titleOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(600, withSpring(0, { damping: 16, stiffness: 200 }));
    
    // Body animation
    bodyOpacity.value = withDelay(800, withTiming(1, { duration: 600 }));
    bodyTranslateY.value = withDelay(800, withSpring(0, { damping: 16, stiffness: 200 }));
    
    // Benefits animation
    benefitsOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    benefitsTranslateY.value = withDelay(1000, withSpring(0, { damping: 16, stiffness: 180 }));
    
    // Showcase animations with staggered delays
    showcaseHeaderOpacity.value = withDelay(1200, withTiming(1, { duration: 600 }));
    showcaseHeaderTranslateY.value = withDelay(1200, withSpring(0, { damping: 16, stiffness: 200 }));
    
    memorialOpacity.value = withDelay(1400, withTiming(1, { duration: 600 }));
    memorialTranslateY.value = withDelay(1400, withSpring(0, { damping: 16, stiffness: 200 }));
    
    repairOpacity.value = withDelay(1600, withTiming(1, { duration: 600 }));
    repairTranslateY.value = withDelay(1600, withSpring(0, { damping: 16, stiffness: 200 }));
    
    backgroundOpacity.value = withDelay(1800, withTiming(1, { duration: 600 }));
    backgroundTranslateY.value = withDelay(1800, withSpring(0, { damping: 16, stiffness: 200 }));
    
    customOpacity.value = withDelay(2000, withTiming(1, { duration: 600 }));
    customTranslateY.value = withDelay(2000, withSpring(0, { damping: 16, stiffness: 200 }));
    
    // Stats animation
    statsOpacity.value = withDelay(2200, withTiming(1, { duration: 600 }));
    statsScale.value = withDelay(2200, withSpring(1, { damping: 14, stiffness: 250 }));
    
    // Start with initial counting animation to 10,532
    stat1Value.value = withDelay(1200, withTiming(10532, { duration: 1800 }));
    
    // Regular animations for other stats
    stat2Value.value = withDelay(1400, withTiming(5.0, { duration: 1800 }));
    stat3Value.value = withDelay(1600, withTiming(172, { duration: 1800 }));
    
    // Button animation
    buttonOpacity.value = withDelay(1400, withTiming(1, { duration: 500 }));

    // Start continuous increment with glow effect
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        // Check if component is still mounted before updating values
        if (intervalRef.current) {
          stat1Value.value = stat1Value.value + 1;
          // Trigger glow effect on each increment
          counterGlow.value = withTiming(1, { duration: 200 }, () => {
            if (intervalRef.current) {
              counterGlow.value = withTiming(0, { duration: 800 });
            }
          });
        }
      }, 1500) as any; // Slower increment for better UX
    }, 3000) as any;

    // Cleanup function
    return () => {
      // Clear timeouts and intervals first
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Cancel all animations
      cancelAnimation(stat1Value);
      cancelAnimation(stat2Value);
      cancelAnimation(stat3Value);
      cancelAnimation(backgroundPulse);
      cancelAnimation(counterGlow);
      cancelAnimation(statsBgPulse);
      cancelAnimation(benefitsOpacity);
      cancelAnimation(benefitsTranslateY);
      cancelAnimation(showcaseHeaderOpacity);
      cancelAnimation(showcaseHeaderTranslateY);
      cancelAnimation(memorialOpacity);
      cancelAnimation(memorialTranslateY);
      cancelAnimation(repairOpacity);
      cancelAnimation(repairTranslateY);
      cancelAnimation(backgroundOpacity);
      cancelAnimation(backgroundTranslateY);
      cancelAnimation(customOpacity);
      cancelAnimation(customTranslateY);
      
      // Reset values to prevent further updates
      stat1Value.value = 10532;
      counterGlow.value = 0;
    };
  }, [backgroundPulse, statsBgPulse, heroOpacity, heroScale, heroGlow, photo1Rotate, photo2Rotate, photo3Rotate, titleOpacity, titleTranslateY, bodyOpacity, bodyTranslateY, statsOpacity, statsScale, buttonOpacity, stat1Value, stat2Value, stat3Value, counterGlow, benefitsOpacity, benefitsTranslateY, showcaseHeaderOpacity, showcaseHeaderTranslateY, memorialOpacity, memorialTranslateY, repairOpacity, repairTranslateY, backgroundOpacity, backgroundTranslateY, customOpacity, customTranslateY, screenHeight]);

  // Background animated style
  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + (backgroundPulse.value * 0.05),
  }));

  // Hero animated styles
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));


  // Content animated styles
  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));



  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));


  // Benefits animated style
  const benefitsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: benefitsOpacity.value,
    transform: [{ translateY: benefitsTranslateY.value }],
  }));

  // Showcase animated styles
  const showcaseHeaderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: showcaseHeaderOpacity.value,
    transform: [{ translateY: showcaseHeaderTranslateY.value }],
  }));

  const memorialAnimatedStyle = useAnimatedStyle(() => ({
    opacity: memorialOpacity.value,
    transform: [{ translateY: memorialTranslateY.value }],
  }));

  const repairAnimatedStyle = useAnimatedStyle(() => ({
    opacity: repairOpacity.value,
    transform: [{ translateY: repairTranslateY.value }],
  }));

  const backgroundAnimatedStyle2 = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
    transform: [{ translateY: backgroundTranslateY.value }],
  }));

  const customAnimatedStyle = useAnimatedStyle(() => ({
    opacity: customOpacity.value,
    transform: [{ translateY: customTranslateY.value }],
  }));


  return (
    <OnboardingContainer showGradient={false}>{/* Fix children prop */}
      {/* Clean Background */}
      <Animated.View style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 107, 53, 0.05)',
        },
        backgroundAnimatedStyle
      ]} />
      
      <View style={{ flex: 1 }}>
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Image */}
          <Animated.View style={[
            {
              alignItems: 'center',
              marginBottom: 32,
              marginTop: 8,
            },
            heroAnimatedStyle
          ]}>
            <ExpoImage
              source={require('@/assets/images/onboarding/communityscreen.svg')}
              style={{
                width: 280,
                height: 180,
                borderRadius: 16,
              }}
              contentFit="cover"
            />
          </Animated.View>

          {/* Title */}
          <Animated.View style={[
            { 
              alignItems: 'center', 
              marginBottom: screenHeight > 700 ? 48 : 24,
            }, 
            titleAnimatedStyle
          ]}>
            <Text style={{ 
              fontSize: 32, 
              fontFamily: 'Lexend-Bold', 
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 38,
              letterSpacing: -0.8,
            }}>
              {t('onboarding.community.title')}
            </Text>
          </Animated.View>

          {/* Benefits List */}
          <Animated.View style={[
            {
              paddingHorizontal: 24,
              marginBottom: 48,
            },
            benefitsAnimatedStyle
          ]}>
            <BenefitItem 
              icon="✨"
              text={t('onboarding.community.benefit1')}
            />
            <BenefitItem 
              icon="⚡"
              text={t('onboarding.community.benefit2')}
            />
            <BenefitItem 
              icon="🎯"
              text={t('onboarding.community.benefit3')}
            />
          </Animated.View>

          {/* Claim Offer Section */}
          <Animated.View style={[
            {
              marginHorizontal: 24,
              marginBottom: 48,
            },
            benefitsAnimatedStyle
          ]}>
            <ClaimOfferCard />
          </Animated.View>

          {/* Showcase Header */}
          <Animated.View style={[
            { 
              alignItems: 'center', 
              marginBottom: 32,
              paddingHorizontal: 24,
            }, 
            showcaseHeaderAnimatedStyle
          ]}>
            <Text style={{ 
              fontSize: 24, 
              fontFamily: 'Lexend-Bold', 
              color: '#FFFFFF',
              textAlign: 'center',
              marginBottom: 8,
              letterSpacing: -0.5,
            }}>
              {t('onboarding.community.showcaseTitle')}
            </Text>
            <Text style={{ 
              fontSize: 16, 
              color: 'rgba(255, 255, 255, 0.7)',
              textAlign: 'center',
              fontFamily: 'Lexend-Regular',
              letterSpacing: -0.1,
            }}>
              {t('onboarding.community.showcaseSubtitle')}
            </Text>
          </Animated.View>

          {/* Memorial Showcase */}
          <Animated.View style={[
            {
              marginBottom: 40,
              paddingHorizontal: 16,
            },
            memorialAnimatedStyle
          ]}>
            <ShowcaseCard
              title={t('onboarding.community.memorial.title')}
              description={t('onboarding.community.memorial.description')}
              beforeImage={require('@/assets/images/onboarding/before-2.jpg')}
              afterImage={require('@/assets/images/onboarding/after-2.png')}
            />
          </Animated.View>

          {/* Repair Showcase */}
          <Animated.View style={[
            {
              marginBottom: 40,
              paddingHorizontal: 16,
            },
            repairAnimatedStyle
          ]}>
            <ShowcaseCard
              title={t('onboarding.community.repair.title')}
              description={t('onboarding.community.repair.description')}
              beforeImage={require('@/assets/images/onboarding/before-3.jpg')}
              afterImage={require('@/assets/images/onboarding/after-3.png')}
            />
          </Animated.View>

          {/* Background Showcase */}
          <Animated.View style={[
            {
              marginBottom: 40,
              paddingHorizontal: 16,
            },
            backgroundAnimatedStyle2
          ]}>
            <ShowcaseCard
              title={t('onboarding.community.background.title')}
              description={t('onboarding.community.background.description')}
              beforeImage={require('@/assets/images/onboarding/before-4.jpg')}
              afterImage={require('@/assets/images/backgrounds/thumbnail/beach/beach.jpeg')}
            />
          </Animated.View>

          {/* Custom Magic Section */}
          <Animated.View style={[
            {
              marginBottom: 32,
              paddingHorizontal: 16,
            },
            customAnimatedStyle
          ]}>
            <CustomMagicCard
              title={t('onboarding.community.custom.title')}
              description={t('onboarding.community.custom.description')}
            />
          </Animated.View>
        </ScrollView>

        {/* Continue Button - Fixed at bottom with glass morphism */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
        }}>
          <Animated.View style={[
            { 
              paddingHorizontal: ONBOARDING_SPACING.xxl, 
              paddingBottom: Math.max(insets.bottom, ONBOARDING_SPACING.huge),
              paddingTop: ONBOARDING_SPACING.xl,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }, 
            buttonAnimatedStyle
          ]}>
            <OnboardingButton
              title={t('onboarding.community.continue')}
              onPress={() => {
                // Track continue from community screen (fire and forget)
                analyticsService.track('onboarding_community_continue_clicked', {
                  onboarding_version: 'v3'
                });
                onContinue();
              }}
              variant="primary"
              size="large"
              style={{ 
                width: '100%',
              }}
            />
          </Animated.View>
        </View>
      </View>
    </OnboardingContainer>
  );
}

function ClaimOfferCard() {
  const handleClaimTrial = async () => {
    try {
      // Track claim button click
      analyticsService.track('claim_trial_clicked', {
        source: 'community_claim_offer_card',
        onboarding_version: 'v3'
      });

      // Present the specific "claim trial" paywall
      const success = await presentPaywall('default4-trial');
      
      if (success) {
        // Track successful trial claim
        analyticsService.track('trial_claimed_from_community', {
          source: 'claim_offer_card',
          onboarding_version: 'v3'
        });
      }
    } catch (error) {
      console.error('Claim trial error:', error);
    }
  };
  
  return (
    <View style={{
      backgroundColor: 'rgba(255, 107, 53, 0.15)',
      borderRadius: 20,
      padding: 24,
      borderWidth: 2,
      borderColor: 'rgba(255, 107, 53, 0.4)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Floating gradient background */}
      <View style={{
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
        opacity: 0.6,
      }} />
      
      {/* Main content */}
      <View style={{ alignItems: 'center', zIndex: 1 }}>
        <Text style={{
          fontSize: 14,
          fontFamily: 'Lexend-Bold',
          color: '#FF6B35',
          textAlign: 'center',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          UNLOCK EVERYTHING FREE
        </Text>
        
        <Text style={{
          fontSize: 28,
          fontFamily: 'Lexend-Bold',
          color: '#FFFFFF',
          textAlign: 'center',
          marginBottom: 8,
          letterSpacing: -0.5,
        }}>
          Try 3 Days Free
        </Text>
        
        <Text style={{
          fontSize: 16,
          color: 'rgba(255, 255, 255, 0.8)',
          textAlign: 'center',
          fontFamily: 'Lexend-Regular',
          letterSpacing: -0.1,
          marginBottom: 20,
        }}>
          Access all premium features
        </Text>
        
        <TouchableOpacity 
          style={{
            backgroundColor: '#FF6B35',
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 32,
            shadowColor: '#FF6B35',
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            shadowOpacity: 0.3,
            elevation: 8,
          }}
          onPress={handleClaimTrial}
        >
          <Text style={{
            fontSize: 18,
            fontFamily: 'Lexend-Bold',
            color: '#FFFFFF',
            textAlign: 'center',
            letterSpacing: -0.2,
          }}>
            Claim Your Free Trial
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface BenefitItemProps {
  icon: string;
  text: string;
}

function BenefitItem({ icon, text }: BenefitItemProps) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    }}>
      <Text style={{ 
        fontSize: 20, 
        marginRight: 16,
      }}>
        {icon}
      </Text>
      <Text style={{ 
        fontSize: 16, 
        color: '#FFFFFF',
        fontFamily: 'Lexend-Medium',
        letterSpacing: -0.2,
        flex: 1,
      }}>
        {text}
      </Text>
    </View>
  );
}

interface ShowcaseCardProps {
  title: string;
  description: string;
  beforeImage: any;
  afterImage: any;
}

function ShowcaseCard({ title, description, beforeImage, afterImage }: ShowcaseCardProps) {
  return (
    <View style={{
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    }}>
      <Text style={{ 
        fontSize: 20, 
        fontFamily: 'Lexend-Bold', 
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.4,
      }}>
        {title}
      </Text>
      
      <View style={{
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <SimpleBeforeAfterSlider
          beforeImage={beforeImage}
          afterImage={afterImage}
          height={240}
        />
      </View>
      
      <Text style={{ 
        fontSize: 14, 
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        fontFamily: 'Lexend-Regular',
        letterSpacing: -0.1,
        lineHeight: 20,
      }}>
        {description}
      </Text>
    </View>
  );
}

interface CustomMagicCardProps {
  title: string;
  description: string;
}

function CustomMagicCard({ title, description }: CustomMagicCardProps) {
  return (
    <View style={{
      backgroundColor: 'rgba(255, 107, 53, 0.1)',
      borderRadius: 16,
      padding: 24,
      borderWidth: 2,
      borderColor: 'rgba(255, 107, 53, 0.3)',
    }}>
      <Text style={{ 
        fontSize: 20, 
        fontFamily: 'Lexend-Bold', 
        color: '#FF6B35',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.4,
      }}>
        {title}
      </Text>
      
      {/* Mock Text Input */}
      <View style={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
      }}>
        <Text style={{ 
          fontSize: 16, 
          color: 'rgba(255, 255, 255, 0.6)',
          fontFamily: 'Lexend-Regular',
          fontStyle: 'italic',
        }}>
          Type what you want to change...
        </Text>
      </View>
      
      <Text style={{ 
        fontSize: 14, 
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        fontFamily: 'Lexend-Regular',
        letterSpacing: -0.1,
        lineHeight: 20,
      }}>
        {description}
      </Text>
    </View>
  );
}

interface SimpleBeforeAfterSliderProps {
  beforeImage: any;
  afterImage: any;
  height: number;
}

function SimpleBeforeAfterSlider({ beforeImage, afterImage, height }: SimpleBeforeAfterSliderProps) {
  const [containerWidth, setContainerWidth] = React.useState(300);
  const sliderPosition = useSharedValue(0.5);
  const [dragging, setDragging] = React.useState(false);

  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      'worklet';
      runOnJS(setDragging)(true);
    },
    onActive: (event) => {
      'worklet';
      const newPosition = Math.max(0, Math.min(1, event.x / containerWidth));
      sliderPosition.value = newPosition;
    },
    onEnd: () => {
      'worklet';
      runOnJS(setDragging)(false);
    },
  });

  const clipAnimatedStyle = useAnimatedStyle(() => ({
    width: `${sliderPosition.value * 100}%`,
  }));

  const lineAnimatedStyle = useAnimatedStyle(() => ({
    left: `${sliderPosition.value * 100}%`,
  }));

  const handleAnimatedStyle = useAnimatedStyle(() => ({
    left: `${sliderPosition.value * 100}%`,
    transform: [
      { translateX: -12 },
      { scale: dragging ? 1.05 : 1 },
    ],
  }));

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View 
        style={{ height, position: 'relative', backgroundColor: '#000' }}
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          setContainerWidth(width);
        }}
      >
        {/* After image (base) */}
        <ExpoImage
          source={afterImage}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
          contentFit="cover"
        />
        
        {/* Before image (clipped) */}
        <Animated.View style={[{ position: 'absolute', height: '100%', overflow: 'hidden' }, clipAnimatedStyle]}>
          <ExpoImage
            source={beforeImage}
            style={{ width: containerWidth, height: '100%' }}
            contentFit="cover"
          />
        </Animated.View>
        
        {/* Divider line */}
        <Animated.View style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 1,
          },
          lineAnimatedStyle
        ]} />
        
        {/* Simple minimal handle */}
        <Animated.View style={[
          {
            position: 'absolute',
            top: '50%',
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.1)',
            zIndex: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowRadius: 2,
            shadowOpacity: 0.2,
            transform: [{ translateY: -12 }],
          },
          handleAnimatedStyle
        ]}>
          {/* Inner dot */}
          <View style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            transform: [{ translateX: -3 }, { translateY: -3 }],
          }} />
        </Animated.View>
      </Animated.View>
    </PanGestureHandler>
  );
}

