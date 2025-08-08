import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from './ui/IconSymbol';

const ACTIONS: { route: string; label: string; icon: string }[] = [
  { route: '/text-edits', label: 'Text edit', icon: 'pencil' },
];

export function QuickActionRail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const go = (route: string) => router.push(route as any);

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: (insets?.bottom || 0) + (Platform.OS === 'ios' ? 6 : 10),
      }}
    >
      {ACTIONS.map((a, index) => (
        <TouchableOpacity
          key={a.route}
          onPress={() => go(a.route)}
          activeOpacity={0.9}
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            height: 50,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            marginTop: index === 0 ? 0 : 8,
          }}
        >
          <LinearGradient
            colors={[ '#FFB54D', '#FF7A00' ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ ...StyleSheet.absoluteFillObject }}
          />
          <IconSymbol name={a.icon as any} size={18} color={'#0B0B0F'} />
          <Text style={{ color: '#0B0B0F', fontWeight: '900', fontSize: 15, marginLeft: 8 }}>{a.label}</Text>
          <View style={{ position: 'absolute', right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: '#0B0B0F', alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name={'chevron.right'} size={18} color={'#FFFFFF'} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}


