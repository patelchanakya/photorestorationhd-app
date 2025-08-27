import React from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withDelay,
  withTiming 
} from 'react-native-reanimated';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { OnboardingButton } from './shared/OnboardingButton';

const { width: screenWidth } = Dimensions.get('window');

interface CommunityScreenProps {
  onContinue: () => void;
}

export function CommunityScreen({ onContinue }: CommunityScreenProps) {
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.95);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslateY = useSharedValue(15);
  const statsOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  // Animated values for stats counting
  const stat1Value = useSharedValue(0);
  const stat2Value = useSharedValue(0);
  const stat3Value = useSharedValue(0);

  React.useEffect(() => {
    // Hero image animation
    heroOpacity.value = withDelay(100, withTiming(1, { duration: 600 }));
    heroScale.value = withDelay(100, withSpring(1, { damping: 15, stiffness: 200 }));
    
    // Title animation
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(400, withSpring(0, { damping: 15, stiffness: 200 }));
    
    // Body animation
    bodyOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
    bodyTranslateY.value = withDelay(600, withSpring(0, { damping: 15, stiffness: 200 }));
    
    // Stats animation with counting effect
    statsOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    stat1Value.value = withDelay(1000, withTiming(10, { duration: 1500 }));
    stat2Value.value = withDelay(1200, withTiming(4.8, { duration: 1500 }));
    stat3Value.value = withDelay(1400, withTiming(150, { duration: 1500 }));
    
    // Button animation
    buttonOpacity.value = withDelay(1200, withTiming(1, { duration: 400 }));
  }, []);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bodyTranslateY.value }],
  }));

  const statsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <OnboardingContainer>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image/Graphic */}
        <Animated.View style={[
          {
            alignItems: 'center',
            marginBottom: 40,
          },
          heroAnimatedStyle
        ]}>
          <View style={{
            width: screenWidth - 80,
            height: 200,
            borderRadius: 20,
            backgroundColor: 'rgba(250, 204, 21, 0.1)',
            borderWidth: 1,
            borderColor: 'rgba(250, 204, 21, 0.3)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#FACC15',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10,
          }}>
            {/* Photo collage placeholder - you can replace with actual collage image */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 24 }}>📸</Text>
              </View>
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 24 }}>✨</Text>
              </View>
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 24 }}>🎨</Text>
              </View>
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 24 }}>🖼️</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Main Title */}
        <Animated.View style={[
          { alignItems: 'center', marginBottom: 20 }, 
          titleAnimatedStyle
        ]}>
          <Text style={{ 
            fontSize: 32, 
            fontWeight: 'bold', 
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 38,
          }}>
            Join millions transforming their memories ✨
          </Text>
        </Animated.View>

        {/* Body Text */}
        <Animated.View style={[
          { alignItems: 'center', marginBottom: 40 }, 
          bodyAnimatedStyle
        ]}>
          <Text style={{ 
            fontSize: 18, 
            color: '#9CA3AF',
            textAlign: 'center',
            lineHeight: 26,
            paddingHorizontal: 16,
          }}>
            Photographers, families, and creators worldwide trust Clever with their precious photos
          </Text>
        </Animated.View>

        {/* Stats Section */}
        <Animated.View style={[
          {
            flexDirection: 'row',
            justifyContent: 'space-around',
            marginBottom: 50,
            paddingHorizontal: 20,
          },
          statsAnimatedStyle
        ]}>
          <StatItem
            value={stat1Value}
            suffix="M+"
            label="Photos Enhanced"
          />
          <StatItem
            value={stat2Value}
            suffix="★"
            label="Average Rating"
            isDecimal
          />
          <StatItem
            value={stat3Value}
            suffix="+"
            label="Countries"
          />
        </Animated.View>

        {/* Continue Button */}
        <Animated.View style={[
          { width: '100%', maxWidth: 280, alignSelf: 'center' }, 
          buttonAnimatedStyle
        ]}>
          <OnboardingButton
            title="Continue"
            onPress={onContinue}
            variant="primary"
            size="large"
            style={{ width: '100%' }}
          />
        </Animated.View>
      </ScrollView>
    </OnboardingContainer>
  );
}

interface StatItemProps {
  value: Animated.SharedValue<number>;
  suffix: string;
  label: string;
  isDecimal?: boolean;
}

function StatItem({ value, suffix, label, isDecimal = false }: StatItemProps) {
  const animatedProps = useAnimatedStyle(() => {
    const displayValue = isDecimal ? value.value.toFixed(1) : Math.round(value.value);
    return {};
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.Text style={{ 
        fontSize: 28, 
        fontWeight: 'bold', 
        color: '#FACC15',
        marginBottom: 4,
      }}>
        {/* This would be better with a custom animated text component */}
        10M+
      </Animated.Text>
      <Text style={{ 
        fontSize: 12, 
        color: '#6B7280',
        textAlign: 'center',
        fontWeight: '500',
      }}>
        {label}
      </Text>
    </View>
  );
}

// For now, using static values since animated text value display 
// would require a custom component or library
function StatItemStatic({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ 
        fontSize: 28, 
        fontWeight: 'bold', 
        color: '#FACC15',
        marginBottom: 4,
      }}>
        {value}
      </Text>
      <Text style={{ 
        fontSize: 12, 
        color: '#6B7280',
        textAlign: 'center',
        fontWeight: '500',
      }}>
        {label}
      </Text>
    </View>
  );
}