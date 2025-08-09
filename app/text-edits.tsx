import { IconSymbol } from '@/components/ui/IconSymbol';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TextEditsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  // Get parameters from navigation
  const { imageUri, prompt: initialPrompt, mode } = params;
  
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [hasProcessed, setHasProcessed] = useState(false);
  
  useEffect(() => {
    // If we have an image and prompt from navigation, process it ONCE
    if (imageUri && initialPrompt && !hasProcessed) {
      setHasProcessed(true);
      processWithPrompt(imageUri as string, initialPrompt as string, mode as string);
    }
  }, [imageUri, initialPrompt, mode, hasProcessed]);

  const processWithPrompt = async (uri: string, prompt: string, editMode?: string) => {
    // Determine the function type based on mode
    let functionType: string = 'custom';
    
    if (editMode === 'outfit') {
      functionType = 'outfit';
    } else if (editMode === 'background') {
      functionType = 'background';
    } else if (editMode === 'backtolife') {
      functionType = 'backtolife';
    }
    
    if (functionType === 'backtolife') {
      // Start Back to Life directly (skip crop modal)
      const { useCropModalStore } = await import('@/store/cropModalStore');
      const { useBackToLife } = await import('@/hooks/useBackToLife');
      const store = useCropModalStore.getState();
      const backToLife = (useBackToLife as any)();
      store.setIsProcessing(true);
      store.setCurrentImageUri(uri);
      store.setProgress(1);
      store.setCanCancel(true);
      backToLife.mutate({ imageUri: uri, animationPrompt: prompt, imageSource: 'gallery' });
      return;
    }
    // Otherwise go to crop modal
    router.replace(`/crop-modal?imageUri=${encodeURIComponent(uri)}&functionType=${functionType}&customPrompt=${encodeURIComponent(prompt)}&imageSource=gallery`);
  };

  const openPicker = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: false, 
      quality: 1 
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };
  
  const handleProcessImage = () => {
    if (!selectedImage) {
      Alert.alert('No Image', 'Please select an image first');
      return;
    }
    
    if (!customPrompt.trim()) {
      Alert.alert('No Prompt', 'Please enter what you want to do with the image');
      return;
    }
    
    processWithPrompt(selectedImage, customPrompt, 'custom');
  };

  // If we came here with parameters, show loading
  if (imageUri && initialPrompt) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0F', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#EAEAEA', fontSize: 16 }}>Processing...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#0B0B0F' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#EAEAEA', fontSize: 28 }}>✕</Text>
        </TouchableOpacity>
        <Text style={{ color: '#EAEAEA', fontSize: 20, fontWeight: '800' }}>Custom AI Edit</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        <View style={{ marginTop: 20 }}>
          {selectedImage ? (
            <TouchableOpacity onPress={openPicker} style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
              <ExpoImage source={{ uri: selectedImage }} style={{ width: '100%', aspectRatio: 3/4 }} contentFit="cover" />
              <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Tap to change</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={openPicker} 
              style={{ 
                borderRadius: 24, 
                borderWidth: 2, 
                borderColor: 'rgba(255,255,255,0.12)', 
                borderStyle: 'dashed',
                aspectRatio: 3/4,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.02)'
              }}
            >
              <IconSymbol name="photo" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 12 }}>Select Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ marginTop: 30, marginBottom: 20 }}>
          <Text style={{ color: '#EAEAEA', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>What do you want to do?</Text>
          <View style={{ 
            borderRadius: 16, 
            borderWidth: 1, 
            borderColor: 'rgba(255,255,255,0.12)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            padding: 16
          }}>
            <TextInput
              style={{ 
                color: '#EAEAEA', 
                fontSize: 16,
                minHeight: 100,
                textAlignVertical: 'top'
              }}
              placeholder="Example: Change outfit to business suit, replace background with beach, add smile, fix lighting..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={customPrompt}
              onChangeText={setCustomPrompt}
              multiline
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Quick suggestions */}
        <View style={{ marginBottom: 100 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 12 }}>Try these:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              'Change to formal outfit',
              'Beach background',
              'Fix lighting',
              'Add smile',
              'Professional headshot',
              'Remove background'
            ].map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                onPress={() => setCustomPrompt(suggestion)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)'
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom action button */}
      <View style={{ 
        position: 'absolute', 
        left: 16, 
        right: 16, 
        bottom: (insets?.bottom || 0) + 10,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        padding: 6
      }}>
        <TouchableOpacity 
          onPress={selectedImage ? handleProcessImage : openPicker} 
          activeOpacity={0.95} 
          style={{ height: 50, borderRadius: 16, overflow: 'hidden' }}
        >
          <LinearGradient 
            colors={selectedImage ? ['#FF7A00', '#FFB54D'] : ['#FFB54D', '#FF7A00']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
          >
            <IconSymbol name={selectedImage ? 'wand.and.stars' : 'square.and.arrow.up'} size={18} color='#0B0B0F' />
            <Text style={{ color: '#0B0B0F', fontSize: 16, fontWeight: '900', marginLeft: 8 }}>
              {selectedImage ? 'Apply Edit' : 'Upload Image'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}