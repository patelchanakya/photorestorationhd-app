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
import { Alert, Animated, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

type CardItem = {
  id: string;
  titleKey: string; // Translation key for title
  subtitleKey: string; // Translation key for subtitle
  functionType?: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'restore_repair' | 'water_damage';
  styleKey?: string;
  route?: string;
  image: any; // require('...')
};

// Poster-style cards inspired by the provided reference
const CARDS: CardItem[] = [
  { id: 'fc_water_stain', titleKey: 'magic.waterDamage.title', subtitleKey: 'magic.waterDamage.subtitle', functionType: 'water_damage', image: require('../assets/images/popular/stain/pop-7.png') },
  { id: 'fc_enhance', titleKey: 'magic.clarify.title', subtitleKey: 'magic.clarify.subtitle', functionType: 'unblur', image: require('../assets/images/popular/enhance/pop-3.png') },
  { id: 'fc_recreate', titleKey: 'magic.recreate.title', subtitleKey: 'magic.recreate.subtitle', functionType: 'repair', image: require('../assets/images/popular/recreate/pop-5.png') },
  { id: 'fc_colorize', titleKey: 'magic.colorize.title', subtitleKey: 'magic.colorize.subtitle', functionType: 'colorize', image: require('../assets/images/popular/colorize/pop-1.png') },
  { id: 'fc_descratch', titleKey: 'magic.descratch.title', subtitleKey: 'magic.descratch.subtitle', functionType: 'descratch', image: require('../assets/images/popular/descratch/pop-2.png') },
  { id: 'fc_enlighten', titleKey: 'magic.brighten.title', subtitleKey: 'magic.brighten.subtitle', functionType: 'enlighten', image: require('../assets/images/popular/brighten/pop-4.png') },
];

type FeatureCardsListProps = {
  onOpenBackgrounds?: () => void;
  onOpenClothes?: () => void;
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
      {/* Enhanced top gradient for superior text contrast */}
      <LinearGradient
        colors={[ 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'transparent' ]}
        locations={[0, 0.6, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '45%' }}
      />
      {/* Bottom gradient for action bar */}
      <LinearGradient
        colors={[ 'transparent', 'rgba(0,0,0,0.8)' ]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%' }}
      />
      
      {/* Enhanced title and subtitle with better readability */}
      <View style={{ 
        position: 'absolute', 
        left: 18, 
        right: 18, 
        top: 18,
        backgroundColor: 'transparent' // Add solid background for shadow efficiency
      }}>
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 23, 
          fontFamily: 'Lexend-Bold', 
          letterSpacing: -0.4,
          textShadowColor: 'rgba(0,0,0,0.8)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
          marginBottom: 4
        }} numberOfLines={1}>
          {t(item.titleKey)}
        </Text>
        <Text style={{ 
          color: 'rgba(255,255,255,0.95)', 
          fontSize: 14, 
          fontFamily: 'Lexend-Medium',
          lineHeight: 20,
          textShadowColor: 'rgba(0,0,0,0.7)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
          letterSpacing: -0.1
        }} numberOfLines={2}>
          {t(item.subtitleKey)}
        </Text>
      </View>
      
      {/* Refined bottom action bar with enhanced visual appeal */}
      <View style={{ 
        position: 'absolute', 
        left: 18, 
        right: 18, 
        bottom: 18,
        backgroundColor: 'transparent' // Add solid background for shadow efficiency
      }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: 'transparent', 
          paddingHorizontal: 18, 
          paddingVertical: 12, 
          borderRadius: 14
        }}>
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 15, 
            fontFamily: 'Lexend-SemiBold', 
            marginRight: 10,
            letterSpacing: -0.2,
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2
          }}>
            Tap to select photo
          </Text>
          <IconSymbol name="arrow.right" size={17} color={'#FFFFFF'} />
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
  onOpenClothes 
}: FeatureCardsListProps) {
  const router = useRouter();
  const { isPro } = useRevenueCat();
  const t = useT();

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
    const translatedSubtitle = t(item.subtitleKey);
    
    // PROMPT LOGGING: Track which feature card is selected
    console.log('🎯 FEATURE CARD SELECTED:', {
      id: item.id,
      title: translatedTitle,
      subtitle: translatedSubtitle,
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
        useQuickEditStore.getState().openWithImage({ functionType, imageUri: result.assets[0].uri, styleKey: item.styleKey, styleName: translatedTitle });
      } catch {}
    }
  }, [onOpenBackgrounds, onOpenClothes, router, t]);

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