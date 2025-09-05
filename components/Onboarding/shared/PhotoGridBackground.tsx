import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

const SAMPLE_PHOTOS = [
  // Popular restoration photos
  require('../../../assets/images/popular/enhance/pop-3.png'),
  require('../../../assets/images/popular/colorize/pop-1.png'),
  require('../../../assets/images/popular/brighten/pop-4.png'),
  require('../../../assets/images/popular/recreate/pop-5.png'),
  require('../../../assets/images/popular/descratch/pop-2.png'),
  require('../../../assets/images/popular/stain/pop-7.png'),
  
  // Background thumbnails
  require('../../../assets/images/backgrounds/thumbnail/studio/studio.jpeg'),
  require('../../../assets/images/backgrounds/thumbnail/city/city.jpeg'),
  require('../../../assets/images/backgrounds/thumbnail/garden/garden.jpeg'),
  require('../../../assets/images/backgrounds/thumbnail/heavenly/heavenly.jpg'),
  require('../../../assets/images/backgrounds/thumbnail/wedding/wedding.jpeg'),
  require('../../../assets/images/backgrounds/thumbnail/soft-lights/softer.jpg'),
  require('../../../assets/images/backgrounds/thumbnail/passport/passport.jpg'),
  require('../../../assets/images/backgrounds/thumbnail/christmas/christmas.jpg'),
  require('../../../assets/images/backgrounds/thumbnail/blur/blurred.jpeg'),
  require('../../../assets/images/backgrounds/thumbnail/beach/beach.jpeg'),
  
  // Onboarding examples
  require('../../../assets/images/onboarding/before-2.jpg'),
  require('../../../assets/images/onboarding/before-3.jpg'),
  require('../../../assets/images/onboarding/before-4.jpg'),
  require('../../../assets/images/onboarding/after-2.png'),
  require('../../../assets/images/onboarding/after-3.png'),
  require('../../../assets/images/onboarding/after-4.png'),
];

interface PhotoTileProps {
  source: any;
  index: number;
  size: number;
  x: number;
  y: number;
}

function PhotoTile({ source, index, size, x, y }: PhotoTileProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const scale = useSharedValue(0.8);

  React.useEffect(() => {
    // Staggered entrance animation
    const delay = index * 150;
    
    opacity.value = withDelay(delay, withTiming(0.3, { duration: 800 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 800 }));
    scale.value = withDelay(delay, withTiming(1, { duration: 800 }));

    // Start floating animation after entrance
    setTimeout(() => {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 3000 + Math.random() * 1000 }),
          withTiming(10, { duration: 3000 + Math.random() * 1000 })
        ),
        -1,
        true
      );
      
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 4000 + Math.random() * 2000 }),
          withTiming(0.95, { duration: 4000 + Math.random() * 2000 })
        ),
        -1,
        true
      );
    }, delay + 800);
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
        },
        animatedStyle,
      ]}
    >
      <Image
        source={source}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
        }}
        contentFit="cover"
      />
    </Animated.View>
  );
}

interface PhotoGridBackgroundProps {
  width: number;
  height: number;
}

export function PhotoGridBackground({ width, height }: PhotoGridBackgroundProps) {
  const positions = React.useMemo(() => {
    const baseTileSize = Math.min(width, height) * 0.08;
    const tiles = [];
    const numPhotos = Math.min(SAMPLE_PHOTOS.length, 18); // Show up to 18 photos
    
    // Generate random positions for photos with better distribution
    for (let i = 0; i < numPhotos; i++) {
      const sizeVariation = Math.random() * 30 + 10; // 10-40px variation
      const size = baseTileSize + sizeVariation;
      
      tiles.push({
        x: Math.random() * (width - size),
        y: Math.random() * (height - size),
        size: size,
      });
    }
    
    return tiles;
  }, [width, height]);

  return (
    <View
      style={{
        position: 'absolute',
        width,
        height,
        overflow: 'hidden',
      }}
    >
      {positions.map((pos, index) => (
        <PhotoTile
          key={index}
          source={SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length]}
          index={index}
          size={pos.size}
          x={pos.x}
          y={pos.y}
        />
      ))}
    </View>
  );
}