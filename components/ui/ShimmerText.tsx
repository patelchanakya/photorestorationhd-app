import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './IconSymbol';

interface ShimmerTextProps {
  onPress: () => void;
  children: string;
  style?: any;
}

export const ShimmerText = React.memo(function ShimmerText({ onPress, children, style }: ShimmerTextProps) {
  const isProcessingRef = React.useRef(false);

  const textStyle = React.useMemo(() => [
    {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 14,
      fontFamily: 'Lexend-Medium',
      letterSpacing: -0.1,
      textAlign: 'center' as const,
    },
    style,
  ], [style]);

  const handlePress = React.useCallback(() => {
    if (isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    onPress();
    
    // Reset after a short delay to prevent rapid successive clicks
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 200);
  }, [onPress]);

  return (
    <TouchableOpacity 
      onPress={handlePress} 
      activeOpacity={0.5}
      hitSlop={{ top: 10, bottom: 10, left: 15, right: 15 }}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconSymbol name="pencil" size={14} color="rgba(255,255,255,0.7)" />
        <Text style={textStyle}>
          {children}
        </Text>
      </View>
    </TouchableOpacity>
  );
});