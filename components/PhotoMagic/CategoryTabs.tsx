import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

type Category = 'All' | 'Memorial' | 'Creative' | 'Cleanup' | 'Style' | 'Looks';

interface CategoryTabsProps {
  selectedCategory: Category;
  onCategoryChange: (category: Category) => void;
  categories?: Category[];
}

const DEFAULT_CATEGORIES: Category[] = ['All', 'Looks', 'Style', 'Creative', 'Memorial', 'Cleanup'];

export function CategoryTabs({ 
  selectedCategory, 
  onCategoryChange, 
  categories = DEFAULT_CATEGORIES 
}: CategoryTabsProps) {
  const scrollViewRef = React.useRef<ScrollView>(null);

  const CategoryTab = ({ category, isSelected, onPress }: { 
    category: Category; 
    isSelected: boolean; 
    onPress: () => void;
  }) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }));

    const handlePressIn = () => {
      try { Haptics.selectionAsync(); } catch {}
      scale.value = withSpring(0.95, { damping: 12, stiffness: 200 });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    };

    React.useEffect(() => {
      opacity.value = withTiming(isSelected ? 1 : 0.8, { duration: 200 });
    }, [isSelected]);

    return (
      <Animated.View style={[animatedStyle, { marginRight: 8 }]}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
          style={{
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {isSelected ? (
            <View style={{ position: 'relative' }}>
              {/* Glow effect */}
              <View style={{
                position: 'absolute',
                top: -2,
                left: -2,
                right: -2,
                bottom: -2,
                borderRadius: 18,
                backgroundColor: '#F59E0B',
                opacity: 0.3,
              }} />
              
              <LinearGradient
                colors={['#F59E0B', '#FBBF24', '#F59E0B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 16,
                  minWidth: 72,
                  shadowColor: '#F59E0B',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text style={{ 
                  color: '#0B0B0F', 
                  fontSize: 13, 
                  fontFamily: 'Lexend-Black',
                  textAlign: 'center',
                  letterSpacing: 0.2
                }}>
                  {category}
                </Text>
              </LinearGradient>
            </View>
          ) : (
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              paddingHorizontal: 16,
              paddingVertical: 10,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 16,
              minWidth: 72,
            }}>
              <Text style={{ 
                color: 'rgba(255,255,255,0.75)', 
                fontSize: 13, 
                fontFamily: 'Lexend-SemiBold',
                textAlign: 'center',
                letterSpacing: 0.1
              }}>
                {category}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ 
        color: '#EAEAEA', 
        fontSize: 16, 
        fontFamily: 'Lexend-SemiBold', 
        marginBottom: 14,
        paddingHorizontal: 16,
      }}>
        Categories
      </Text>
      
      <View style={{ position: 'relative' }}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 2 }}
          style={{ flexGrow: 0 }}
        >
          {categories.map((category) => (
            <CategoryTab
              key={category}
              category={category}
              isSelected={selectedCategory === category}
              onPress={() => onCategoryChange(category)}
            />
          ))}
        </ScrollView>
        
        {/* Enhanced right edge gradient fade */}
        <LinearGradient
          colors={['transparent', 'rgba(11,11,15,0.8)', '#0B0B0F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ 
            position: 'absolute', 
            right: 0, 
            top: 0, 
            bottom: 0, 
            width: 32, 
            pointerEvents: 'none' 
          }}
        />
      </View>

      {/* Enhanced category description */}
      <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
        <Text style={{ 
          color: 'rgba(255,255,255,0.65)', 
          fontSize: 12, 
          lineHeight: 16,
          fontFamily: 'Lexend-Medium'
        }}>
          {getCategoryDescription(selectedCategory)}
        </Text>
      </View>
    </View>
  );
}

function getCategoryDescription(category: Category): string {
  switch (category) {
    case 'All':
      return 'Browse all available photo editing presets';
    case 'Looks':
      return 'Change facial features, skin, hair, and appearance';
    case 'Style':
      return 'Transform your photo with artistic styles and effects';
    case 'Creative':
      return 'Add creative elements like lighting, sparkles, and more';
    case 'Memorial':
      return 'Gentle enhancements perfect for memorial photos';
    case 'Cleanup':
      return 'Remove unwanted elements like watermarks and marks';
    default:
      return '';
  }
}