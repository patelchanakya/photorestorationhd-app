import { useT } from '@/src/hooks/useTranslation';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface NavigationPillsProps {
  sections: Array<{
    id: string;
    titleKey: string;
    onPress: () => void;
  }>;
  activeSectionId?: string;
}

export function NavigationPills({ sections, activeSectionId }: NavigationPillsProps) {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = width <= 375; // iPhone SE and similar
  const isLargeTablet = shortestSide >= 1024; // iPad Pro and similar
  const isLandscape = width > height;
  const t = useT();

  // Enhanced responsive sizing for better cross-device support
  const pillPadding = isLargeTablet ? 28 : (isTabletLike ? 24 : (isSmallPhone ? 12 : 16));
  const pillVerticalPadding = isLargeTablet ? 14 : (isTabletLike ? 12 : (isSmallPhone ? 6 : 8));
  const fontSize = isLargeTablet ? 16 : (isTabletLike ? 15 : (isSmallPhone ? 11 : 12));
  const containerPadding = isLargeTablet ? 24 : (isTabletLike ? 20 : (isSmallPhone ? 12 : 16));
  const gap = isLargeTablet ? 16 : (isTabletLike ? 12 : (isSmallPhone ? 6 : 8));

  return (
    <View style={{ 
      paddingVertical: isLargeTablet ? 20 : (isTabletLike ? 16 : 12), 
      backgroundColor: '#000000',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)'
    }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingHorizontal: containerPadding, 
          gap: gap,
          alignItems: 'center'
        }}
        decelerationRate="fast"
        snapToInterval={isLargeTablet ? 120 : 100} // Better snapping for larger screens
        snapToAlignment="start"
        bounces={false} // Disable bouncing for better UX
      >
        {sections.map((section, index) => {
          const isActive = activeSectionId === section.id;
          
          const animatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: isActive ? withSpring(1.02) : 1 }],
          }));

          return (
            <Animated.View
              key={section.id}
              entering={FadeIn.delay(index * 80).duration(500)}
              style={animatedStyle}
            >
              <TouchableOpacity
                onPress={section.onPress}
                style={{
                  paddingHorizontal: pillPadding,
                  paddingVertical: pillVerticalPadding,
                  borderRadius: isLargeTablet ? 26 : (isTabletLike ? 22 : 18),
                  backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                  minWidth: isLargeTablet ? 80 : (isSmallPhone ? 60 : 70), // Better touch targets for all devices
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
                    fontSize: fontSize,
                    fontFamily: isActive ? 'Lexend-SemiBold' : 'Lexend-Medium',
                    letterSpacing: -0.1,
                    textAlign: 'center',
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {t(section.titleKey)}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}