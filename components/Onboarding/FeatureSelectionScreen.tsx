import React from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ONBOARDING_FEATURES } from '@/utils/onboarding';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withDelay,
  withTiming 
} from 'react-native-reanimated';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { OnboardingButton } from './shared/OnboardingButton';

interface FeatureSelectionScreenProps {
  onContinue: (selectedFeature: string, customPrompt?: string) => void;
}

export function FeatureSelectionScreen({ onContinue }: FeatureSelectionScreenProps) {
  const [selectedFeature, setSelectedFeature] = React.useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = React.useState<string>('');
  
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const buttonOpacity = useSharedValue(0);
  const promptInputOpacity = useSharedValue(0);
  const promptInputHeight = useSharedValue(0);

  React.useEffect(() => {
    // Title animation
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(100, withSpring(0, { damping: 15, stiffness: 200 }));
  }, []);

  React.useEffect(() => {
    const isCustomPromptSelected = selectedFeature === 'custom_prompt';
    
    // Show/hide custom prompt input
    if (isCustomPromptSelected) {
      promptInputOpacity.value = withTiming(1, { duration: 300 });
      promptInputHeight.value = withSpring(80, { damping: 15, stiffness: 200 });
    } else {
      promptInputOpacity.value = withTiming(0, { duration: 200 });
      promptInputHeight.value = withSpring(0, { damping: 15, stiffness: 200 });
      setCustomPrompt(''); // Clear prompt when not custom
    }
    
    // Button appears when feature is selected (and prompt filled for custom)
    const canContinue = selectedFeature && (!isCustomPromptSelected || customPrompt.trim().length > 0);
    if (canContinue) {
      buttonOpacity.value = withTiming(1, { duration: 300 });
    } else {
      buttonOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [selectedFeature, customPrompt]);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const promptInputAnimatedStyle = useAnimatedStyle(() => ({
    opacity: promptInputOpacity.value,
    height: promptInputHeight.value,
  }));

  const handleFeatureSelect = (featureId: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setSelectedFeature(featureId);
  };

  const handleContinue = () => {
    if (selectedFeature) {
      const isCustom = selectedFeature === 'custom_prompt';
      onContinue(selectedFeature, isCustom ? customPrompt.trim() : undefined);
    }
  };

  return (
    <OnboardingContainer>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
        {/* Header */}
        <Animated.View style={[{ alignItems: 'center', paddingVertical: 32 }, titleAnimatedStyle]}>
          <Text style={{ 
            fontSize: 32, 
            fontWeight: 'bold', 
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: 8,
          }}>
            What would you like to do today?
          </Text>
          <Text style={{ 
            fontSize: 16, 
            color: '#9CA3AF',
            textAlign: 'center',
          }}>
            Choose what interests you most
          </Text>
        </Animated.View>

        {/* Feature List */}
        <View style={{ flex: 1 }}>
          <FlatList
            data={ONBOARDING_FEATURES}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <FeatureCard
                feature={item}
                isSelected={selectedFeature === item.id}
                onSelect={() => handleFeatureSelect(item.id)}
                index={index}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 0 }}
          />
        </View>

        {/* Custom Prompt Input */}
        <Animated.View style={[
          {
            marginHorizontal: 24,
            marginBottom: 8,
            overflow: 'hidden',
          },
          promptInputAnimatedStyle
        ]}>
          <View style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(250, 204, 21, 0.3)',
            padding: 16,
          }}>
            <TextInput
              value={customPrompt}
              onChangeText={setCustomPrompt}
              placeholder="Describe what you want to do (e.g., 'make photo vintage style', 'add rain effect')"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              multiline
              maxLength={200}
              style={{
                color: '#FFFFFF',
                fontSize: 16,
                minHeight: 40,
                textAlignVertical: 'top',
              }}
              returnKeyType="done"
              blurOnSubmit={true}
            />
          </View>
        </Animated.View>

        {/* Continue Button - Only shown when feature selected */}
        {selectedFeature && (selectedFeature !== 'custom_prompt' || customPrompt.trim().length > 0) && (
          <Animated.View style={[
            {
              position: 'absolute',
              bottom: 40,
              left: 24,
              right: 24,
              zIndex: 10,
            },
            buttonAnimatedStyle
          ]}>
            <OnboardingButton
              title="Continue"
              onPress={handleContinue}
              variant="primary"
              size="large"
              style={{
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 12,
              }}
            />
          </Animated.View>
        )}
        </View>
      </KeyboardAvoidingView>
    </OnboardingContainer>
  );
}

interface FeatureCardProps {
  feature: typeof ONBOARDING_FEATURES[0];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}

function FeatureCard({ feature, isSelected, onSelect, index }: FeatureCardProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const backgroundColor = useSharedValue(0);

  React.useEffect(() => {
    // Stagger entrance animation
    const delay = index * 80;
    opacity.value = withDelay(delay + 300, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay + 300, withSpring(0, { damping: 15, stiffness: 200 }));
  }, [index]);

  React.useEffect(() => {
    backgroundColor.value = withTiming(isSelected ? 1 : 0, { duration: 300 });
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => {
    const bgOpacity = backgroundColor.value * 0.15;
    const borderOpacity = backgroundColor.value * 0.8 + 0.1;
    
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }, { scale: scale.value }],
      backgroundColor: isSelected 
        ? `rgba(250, 204, 21, ${bgOpacity})` 
        : 'rgba(255, 255, 255, 0.05)',
      borderColor: isSelected 
        ? `rgba(250, 204, 21, ${borderOpacity})` 
        : 'rgba(255, 255, 255, 0.1)',
      borderWidth: isSelected ? 2 : 1,
      shadowColor: isSelected ? '#FACC15' : 'transparent',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: isSelected ? 6 : 2,
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 20, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onSelect}
      activeOpacity={1}
      style={{ marginBottom: 12 }}
    >
      <Animated.View 
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 20,
            borderRadius: 16,
          },
          animatedStyle
        ]}
      >
        {/* Icon */}
        <View style={{ 
          width: 48, 
          height: 48, 
          borderRadius: 24,
          backgroundColor: isSelected ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255, 255, 255, 0.1)',
          alignItems: 'center', 
          justifyContent: 'center',
          marginRight: 16 
        }}>
          <Text style={{ fontSize: 20 }}>
            {getFeatureEmoji(feature.id)}
          </Text>
        </View>
        
        {/* Text Content */}
        <View style={{ flex: 1 }}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '600', 
            color: isSelected ? '#FFFFFF' : '#F3F4F6',
            marginBottom: 4,
          }}>
            {feature.name}
          </Text>
          <Text style={{ 
            fontSize: 14, 
            color: isSelected ? '#FDE047' : '#9CA3AF',
            lineHeight: 18,
          }}>
            {feature.description}
          </Text>
        </View>
        
        {/* Selection Indicator */}
        {isSelected && (
          <View style={{ 
            width: 24, 
            height: 24, 
            borderRadius: 12,
            backgroundColor: '#FACC15',
            alignItems: 'center', 
            justifyContent: 'center',
            marginLeft: 12
          }}>
            <IconSymbol name="checkmark" size={14} color="#1a1a2e" />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

function getFeatureEmoji(featureId: string): string {
  const emojiMap: Record<string, string> = {
    'fix_old_damaged': '🔧',
    'add_color_bw': '🎨',
    'create_videos': '🎬',
    'restore_old_memories': '🖼️',
    'change_outfits': '👕',
    'remove_backgrounds': '✂️',
    'face_enhancement': '✨',
    'photo_upscaling': '🔍',
  };
  return emojiMap[featureId] || '⚡';
}