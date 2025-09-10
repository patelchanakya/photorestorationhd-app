import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  withDelay 
} from 'react-native-reanimated';

interface IntentOption {
  id: string;
  label: string;
  icon: string;
  demoImages: string[];
}

interface IntentCaptureScreenProps {
  options: IntentOption[];
  onSelect: (intentId: string) => void;
}

function IntentTile({ 
  option, 
  index, 
  onPress 
}: { 
  option: IntentOption; 
  index: number; 
  onPress: () => void; 
}) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    // Staggered entrance animation
    const delay = index * 100;
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 12 }));
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.95, { damping: 15 }, () => {
      scale.value = withSpring(1, { damping: 15 });
    });
    onPress();
  };

  return (
    <Animated.View style={[styles.tileContainer, animatedStyle]}>
      <TouchableOpacity
        style={styles.tile}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.tileIcon}>{option.icon}</Text>
        <Text style={styles.tileLabel}>{option.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function IntentCaptureScreen({ options, onSelect }: IntentCaptureScreenProps) {
  const insets = useSafeAreaInsets();
  const titleOpacity = useSharedValue(0);

  React.useEffect(() => {
    titleOpacity.value = withTiming(1, { duration: 600 });
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#0B0B0F', '#1a1a2e']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Header */}
        <Animated.View style={[styles.header, titleStyle]}>
          <Text style={styles.title}>What brought you here?</Text>
        </Animated.View>

        {/* Intent Options Grid */}
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {options.map((option, index) => (
              <IntentTile
                key={option.id}
                option={option}
                index={index}
                onPress={() => onSelect(option.id)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Bottom Spacing */}
        <View style={{ height: insets.bottom + 20 }} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileContainer: {
    width: '48%',
    marginBottom: 16,
  },
  tile: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  tileIcon: {
    fontSize: 32,
    marginBottom: 12,
    textAlign: 'center',
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
  },
});