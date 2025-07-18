import { IconSymbol } from '@/components/ui/IconSymbol';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function MinimalCameraWithGalleryButton() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();

  useEffect(() => {
    if (!permission) return;
    if (permission.status === 'undetermined') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 18 }}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (permission.status === 'denied') {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <IconSymbol name="camera" size={64} color="#fff" />
        <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 16, marginBottom: 8 }}>Camera Permission Denied</Text>
        <Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginBottom: 24 }}>
          Please enable camera permission in your device settings.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{ backgroundColor: '#f97316', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 999 }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Request Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (permission.status === 'granted') {
    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <CameraView style={{ flex: 1 }} />
        {/* Gallery Button Overlay (no navigation) */}
        <TouchableOpacity
          onPress={() => router.push('/gallery-modal')}
          style={{ position: 'absolute', left: 24, bottom: 32, width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
        >
          <IconSymbol name="photo" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}