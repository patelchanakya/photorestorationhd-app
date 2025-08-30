import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { useSavePhoto } from '@/hooks/useSavePhoto';
import { CustomImageCropper } from '@/components/CustomImageCropper';
import { useQuickEditStore } from '@/store/quickEditStore';
import { photoStorage } from '@/services/storage';
import { presentPaywall } from '@/services/revenuecat';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
// Removed heavy blur to reduce memory/CPU
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Alert, Dimensions, Modal, Text, TouchableOpacity, View, Pressable, ActivityIndicator, Platform } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { ProUpgradeModal } from '@/components/ProUpgradeModal';
import { SavingModal, SavingModalRef } from '@/components/SavingModal';
import { analyticsService } from '@/services/analytics';

// Helper to determine tile category
const determineTileCategory = (functionType: string, styleKey?: string | null): 'outfit' | 'background' | 'memorial' | 'popular' | 'feature' | 'style' => {
  if (functionType === 'outfit') return 'outfit';
  if (functionType === 'background') return 'background';  
  if (functionType === 'memorial') return 'memorial';
  if (functionType === 'custom') return 'popular';
  if (styleKey) return 'style';
  return 'feature';
};

const { height } = Dimensions.get('window');

export function QuickEditSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    visible,
    stage,
    functionType,
    styleKey,
    styleName,
    selectedImageUri,
    restoredId,
    restoredImageUri,
    progress,
    setSelectedImage,
    setStage,
    setProgress,
    setResult,
    close,
    customPrompt,
    errorMessage,
    setError,
  } = useQuickEditStore();

  const photoRestoration = usePhotoRestoration();
  const savePhotoMutation = useSavePhoto();
  const [isCropping, setIsCropping] = React.useState(false);
  const hasAppliedCropRef = React.useRef(false);
  const [mediaLoading, setMediaLoading] = React.useState(false);
  const [isLimitError, setIsLimitError] = React.useState(false);
  const [showSavingModal, setShowSavingModal] = React.useState(false);
  const savingModalRef = React.useRef<SavingModalRef>(null);
  // Progress-based loading copy (no cycling back)
  const getLoadingMessage = (p: number) => {
    if (p < 10) return 'Uploading photo…';
    if (p < 30) return 'Running magic…';
    if (p < 55) return 'Fixing damage…';
    if (p < 80) return 'Enhancing details…';
    return 'Almost done…';
  };
  const modeTitle = React.useMemo(() => {
    // Use styleName if available, otherwise fall back to functionType-based title
    if (styleName) {
      return styleName;
    }
    
    switch (functionType) {
      case 'restoration':
        return 'Restore';
      case 'repair':
        return 'Repair';
      case 'restore_repair':
        return 'Restore & Repair';
      case 'descratch':
        return 'Descratch';
      case 'unblur':
        return 'Enhance';
      case 'colorize':
        return 'Colorize';
      case 'enlighten':
        return 'Fix Lighting';
      case 'background':
        return 'Change Background';
      case 'outfit':
        return 'Change Outfit';
      case 'memorial':
        return 'Memorial Edit';
      case 'custom':
        return 'Custom Edit';
      default:
        return 'Edit Photo';
    }
  }, [styleName, functionType]);

  const translateY = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const MEDIA_HEIGHT = 240;
  const saveButtonScale = useSharedValue(1);
  const handleClose = React.useCallback(async () => {
    // Prevent dismissal while processing
    if (stage === 'loading') {
      return;
    }
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    
    // Clear active prediction state when dismissing the sheet
    await AsyncStorage.removeItem('activePredictionId');
    
    if (__DEV__) {
      console.log('❌ [RECOVERY] Cleared prediction state after dismiss');
    }
    
    close();
    // Give the exit animation time, then aggressively free image memory
    setTimeout(() => {
      try { (ExpoImage as any).clearMemoryCache?.(); } catch {}
    }, 320);
  }, [close, stage]);
  const [rendered, setRendered] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [showUpgrade, setShowUpgrade] = React.useState(false);
  React.useEffect(() => {
    // Mount and animate in
    if (visible) {
      setRendered(true);
      translateY.value = height;
      overlayOpacity.value = 0;
      // next frame animate
      requestAnimationFrame(() => {
        // Slight spring overshoot on open for polish
        translateY.value = withSpring(0, { damping: 22, stiffness: 260, mass: 0.9 });
        overlayOpacity.value = withTiming(1, { duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1) });
      });
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    } else {
      // Animate out then unmount
      translateY.value = withTiming(height, { duration: 260, easing: Easing.bezier(0.4, 0, 0.2, 1) });
      overlayOpacity.value = withTiming(0, { duration: 260, easing: Easing.linear });
      const t = setTimeout(() => setRendered(false), 270);
      return () => clearTimeout(t);
    }
  }, [visible]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const saveBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveButtonScale.value }] }));

  const handlePick = async () => {
    try { Haptics.selectionAsync(); } catch {}
    // Launch image picker - no permission check needed on iOS 11+
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setMediaLoading(true);
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleCrop = () => {
    try { Haptics.selectionAsync(); } catch {}
    if (!selectedImageUri) return;
    hasAppliedCropRef.current = false;
    setIsCropping(true);
  };

  const handleUpload = async () => {
    if (!selectedImageUri || !functionType) return;
    if (isUploading) return;
    setIsUploading(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    // PROMPT LOGGING: Track generation start
    console.log('🚀 QUICK EDIT GENERATION START:', {
      functionType: functionType,
      styleKey: styleKey,
      styleName: styleName,
      customPrompt: customPrompt,
      hasCustomPrompt: !!customPrompt
    });

    // Track tile usage started
    const tileCategory = determineTileCategory(functionType, styleKey);
    const tileName = styleName || functionType;
    const tileId = styleKey || functionType;
    
    analyticsService.trackTileUsage({
      category: tileCategory,
      tileName: tileName,
      tileId: tileId,
      functionType: functionType,
      styleKey: styleKey || undefined,
      customPrompt: customPrompt || undefined,
      stage: 'started'
    });

    // Pass styleKey through global context for webhook system
    (global as any).__quickEditStyleKey = styleKey;
    // Store tile metadata for success tracking
    (global as any).__tileCategory = tileCategory;
    (global as any).__tileName = tileName;
    (global as any).__tileId = tileId;

    // Server-side webhook handles all usage checking and limits

    setStage('loading');

    const started = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - started;
      const est = 10000; // 10s estimate for photos
      const p = Math.min(95, Math.floor((elapsed / est) * 95));
      setProgress(p);
    }, 500);

    try {
      const effectiveFunctionType = functionType as any;
      const data = await photoRestoration.mutateAsync({ imageUri: selectedImageUri, functionType: effectiveFunctionType, imageSource: 'gallery', customPrompt: customPrompt || undefined });
      const id = data.id;
      const restoredUri = (data as any).restoredImageUri || '';
      
      // Track success
      const processingTime = Date.now() - started;
      analyticsService.trackTileUsage({
        category: tileCategory,
        tileName: tileName,
        tileId: tileId,
        functionType: functionType,
        styleKey: styleKey || undefined,
        customPrompt: customPrompt || undefined,
        stage: 'completed',
        success: true,
        processingTime: processingTime
      });
      
      setResult(id, restoredUri);
    } catch (e: any) {
      if (__DEV__) {
        console.log('🚨 QuickEditSheet caught error:', e?.message);
        console.log('🚨 Error type:', typeof e);
        console.log('🚨 Full error:', e);
      }
      
      // Note: Hook handles its own rollback logic
      
      // Show user-friendly error message
      let errorMsg = e?.message || 'Something went wrong. Please try again.';
      
      // Override technical error messages with user-friendly ones
      if (errorMsg.includes('PHOTO_LIMIT_EXCEEDED') || e?.code === 'PHOTO_LIMIT_EXCEEDED') {
        errorMsg = 'You\'ve reached your daily photo limit. Tap here to upgrade to Pro for unlimited edits!';
        setIsLimitError(true);
      } else if (errorMsg.includes('Unable to verify photo limits') || 
          errorMsg.includes('Servers are loaded') ||
          errorMsg.includes('Unable to process photo')) {
        errorMsg = 'Servers are loaded, please try again later.';
        setIsLimitError(false);
      } else {
        setIsLimitError(false);
      }
      
      // Track failure
      const processingTime = Date.now() - started;
      analyticsService.trackTileUsage({
        category: tileCategory,
        tileName: tileName,
        tileId: tileId,
        functionType: functionType,
        styleKey: styleKey || undefined,
        customPrompt: customPrompt || undefined,
        stage: 'failed',
        success: false,
        processingTime: processingTime
      });
      
      if (__DEV__) {
        console.log('🔴 Setting error message:', errorMsg);
        console.log('🔴 Calling setError...');
      }
      setError(errorMsg);
      
      if (__DEV__) {
        console.log('🔴 setError called, stage should be "error" now');
      }
    } finally {
      clearInterval(interval);
      setIsUploading(false);
      // Clean up global styleKey
      (global as any).__quickEditStyleKey = undefined;
    }
  };

  const handleSave = async () => {
    if (!restoredId || !restoredImageUri) return;
    // Tap animation
    saveButtonScale.value = withTiming(0.96, { duration: 90 }, () => {
      saveButtonScale.value = withTiming(1, { duration: 120 });
    });
    
    // Show saving modal
    setShowSavingModal(true);
    
    savePhotoMutation.mutate({ imageUri: restoredImageUri }, {
      onSuccess: async () => {
        // Clear active prediction state since user has saved the result
        await AsyncStorage.removeItem('activePredictionId');
        
        if (__DEV__) {
          console.log('💾 [RECOVERY] Cleared prediction state after save');
        }
        
        // Trigger success state in modal
        savingModalRef.current?.showSuccess();
        
        // Close sheet after modal completes
        setTimeout(() => {
          handleClose();
        }, 1000);
      },
      onError: (error) => {
        console.error('Save failed:', error);
        // Hide saving modal on error
        setShowSavingModal(false);
        // Reset button animation on error
        saveButtonScale.value = withTiming(1, { duration: 120 });
      }
    });
  };

  const handleView = async () => {
    if (!restoredId) return;
    
    // Clear active prediction state since user is viewing the result
    await AsyncStorage.removeItem('activePredictionId');
    
    if (__DEV__) {
      console.log('👁️ [RECOVERY] Cleared prediction state after view');
    }
    
    close();
    router.push(`/restoration/${restoredId}`);
  };

  if (!rendered) return null;

  return (
    <Modal visible={true} transparent statusBarTranslucent animationType="none">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          // Disable backdrop dismiss while processing
          onPress={stage === 'loading' ? undefined : handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close editor"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Animated.View style={[{ flex: 1 }, dimStyle]}>
            {Platform.OS === 'ios' && (
              <BlurView intensity={12} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            )}
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} />
          </Animated.View>
        </Pressable>
        <Animated.View style={[{ paddingBottom: 0 }, sheetStyle]}>
          <View style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(12,12,14,0.96)', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <View style={{ padding: 16, paddingBottom: Math.max(12, insets.bottom + 8) }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <TouchableOpacity onPress={handleClose} disabled={stage === 'loading'} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }} style={{ padding: 4, opacity: stage === 'loading' ? 0.4 : 1 }}>
                  <IconSymbol name="xmark" size={20} color="#EAEAEA" />
                </TouchableOpacity>
                <Text style={{ color: '#EAEAEA', fontSize: 16, fontFamily: 'Lexend-Bold' }}>
                  {modeTitle}
                </Text>
                <View style={{ width: 24, height: 24 }} />
              </View>

              {/* Image preview / Cropper */}
              {!isCropping ? (
                <View style={{ height: MEDIA_HEIGHT, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                  {(stage === 'done' ? restoredImageUri : selectedImageUri) ? (
                    <ExpoImage 
                      source={{ uri: (stage === 'done' && restoredImageUri) ? restoredImageUri : (selectedImageUri as string) }} 
                      style={{ width: '100%', height: '100%' }} 
                      contentFit="contain" 
                      cachePolicy="memory"
                      allowDownscaling
                      transition={0}
                      onLoadStart={() => setMediaLoading(true)}
                      onLoadEnd={() => setMediaLoading(false)}
                    />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <IconSymbol name="photo.on.rectangle" size={28} color="rgba(255,255,255,0.75)" />
                      <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>Select a photo to begin</Text>
                    </View>
                  )}
                  {mediaLoading && stage !== 'loading' && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                        <Text style={{ color: '#F59E0B', fontSize: 14, fontFamily: 'Lexend-Black', textAlign: 'center' }}>Loading photo…</Text>
                      </View>
                    </View>
                  )}
                  {stage === 'loading' && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center', marginBottom: 4 }}>Please wait a few seconds</Text>
                        <Text style={{ color: '#F59E0B', fontSize: 16, fontFamily: 'Lexend-Black', textAlign: 'center' }}>
                          {getLoadingMessage(progress)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ height: MEDIA_HEIGHT, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#000' }}>
                  {selectedImageUri && (
                    <CustomImageCropper
                      imageUri={selectedImageUri}
                      onEditingComplete={(result) => {
                        if (hasAppliedCropRef.current) return;
                        hasAppliedCropRef.current = true;
                        const cropped = result?.uri || selectedImageUri;
                        // Unmount cropper first, then update image to avoid flicker
                        setIsCropping(false);
                        setTimeout(() => {
                          setSelectedImage(cropped);
                        }, 0);
                      }}
                      onEditingCancel={() => {
                        hasAppliedCropRef.current = false;
                        setIsCropping(false);
                      }}
                    />
                  )}
                </View>
              )}

              {/* Progress bar */}
              {stage === 'loading' && (
                <View style={{ height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 12 }}>
                  <View style={{ width: `${progress}%`, height: '100%', backgroundColor: '#F59E0B' }} />
                </View>
              )}

              {/* Error Message */}
              {stage === 'error' && (
                <TouchableOpacity 
                  onPress={isLimitError ? () => {
                    presentPaywall().then((success) => {
                      if (success) {
                        // Reset error state and retry
                        setIsLimitError(false);
                        setStage('preview');
                        setTimeout(() => handleUpload(), 100);
                      }
                    });
                  } : undefined}
                  activeOpacity={isLimitError ? 0.8 : 1}
                  style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontFamily: 'Lexend-SemiBold', fontSize: 14 }}>Error</Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18 }}>
                    {errorMessage}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Actions */}
              <View style={{ marginTop: 16, marginBottom: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {stage === 'select' && (
                  <TouchableOpacity onPress={handlePick} style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontFamily: 'Lexend-SemiBold' }}>Select Photo</Text>
                  </TouchableOpacity>
                )}
                {stage === 'preview' && !isCropping && (
                  <>
                    <TouchableOpacity onPress={handleCrop} style={{ paddingHorizontal: 22, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Crop</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleUpload} disabled={isUploading} style={{ flex: 1, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', opacity: isUploading ? 0.7 : 1, minWidth: 120, marginLeft: 0 }}>
                      <LinearGradient colors={['#F59E0B', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        {isUploading ? (
                          <ActivityIndicator color="#0B0B0F" />
                        ) : (
                          <Text style={{ color: '#0B0B0F', fontWeight: '900', fontSize: 16 }}>Create</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {stage === 'preview' && isCropping && (
                  <>
                    <TouchableOpacity onPress={() => setIsCropping(false)} style={{ paddingHorizontal: 18, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontFamily: 'Lexend-SemiBold' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { /* Save already applied in onEditingComplete; just exit crop */ setIsCropping(false); }} style={{ flex: 1, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', minWidth: 120 }}>
                      <LinearGradient colors={['#F59E0B', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#0B0B0F', fontWeight: '900', fontSize: 16 }}>Done</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {stage === 'error' && (
                  <>
                    <TouchableOpacity onPress={() => setStage('preview')} style={{ paddingHorizontal: 22, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontFamily: 'Lexend-SemiBold' }}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleUpload} disabled={isUploading} style={{ flex: 1, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', opacity: isUploading ? 0.7 : 1, minWidth: 120 }}>
                      <LinearGradient colors={['#F59E0B', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        {isUploading ? (
                          <ActivityIndicator color="#0B0B0F" />
                        ) : (
                          <Text style={{ color: '#0B0B0F', fontWeight: '900', fontSize: 16 }}>Try Again</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {stage === 'done' && (
                  <>
                    <Animated.View style={[saveBtnStyle]}>
                      <TouchableOpacity 
                        onPress={handleSave} 
                        disabled={savePhotoMutation.isPending}
                        style={{ 
                          paddingHorizontal: 22, 
                          height: 56, 
                          borderRadius: 28, 
                          backgroundColor: 'rgba(255,255,255,0.1)', 
                          borderWidth: 1, 
                          borderColor: 'rgba(255,255,255,0.25)', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          opacity: savePhotoMutation.isPending ? 0.6 : 1
                        }}
                      >
                        {savePhotoMutation.isPending ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={{ color: '#fff', fontFamily: 'Lexend-SemiBold' }}>Saving...</Text>
                          </View>
                        ) : (
                          <Text style={{ color: '#fff', fontFamily: 'Lexend-SemiBold' }}>Save</Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                    <TouchableOpacity onPress={handleView} style={{ flex: 1, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', minWidth: 120 }}>
                      <LinearGradient colors={['#F59E0B', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#0B0B0F', fontWeight: '900', fontSize: 16 }}>View</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* No footer close; header X handles dismissal */}
            </View>
          </View>
        </Animated.View>
      </View>
      {/* Free limit reached modal */}
      <ProUpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="Free limit reached"
        message="You've reached your free photo restoration limit. Go Pro to continue."
        ctaLabel="Go Pro"
        onSuccess={() => {
          setShowUpgrade(false);
          // Resume upload automatically
          setTimeout(() => {
            handleUpload();
          }, 0);
        }}
      />
      
      {/* Saving Modal */}
      <SavingModal 
        ref={savingModalRef}
        visible={showSavingModal} 
        onComplete={() => setShowSavingModal(false)}
      />
    </Modal>
  );
}
