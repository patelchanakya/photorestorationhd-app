import { DeviceTwoRowCarousel } from '@/components/DeviceTwoRowCarousel';
import { IconSymbol } from '@/components/ui/IconSymbol';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeGalleryLikeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>Clever</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={{ backgroundColor: '#ef4444', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>PRO</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <IconSymbol name="gear" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Enhance section title */}
      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>Enhance ✨</Text>
        <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
          <IconSymbol name="rectangle.stack" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Two-row horizontally scrolling device photos */}
      <View style={{ paddingBottom: 10 }}>
        <DeviceTwoRowCarousel functionType="restoration" />
      </View>

      {/* Section tiles (placeholder unique design) */}
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: '#0f0f0f', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Restore</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Fix damage and enhance clarity</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, backgroundColor: '#0f0f0f', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Unblur</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Sharpen faces and details</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 10 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: '#0f0f0f', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Colorize</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Add life to black-and-white</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, backgroundColor: '#0f0f0f', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Descratch</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Remove scratches and dust</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}


