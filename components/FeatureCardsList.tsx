import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

type CardItem = {
  id: string;
  title: string;
  subtitle: string;
  functionType?: 'restoration' | 'unblur' | 'colorize' | 'descratch' | 'enlighten';
  styleKey?: string;
  route?: string;
  image: any; // require('...')
};

// Poster-style cards inspired by the provided reference
const CARDS: CardItem[] = [
  { id: 'fc_restore', title: 'Restore', subtitle: 'Fix damage, tears & fading', functionType: 'restoration', image: require('../assets/images/onboarding/before-3.jpg') },
  { id: 'fc_descratch', title: 'Descratch', subtitle: 'Remove scratches & marks', functionType: 'descratch', image: require('../assets/images/onboarding/before-2.jpg') },
  { id: 'fc_enhance', title: 'Enhance', subtitle: 'Remove blur, sharpen details', functionType: 'unblur', image: require('../assets/images/onboarding/before-2.jpg') },
  { id: 'fc_colorize', title: 'Colorize', subtitle: 'Add colors to B&W photos', functionType: 'colorize', image: require('../assets/images/onboarding/after-4.png') },
  { id: 'fc_enlighten', title: 'Enlighten', subtitle: 'Fix lighting & exposure', functionType: 'enlighten', image: require('../assets/images/onboarding/after-2.png') },
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
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>{item.title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 }} numberOfLines={2}>{item.subtitle}</Text>
      </View>
      <View style={{ position: 'absolute', right: 12, bottom: 12, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <IconSymbol name={'photo.stack'} size={16} color={'#FFFFFF'} />
      </View>
    </View>
  </TouchableOpacity>
));

// Handle request idea email
async function handleRequestIdea() {
  try {
    const subject = 'Clever - Feature Request';
    const body = `Hi Clever team!

I'd love to see this feature added to the app:

[Describe your feature idea here - e.g., "Remove background", "Change hair color", "Age progression", etc.]

Why I want this:
[Tell us why this would be useful]

Thanks!`;

    const mailUrl = `mailto:photorestorationhd@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    const canOpen = await Linking.canOpenURL(mailUrl);
    if (canOpen) {
      await Linking.openURL(mailUrl);
    } else {
      Alert.alert(
        'Contact Us',
        'Please email us at: photorestorationhd@gmail.com',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    Alert.alert(
      'Contact Us',
      'Please email us at: photorestorationhd@gmail.com',
      [{ text: 'OK' }]
    );
  }
}

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
          borderColor: 'rgba(249,115,22,0.3)',
          backgroundColor: '#0b0b0f',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <LinearGradient
            colors={['rgba(249,115,22,0.05)', 'rgba(249,115,22,0.15)']}
            style={{ position: 'absolute', inset: 0 }}
          />
          
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(249,115,22,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12
            }}>
              <IconSymbol name="lightbulb" size={24} color="#f97316" />
            </View>
            <Text style={{ 
              color: '#f97316', 
              fontSize: 20, 
              fontWeight: '700', 
              letterSpacing: -0.3,
              marginBottom: 6
            }}>
              Request your idea
            </Text>
            <Text style={{ 
              color: 'rgba(255,255,255,0.6)', 
              fontSize: 13,
              textAlign: 'center',
              paddingHorizontal: 40
            }}>
              Have a feature in mind? Let us know!
            </Text>
          </View>
          
          <View style={{
            backgroundColor: 'rgba(249,115,22,0.2)',
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6
          }}>
            <IconSymbol name="envelope" size={14} color="#f97316" />
            <Text style={{ color: '#f97316', fontSize: 13, fontWeight: '600' }}>
              Send Request
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}