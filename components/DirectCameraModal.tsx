import { useRestorationHistory } from '@/hooks/useRestorationHistory';
import { useRestorationStore } from '@/store/restorationStore';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { CameraViewfinder } from './CameraViewfinder';
import { IconSymbol } from './ui/IconSymbol';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface DirectCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoSelected: (uri: string, functionType: 'restoration' | 'unblur') => void;
  defaultFunctionType?: 'restoration' | 'unblur';
}

export function DirectCameraModal({ 
  visible, 
  onClose, 
  onPhotoSelected,
  defaultFunctionType = 'restoration' 
}: DirectCameraModalProps) {
  console.log('[DirectCameraModal] Mounted');
  const [facing, setFacing] = useState<CameraType>('back');
  // Flash removed from app
  const [permission, requestPermission] = useCameraPermissions();
  const [functionType, setFunctionType] = useState<'restoration' | 'unblur'>(defaultFunctionType);
  const router = useRouter();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [cameraInstanceKey, setCameraInstanceKey] = useState(0); // NEW: key for CameraView
  const [zoom, setZoom] = useState(1);
  const cameraRef = useRef<CameraView>(null);
  const isMounted = useRef(true);
  
  // Get restoration count from Zustand store for badge
  const restorationCount = useRestorationStore((state) => state.restorationCount);
  
  // Animation values
  const captureButtonScale = useSharedValue(1);
  const flashAnimation = useSharedValue(0);
  const savedZoom = useSharedValue(1);
  const scale = useSharedValue(1);
  
  console.log('[DirectCameraModal] Rendering with visible:', visible, 'appState:', appState);

  // Handle component mount/unmount
  useEffect(() => {
    isMounted.current = true;
    console.log('[DirectCameraModal] Component mounted');
    
    return () => {
      isMounted.current = false;
      console.log('[DirectCameraModal] Component unmounting');
      // Clean up camera resources
      setIsCameraReady(false);
    };
  }, []);
  
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('[DirectCameraModal] App state changing from', appState, 'to', nextAppState);
      
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[DirectCameraModal] App has come to foreground');
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[DirectCameraModal] App going to background');
        // Disable camera features when going to background
          setIsCameraReady(false);
      }
      
      setAppState(nextAppState);
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [appState]);
  
  // Handle modal visibility changes
  useEffect(() => {
    if (!visible) {
      console.log('[DirectCameraModal] Modal closing, cleaning up camera');
      setIsCameraReady(false);
      setFacing('back');
      setCameraInstanceKey((k) => k + 1); // Force remount CameraView
      // Reset to back camera when closing
    } else {
      console.log('[DirectCameraModal] Modal opening');
      // Request permissions when opening if not granted
      if (!permission?.granted) {
        requestPermission();
      }
      setIsCameraReady(false);
      setFacing('back');
    }
  }, [visible, permission?.granted, requestPermission]);
  
  // Handle function type changes
  useEffect(() => {
    setFunctionType(defaultFunctionType);
  }, [defaultFunctionType]);

  // Ensure restoration count is fetched and synced on mount
  const { refetch } = useRestorationHistory();
  useEffect(() => {
    console.log('[DirectCameraModal] Forcing restoration history refetch on mount (cancelRefetch: false)');
    refetch({ cancelRefetch: false });
  }, []);

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

  // Pinch-to-zoom gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newZoom = Math.max(1, Math.min(savedZoom.value * event.scale, 10));
      scale.value = event.scale;
      setZoom(newZoom);
    })
    .onEnd(() => {
      savedZoom.value = zoom;
      scale.value = withSpring(1);
    });

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady || !isMounted.current) {
      console.log('[DirectCameraModal] Cannot capture - camera not ready or component unmounted');
      return;
    }

    console.log('[DirectCameraModal] Starting capture');
    
    // Haptic feedback
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
      
      if (photo && isMounted.current) {
        console.log('[DirectCameraModal] Photo captured successfully:', photo.uri);
        // Navigate to crop modal instead of directly processing
        router.push(`/crop-modal?imageUri=${encodeURIComponent(photo.uri)}&functionType=${functionType}`);
        onClose();
      }
    } catch (error) {
      console.error('[DirectCameraModal] Failed to take picture:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to capture photo. Please try again.');
      }
    }
  }, [isCameraReady, functionType, onPhotoSelected, onClose, captureButtonScale, flashAnimation]);

  const handleGalleryPress = useCallback(async () => {
    console.log('[DirectCameraModal] Opening gallery');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0] && isMounted.current) {
        console.log('[DirectCameraModal] Image selected from gallery');
        // Navigate to crop modal for consistent UX
        router.push(`/crop-modal?imageUri=${encodeURIComponent(result.assets[0].uri)}&functionType=${functionType}`);
        onClose();
      }
    } catch (error) {
      console.error('[DirectCameraModal] Gallery error:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to access gallery. Please try again.');
      }
    }
  }, [functionType, onPhotoSelected, onClose]);

  const toggleCameraFacing = useCallback(() => {
    console.log('[DirectCameraModal] Toggling camera facing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }, []);

  // Flash toggle removed

  const toggleFunctionType = useCallback(() => {
    console.log('[DirectCameraModal] Toggling function type');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFunctionType(current => 
      current === 'restoration' ? 'unblur' : 'restoration'
    );
  }, []);
  
  const handleCameraReady = useCallback(() => {
    console.log('[DirectCameraModal] Camera ready');
    setIsCameraReady(true);
  }, []);
  
  const handleCameraError = useCallback((error: any) => {
    console.error('[DirectCameraModal] Camera error:', error);
    setIsCameraReady(false);
    if (isMounted.current) {
      Alert.alert(
        'Camera Error',
        'Unable to access camera. Please check permissions and try again.',
        [
          { text: 'OK', onPress: onClose }
        ]
      );
    }
  }, [onClose]);

  // Don't render anything if modal is not visible
  if (!visible) {
    return null;
  }
  
  // Show loading state while permissions are being checked
  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide">
        <View className="flex-1 bg-black justify-center items-center">
          <Text className="text-white text-lg">Loading camera...</Text>
        </View>
      </Modal>
    );
  }

  // Show permission request UI
  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View className="flex-1 bg-black justify-center items-center px-6">
          <IconSymbol name="camera" size={64} color="#fff" />
          <Text className="text-white text-xl font-semibold mt-4 mb-2">Camera Permission Required</Text>
          <Text className="text-white/70 text-center mb-6">
            Please grant camera permission to capture photos for restoration.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="bg-orange-500 px-8 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            className="mt-4"
          >
            <Text className="text-white/70">Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }
  
  // Don't render camera if app is in background
  if (appState !== 'active') {
    return (
      <Modal visible={visible} animationType="slide">
        <View className="flex-1 bg-black justify-center items-center">
          <Text className="text-white text-lg">Camera paused</Text>
        </View>
      </Modal>
    );
  }

  // Refactored: CameraView has no children. Overlays are absolutely positioned in a parent View.
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <GestureDetector gesture={pinchGesture}>
        <View style={{ flex: 1, position: 'relative', backgroundColor: 'black' }}>
          <CameraView
            key={cameraInstanceKey} // NEW: force remount on modal open/close
            ref={cameraRef}
            style={{ ...StyleSheet.absoluteFillObject }}
            facing={facing}
            // Flash removed
            zoom={zoom}
            onCameraReady={handleCameraReady}
            onMountError={handleCameraError}
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

        {/* Center Viewfinder and Zoom Indicator */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
          <CameraViewfinder />
          <View style={{ marginTop: 16, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
            <Text style={{ color: 'white', fontSize: 14, fontWeight: '500' }}>
              {zoom.toFixed(1)}x
            </Text>
          </View>
        </View>

        {/* Top Controls */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 48, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Settings Button */}
            <TouchableOpacity
              onPress={toggleFunctionType}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}
            >
              <IconSymbol name="gear" size={22} color="#fff" />
            </TouchableOpacity>

            {/* Function Type Indicator */}
            <View style={{ backgroundColor: 'rgba(249,115,22,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
                {functionType === 'restoration' ? 'Restore' : 'Unblur'}
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <IconSymbol name="xmark" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

        </View>

        {/* Bottom Controls */}
        <View style={{ position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            {/* Gallery Button with Count Badge */}
            <TouchableOpacity
              onPress={handleGalleryPress}
              style={{ position: 'absolute', left: 32, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}
            >
              <IconSymbol name="photo" size={28} color="#fff" />
              {restorationCount > 0 && (
                <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#f97316', borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000' }}>
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                    {restorationCount > 99 ? '99+' : restorationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Capture Button */}
            <AnimatedTouchableOpacity
              onPress={handleCapture}
              style={[
                {
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: 'red',
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

            {/* Upload Button */}
            <TouchableOpacity
              onPress={handleGalleryPress}
              style={{ position: 'absolute', right: 32, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}
            >
              <IconSymbol name="square.and.arrow.up" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </GestureDetector>
    </Modal>
  );
}