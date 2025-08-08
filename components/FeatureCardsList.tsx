import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

type CardItem = {
  id: string;
  title: string;
  subtitle: string;
  functionType?: 'restoration' | 'unblur' | 'colorize' | 'descratch';
  styleKey?: string;
  route?: string;
  image: any; // require('...')
};

// Poster-style cards inspired by the provided reference
const CARDS: CardItem[] = [
  { id: 'fc_enhance', title: 'Enhance', subtitle: 'Remove blur, sharpen, add details', functionType: 'unblur', image: require('../assets/images/onboarding/before-2.jpg') },
  { id: 'fc_colorize', title: 'Colorize', subtitle: 'Add colors to black‑and‑white photos', functionType: 'colorize', image: require('../assets/images/onboarding/after-4.png') },
  { id: 'fc_recreate', title: 'Recreate', subtitle: 'Recreate very damaged portraits', styleKey: 'recreate', image: require('../assets/images/onboarding/before-3.jpg') },
  { id: 'fc_combine', title: 'Combine', subtitle: 'Create common photo with ancestors', styleKey: 'combine', image: require('../assets/images/onboarding/after-3.png') },
  { id: 'fc_enlighten', title: 'Enlighten', subtitle: 'Correct lights on photo', styleKey: 'enlighten', image: require('../assets/images/onboarding/after-2.png') },
  { id: 'fc_change_bg', title: 'Change background', subtitle: 'Swap to studio, heavenly, vintage, more', route: '/backgrounds', image: require('../assets/images/onboarding/after-2.png') },
  { id: 'fc_change_clothes', title: 'Change clothes', subtitle: 'Formal, wedding, jersey, and more', route: '/clothes', image: require('../assets/images/onboarding/after-4.png') },
];

type FeatureCardsListProps = {
  onOpenBackgrounds?: () => void;
  onOpenClothes?: () => void;
};

// Memoize individual card to prevent re-renders
const Card = React.memo(({ 
  item, 
  onPress 
}: { 
  item: CardItem; 
  onPress: (item: CardItem) => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={() => onPress(item)}
    style={{ marginHorizontal: 16, marginBottom: 14 }}
  >
    <View style={{ height: 240, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
      <ExpoImage 
        source={item.image} 
        style={{ width: '100%', height: '100%' }} 
        contentFit="cover"
        cachePolicy="memory-disk" // Enable aggressive caching
        priority="high" // High priority loading
        placeholderContentFit="cover"
        transition={0} // Disable transition to prevent flash
      />
      <LinearGradient
        colors={[ 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.65)' ]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
      />
      <View style={{ position: 'absolute', left: 16, right: 56, bottom: 14 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900' }} numberOfLines={1}>{item.title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, marginTop: 4 }} numberOfLines={2}>{item.subtitle}</Text>
      </View>
      <View style={{ position: 'absolute', right: 12, bottom: 12, width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,213,0,0.8)' }}>
        <LinearGradient colors={[ '#FFD54D', '#FF8A00' ]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        <IconSymbol name={'chevron.right'} size={20} color={'#0B0B0F'} />
      </View>
    </View>
  </TouchableOpacity>
));

// Memoize the entire component - export as default function
export function FeatureCardsList({ 
  onOpenBackgrounds, 
  onOpenClothes 
}: FeatureCardsListProps) {
  const router = useRouter();

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
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: false, 
      quality: 1 
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const functionType = item.functionType ?? 'restoration';
      const styleKeyParam = item.styleKey ? `&styleKey=${encodeURIComponent(item.styleKey)}` : '';
      router.push(`/crop-modal?imageUri=${encodeURIComponent(uri)}&functionType=${functionType}&imageSource=gallery${styleKeyParam}`);
    }
  }, [onOpenBackgrounds, onOpenClothes, router]);

  return (
    <View style={{ paddingTop: 8, paddingBottom: 24 }}>
      {CARDS.map((c) => (
        <Card key={c.id} item={c} onPress={handlePress} />
      ))}
    </View>
  );
}