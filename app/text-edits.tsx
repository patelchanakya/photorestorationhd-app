import { IconSymbol } from '@/components/ui/IconSymbol';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TextEditsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const openPicker = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      router.push(`/crop-modal?imageUri=${encodeURIComponent(uri)}&functionType=restoration&styleKey=text_edits&imageSource=gallery`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#EAEAEA', fontSize: 28 }}>✕</Text>
        </TouchableOpacity>
        <Text style={{ color: '#EAEAEA', fontSize: 20, fontWeight: '800' }}>Custom AI Edit</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 80 }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <ExpoImage source={require('../assets/images/onboarding/after-4.png')} style={{ width: '100%', aspectRatio: 3/4 }} contentFit="cover" />
          </View>

          <Text style={{ color: '#EAEAEA', fontSize: 28, fontWeight: '800', marginTop: 22 }}>Custom AI Edits 💬</Text>
          <Text style={{ color: '#BFC3CF', fontSize: 16, marginTop: 8, lineHeight: 22 }}>Describe any change you want. We'll apply it to your photo.</Text>
        </View>
      </View>

      {/* Bottom pinned toolbar */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: (insets?.bottom || 0) + 10, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 6 }}>
        <TouchableOpacity onPress={openPicker} activeOpacity={0.95} style={{ height: 50, borderRadius: 16, overflow: 'hidden' }}>
          <LinearGradient colors={[ '#FFB54D', '#FF7A00' ]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
            <IconSymbol name={'square.and.arrow.up'} size={18} color={'#0B0B0F'} />
            <Text style={{ color: '#0B0B0F', fontSize: 16, fontWeight: '900', marginLeft: 8 }}>Upload an image</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}


