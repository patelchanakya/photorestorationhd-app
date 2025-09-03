import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useT } from '@/src/hooks/useTranslation';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Text, TouchableOpacity, View, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from './ui/IconSymbol';
import { featureRequestService } from '@/services/featureRequestService';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analyticsService } from '@/services/analytics';

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

// Helper: choose icon per function type
function getFunctionIcon(functionType?: CardItem['functionType']): string {
  switch (functionType) {
    case 'restoration':
      return 'wand.and.stars';
    case 'repair':
      return 'wrench.and.screwdriver';
    case 'descratch':
      return 'bandage';
    case 'unblur':
      return 'sparkles';
    case 'colorize':
      return 'paintpalette';
    case 'enlighten':
      return 'sun.max';
    default:
      return 'photo.on.rectangle';
  }
}

// Memoize individual card to prevent re-renders
const FeatureCardBase = ({ 
  item, 
  onPress 
}: { 
  item: CardItem; 
  onPress: (item: CardItem) => void;
}) => {
  const t = useT();
  return (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={() => onPress(item)}
    onPressIn={() => {
      try { Haptics.selectionAsync(); } catch {}
    }}
    style={{ marginHorizontal: 16, marginBottom: 14 }}
  >
    <Animated.View style={{ height: 240, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
      <ExpoImage 
        source={item.image} 
        style={{ width: '100%', height: '100%' }} 
        contentFit="cover"
        cachePolicy="memory-disk" // Enable aggressive caching
        priority="high" // High priority loading
        placeholderContentFit="cover"
        transition={0} // Disable transition to prevent flash
      />
      {/* Subtle top vignette to improve title contrast */}
      <LinearGradient
        colors={[ 'rgba(0,0,0,0.12)', 'transparent' ]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '20%' }}
      />
      <LinearGradient
        colors={[ 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.65)' ]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
      />
      <View style={{ position: 'absolute', left: 16, right: 56, bottom: 14 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontFamily: 'Lexend-Bold', letterSpacing: -0.3 }} numberOfLines={1}>
          {t(item.titleKey)}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4, lineHeight: 20 }} numberOfLines={2}>
          {t(item.subtitleKey)}
        </Text>
      </View>
      <View style={{ position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
        <IconSymbol name={getFunctionIcon(item.functionType) as any} size={16} color={'#FFFFFF'} />
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
            const result = await featureRequestService.submitRequest(text, undefined, isPro);
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
      quality: 1 
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
      
      {/* Request your idea card */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleRequestIdea}
        style={{ marginHorizontal: 16, marginBottom: 14 }}
      >
        <View style={{ 
          height: 180, 
          borderRadius: 22, 
          overflow: 'hidden', 
          borderWidth: 1.5, 
          borderColor: 'rgba(255,255,255,0.18)',
          backgroundColor: 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <LinearGradient
            colors={["rgba(255,255,255,0.06)", "transparent"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
            style={{ position: 'absolute', inset: 0 }}
          />
          
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12
            }}>
              <IconSymbol name="lightbulb" size={24} color="#F59E0B" />
            </View>
            <Text style={{ 
              color: '#F59E0B', 
              fontSize: 20, 
              fontFamily: 'Lexend-Bold', 
              letterSpacing: -0.3,
              marginBottom: 6
            }}>
              Request your idea
            </Text>
            <Text style={{ 
              color: 'rgba(255,255,255,0.7)', 
              fontSize: 13,
              textAlign: 'center',
              paddingHorizontal: 40
            }}>
              Have a feature in mind? Let us know!
            </Text>
          </View>
          
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.18)'
          }}>
            <IconSymbol name="envelope" size={14} color="#F59E0B" />
            <Text style={{ color: '#F59E0B', fontSize: 13, fontFamily: 'Lexend-SemiBold' }}>
              Send Request
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}