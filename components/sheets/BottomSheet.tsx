import React from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedGestureHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  maxHeightPercent?: number; // 0..1
  children: React.ReactNode;
};

export function BottomSheet({ visible, onDismiss, maxHeightPercent = 0.68, children }: BottomSheetProps) {
  const SHEET_MAX_HEIGHT = Math.round(Dimensions.get('window').height * maxHeightPercent);
  const translateY = useSharedValue(40);
  const backdrop = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      backdrop.value = withTiming(0.28, { duration: 220 });
    }
  }, [visible, translateY, backdrop]);

  const handleClose = () => {
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
      const next = Math.max(0, ctx.startY + event.translationY);
      translateY.value = next;
      const progress = Math.min(1, next / 300);
      backdrop.value = 0.28 * (1 - progress);
    },
    onEnd: (event) => {
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
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000' }, backdropStyle]} />
      <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={handleClose} />
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[{ maxHeight: SHEET_MAX_HEIGHT, backgroundColor: '#0B0B0F', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' }, sheetStyle]}>
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


