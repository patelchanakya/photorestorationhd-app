import React from 'react';
import { Dimensions, Pressable, View, Platform } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedGestureHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  maxHeightPercent?: number; // 0..1
  disableDismiss?: boolean; // prevent backdrop/gesture dismiss
  children: React.ReactNode;
};

export function BottomSheet({ visible, onDismiss, maxHeightPercent = 0.68, disableDismiss = false, children }: BottomSheetProps) {
  const SHEET_MAX_HEIGHT = Math.round(Dimensions.get('window').height * maxHeightPercent);
  const translateY = useSharedValue(40);
  const backdrop = useSharedValue(0);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 22, stiffness: 260, mass: 0.9 });
      backdrop.value = withTiming(0.28, { duration: 220, easing: Easing.bezier(0.22, 1, 0.36, 1) });
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  }, [visible, translateY, backdrop]);

  const handleClose = () => {
    if (disableDismiss) {
      return;
    }
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    translateY.value = withTiming(500, { duration: 160 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
    backdrop.value = withTiming(0, { duration: 160 });
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx: any) => {
      if (disableDismiss) return;
      const next = Math.max(0, ctx.startY + event.translationY);
      translateY.value = next;
      const progress = Math.min(1, next / 300);
      backdrop.value = 0.28 * (1 - progress);
    },
    onEnd: (event) => {
      if (disableDismiss) {
        translateY.value = withSpring(0, { damping: 24, stiffness: 260 });
        backdrop.value = withTiming(0.28, { duration: 150 });
        return;
      }
      const close = event.translationY + event.velocityY * 0.2 > 110;
      if (close) {
        translateY.value = withTiming(500, { duration: 160 }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        });
        backdrop.value = withTiming(0, { duration: 160 });
      } else {
        translateY.value = withSpring(0, { damping: 24, stiffness: 260 });
        backdrop.value = withTiming(0.28, { duration: 150 });
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!visible) return null;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, backdropStyle]}>
        {Platform.OS === 'ios' && (
          <BlurView intensity={12} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        )}
        <View style={{ flex: 1, backgroundColor: '#000' }} />
      </Animated.View>
      <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={handleClose} disabled={disableDismiss} />
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[{ maxHeight: SHEET_MAX_HEIGHT, backgroundColor: '#0B0B0F', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', paddingBottom: Math.max(10, insets.bottom + 6) }, sheetStyle]}>
          {/* Grab handle */}
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          </View>
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}


