import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { CustomImageCropper } from '@/components/CustomImageCropper';
import { useQuickEditStore } from '@/store/quickEditStore';
import { photoStorage } from '@/services/storage';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
// Removed heavy blur to reduce memory/CPU
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Dimensions, Modal, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const { height } = Dimensions.get('window');

export function QuickEditSheet() {
  const router = useRouter();
  const {
    visible,
    stage,
    functionType,
    styleKey,
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
  } = useQuickEditStore();

  const photoRestoration = usePhotoRestoration();
  const [isCropping, setIsCropping] = React.useState(false);
  const hasAppliedCropRef = React.useRef(false);
  const [mediaLoading, setMediaLoading] = React.useState(false);
  // Progress-based loading copy (no cycling back)
  const getLoadingMessage = (p: number) => {
    if (p < 10) return 'Uploading photo…';
    if (p < 30) return 'Running magic…';
    if (p < 55) return 'Fixing damage…';
    if (p < 80) return 'Enhancing details…';
    return 'Almost done…';
  };
  const modeTitle = React.useMemo(() => {
    switch (functionType) {
      case 'restoration':
        return 'Restore';
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
      case 'custom':
        return 'Custom Edit';
      default:
        return 'Edit Photo';
    }
  }, [functionType]);

  const translateY = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const MEDIA_HEIGHT = 240;
  const saveButtonScale = useSharedValue(1);
  const savedFeedback = useSharedValue(0);
  const handleClose = React.useCallback(() => {
    close();
    // Give the exit animation time, then aggressively free image memory
    setTimeout(() => {
      try { (ExpoImage as any).clearMemoryCache?.(); } catch {}
    }, 320);
  }, [close]);
  const [rendered, setRendered] = React.useState(false);
  React.useEffect(() => {
    // Mount and animate in
    if (visible) {
      setRendered(true);
      translateY.value = height;
      overlayOpacity.value = 0;
      // next frame animate
      requestAnimationFrame(() => {
        translateY.value = withTiming(0, { duration: 280 });
        overlayOpacity.value = withTiming(1, { duration: 280 });
      });
    } else {
      // Animate out then unmount
      translateY.value = withTiming(height, { duration: 260 });
      overlayOpacity.value = withTiming(0, { duration: 260 });
      const t = setTimeout(() => setRendered(false), 270);
      return () => clearTimeout(t);
    }
  }, [visible]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const saveBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveButtonScale.value }] }));
  const savedFeedbackStyle = useAnimatedStyle(() => ({
    opacity: savedFeedback.value,
    transform: [{ translateY: withTiming(savedFeedback.value > 0 ? 0 : 6, { duration: 200 }) }],
  }));

  const handlePick = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setMediaLoading(true);
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleCrop = () => {
    if (!selectedImageUri) return;
    hasAppliedCropRef.current = false;
    setIsCropping(true);
  };

  const handleUpload = async () => {
    if (!selectedImageUri || !functionType) return;
    setStage('loading');

    const started = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - started;
      const est = 10000; // 10s estimate for photos
      const p = Math.min(95, Math.floor((elapsed / est) * 95));
      setProgress(p);
    }, 500);

    try {
      const effectiveFunctionType = (functionType === 'repair' ? 'restoration' : functionType) as any;
      const data = await photoRestoration.mutateAsync({ imageUri: selectedImageUri, functionType: effectiveFunctionType, imageSource: 'gallery', customPrompt: customPrompt || undefined });
      const id = data.id;
      const restoredUri = (data as any).restoredImageUri || '';
      setResult(id, restoredUri);
    } catch (e) {
      setStage('preview');
    } finally {
      clearInterval(interval);
    }
  };

  const handleSave = async () => {
    if (!restoredId || !restoredImageUri) return;
    // Tap animation
    saveButtonScale.value = withTiming(0.96, { duration: 90 }, () => {
      saveButtonScale.value = withTiming(1, { duration: 120 });
    });
    await photoStorage.exportToCameraRoll(restoredImageUri);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    // Show success, then close
    savedFeedback.value = 1;
    setTimeout(() => {
      savedFeedback.value = withTiming(0, { duration: 220 });
      handleClose();
    }, 800);
  };

  const handleView = () => {
    if (!restoredId) return;
    close();
    router.push(`/restoration/${restoredId}`);
  };

  if (!rendered) return null;

  return (
    <Modal visible={true} transparent statusBarTranslucent animationType="none">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }, dimStyle]} />
        <Animated.View style={[{ paddingBottom: 0 }, sheetStyle]}>
          <View style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(12,12,14,0.96)', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <View style={{ padding: 16 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }} style={{ padding: 4 }}>
                  <IconSymbol name="xmark" size={20} color="#EAEAEA" />
                </TouchableOpacity>
                <Text style={{ color: '#EAEAEA', fontSize: 16, fontWeight: '700' }}>
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
                        <Text style={{ color: '#F59E0B', fontSize: 14, fontWeight: '800', textAlign: 'center' }}>Loading photo…</Text>
                      </View>
                    </View>
                  )}
                  {stage === 'loading' && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center', marginBottom: 4 }}>Please wait a few seconds</Text>
                        <Text style={{ color: '#F59E0B', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
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

              {/* Actions */}
              <View style={{ marginTop: 16, marginBottom: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {stage === 'select' && (
                  <TouchableOpacity onPress={handlePick} style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Select Photo</Text>
                  </TouchableOpacity>
                )}
                {stage === 'preview' && !isCropping && (
                  <>
                    <TouchableOpacity onPress={handleCrop} style={{ paddingHorizontal: 22, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Crop</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleUpload} style={{ flex: 1, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
                      <LinearGradient colors={['#F59E0B', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#0B0B0F', fontWeight: '900', fontSize: 16 }}>Upload</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {stage === 'preview' && isCropping && (
                  <>
                    <TouchableOpacity onPress={() => setIsCropping(false)} style={{ paddingHorizontal: 18, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { /* Save already applied in onEditingComplete; just exit crop */ setIsCropping(false); }} style={{ flex: 1, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
                      <LinearGradient colors={['#F59E0B', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#0B0B0F', fontWeight: '900', fontSize: 16 }}>Done</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {stage === 'done' && (
                  <>
                    <Animated.View style={[saveBtnStyle]}>
                      <TouchableOpacity onPress={handleSave} style={{ paddingHorizontal: 22, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
                      </TouchableOpacity>
                    </Animated.View>
                    <TouchableOpacity onPress={handleView} style={{ flex: 1, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
                      <LinearGradient colors={['#F59E0B', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#0B0B0F', fontWeight: '900', fontSize: 16 }}>View</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Save success mini-toast */}
              {stage === 'done' && (
                <Animated.View style={[{ alignItems: 'center' }, savedFeedbackStyle]}>
                  <View style={{ marginTop: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(34,197,94,0.2)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <IconSymbol name="checkmark" size={14} color="#22C55E" />
                    <Text style={{ color: '#22C55E', fontWeight: '700', fontSize: 12 }}>Saved to Photos</Text>
                  </View>
                </Animated.View>
              )}

              {/* No footer close; header X handles dismissal */}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
