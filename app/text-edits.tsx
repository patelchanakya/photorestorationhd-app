import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { presentPaywall } from '@/services/revenuecat';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TextEditsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  // Note: isPro is not used directly here; using store getters inside processing flow
  
  // Get parameters from navigation
  const { imageUri, prompt: initialPrompt, mode } = params;
  
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [hasProcessed, setHasProcessed] = useState(false);
  const [category, setCategory] = useState<'All' | 'Memorial' | 'Creative' | 'Cleanup' | 'Style' | 'Looks'>('All');
  const [preserveIdentity, setPreserveIdentity] = useState(true);
  const [preserveComposition, setPreserveComposition] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const applyLockRef = useRef(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const photoRestoration = usePhotoRestoration();
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoTitle, setInfoTitle] = useState<string>('');
  const [infoText, setInfoText] = useState<string>('');
  
useEffect(() => {
  // If we have an image and prompt from navigation, process it ONCE
  if (imageUri && initialPrompt && !hasProcessed) {
    setHasProcessed(true);
    processWithPrompt(imageUri as string, initialPrompt as string, mode as string);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [imageUri, initialPrompt, mode, hasProcessed]);

  const processWithPrompt = useCallback(async (uri: string, prompt: string, editMode?: string) => {
    // CRITICAL: Gate Pro-only features before processing
    const proOnlyModes = ['outfit', 'background'];
    if (proOnlyModes.includes(editMode || '')) {
      const currentIsPro = useSubscriptionStore.getState().isPro;
      
      if (!currentIsPro) {
        console.log(`🔒 Photo Magic: Pro mode "${editMode}" requires subscription`);
        const success = await presentPaywall();
        
        if (!success) {
          console.log(`🔒 Photo Magic: Pro mode "${editMode}" cancelled - returning to previous screen`);
          router.back();
          return;
        }
        
        // Wait for listener to update subscription state
        await new Promise(resolve => setTimeout(resolve, 1000));
        const updatedIsPro = useSubscriptionStore.getState().isPro;
        
        if (!updatedIsPro) {
          Alert.alert('Purchase Error', 'Please try again or restore purchases if you already have a subscription.');
          router.back();
          return;
        }
        
        console.log(`✅ Photo Magic: Pro mode "${editMode}" unlocked after purchase`);
      } else {
        console.log(`✅ Photo Magic: Pro mode "${editMode}" - user already has Pro access`);
      }
    }
    // Determine the function type based on mode
    let functionType: any = 'custom';
    if (editMode === 'outfit') functionType = 'outfit';
    else if (editMode === 'background') functionType = 'background';

    // Local loading UI with progress simulation
    setIsLoading(true);
    setProgress(0);
    const start = Date.now();
    const estMs = 10000;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(95, Math.floor((elapsed / estMs) * 95));
      setProgress(p);
    }, 500);
    try {
      const result = await photoRestoration.mutateAsync({ imageUri: uri, functionType, imageSource: 'gallery', customPrompt: prompt });
      clearInterval(timer);
      setProgress(100);
      setTimeout(() => {
        setIsLoading(false);
        router.replace(`/restoration/${result.id}`);
      }, 300);
    } catch (err: any) {
      clearInterval(timer);
      setIsLoading(false);
      Alert.alert('Processing Failed', err?.message || 'Something went wrong. Please try again.');
    }
  }, [router, photoRestoration]);

  const openPicker = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'], 
      allowsEditing: false, 
      quality: 1 
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  // Curated prompt templates aligned with FLUX Kontext best practices
  type Suggestion = {
    label: string;
    icon: string;
    category: 'Memorial' | 'Creative' | 'Cleanup' | 'Style' | 'Looks';
    template: string;
    opensEditor?: boolean; // if true, reveal editor when selected
    prefill?: string; // default text to prefill editor
  };
  const SUGGESTIONS: Suggestion[] = [
    // Memorial
    { label: 'Add angel wings', icon: 'bird', category: 'Memorial', template: 'Add soft, white angel wings behind the subject to create a gentle memorial look.' },
    { label: 'Add halo', icon: 'circle.dashed', category: 'Memorial', template: 'Add a subtle glowing halo above the subject’s head.' },
    { label: 'Gentle memorial glow', icon: 'sun.max', category: 'Memorial', template: 'Add a soft, warm glow around the subject with light bloom for a memorial feel.' },
    { label: 'Add doves', icon: 'bird', category: 'Memorial', template: 'Add a few soft white doves near the subject for a peaceful memorial touch.' },
    { label: 'Memorial text ribbon', icon: 'bookmark', category: 'Memorial', template: 'Add a small memorial ribbon and tasteful memorial text in the corner.', opensEditor: true, prefill: 'In Loving Memory' },

    // Creative
    { label: 'Butterflies', icon: 'leaf', category: 'Creative', template: 'Add a few colorful butterflies around the subject, keeping them subtle and tasteful.' },
    { label: 'Golden hour rays', icon: 'sun.max', category: 'Creative', template: 'Add gentle golden hour light rays from the side, keeping the subject natural.' },
    { label: 'Sparkles', icon: 'sparkles', category: 'Creative', template: 'Add a few soft sparkles around the subject without overpowering the scene.' },
    { label: 'Portrait bokeh', icon: 'circle.dashed', category: 'Creative', template: 'Add a subtle portrait bokeh effect to the background, keeping the subject crisp.' },

    // Cleanup
    { label: 'Remove background objects', icon: 'scissors', category: 'Cleanup', template: 'Remove distracting background objects while keeping the subject untouched.' },
    { label: 'Remove person in background', icon: 'photo', category: 'Cleanup', template: 'Remove a person in the background while keeping the main subject and composition unchanged.' },
    { label: 'Remove watermark/logo', icon: 'square', category: 'Cleanup', template: 'Remove a watermark or logo cleanly while preserving surrounding details.' },
    { label: 'Remove date stamp', icon: 'pencil.tip', category: 'Cleanup', template: 'Remove any date stamp or overlay text cleanly from the image.' },

    // Style
    { label: 'Vintage look', icon: 'camera.filters', category: 'Style', template: 'Apply a subtle vintage film look with soft contrast and warm tones.' },
    { label: 'Pencil sketch, detailed', icon: 'pencil.tip', category: 'Style', template: 'Convert to pencil sketch with natural graphite lines, cross-hatching, and visible paper texture.' },
    { label: 'Oil painting, rich texture', icon: 'paintpalette', category: 'Style', template: 'Transform to oil painting with visible brushstrokes, thick paint texture, and rich color depth while preserving the original composition and object placement.' },
    { label: 'Bauhaus style (preserve layout)', icon: 'square.grid.2x2', category: 'Style', template: 'Change to Bauhaus art style while maintaining the original composition and object placement.' },

    // Looks (common requests)
    { label: 'Remove acne', icon: 'bandage', category: 'Looks', template: 'Remove acne and blemishes while keeping natural skin texture.' },
    { label: 'Even skin tone', icon: 'sparkles', category: 'Looks', template: 'Even out skin tone gently while preserving natural detail.' },
    { label: 'Smooth skin', icon: 'sparkles', category: 'Looks', template: 'Gently smooth skin while preserving pores and details.' },
    { label: 'Whiten teeth', icon: 'mouth', category: 'Looks', template: 'Whiten teeth naturally without over-brightening.' },
    { label: 'Brighten eyes', icon: 'eye', category: 'Looks', template: 'Slightly brighten the eyes and enhance clarity.' },
    { label: 'Add smile', icon: 'face.smiling', category: 'Looks', template: 'Add a gentle, natural smile to the subject.' },
    { label: 'Subtle makeup', icon: 'face.smiling', category: 'Looks', template: 'Apply very subtle, natural-looking makeup enhancement.' },
    { label: 'Fix flyaway hair', icon: 'wand.and.stars', category: 'Looks', template: 'Clean up flyaway hairs while keeping hair texture natural.' },
    { label: 'Slimmer look', icon: 'person', category: 'Looks', template: 'Make the subject look slightly slimmer in a natural, realistic way.' },
    { label: 'Younger look', icon: 'clock', category: 'Looks', template: 'Make the subject appear a bit younger while keeping their identity the same.' },
    { label: 'Older look', icon: 'clock', category: 'Looks', template: 'Make the subject appear a bit older while keeping their identity the same.' },
  ];

  const compositionClause = ' Keep the exact camera angle, subject position, scale, and framing. Only replace the environment.';
  const identityClause = ' Maintain the same facial features, hairstyle, and expression.';

  const handleSuggestionPress = (label: string) => {
    try { Haptics.selectionAsync(); } catch {}
    const s = SUGGESTIONS.find(x => x.label === label);
    setSelectedLabels((prev) => {
      const already = prev.includes(label);
      const next = already ? prev.filter(l => l !== label) : [...prev, label];
      if (!already && s?.opensEditor) {
        // Selecting a text-based preset: open editor and prefill
        setShowAdvanced(true);
        if (s.prefill) {
          setCustomPrompt(s.prefill);
        }
      } else if (already && s?.opensEditor) {
        // Deselecting a text-based preset: clear and collapse
        setCustomPrompt('');
        setShowAdvanced(false);
      }
      if (__DEV__) {
        console.log('🪄 Photo Magic - toggle preset:', label, '→ selected:', next);
      }
      return next;
    });
  };

  const handleSuggestionLongPress = (label: string) => {
    const s = SUGGESTIONS.find(x => x.label === label);
    setInfoTitle(label);
    setInfoText(s?.template || 'More details coming soon.');
    setInfoVisible(true);
  };

  const buildPromptFromSelections = (): string => {
    // Only include custom text if a text-based preset is selected
    const textPresetSelected = selectedLabels.some(l => {
      const s = SUGGESTIONS.find(x => x.label === l);
      return !!s?.opensEditor;
    });
    if (textPresetSelected && showAdvanced && customPrompt.trim()) {
      return customPrompt.trim();
    }
    const chosen = (category === 'All' ? SUGGESTIONS : SUGGESTIONS).filter(s => selectedLabels.includes(s.label));
    if (chosen.length === 0) return '';
    let merged = chosen.map(s => s.template).join(' ');
    if (preserveComposition && !/camera angle|framing|position|scale/i.test(merged)) {
      merged += compositionClause;
    }
    if (preserveIdentity && !/facial features|identity|hairstyle|expression/i.test(merged)) {
      merged += identityClause;
    }
    if (__DEV__) {
      console.log('🧠 Photo Magic - built prompt:', {
        presets: selectedLabels,
        preserveIdentity,
        preserveComposition,
        length: merged.length,
        preview: merged.slice(0, 160) + (merged.length > 160 ? '…' : ''),
      });
    }
    return merged.trim();
  };
  
  const handleProcessImage = async () => {
    if (isSubmitting || isLoading || applyLockRef.current) return;
    if (!selectedImage) {
      Alert.alert('No Image', 'Please select an image first');
      return;
    }
    const finalPrompt = buildPromptFromSelections();
    if (!finalPrompt) {
      Alert.alert('Select edits', 'Please select at least 1 preset or write a custom edit.');
      return;
    }
    if (__DEV__) {
      console.log('🚀 Photo Magic - starting apply:', {
        selectedImage,
        selectedLabels,
        preserveIdentity,
        preserveComposition,
        promptLen: finalPrompt.length,
        promptPreview: finalPrompt.slice(0, 160) + (finalPrompt.length > 160 ? '…' : ''),
      });
    }
    setIsSubmitting(true);
    applyLockRef.current = true;
    try {
      await processWithPrompt(selectedImage, finalPrompt, 'custom');
    } catch {
      // error surfaced inside processWithPrompt already
    } finally {
      setIsSubmitting(false);
      // slight delay to avoid re-entry during transition
      setTimeout(() => { applyLockRef.current = false; }, 500);
    }
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
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 6, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#EAEAEA', fontSize: 28 }}>✕</Text>
        </TouchableOpacity>
        <Text style={{ color: '#EAEAEA', fontSize: 20, fontWeight: '800' }}>Photo Magic</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: -2, marginBottom: 8, textAlign: 'center' }}>
          Write your own edit or use the presets.
        </Text>
      </View>
      

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        <View style={{ marginTop: 20 }}>
          {selectedImage ? (
            <TouchableOpacity onPress={openPicker} style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', height: 160, backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <ExpoImage source={{ uri: selectedImage }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Tap to change</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={openPicker} 
              style={{ 
                borderRadius: 20, 
                borderWidth: 1, 
                borderColor: 'rgba(255,255,255,0.12)', 
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.04)',
                height: 140
              }}
            >
              <IconSymbol name="photo.on.rectangle" size={32} color="rgba(255,255,255,0.5)" />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 8 }}>Select Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ marginTop: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: '#EAEAEA', fontSize: 16, fontWeight: '600' }}>Quick presets</Text>
            <TouchableOpacity onPress={() => setShowAdvanced(!showAdvanced)} accessibilityLabel="Write your own" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {!showAdvanced && <IconSymbol name="pencil" size={14} color="rgba(255,255,255,0.6)" />}
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' }}>
                {showAdvanced ? 'Done' : 'Write your own'}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Selected tags summary */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {selectedLabels.length === 0 ? (
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Pick presets below or write custom edits.</Text>
            ) : (
              selectedLabels.map((label) => (
                <TouchableOpacity key={label} onPress={() => handleSuggestionPress(label)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: '#F59E0B' }}>
                  <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700' }}>{label} ✕</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Custom prompt (hidden by default) */}
          {showAdvanced && (
            <BlurView intensity={20} tint="dark" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <View style={{ 
                borderRadius: 16, 
                borderWidth: 1, 
                borderColor: 'rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(255,255,255,0.06)',
                padding: 16
              }}>
                <TextInput
                  style={{ 
                    color: '#EAEAEA', 
                    fontSize: 16,
                    minHeight: 100,
                    textAlignVertical: 'top'
                  }}
                  placeholder="Describe what you want to change..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={customPrompt}
                  onChangeText={setCustomPrompt}
                  multiline
                  autoCorrect={false}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{customPrompt.length}/512</Text>
                  {customPrompt.length > 0 && (
                    <TouchableOpacity onPress={() => setCustomPrompt('')}>
                      <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </BlurView>
          )}
        </View>

        {/* Editing helpers */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {[
            { key: 'identity', label: 'Preserve identity', value: preserveIdentity, setter: setPreserveIdentity },
            { key: 'composition', label: 'Keep composition', value: preserveComposition, setter: setPreserveComposition },
          ].map(({ key, label, value, setter }) => (
            <TouchableOpacity
              key={key}
              onPress={() => { try { Haptics.selectionAsync(); } catch {} setter(!value); }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 18,
                backgroundColor: value ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: value ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6
              }}
            >
              <IconSymbol name={value ? 'checkmark.circle' : 'circle'} size={14} color={value ? '#F59E0B' : 'rgba(255,255,255,0.8)'} />
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category filter */}
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['All','Memorial','Creative','Cleanup','Style','Looks'] as const).map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => { try { Haptics.selectionAsync(); } catch {} setCategory(c); }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 18,
                  backgroundColor: category === c ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: category === c ? '#F59E0B' : 'rgba(255,255,255,0.12)'
                }}
              >
                <Text style={{ color: category === c ? '#F59E0B' : 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: category === c ? '700' : '500' }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Suggestions grid */}
        <View style={{ marginBottom: 100 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 6 }}>Try these:</Text>
          {selectedLabels.length > 0 && (
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginBottom: 6 }}>Selected: {selectedLabels.length}</Text>
          )}
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 12 }}>Tap to select • Long‑press for info</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {(category === 'All' ? SUGGESTIONS : SUGGESTIONS.filter(s => s.category === category)).map(({ label, icon }) => (
              <TouchableOpacity
                key={label}
                onPress={() => handleSuggestionPress(label)}
                onLongPress={() => handleSuggestionLongPress(label)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: selectedLabels.includes(label) ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: selectedLabels.includes(label) ? '#F59E0B' : 'rgba(255,255,255,0.12)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <IconSymbol name={icon as any} size={16} color={selectedLabels.includes(label) ? '#F59E0B' : 'rgba(255,255,255,0.9)'} />
                <Text style={{ color: selectedLabels.includes(label) ? '#F59E0B' : 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Local loading overlay */}
      {isLoading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(12,12,14,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', minWidth: 220, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Enhancing your photo…</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6 }}>This usually takes 5–10 seconds</Text>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 12, alignSelf: 'stretch' }}>
              <View style={{ width: `${progress}%`, height: '100%', backgroundColor: '#F59E0B' }} />
            </View>
          </View>
        </View>
      )}

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
        {(() => {
          const canApply = !!selectedImage && !isSubmitting && !isLoading && selectedLabels.length > 0;
          return (
            <TouchableOpacity 
              onPress={handleProcessImage}
              activeOpacity={canApply ? 0.95 : 1} 
              disabled={!canApply}
              style={{ height: 50, borderRadius: 16, overflow: 'hidden', opacity: canApply ? 1 : 0.5 }}
              accessibilityState={{ disabled: !canApply }}
            >
              {selectedImage ? (
                <LinearGradient 
                  colors={['#F59E0B', '#FBBF24']} 
                  start={{ x: 0, y: 0 }} 
                  end={{ x: 1, y: 1 }} 
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
                >
                  <IconSymbol name='wand.and.stars' size={18} color='#0B0B0F' />
                  <Text style={{ color: '#0B0B0F', fontSize: 16, fontWeight: '900', marginLeft: 8 }}>
                    {isSubmitting || isLoading ? 'Processing…' : 'Apply Edits'}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <IconSymbol name='photo' size={18} color='rgba(255,255,255,0.7)' />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '700', marginLeft: 8 }}>Select Photo Above</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })()}
      </View>

      {/* Long-press info sheet */}
      <BottomSheet visible={infoVisible} onDismiss={() => setInfoVisible(false)} maxHeightPercent={0.65}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 6 }}>{infoTitle}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 }}>{infoText}</Text>
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}