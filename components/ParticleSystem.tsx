import React, { useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ParticleProps {
  delay: number;
  startX: number;
  startY: number;
  size: number;
  color: string;
  isStarShape: boolean;
}

function Particle({ delay, startX, startY, size, color, isStarShape }: ParticleProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const flash = useSharedValue(1);

  useEffect(() => {
    // Random movement direction
    const randomX = (Math.random() - 0.5) * 200; // -100 to 100
    const randomY = -Math.random() * 150 - 50; // -50 to -200 (upward)
    const twinkleInterval = 150 + Math.random() * 100; // Random twinkle timing

    // Start animation with delay
    setTimeout(() => {
      // Initial burst with flash
      opacity.value = withTiming(1, { duration: 100 });
      scale.value = withSequence(
        withTiming(1.3, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      
      // Continuous twinkling/flashing effect
      flash.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: twinkleInterval }),
          withTiming(1, { duration: twinkleInterval * 0.5 }),
          withTiming(0.6, { duration: twinkleInterval }),
          withTiming(1, { duration: twinkleInterval * 0.3 })
        ),
        -1, // Infinite repeat
        true
      );
      
      // Movement animation
      translateX.value = withTiming(randomX, { 
        duration: 1200, 
        easing: Easing.out(Easing.quad) 
      });
      
      translateY.value = withTiming(randomY, { 
        duration: 1200, 
        easing: Easing.out(Easing.quad) 
      });
      
      // Faster, more beautiful fade out
      setTimeout(() => {
        flash.value = withTiming(0, { duration: 300 }); // Stop twinkling
        opacity.value = withTiming(0, { 
          duration: 400, 
          easing: Easing.out(Easing.cubic) 
        });
        scale.value = withTiming(0, { 
          duration: 400, 
          easing: Easing.out(Easing.cubic) 
        });
      }, 1400);
    }, delay);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value * flash.value,
    shadowOpacity: flash.value * 0.8,
  }));

  if (isStarShape) {
    return (
      <Animated.View
        style={[
          animatedStyle,
          {
            position: 'absolute',
            left: startX,
            top: startY,
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }
        ]}
      >
        <View
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: size * 0.5,
            transform: [{ rotate: '45deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: size * 0.6,
            height: size * 0.6,
            backgroundColor: color,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: size * 0.3,
          }}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          left: startX,
          top: startY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: size * 0.5,
        }
      ]}
    />
  );
}

interface ParticleSystemProps {
  show: boolean;
  centerX: number;
  centerY: number;
}

export default function ParticleSystem({ show, centerX, centerY }: ParticleSystemProps) {
  if (!show) return null;

  // Particle configurations
  const colors = ['#f97316', '#fb923c', '#fdba74'];
  const sizes = [6, 8, 10, 12];
  
  const particles = Array.from({ length: 30 }, (_, index) => {
    const isStarShape = Math.random() < 0.3; // 30% chance of star
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const delay = index * 15; // Faster stagger for more particles
    
    return {
      id: index,
      delay,
      size,
      color,
      isStarShape,
    };
  });

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
      }}
    >
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          delay={particle.delay}
          startX={centerX}
          startY={centerY}
          size={particle.size}
          color={particle.color}
          isStarShape={particle.isStarShape}
        />
      ))}
    </View>
  );
}