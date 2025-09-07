import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analyticsService } from '@/services/analytics';
import { featureRequestService } from '@/services/featureRequestService';
import { useT } from '@/src/hooks/useTranslation';
import { useQuickEditStore } from '@/store/quickEditStore';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Animated, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

type CardItem = {
  id: string;
  titleKey: string; // Translation key for title
  emoji: string; // Emoji for the card
  functionType?: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'restore_repair' | 'water_damage';
  styleKey?: string;
  route?: string;
  customPrompt?: string; // Custom prompt for specific functionality
  image: any; // require('...')
};

// Poster-style cards; order sets Featured (first). Prioritize Repair; move Water Damage lower.
const CARDS: CardItem[] = [
  { id: 'fc_repair', titleKey: 'magic.repair.title', emoji: '🔧', functionType: 'repair', image: require('../assets/images/popular/recreate/pop-5.png') },
  { id: 'fc_torn_photos', titleKey: 'Fix Torn Photos', emoji: '📄', functionType: 'repair', customPrompt: 'Repair tears and rips in old photos', image: require('../assets/images/popular/recreate/pop-5.png') },
  { id: 'fc_colorize', titleKey: 'magic.colorize.title', emoji: '🎨', functionType: 'colorize', image: require('../assets/images/popular/colorize/pop-1.png') },
  { id: 'fc_descratch', titleKey: 'magic.descratch.title', emoji: '✨', functionType: 'descratch', image: require('../assets/images/popular/descratch/pop-2.png') },
  { id: 'fc_enlighten', titleKey: 'magic.brighten.title', emoji: '☀️', functionType: 'enlighten', image: require('../assets/images/popular/brighten/pop-4.png') },
  { id: 'fc_water_stain', titleKey: 'magic.waterDamage.title', emoji: '💧', functionType: 'water_damage', image: require('../assets/images/popular/stain/pop-7.png') },
  { id: 'fc_enhance', titleKey: 'magic.clarify.title', emoji: '🔍', functionType: 'unblur', image: require('../assets/images/popular/enhance/pop-3.png') },
  { id: 'fc_remove_stains', titleKey: 'Remove Stains', emoji: '🧽', functionType: 'water_damage', customPrompt: 'Remove coffee stains, water stains, and discoloration', image: require('../assets/images/popular/stain/pop-7.png') },
  { id: 'fc_faded_photos', titleKey: 'Fix Faded Photos', emoji: '🌅', functionType: 'enlighten', customPrompt: 'Restore color and contrast to faded images', image: require('../assets/images/popular/brighten/pop-4.png') },
];

type FeatureCardsListProps = {
  onOpenBackgrounds?: () => void;
  onOpenClothes?: () => void;
  // When true, renders a compact Featured + Grid layout optimized for readability
  compact?: boolean;
};


// Memoize individual card to prevent re-renders
const FeatureCardBase = ({ 
  item, 
  onPress 
}: { 
  item: CardItem; 
  onPress: (item: CardItem) => void;
}) => {
  const t = useT();
  const scaleValue = React.useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    try { Haptics.selectionAsync(); } catch {}
    Animated.timing(scaleValue, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true
    }).start();
  };
  
  return (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={() => onPress(item)}
    onPressIn={handlePressIn}
    onPressOut={handlePressOut}
    style={{ marginHorizontal: 16, marginBottom: 14 }}
  >
    <Animated.View style={{ 
      height: 260, 
      borderRadius: 24, 
      overflow: 'hidden', 
      backgroundColor: 'transparent',
      transform: [{ scale: scaleValue }]
    }}>
      <ExpoImage 
        source={item.image} 
        style={{ width: '100%', height: '100%' }} 
        contentFit="cover"
        cachePolicy="memory-disk" // Enable aggressive caching
        priority="high" // High priority loading
        placeholderContentFit="cover"
        transition={0} // Disable transition to prevent flash
      />
      {/* Clean gradient overlay */}
      <LinearGradient
        colors={[ 'transparent', 'rgba(0,0,0,0.68)' ]}
        locations={[0, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' }}
      />
      
      {/* Clean aligned content */}
      <View style={{ 
        position: 'absolute', 
        left: 24, 
        right: 24, 
        bottom: 24,
        alignItems: 'center'
      }}>
        {/* Feature Title */}
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 20, 
          fontFamily: 'Lexend-Bold', 
          letterSpacing: -0.4,
          textAlign: 'center',
          textShadowColor: 'rgba(0,0,0,0.85)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
          marginBottom: 8
        }} numberOfLines={1}>
          {t(item.titleKey)}
        </Text>
        
        {/* Action with emoji */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)'
        }}>
          <IconSymbol name="camera" size={14} color="#FFFFFF" />
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 13, 
            fontFamily: 'Lexend-Medium', 
            letterSpacing: -0.1,
            marginLeft: 6
          }}>
            Choose Photo
          </Text>
        </View>
      </View>
      
    </Animated.View>
  </TouchableOpacity>
  );
};

const Card = React.memo(FeatureCardBase);
Card.displayName = 'FeatureCard';


// Memoize the entire component - export as default function
export function FeatureCardsList({ 
  onOpenBackgrounds, 
  onOpenClothes,
  compact = false
}: FeatureCardsListProps) {
  const router = useRouter();
  const { isPro } = useRevenueCat();
  const t = useT();
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const isTabletLike = shortestSide >= 768;

  // Handle request idea submission
  const handleRequestIdea = React.useCallback(async () => {
    Alert.prompt(
      t('magic.requestFeature.title'),
      t('magic.requestFeature.prompt'),
      async (text) => {
        if (text && text.trim()) {
          try {
            const result = await featureRequestService.submitRequest(text, undefined, isPro, 'feature');
            if (result.success) {
              Alert.alert(
                t('magic.requestFeature.thankYouTitle'),
                t('magic.requestFeature.thankYouMessage'),
                [{ text: t('magic.requestFeature.button') }]
              );
            } else {
              Alert.alert(
                t('magic.requestFeature.errorTitle'),
                result.error || t('magic.requestFeature.errorMessage'),
                [{ text: t('common.ok') }]
              );
            }
          } catch (error) {
            Alert.alert(
              t('common.error'),
              t('magic.requestFeature.errorGeneric'),
              [{ text: t('common.ok') }]
            );
          }
        }
      },
      'plain-text',
      '',
      'Describe your feature idea here...'
    );
  }, [isPro]);

  // Handle bug report submission
  const handleBugReport = React.useCallback(async () => {
    Alert.prompt(
      t('magic.reportBug.title'),
      t('magic.reportBug.prompt'),
      async (text) => {
        if (text && text.trim()) {
          try {
            const result = await featureRequestService.submitRequest(text, undefined, isPro, 'bug');
            if (result.success) {
              Alert.alert(
                t('magic.reportBug.thankYouTitle'),
                t('magic.reportBug.thankYouMessage'),
                [{ text: t('magic.reportBug.button') }]
              );
            } else {
              Alert.alert(
                t('magic.reportBug.errorTitle'),
                result.error || t('magic.reportBug.errorMessage'),
                [{ text: t('common.ok') }]
              );
            }
          } catch (error) {
            Alert.alert(
              t('common.error'),
              t('magic.reportBug.errorGeneric'),
              [{ text: t('common.ok') }]
            );
          }
        }
      },
      'plain-text',
      '',
      'Describe the bug you encountered...'
    );
  }, [isPro]);

  // Memoize handlePress to prevent re-creation
  const handlePress = React.useCallback(async (item: CardItem) => {
    if (item.route === '/backgrounds' && onOpenBackgrounds) {
      onOpenBackgrounds();
      return;
    }
    if (item.route === '/clothes' && onOpenClothes) {
      onOpenClothes();
      return;
    }
    const functionType = item.functionType ?? 'restoration';
    const translatedTitle = t(item.titleKey);
    
    // PROMPT LOGGING: Track which feature card is selected
    console.log('🎯 FEATURE CARD SELECTED:', {
      id: item.id,
      title: translatedTitle,
      functionType: functionType,
      styleKey: item.styleKey
    });
    
    // Track feature tile selection
    analyticsService.trackTileUsage({
      category: 'feature',
      tileName: translatedTitle,
      tileId: item.id,
      functionType: functionType,
      styleKey: item.styleKey,
      stage: 'selected'
    });
    
    // Open native picker first, then open Quick Edit sheet prefilled
    // No permission check needed on iOS 11+ - PHPickerViewController handles privacy
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'], 
      allowsEditing: false, 
      quality: 1,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.CURRENT,
      exif: false
    });
    if (!result.canceled && result.assets[0]) {
      try {
        useQuickEditStore.getState().openWithImage({ 
          functionType, 
          imageUri: result.assets[0].uri, 
          styleKey: item.styleKey, 
          styleName: translatedTitle,
          customPrompt: item.customPrompt
        });
      } catch {}
    }
  }, [onOpenBackgrounds, onOpenClothes, router, t]);

  if (!compact) {
    return (
      <View style={{ paddingTop: 8, paddingBottom: 24 }}>
        {CARDS.map((c) => (
          <Card key={c.id} item={c} onPress={handlePress} />
        ))}
        
        {/* Request your idea & Report bug side-by-side cards */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, gap: 12 }}>
          {/* Request your idea card - smaller */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleRequestIdea}
            style={{ flex: 1 }}
          >
            <View style={{ 
              height: 140, 
              borderRadius: 18, 
              overflow: 'hidden', 
              borderWidth: 1.5, 
              borderColor: 'rgba(255,255,255,0.18)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 12
            }}>
              <LinearGradient
                colors={["rgba(255,255,255,0.06)", "transparent"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.6 }}
                style={{ position: 'absolute', inset: 0 }}
              />
              
              <View style={{ alignItems: 'center' }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10
                }}>
                  <IconSymbol name="lightbulb" size={20} color="#D4A574" />
                </View>
                <Text style={{ 
                  color: '#D4A574', 
                  fontSize: 16, 
                  fontFamily: 'Lexend-Bold', 
                  letterSpacing: -0.2,
                  marginBottom: 4,
                  textAlign: 'center'
                }}>
                  Request Idea
                </Text>
                <Text style={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  fontSize: 11,
                  textAlign: 'center',
                  marginBottom: 8
                }}>
                  Share your feature idea
                </Text>
                
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)'
                }}>
                  <IconSymbol name="envelope" size={12} color="#D4A574" />
                  <Text style={{ color: '#D4A574', fontSize: 11, fontFamily: 'Lexend-SemiBold' }}>
                    Send
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
          
          {/* Report bug card - smaller */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleBugReport}
            style={{ flex: 1 }}
          >
            <View style={{ 
              height: 140, 
              borderRadius: 18, 
              overflow: 'hidden', 
              borderWidth: 1.5, 
              borderColor: 'rgba(255,255,255,0.18)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 12
            }}>
              <LinearGradient
                colors={["rgba(255,255,255,0.06)", "transparent"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.6 }}
                style={{ position: 'absolute', inset: 0 }}
              />
              
              <View style={{ alignItems: 'center' }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10
                }}>
                  <IconSymbol name="ant" size={20} color="#C1A28A" />
                </View>
                <Text style={{ 
                  color: '#C1A28A', 
                  fontSize: 16, 
                  fontFamily: 'Lexend-Bold', 
                  letterSpacing: -0.2,
                  marginBottom: 4,
                  textAlign: 'center'
                }}>
                  Report Bug
                </Text>
                <Text style={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  fontSize: 11,
                  textAlign: 'center',
                  marginBottom: 8
                }}>
                  Found an issue? Tell us
                </Text>
                
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)'
                }}>
                  <IconSymbol name="exclamationmark.triangle" size={12} color="#C1A28A" />
                  <Text style={{ color: '#C1A28A', fontSize: 11, fontFamily: 'Lexend-SemiBold' }}>
                    Report
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Compact: show first item as Featured, rest as 2-column grid, larger text
  const [featured, ...rest] = CARDS;
  return (
    <View style={{ paddingTop: 8, paddingBottom: 24 }}>
      <Card item={featured} onPress={handlePress} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 }}>
        {rest.map((item) => {
          const cardWidth = isTabletLike ? '33.333%' : '50%';
          const scale = new Animated.Value(1);
          const onPressIn = () => {
            Animated.timing(scale, { toValue: 0.97, duration: 100, useNativeDriver: true }).start();
          };
          const onPressOut = () => {
            Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }).start();
          };
          const imageOpacity = new Animated.Value(0);
          const onImageLoad = () => {
            Animated.timing(imageOpacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
          };
          return (
            <TouchableOpacity key={item.id} activeOpacity={0.9} onPress={() => handlePress(item)} onPressIn={onPressIn} onPressOut={onPressOut} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole="button" accessibilityLabel={`${t(item.titleKey)} - Choose Photo`} style={{ width: cardWidth }}>
              <Animated.View style={{ marginHorizontal: 8, marginBottom: 14, borderRadius: 18, overflow: 'hidden', height: 200, transform: [{ scale }] }}>
                <Animated.View style={{ opacity: imageOpacity }}>
                  <ExpoImage source={item.image} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" priority="high" onLoad={onImageLoad} />
                </Animated.View>
                <LinearGradient colors={[ 'transparent', 'rgba(0,0,0,0.65)' ]} locations={[0, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' }} />
                <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'Lexend-Bold', letterSpacing: -0.3, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} numberOfLines={2}>
                    {t(item.titleKey)}
                  </Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginTop: 6 }}>
                    <IconSymbol name="camera" size={13} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: 'Lexend-Medium', marginLeft: 6 }}>Choose Photo</Text>
                  </View>
                </View>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}