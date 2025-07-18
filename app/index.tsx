import { ModeSelector } from '@/components/ModeSelector';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRestorationHistory } from '@/hooks/useRestorationHistory';
import { useRestorationStore } from '@/store/restorationStore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Define available modes
const MODES = [
  { id: 'restoration', name: 'Restore', icon: 'wand.and.stars' },
  { id: 'unblur', name: 'Unblur', icon: 'eye' },
  { id: 'colorize', name: 'Colorize', icon: 'paintbrush' }
] as const;

type ModeType = typeof MODES[number]['id'];

export default function MinimalCameraWithGalleryButton() {
  const [permission, requestPermission] = useCameraPermissions();
  const [enableTorch, setEnableTorch] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [isAppReady, setIsAppReady] = useState(false);
  const [functionType, setFunctionType] = useState<ModeType>('restoration');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  
  // Always fetch and sync restoration history on app start
  const { refetch } = useRestorationHistory();
  useEffect(() => {
    refetch({ cancelRefetch: false });
  }, []);
  
  // Use Zustand store for restorationCount
  const restorationCount = useRestorationStore((state) => state.restorationCount);
  
  // Debug logging for badge
  useEffect(() => {
    console.log('📊 Badge State:', {
      restorationCount,
    });
  }, [restorationCount]);
  
  
  // Animation values
  const captureButtonScale = useSharedValue(1);
  const flashAnimation = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);
  const badgeScale = useSharedValue(1);
  const badgeOpacity = useSharedValue(1);

  useEffect(() => {
    if (!permission) return;
    if (permission.status === 'undetermined') {
      requestPermission();
    }
  }, [permission, requestPermission]);
  
  useEffect(() => {
    // Defer heavy operations until after interactions complete
    InteractionManager.runAfterInteractions(() => {
      // Reduced delay for faster loading
      setTimeout(() => {
        console.log('📱 App is ready, enabling restoration history loading');
        setIsAppReady(true);
      }, 100);
    });
  }, []);
  
  useEffect(() => {
    // Subtle glow animation for capture button
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500 }),
        withTiming(0.3, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [glowOpacity]);
  
  // Animated styles
  const animatedCaptureStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: captureButtonScale.value }],
    };
  });

  const animatedFlashStyle = useAnimatedStyle(() => {
    return {
      opacity: flashAnimation.value,
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
    };
  });

  const animatedBadgeStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: badgeScale.value }],
      opacity: badgeOpacity.value,
    };
  });

    
  // Camera functions
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animate capture button
    captureButtonScale.value = withSequence(
      withSpring(0.8),
      withSpring(1)
    );

    // Flash animation
    flashAnimation.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 300 })
    );

    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        router.push(`/crop-modal?imageUri=${encodeURIComponent(photo.uri)}&functionType=${functionType}`);
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
    }
  }, [router, functionType, captureButtonScale, flashAnimation]);

  const handleGalleryPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        router.push(`/restoration/${Date.now()}?imageUri=${encodeURIComponent(result.assets[0].uri)}&functionType=${functionType}`);
      }
    } catch (error) {
      console.error('Gallery error:', error);
    }
  }, [router, functionType]);

  const toggleFlash = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnableTorch(current => !current);
  }, []);

  const handleModePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowModeSelector(true);
  }, []);

  // Make a mutable copy of MODES for ModeSelector
  const mutableModes = MODES.map(mode => ({ ...mode }));

  // Update handleModeSelect to accept modeId: string
  const handleModeSelect = useCallback((modeId: string) => {
    // Animate badge transition
    badgeScale.value = withSequence(
      withSpring(1.1, { damping: 15 }),
      withSpring(1, { damping: 15 })
    );
    badgeOpacity.value = withSequence(
      withTiming(0.7, { duration: 150 }),
      withTiming(1, { duration: 150 })
    );
    setFunctionType(modeId as ModeType);
    setShowModeSelector(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const getCurrentMode = useCallback(() => {
    return MODES.find(mode => mode.id === functionType) || MODES[0];
  }, [functionType]);


  if (!permission || !isAppReady) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
        <IconSymbol name="camera" size={64} color="#f97316" />
        <Text style={{ color: 'white', fontSize: 18, marginTop: 16 }}>
          {!permission ? 'Checking camera permissions...' : 'Loading camera...'}
        </Text>
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
        <CameraView 
          ref={cameraRef}
          style={{ flex: 1 }} 
          facing={facing}
          enableTorch={enableTorch}
        />
          
          {/* Flash overlay animation */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'white',
                pointerEvents: 'none',
              },
              animatedFlashStyle,
            ]}
          />


          {/* Top Controls */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 60, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Settings Button */}
              <TouchableOpacity
                onPress={() => router.push('/settings-modal')}
                style={{ width: 52, height: 52, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
              >
                <IconSymbol name="gear" size={28} color="#fff" />
              </TouchableOpacity>

              {/* Mode Selector Badge */}
              <TouchableOpacity onPress={handleModePress} activeOpacity={0.8}>
                <Animated.View
                  style={[
                    { 
                      backgroundColor: 'rgba(249,115,22,0.9)', 
                      paddingHorizontal: 16, 
                      paddingVertical: 8, 
                      borderRadius: 20, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      gap: 6 
                    },
                    animatedBadgeStyle
                  ]}
                >
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
                    {getCurrentMode().name}
                  </Text>
                  <IconSymbol name="chevron.down" size={12} color="white" />
                </Animated.View>
              </TouchableOpacity>

              {/* Flash/Torch Toggle */}
              <TouchableOpacity
                onPress={toggleFlash}
                style={{ width: 52, height: 52, backgroundColor: enableTorch ? 'rgba(249,115,22,0.9)' : 'rgba(0,0,0,0.6)', borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
              >
                <IconSymbol name={enableTorch ? 'bolt.fill' : 'bolt.slash'} size={28} color="#fff" />
              </TouchableOpacity>
            </View>

          </View>

          {/* Bottom Controls */}
          <View style={{ position: 'absolute', bottom: 64, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              {/* Gallery Button with Count Badge */}
              <TouchableOpacity
                onPress={() => router.push('/gallery-modal')}
                style={{ position: 'absolute', left: 32, width: 64, height: 64, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}
              >
                <IconSymbol name="photo" size={32} color="#fff" />
                {/* Always show badge for testing - replace with restorationCount > 0 later */}
                <View style={{ 
                  position: 'absolute', 
                  top: 4, 
                  right: 4, 
                  backgroundColor: '#f97316', 
                  borderRadius: 12, 
                  minWidth: 24, 
                  height: 24, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  borderWidth: 2, 
                  borderColor: '#000',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5
                }}>
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                    {restorationCount > 99 ? '99+' : restorationCount.toString()}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Capture Button with Glow */}
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {/* Glow Effect */}
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      width: 90,
                      height: 90,
                      borderRadius: 45,
                      backgroundColor: '#f97316',
                      shadowColor: '#f97316',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1,
                      shadowRadius: 20,
                      elevation: 20,
                    },
                    animatedGlowStyle,
                  ]}
                />
                <AnimatedTouchableOpacity
                  onPress={handleCapture}
                  style={[
                    {
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: '#f97316',
                      borderWidth: 4,
                      borderColor: '#fff',
                      justifyContent: 'center',
                      alignItems: 'center',
                    },
                    animatedCaptureStyle,
                  ]}
                >
                  <View style={{ width: 64, height: 64, backgroundColor: 'white', borderRadius: 32 }} />
                </AnimatedTouchableOpacity>
              </View>

              {/* Upload Button */}
              <TouchableOpacity
                onPress={handleGalleryPress}
                style={{ position: 'absolute', right: 32, width: 64, height: 64, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}
              >
                <IconSymbol name="photo.badge.plus" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode Selector Modal */}
          <ModeSelector
            visible={showModeSelector}
            modes={mutableModes}
            selectedMode={functionType}
            onSelect={handleModeSelect}
            onClose={() => setShowModeSelector(false)}
          />
      </View>
    );
  }

  return null;
}