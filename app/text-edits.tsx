import { BottomSheet } from '@/components/sheets/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { usePhotoUsage } from '@/services/photoUsageService';
import { presentPaywall, validatePremiumAccess } from '@/services/revenuecat';
import { useTranslation } from '@/src/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// New components
import { CategoryTabs } from '@/components/PhotoMagic/CategoryTabs';
import { ImageSelector } from '@/components/PhotoMagic/ImageSelector';
import { PresetCard } from '@/components/PhotoMagic/PresetCard';
import { analyticsService } from '@/services/analytics';

export default function TextEditsScreen() {
  const { t } = useTranslation();
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
  const [editMode, setEditMode] = useState<'presets' | 'custom'>('custom');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const photoRestoration = usePhotoRestoration();
  const { data: photoUsage } = usePhotoUsage();
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
  
// Simple mount check - prevent duplicates by checking for active work
useEffect(() => {
  const checkActiveWork = async () => {
    const activePredictionId = await AsyncStorage.getItem('activePredictionId');
    
    if (activePredictionId && imageUri && initialPrompt) {
      // We have active work - block new processing
      if (__DEV__) {
        console.log('📱 [TEXT-EDIT] Found active prediction on mount:', activePredictionId);
      }
      setIsLoading(true);
      setHasProcessed(true);
      // Recovery will handle navigation
      return;
    }
    
    if (__DEV__) {
      console.log('✅ [TEXT-EDIT] No active work found on mount');
    }
  };
  
  checkActiveWork();
}, []); // Only on component mount

useEffect(() => {
  // If we have an image from upload, set it as selected
  if (imageUri && fromUpload && !selectedImage) {
    setSelectedImage(imageUri as string);
  }
  
  // If we have an image and prompt from navigation, check for existing processing
  if (imageUri && initialPrompt && !hasProcessed && !isLoading) {
    const checkAndProcess = async () => {
      // Simple check - just look for active prediction
      const activePredictionId = await AsyncStorage.getItem('activePredictionId');
      
      if (activePredictionId) {
        if (__DEV__) {
          console.log('🚫 [TEXT-EDIT] Blocking duplicate - found active prediction:', activePredictionId);
        }
        setIsLoading(true);
        setHasProcessed(true);
        // Recovery will handle navigation when prediction completes
        return;
      }
      
      if (__DEV__) {
        console.log('✅ [TEXT-EDIT] No active prediction, starting new processing');
      }
      
      setHasProcessed(true);
      processWithPrompt(imageUri as string, initialPrompt as string, mode as string);
    };
    
    checkAndProcess();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [imageUri, initialPrompt, mode, hasProcessed, fromUpload, selectedImage]);


  const processWithPrompt = useCallback(async (uri: string, prompt: string, editMode?: string) => {
    // CRITICAL: Check photo usage limits BEFORE making any API calls
    if (photoUsage && !photoUsage.canUse && photoUsage.planType === 'free') {
      if (__DEV__) {
        console.log('❌ [TEXT-EDIT] Photo limit exceeded, showing paywall instead of API call');
      }
      
      try {
        const success = await presentPaywall();
        if (!success) {
          if (__DEV__) {
            console.log('🚫 [TEXT-EDIT] User cancelled paywall, cancelling processing');
          }
          setIsSubmitting(false);
          applyLockRef.current = false;
          return;
        }
        // If successful, continue with processing (usage will be rechecked on server)
      } catch (error) {
        if (__DEV__) {
          console.error('❌ [TEXT-EDIT] Paywall error:', error);
        }
        setIsSubmitting(false);
        applyLockRef.current = false;
        return;
      }
    }
    
    // CRITICAL: Check for active prediction before any processing
    const activePredictionId = await AsyncStorage.getItem('activePredictionId');
    if (activePredictionId) {
      if (__DEV__) {
        console.log('🚫 [TEXT-EDIT] CRITICAL BLOCK: Found active prediction, cannot start new processing:', activePredictionId);
      }
      setIsLoading(true);
      // Recovery will handle navigation when prediction completes
      return;
    }
    
    // Prevent duplicate processing calls
    if (isLoading) {
      if (__DEV__) {
        console.log('🚫 DUPLICATE PROCESSING BLOCKED: Already processing');
      }
      return;
    }
    
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
    
    // Track text-edit tile usage
    analyticsService.trackTileUsage({
      category: 'popular',
      tileName: `Text Edit - ${editMode || 'custom'}`,
      tileId: `text-edit-${editMode || 'custom'}`,
      functionType: functionType,
      customPrompt: prompt.substring(0, 100), // Truncate for privacy
      stage: 'started'
    });

    // Store a flag indicating we're in text-edits flow for recovery
    await AsyncStorage.setItem('isTextEditsFlow', 'true');
    
    if (__DEV__) {
      console.log('📝 [TEXT-EDIT] Set text-edits flow flag for recovery');
    }

    // Show loading UI
    setIsLoading(true);
    
    try {
      const result = await photoRestoration.mutateAsync({ imageUri: uri, functionType, imageSource: 'gallery', customPrompt: prompt });
      
      // Store text-edit context with prediction ID for deterministic recovery
      await AsyncStorage.setItem(`textEditContext_${result.id}`, JSON.stringify({
        mode: 'text-edits',
        imageUri: uri,
        functionType,
        customPrompt: prompt,
        timestamp: Date.now(),
        predictionId: result.id
      }));
      
      if (__DEV__) {
        console.log('📝 [TEXT-EDIT] Stored text-edit context with prediction ID for deterministic recovery:', {
          predictionId: result.id,
          mode: 'text-edits',
          functionType,
          prompt_preview: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
        });
      }
      
      // Clear text-edits flow flag now that we have the prediction ID and context stored
      await AsyncStorage.removeItem('isTextEditsFlow');
      
      setIsLoading(false);
      router.replace(`/restoration/${result.id}`);
    } catch (err: any) {
      setIsLoading(false);
      
      // Clear text-edits flow flag on error
      await AsyncStorage.removeItem('isTextEditsFlow');
      
      // Handle photo limit exceeded error with user-friendly message
      let errorTitle = 'Processing Failed';
      let errorMessage = 'Something went wrong. Please try again.';
      
      if (err?.message?.includes('PHOTO_LIMIT_EXCEEDED') || err?.code === 'PHOTO_LIMIT_EXCEEDED') {
        errorTitle = 'Free Limit Reached';
        errorMessage = 'You\'ve reached your free photo editing limit. Upgrade to Pro for unlimited edits.';
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
    { label: 'Remove watermark/logo', icon: 'square', category: 'Cleanup', template: 'Remove watermark or logo completely while preserving surrounding details.' },
    { label: 'Remove date stamp', icon: 'pencil.tip', category: 'Cleanup', template: 'Remove all date stamps and overlay text from the image.' },
    { label: 'Fix red eyes', icon: 'eye.fill', category: 'Cleanup', template: 'Fix red-eye effect from camera flash, restore natural eye color.' },
    { label: 'Sharpen photo', icon: 'viewfinder', category: 'Cleanup', template: 'Dramatically enhance image sharpness and clarity for crystal clear details.' },

    // Looks - Portrait enhancements for social media
    { label: 'Perfect selfie', icon: 'person.crop.circle.fill', category: 'Looks', template: 'Complete face makeover: smooth flawless skin, brighten face, enhance all features dramatically.' },
    { label: 'Smooth skin', icon: 'sparkles', category: 'Looks', template: 'Create perfectly smooth porcelain skin with professional retouching.' },
    { label: 'Whiten teeth', icon: 'mouth', category: 'Looks', template: 'Make teeth bright white for a Hollywood smile.' },
    { label: 'Brighten smile', icon: 'face.smiling', category: 'Looks', template: 'Dramatically enhance smile and teeth for maximum confidence.' },

    // Creative - Popular social media effects
    { label: 'Golden hour rays', icon: 'sun.max', category: 'Creative', template: 'Add dramatic golden hour sun rays streaming through the scene.' },
    { label: 'Add warm glow', icon: 'sun.min', category: 'Creative', template: 'Add strong warm glowing aura around the subject for magical effect.' },
    { label: 'Blur background', icon: 'circle.dashed', category: 'Creative', template: 'Create professional bokeh blur in background, keep subject razor sharp.' },
    { label: 'Add sunset colors', icon: 'sunset', category: 'Creative', template: 'Transform scene with vibrant sunset colors - intense oranges, pinks and purples.' },
    { label: 'Butterflies', icon: 'leaf', category: 'Creative', template: 'Add multiple vibrant colorful butterflies flying around the subject.' },
    { label: 'Sparkles', icon: 'sparkles', category: 'Creative', template: 'Add bright magical sparkles and glitter effects throughout the image.' },
    { label: 'White background', icon: 'square.fill', category: 'Creative', template: 'Replace entire background with pure white studio backdrop.' },
    { label: 'Add soft focus', icon: 'camera.filters', category: 'Creative', template: 'Create dreamy soft focus blur around edges with sharp center subject.' },

    // Memorial - Respectful memorial enhancements
    { label: 'Gentle memorial glow', icon: 'sun.max', category: 'Memorial', template: 'Add ethereal warm glow and light bloom around subject for memorial tribute.' },

    // Style - Artistic transformations
    { label: 'Vintage look', icon: 'camera.filters', category: 'Style', template: 'Transform to authentic vintage film aesthetic with faded colors and grain.' },
    { label: 'Oil painting, rich texture', icon: 'paintpalette', category: 'Style', template: 'Transform to dramatic oil painting with bold brushstrokes, thick impasto texture, and vibrant colors.' },
    { label: 'Pencil sketch, detailed', icon: 'pencil.tip', category: 'Style', template: 'Convert to detailed pencil sketch with strong graphite strokes and dramatic shading.' },
  ];

  const compositionClause = ' Keep the exact camera angle, subject position, scale, and framing.';
  const identityClause = ' Maintain the same facial features, hairstyle, and expression.';

  const handleSuggestionPress = (label: string) => {
    const s = SUGGESTIONS.find(x => x.label === label);
    setSelectedLabels((prev) => {
      const already = prev.includes(label);
      
      // If trying to select and already at max (3), prevent it
      if (!already && prev.length >= 3) {
        Alert.alert(
          t('textEdit.maxEffectsReached'),
          t('textEdit.maxEffectsMessage'),
          [{ text: 'OK' }]
        );
        return prev;
      }
      
      const next = already ? prev.filter(l => l !== label) : [...prev, label];
      
      if (!already) {
        // Track preset tile selection
        analyticsService.trackTileUsage({
          category: 'popular',
          tileName: `Preset - ${label}`,
          tileId: `preset-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          functionType: 'custom',
          customPrompt: s?.template || s?.prefill,
          stage: 'selected'
        });
        
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
        console.log('🪄 Photo Magic - toggle preset:', label, '→ selected:', next, `(${next.length}/3)`);
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
    
    // Build clear instructions for each category
    const instructions: string[] = [];
    
    // 1. Cleanup operations first (they should be applied before enhancements)
    if (groupedPresets['Cleanup']) {
      groupedPresets['Cleanup'].forEach(preset => {
        instructions.push(preset.template);
      });
    }
    
    // 2. Style transformations (major changes to image style)
    if (groupedPresets['Style']) {
      groupedPresets['Style'].forEach(preset => {
        instructions.push(preset.template);
      });
    }
    
    // 3. Looks enhancements (facial/beauty improvements)
    if (groupedPresets['Looks']) {
      groupedPresets['Looks'].forEach(preset => {
        instructions.push(preset.template);
      });
    }
    
    // 4. Creative additions (effects, objects, lighting)
    if (groupedPresets['Creative']) {
      groupedPresets['Creative'].forEach(preset => {
        instructions.push(preset.template);
      });
    }
    
    // 5. Memorial elements
    if (groupedPresets['Memorial']) {
      groupedPresets['Memorial'].forEach(preset => {
        instructions.push(preset.template);
      });
    }
    
    // Build the final prompt with clear separation
    let prompt = instructions.join('. ');
    
    // Only add separation instruction if multiple creative effects are selected
    const hasMultipleEffects = groupedPresets['Creative'] && groupedPresets['Creative'].length > 1;
    if (hasMultipleEffects) {
      prompt += '. Apply each effect as a separate distinct layer without blending them together';
    }
    
    // Add composition and identity preservation clauses only when needed
    const needsCompositionClause = (groupedPresets['Style'] || groupedPresets['Creative']) && preserveComposition;
    const needsIdentityClause = (groupedPresets['Style'] || groupedPresets['Looks']) && preserveIdentity;
    
    if (needsCompositionClause) {
      prompt += '.' + compositionClause;
    }
    if (needsIdentityClause) {
      prompt += '.' + identityClause;
    }
    
    // Clean up any formatting issues
    prompt = prompt
      .replace(/\.\s*\./g, '.') // Remove double periods
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    if (__DEV__) {
      console.log('🧠 Photo Magic - built prompt:', {
        mode: editMode,
        selectedPresets: selectedLabels,
        categories: Object.keys(groupedPresets),
        instructionCount: instructions.length,
        preserveIdentity,
        preserveComposition,
        promptLength: prompt.length,
        fullPrompt: prompt,
      });
    }
    
    return prompt;
  };
  
  const handleProcessImage = async () => {
    // Deterministic duplicate prevention - check and set atomically
    if (applyLockRef.current) {
      return;
    }
    applyLockRef.current = true;
    
    if (!selectedImage) {
      applyLockRef.current = false;
      Alert.alert('No Image', 'Please select an image first');
      return;
    }
    
    const finalPrompt = buildPromptFromSelections();
    if (!finalPrompt) {
      applyLockRef.current = false;
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
    
    try {
      await processWithPrompt(selectedImage, finalPrompt, 'custom');
    } catch {
      // error surfaced inside processWithPrompt already
    } finally {
      setIsSubmitting(false);
      applyLockRef.current = false;
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
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                Tap to select • Long‑press for details
              </Text>
              {selectedLabels.length > 0 && (
                <Text style={{ color: '#F59E0B', fontSize: 11, fontFamily: 'Lexend-SemiBold', marginTop: 2 }}>
                  {selectedLabels.length}/3 selected
                </Text>
              )}
            </View>
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
          
          // Check if free limit is reached - button should be enabled to trigger paywall
          const isFreeLimitReached = photoUsage && !photoUsage.canUse && photoUsage.planType === 'free';
          
          // Prevent double-taps by checking both conditions and ref lock
          // But allow clicking if free limit is reached (to trigger paywall)
          const isDisabled = (!canApply || applyLockRef.current) && !isFreeLimitReached;
          
          return (
            <Animated.View style={buttonAnimatedStyle}>
              <TouchableOpacity 
                onPress={handleProcessImage}
                activeOpacity={1}
                onPressIn={() => {
                  if ((canApply || isFreeLimitReached) && !applyLockRef.current) {
                    buttonScale.value = withTiming(0.95, { duration: 100 });
                  }
                }}
                onPressOut={() => {
                  if ((canApply || isFreeLimitReached) && !applyLockRef.current) {
                    buttonScale.value = withTiming(1, { duration: 150 });
                  }
                }}
                disabled={isDisabled}
                style={{ 
                  height: 64, 
                  borderRadius: 24, 
                  overflow: 'hidden',
                  transform: [{ scale: !isDisabled ? 1 : 0.98 }],
                shadowColor: !isDisabled ? '#F59E0B' : 'transparent',
                shadowOffset: { width: 0, height: !isDisabled ? 8 : 0 },
                shadowOpacity: !isDisabled ? 0.4 : 0,
                shadowRadius: !isDisabled ? 20 : 0,
                elevation: !isDisabled ? 12 : 0,
              }}
              accessibilityState={{ disabled: isDisabled }}
            >
              {(!isDisabled || isFreeLimitReached) ? (
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