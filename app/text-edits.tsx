import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { presentPaywall, validatePremiumAccess } from '@/services/revenuecat';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// New components
import { ImageSelector } from '@/components/PhotoMagic/ImageSelector';
import { CategoryTabs } from '@/components/PhotoMagic/CategoryTabs';
import { PresetCard } from '@/components/PhotoMagic/PresetCard';

export default function TextEditsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  // Note: isPro is not used directly here; using store getters inside processing flow
  
  // Get parameters from navigation
  const { imageUri, prompt: initialPrompt, mode, fromUpload } = params;
  
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [hasProcessed, setHasProcessed] = useState(false);
  const [category, setCategory] = useState<'All' | 'Memorial' | 'Creative' | 'Cleanup' | 'Style' | 'Looks'>('All');
  const [preserveIdentity] = useState(true);
  const [preserveComposition] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const applyLockRef = useRef(false);
  const [editMode, setEditMode] = useState<'presets' | 'custom'>('presets');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const photoRestoration = usePhotoRestoration();
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoTitle, setInfoTitle] = useState<string>('');
  const [infoText, setInfoText] = useState<string>('');
  
  // Animation for loading spinner
  const spinValue = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value}deg` }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));
  
useEffect(() => {
  // If we have an image from upload, set it as selected
  if (imageUri && fromUpload && !selectedImage) {
    setSelectedImage(imageUri as string);
  }
  
  // If we have an image and prompt from navigation, process it ONCE
  if (imageUri && initialPrompt && !hasProcessed) {
    setHasProcessed(true);
    processWithPrompt(imageUri as string, initialPrompt as string, mode as string);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [imageUri, initialPrompt, mode, hasProcessed, fromUpload, selectedImage]);


  const processWithPrompt = useCallback(async (uri: string, prompt: string, editMode?: string) => {
    // CRITICAL: Gate Pro-only features before processing
    const proOnlyModes = ['outfit', 'background'];
    if (proOnlyModes.includes(editMode || '')) {
      const currentIsPro = await validatePremiumAccess();
      
      if (!currentIsPro) {
        console.log(`🔒 Photo Magic: Pro mode "${editMode}" requires subscription`);
        const success = await presentPaywall();
        
        if (!success) {
          console.log(`🔒 Photo Magic: Pro mode "${editMode}" cancelled - returning to previous screen`);
          router.back();
          return;
        }
        
        // Verify purchase completion with fresh RevenueCat check
        const updatedIsPro = await validatePremiumAccess();
        
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

    // Store text-edit context for recovery
    await AsyncStorage.setItem('activeTextEditContext', JSON.stringify({
      mode: 'text-edits',
      timestamp: Date.now(),
      prompt: prompt.substring(0, 100), // Store preview of prompt for logging
      functionType
    }));
    
    if (__DEV__) {
      console.log('📝 [TEXT-EDIT] Stored context for recovery:', {
        mode: 'text_edits',
        functionType,
        prompt_preview: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
      });
    }

    // Show loading UI
    setIsLoading(true);
    
    try {
      const result = await photoRestoration.mutateAsync({ imageUri: uri, functionType, imageSource: 'gallery', customPrompt: prompt });
      
      // Clear text-edit context on successful completion since we're navigating away
      await AsyncStorage.removeItem('activeTextEditContext');
      
      if (__DEV__) {
        console.log('📝 [TEXT-EDIT] Cleared context after successful completion');
      }
      
      setIsLoading(false);
      router.replace(`/restoration/${result.id}`);
    } catch (err: any) {
      setIsLoading(false);
      
      // Clear text-edit context on error - recovery will handle this if needed
      await AsyncStorage.removeItem('activeTextEditContext');
      
      if (__DEV__) {
        console.log('📝 [TEXT-EDIT] Cleared context after error');
      }
      
      // Handle photo limit exceeded error with user-friendly message
      let errorTitle = 'Processing Failed';
      let errorMessage = 'Something went wrong. Please try again.';
      
      if (err?.message?.includes('PHOTO_LIMIT_EXCEEDED') || err?.code === 'PHOTO_LIMIT_EXCEEDED') {
        errorTitle = 'Daily Limit Reached';
        errorMessage = 'You\'ve reached your daily photo editing limit. Please try again tomorrow or upgrade to Pro for unlimited edits.';
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      Alert.alert(errorTitle, errorMessage);
    }
  }, [router, photoRestoration, spinValue]);

  const handleImageSelected = (uri: string) => {
    setSelectedImage(uri);
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
    // Cleanup - Essential fixes for social media sharing
    { label: 'Remove watermark/logo', icon: 'square', category: 'Cleanup', template: 'Remove a watermark or logo cleanly while preserving surrounding details.' },
    { label: 'Remove date stamp', icon: 'pencil.tip', category: 'Cleanup', template: 'Remove any date stamp or overlay text cleanly from the image.' },
    { label: 'Fix red eyes', icon: 'eye.fill', category: 'Cleanup', template: 'Fix red-eye effect from camera flash, restoring natural eye color.' },
    { label: 'Sharpen photo', icon: 'viewfinder', category: 'Cleanup', template: 'Enhance image sharpness and clarity, especially for blurry or soft photos.' },

    // Looks - Portrait enhancements for social media
    { label: 'Perfect selfie', icon: 'person.crop.circle.fill', category: 'Looks', template: 'Overall face enhancement for social media: smooth skin, brighten face, enhance features naturally.' },
    { label: 'Smooth skin', icon: 'sparkles', category: 'Looks', template: 'Gently smooth skin while preserving pores and details.' },
    { label: 'Whiten teeth', icon: 'mouth', category: 'Looks', template: 'Whiten teeth naturally without over-brightening.' },
    { label: 'Brighten smile', icon: 'face.smiling', category: 'Looks', template: 'Enhance smile and teeth brightness for a more confident look.' },

    // Creative - Popular social media effects
    { label: 'Golden hour rays', icon: 'sun.max', category: 'Creative', template: 'Add gentle golden hour light rays from the side, keeping the subject natural.' },
    { label: 'Add warm glow', icon: 'sun.min', category: 'Creative', template: 'Add a soft, warm Instagram-style glow around the subject for social media appeal.' },
    { label: 'Blur background', icon: 'circle.dashed', category: 'Creative', template: 'Add a subtle background blur effect, keeping the subject crisp.' },
    { label: 'Add sunset colors', icon: 'sunset', category: 'Creative', template: 'Apply warm sunset color grading with golden and orange tones.' },
    { label: 'Butterflies', icon: 'leaf', category: 'Creative', template: 'Add a few colorful butterflies around the subject, keeping them subtle and tasteful.' },
    { label: 'Sparkles', icon: 'sparkles', category: 'Creative', template: 'Add a few soft sparkles around the subject without overpowering the scene.' },
    { label: 'White background', icon: 'square.fill', category: 'Creative', template: 'Replace background with clean white background, perfect for professional photos and social media.' },
    { label: 'Add soft focus', icon: 'camera.filters', category: 'Creative', template: 'Apply dreamy soft focus effect around the edges while keeping the subject sharp.' },

    // Memorial - Respectful memorial enhancements
    { label: 'Gentle memorial glow', icon: 'sun.max', category: 'Memorial', template: 'Add a soft, warm glow around the subject with light bloom for a memorial feel.' },

    // Style - Artistic transformations
    { label: 'Vintage look', icon: 'camera.filters', category: 'Style', template: 'Apply a subtle vintage film look with soft contrast and warm tones.' },
    { label: 'Oil painting, rich texture', icon: 'paintpalette', category: 'Style', template: 'Transform to oil painting with visible brushstrokes, thick paint texture, and rich color depth while preserving the original composition and object placement.' },
    { label: 'Pencil sketch, detailed', icon: 'pencil.tip', category: 'Style', template: 'Convert to pencil sketch with natural graphite lines, cross-hatching, and visible paper texture.' },
  ];

  const compositionClause = ' Keep the exact camera angle, subject position, scale, and framing. Only replace the environment.';
  const identityClause = ' Maintain the same facial features, hairstyle, and expression.';

  const handleSuggestionPress = (label: string) => {
    const s = SUGGESTIONS.find(x => x.label === label);
    setSelectedLabels((prev) => {
      const already = prev.includes(label);
      const next = already ? prev.filter(l => l !== label) : [...prev, label];
      if (!already) {
        if (s?.opensEditor) {
          // Selecting a text-based preset: prefill custom prompt and switch to custom mode
          setCustomPrompt(s.prefill || '');
          setEditMode('custom');
        }
      } else if (already && s?.opensEditor) {
        // Deselecting a text-based preset: clear custom prompt
        setCustomPrompt('');
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
    // If in custom mode, just return the custom prompt
    if (editMode === 'custom') {
      return customPrompt.trim();
    }
    
    // Preset mode - build from selected presets
    const chosen = SUGGESTIONS.filter(s => selectedLabels.includes(s.label));
    if (chosen.length === 0) return '';
    
    // Group presets by category for better organization
    const groupedPresets = chosen.reduce((groups, preset) => {
      if (!groups[preset.category]) groups[preset.category] = [];
      groups[preset.category].push(preset);
      return groups;
    }, {} as Record<string, typeof chosen>);
    
    // Build prompt sections in priority order
    const sections: string[] = [];
    
    // 1. Cleanup operations first (they should be applied before enhancements)
    if (groupedPresets['Cleanup']) {
      const cleanupTasks = groupedPresets['Cleanup'].map(p => p.template).join(', then ');
      sections.push(cleanupTasks);
    }
    
    // 2. Style transformations (major changes to image style)
    if (groupedPresets['Style']) {
      // For style changes, combine similar requests intelligently
      const stylePresets = groupedPresets['Style'];
      if (stylePresets.length === 1) {
        sections.push(stylePresets[0].template);
      } else {
        // Multiple styles - create a hybrid approach
        const styleDescriptions = stylePresets.map(p => {
          // Extract key style elements from templates
          if (p.label.includes('Oil painting')) return 'oil painting texture with visible brushstrokes';
          if (p.label.includes('Pencil sketch')) return 'pencil sketch with cross-hatching';
          if (p.label.includes('Vintage')) return 'vintage film aesthetic';
          return p.template;
        });
        sections.push(`Apply a artistic style combining: ${styleDescriptions.join(' and ')}`);
      }
    }
    
    // 3. Looks enhancements (facial/beauty improvements)
    if (groupedPresets['Looks']) {
      const looksTasks = groupedPresets['Looks'].map(p => {
        // Simplify repetitive "naturally" and "gently" language
        return p.template.replace(/gently |naturally |very |subtle |slightly /gi, '');
      });
      sections.push(`Enhance appearance: ${looksTasks.join(', ')}`);
    }
    
    // 4. Creative additions (effects, objects, lighting)
    if (groupedPresets['Creative']) {
      const creativeEffects = groupedPresets['Creative'];
      const lightingEffects = creativeEffects.filter(p => p.label.includes('rays') || p.label.includes('glow'));
      const objectAdditions = creativeEffects.filter(p => !lightingEffects.includes(p));
      
      if (lightingEffects.length > 0) {
        sections.push(lightingEffects.map(p => p.template).join(' and '));
      }
      if (objectAdditions.length > 0) {
        sections.push(`Add decorative elements: ${objectAdditions.map(p => p.template).join(', ')}`);
      }
    }
    
    // 5. Memorial elements (handled specially for sensitivity)
    if (groupedPresets['Memorial']) {
      const memorialElements = groupedPresets['Memorial'].map(p => p.template);
      sections.push(`Apply memorial styling: ${memorialElements.join(', ')}`);
    }
    
    // Combine sections with proper flow
    let merged = sections.join('. ');
    
    // Add composition and identity preservation clauses intelligently
    const needsCompositionClause = !/(keep|maintain|preserve).*(?:framing|composition|angle|position)/i.test(merged) && 
                                  (groupedPresets['Style'] || groupedPresets['Creative']) && 
                                  preserveComposition;
                                  
    const needsIdentityClause = !/(maintain|preserve).*(?:face|identity|features|expression)/i.test(merged) && 
                               (groupedPresets['Style'] || groupedPresets['Looks']) && 
                               preserveIdentity;
    
    if (needsCompositionClause) {
      merged += compositionClause;
    }
    if (needsIdentityClause) {
      merged += identityClause;
    }
    
    // Optimize prompt length if too long (keep under 400 characters for better AI processing)
    if (merged.length > 400) {
      // Remove redundant words and phrases
      merged = merged
        .replace(/\b(very|quite|somewhat|rather|fairly)\s+/gi, '')
        .replace(/\b(the|a|an)\s+/gi, '')
        .replace(/\s+(while|and|but)\s+/gi, ', ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    
    if (__DEV__) {
      console.log('🧠 Photo Magic - built prompt (enhanced):', {
        mode: editMode,
        selectedPresets: selectedLabels,
        groupedCategories: Object.keys(groupedPresets),
        sections: sections.length,
        preserveIdentity,
        preserveComposition,
        originalLength: chosen.map(s => s.template).join(' ').length,
        optimizedLength: merged.length,
        preview: merged.slice(0, 200) + (merged.length > 200 ? '…' : ''),
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
    <Animated.View 
      style={{ flex: 1, backgroundColor: '#0B0B0F' }}
      exiting={FadeOut.duration(300)}
    >
      {/* Header - Fixed outside KeyboardAvoidingView */}
      <Animated.View 
        entering={FadeInDown.delay(100).duration(600)}
        style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 6, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Text style={{ color: '#EAEAEA', fontSize: 18 }}>✕</Text>
          </View>
        </TouchableOpacity>
        
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#EAEAEA', fontSize: 22, fontFamily: 'Lexend-Black' }}>Photo Magic</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
            Instant photo editing
          </Text>
        </View>
        
        <View style={{ width: 32 }} />
      </Animated.View>

      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Image Selector */}
        <Animated.View 
          entering={FadeInUp.delay(150).duration(800).springify().damping(15)} 
                    style={{ paddingHorizontal: 16, marginTop: 16 }}
        >
          <ImageSelector 
            selectedImage={selectedImage} 
            onImageSelected={handleImageSelected}
            disabled={isLoading || isSubmitting}
          />
        </Animated.View>

        {/* Edit Mode Selector */}
        <Animated.View 
          entering={FadeInUp.delay(250).duration(800).springify().damping(12)}
                    style={{ paddingHorizontal: 16, marginBottom: 20 }}
        >
          <Text style={{ color: '#EAEAEA', fontSize: 16, fontFamily: 'Lexend-SemiBold', marginBottom: 12 }}>
            Choose Edit Method
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                setEditMode('presets');
                setCustomPrompt('');
              }}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: editMode === 'presets' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: editMode === 'presets' ? '#F59E0B' : 'rgba(255,255,255,0.12)',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <IconSymbol name="square.grid.2x2" size={18} color={editMode === 'presets' ? '#F59E0B' : 'rgba(255,255,255,0.7)'} />
              <Text style={{ 
                color: editMode === 'presets' ? '#F59E0B' : 'rgba(255,255,255,0.8)', 
                fontSize: 14, 
                fontFamily: 'Lexend-SemiBold' 
              }}>
                Use Presets
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => {
                setEditMode('custom');
                setSelectedLabels([]);
              }}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: editMode === 'custom' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: editMode === 'custom' ? '#F59E0B' : 'rgba(255,255,255,0.12)',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <IconSymbol name="pencil" size={18} color={editMode === 'custom' ? '#F59E0B' : 'rgba(255,255,255,0.7)'} />
              <Text style={{ 
                color: editMode === 'custom' ? '#F59E0B' : 'rgba(255,255,255,0.8)', 
                fontSize: 14, 
                fontFamily: 'Lexend-SemiBold' 
              }}>
                Write Custom
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Show either presets or custom edit based on mode */}
        {editMode === 'presets' ? (
          <>
            {/* Category Tabs */}
            <Animated.View 
              entering={FadeInUp.delay(350).duration(800).springify().damping(12)}
                          >
              <CategoryTabs 
                selectedCategory={category}
                onCategoryChange={setCategory}
              />
            </Animated.View>




        {/* Presets grid */}
        <Animated.View 
          entering={FadeInUp.delay(450).duration(800).springify().damping(10)}
                    style={{ paddingHorizontal: 16, marginBottom: 120 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#EAEAEA', fontSize: 16, fontFamily: 'Lexend-SemiBold' }}>
              {category === 'All' ? 'All Presets' : `${category} Presets`}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              Tap to select • Long‑press for details
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {(category === 'All' ? SUGGESTIONS : SUGGESTIONS.filter(s => s.category === category)).map((suggestion) => (
              <View key={suggestion.label} style={{ minWidth: '48%', maxWidth: '48%' }}>
                <PresetCard
                  label={suggestion.label}
                  icon={suggestion.icon}
                  isSelected={selectedLabels.includes(suggestion.label)}
                  onPress={() => handleSuggestionPress(suggestion.label)}
                  onLongPress={() => handleSuggestionLongPress(suggestion.label)}
                />
              </View>
            ))}
          </View>
        </Animated.View>
          </>
        ) : (
          /* Custom Edit Mode */
          <Animated.View 
            entering={FadeInUp.delay(350).duration(800).springify().damping(12)}
                        style={{ paddingHorizontal: 16, marginBottom: 120 }}
          >
            <Text style={{ color: '#EAEAEA', fontSize: 16, fontFamily: 'Lexend-SemiBold', marginBottom: 12 }}>
              Describe Your Edit
            </Text>
            <BlurView intensity={20} tint="dark" style={{ borderRadius: 20, overflow: 'hidden' }}>
              <View style={{ 
                borderRadius: 20, 
                borderWidth: 1, 
                borderColor: 'rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(255,255,255,0.08)',
                padding: 20
              }}>
                <TextInput
                  style={{ 
                    color: '#EAEAEA', 
                    fontSize: 15,
                    minHeight: 120,
                    textAlignVertical: 'top',
                    lineHeight: 22
                  }}
                  placeholder="Describe exactly what you want to change or enhance in your photo..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={customPrompt}
                  onChangeText={(text) => setCustomPrompt(text.slice(0, 150))}
                  maxLength={150}
                  multiline
                  autoCorrect={false}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{customPrompt.length}/150</Text>
                  {customPrompt.length > 0 && (
                    <TouchableOpacity onPress={() => setCustomPrompt('')}>
                      <View style={{
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(245,158,11,0.3)'
                      }}>
                        <Text style={{ color: '#F59E0B', fontSize: 12, fontFamily: 'Lexend-SemiBold' }}>Clear</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </BlurView>
            
            {/* Tips for custom editing */}
            <View style={{ marginTop: 16, padding: 16, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <IconSymbol name="lightbulb" size={16} color="#F59E0B" />
                <Text style={{ color: '#F59E0B', fontSize: 14, fontFamily: 'Lexend-SemiBold', marginLeft: 8 }}>
                  Tips for better results
                </Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18 }}>
                • Be specific about what you want to change{'\n'}
                • Mention colors, lighting, or specific features{'\n'}
                • Describe the desired outcome clearly{'\n'}
                • Use plain language
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Enhanced loading overlay */}
      {isLoading && (
        <Animated.View 
          entering={FadeInUp.duration(300)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ 
            paddingHorizontal: 32, 
            paddingVertical: 24, 
            backgroundColor: 'rgba(11,11,15,0.95)', 
            borderRadius: 24,
            alignItems: 'center',
            minWidth: 280,
          }}>
            {/* Simple loading indicator */}
            <ActivityIndicator size="large" color="#F59E0B" style={{ marginBottom: 16 }} />
            
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: 'Lexend-Black', marginBottom: 8, textAlign: 'center' }}>
              Applying Magic
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              Our AI is enhancing your photo with the selected edits
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Enhanced bottom action button */}
      <Animated.View 
        entering={FadeInUp.delay(500).duration(800).springify().damping(15)}
                style={{ 
          position: 'absolute', 
          left: 16, 
          right: 16, 
          bottom: (insets?.bottom || 0) + 12,
        }}
      >
        {(() => {
          const canApply = !!selectedImage && !isSubmitting && !isLoading && (
            (editMode === 'presets' && selectedLabels.length > 0) || 
            (editMode === 'custom' && customPrompt.trim())
          );
          const hasImage = !!selectedImage;
          const hasEdits = (editMode === 'presets' && selectedLabels.length > 0) || 
                          (editMode === 'custom' && customPrompt.trim());
          
          return (
            <Animated.View style={buttonAnimatedStyle}>
              <TouchableOpacity 
                onPress={handleProcessImage}
                activeOpacity={1}
                onPressIn={() => {
                  if (canApply) {
                    buttonScale.value = withTiming(0.95, { duration: 100 });
                  }
                }}
                onPressOut={() => {
                  if (canApply) {
                    buttonScale.value = withTiming(1, { duration: 150 });
                  }
                }}
                disabled={!canApply}
                style={{ 
                  height: 64, 
                  borderRadius: 24, 
                  overflow: 'hidden',
                  transform: [{ scale: canApply ? 1 : 0.98 }],
                shadowColor: canApply ? '#F59E0B' : 'transparent',
                shadowOffset: { width: 0, height: canApply ? 8 : 0 },
                shadowOpacity: canApply ? 0.4 : 0,
                shadowRadius: canApply ? 20 : 0,
                elevation: canApply ? 12 : 0,
              }}
              accessibilityState={{ disabled: !canApply }}
            >
              {canApply ? (
                <View style={{ position: 'relative', flex: 1 }}>
                  {/* Animated background glow */}
                  <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 24,
                    backgroundColor: '#F59E0B',
                    opacity: 0.2,
                    transform: [{ scale: 1.1 }]
                  }} />
                  
                  <LinearGradient 
                    colors={['#F59E0B', '#FBBF24', '#F59E0B']} 
                    start={{ x: 0, y: 0.3 }} 
                    end={{ x: 1, y: 0.7 }} 
                    style={{ 
                      flex: 1, 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      flexDirection: 'row',
                      paddingHorizontal: 24,
                      borderRadius: 24
                    }}
                  >
                    {isSubmitting || isLoading ? (
                      <>
                        <Animated.View 
                          style={[
                            { 
                              width: 24, 
                              height: 24, 
                              borderRadius: 12, 
                              borderWidth: 3, 
                              borderColor: '#0B0B0F', 
                              borderTopColor: 'transparent',
                              marginRight: 16
                            },
                            spinStyle
                          ]} 
                        />
                        <Text style={{ color: '#0B0B0F', fontSize: 18, fontFamily: 'Lexend-Black', letterSpacing: 0.5 }}>
                          Processing Magic…
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={{
                          backgroundColor: 'rgba(11,11,15,0.1)',
                          borderRadius: 14,
                          padding: 6,
                          marginRight: 12
                        }}>
                          <IconSymbol name='wand.and.stars' size={24} color='#0B0B0F' />
                        </View>
                        <Text style={{ color: '#0B0B0F', fontSize: 19, fontFamily: 'Lexend-Black', letterSpacing: 0.5, flex: 1 }}>
                          Apply Magic
                        </Text>
                        <View style={{ 
                          backgroundColor: 'rgba(11,11,15,0.2)',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 16,
                          minWidth: 32,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: 'rgba(11,11,15,0.1)'
                        }}>
                          <Text style={{ color: '#0B0B0F', fontSize: 14, fontFamily: 'Lexend-Black' }}>
                            {selectedLabels.length || 1}
                          </Text>
                        </View>
                      </>
                    )}
                  </LinearGradient>
                </View>
              ) : (
                <BlurView intensity={10} tint="dark" style={{ flex: 1, borderRadius: 24 }}>
                  <View style={{ 
                    flex: 1, 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexDirection: 'row', 
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderRadius: 24,
                    paddingHorizontal: 20
                  }}>
                    {!hasImage ? (
                      <>
                        <View style={{
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          borderRadius: 12,
                          padding: 6,
                          marginRight: 12
                        }}>
                          <IconSymbol name='photo' size={22} color='rgba(255,255,255,0.6)' />
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 17, fontFamily: 'Lexend-SemiBold', letterSpacing: 0.3 }}>
                          Select a Photo First
                        </Text>
                      </>
                    ) : !hasEdits ? (
                      <>
                        <View style={{
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          borderRadius: 12,
                          padding: 6,
                          marginRight: 12
                        }}>
                          <IconSymbol name='wand.and.stars' size={22} color='rgba(255,255,255,0.6)' />
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 17, fontFamily: 'Lexend-SemiBold', letterSpacing: 0.3 }}>
                          Choose Edits to Apply
                        </Text>
                      </>
                    ) : null}
                  </View>
                </BlurView>
              )}
              </TouchableOpacity>
            </Animated.View>
          );
        })()}
      </Animated.View>

      {/* Long-press info sheet */}
      <BottomSheet visible={infoVisible} onDismiss={() => setInfoVisible(false)} maxHeightPercent={0.65}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'Lexend-Black', marginBottom: 6 }}>{infoTitle}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 }}>{infoText}</Text>
        </View>
      </BottomSheet>
    </Animated.View>
  );
}