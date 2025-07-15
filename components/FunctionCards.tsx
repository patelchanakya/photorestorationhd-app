import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from './ui/IconSymbol';

interface FunctionCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  gradient: string[];
  onPress: () => void;
}

interface FunctionCardsProps {
  onRestorationPress: () => void;
  onUnblurPress: () => void;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function FunctionCards({ onRestorationPress, onUnblurPress }: FunctionCardsProps) {
  const cards: FunctionCard[] = [
    {
      id: 'restoration',
      title: 'Restoration',
      description: 'Restore old photos instantly',
      icon: 'camera.fill',
      gradient: ['#f97316', '#fb923c'],
      onPress: onRestorationPress,
    },
    {
      id: 'unblur',
      title: 'Unblur',
      description: 'Sharpen blurry images',
      icon: 'photo.fill',
      gradient: ['#8b5cf6', '#a78bfa'],
      onPress: onUnblurPress,
    },
  ];

  return (
    <View className="px-4 py-6">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 0 }}
      >
        {cards.map((card, index) => (
          <FunctionCard
            key={card.id}
            card={card}
            isLast={index === cards.length - 1}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface FunctionCardProps {
  card: FunctionCard;
  isLast: boolean;
}

function FunctionCard({ card, isLast }: FunctionCardProps) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    card.onPress();
  };

  return (
    <View className="items-center" style={{ marginRight: isLast ? 0 : 20 }}>
      <AnimatedTouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          {
            width: 120,
            height: 110,
            borderRadius: 20,
            marginBottom: 8,
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={card.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <IconSymbol name={card.icon} size={36} color="#ffffff" />
          <Text 
            className="text-white text-sm font-bold mt-2 text-center" 
            style={{ 
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3
            }}
          >
            {card.title}
          </Text>
          <Text 
            className="text-white text-xs text-center mt-1" 
            style={{ 
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2
            }}
          >
            {card.description}
          </Text>
        </LinearGradient>
      </AnimatedTouchableOpacity>
    </View>
  );
}