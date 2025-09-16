import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useQuickEditStore } from '@/store/quickEditStore';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

type Mode = 'restoration' | 'unblur' | 'colorize' | 'descratch';

const MODES: { key: Mode; label: string; icon: string }[] = [
  { key: 'restoration', label: 'Repair', icon: 'wand.and.stars' },
  { key: 'unblur', label: 'Unblur', icon: 'eye' },
  { key: 'colorize', label: 'Colorize', icon: 'paintbrush' },
  { key: 'descratch', label: 'Descratch', icon: 'bandage' },
];

export function ModeChips() {

  const openPicker = async (mode: Mode) => {
    try {
      // Launch photo picker - works with limited access even if permissions denied
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
        exif: false,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        useQuickEditStore.getState().openWithImage({ 
          functionType: mode as any, 
          imageUri: uri 
        });
      }
    } catch (e) {
      if (__DEV__) console.error('ModeChips picker error:', e);
    }
  };

  return (
    <View style={{ paddingVertical: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => openPicker(m.key)}
            activeOpacity={0.9}
            style={{ flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
          >
            <IconSymbol name={m.icon as any} size={18} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: 'Lexend-Bold', fontSize: 14, marginLeft: 8 }}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}


