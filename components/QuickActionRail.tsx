import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from './ui/IconSymbol';

const ACTIONS: { route: string; label: string; icon: string }[] = [
  { route: '/text-edits', label: 'Photo Magic', icon: 'wand.and.stars' },
];

export function QuickActionRail() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const insets = useSafeAreaInsets();

  const go = async (route: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await router.push(route as any);
    } finally {
      // Small delay to prevent rapid re-entry if animations stack
      setTimeout(() => setBusy(false), 400);
    }
  };

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        paddingBottom: insets?.bottom || 0,
      }}
    >
      {/* Gradient fade at top */}
      <LinearGradient
        colors={['transparent', 'rgba(11,11,15,0.8)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 120,
          zIndex: -1,
        }}
      />
      
      <View
        style={{
          marginHorizontal: 20,
          marginBottom: 12,
          backgroundColor: 'rgba(20,20,24,0.95)',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
          minWidth: '90%',
          maxWidth: 400,
        }}
      >
        {/* Rainbow gradient border effect */}
        <LinearGradient
          colors={['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#FD79A8', '#A29BFE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            left: -1,
            right: -1,
            top: -1,
            height: 3,
            opacity: 0.8,
          }}
        />
        
        <View style={{ 
          paddingHorizontal: 12, 
          paddingVertical: 10,
        }}>
          {ACTIONS.map((a, index) => (
            <TouchableOpacity
              key={a.route}
              onPress={() => go(a.route)}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{
                height: 54,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'space-between',
                flexDirection: 'row',
                backgroundColor: 'rgba(255,255,255,0.03)',
                paddingHorizontal: 14,
                marginTop: index === 0 ? 0 : 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ 
                  width: 38, 
                  height: 38, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                }}>
                  <IconSymbol name={a.icon as any} size={20} color={'rgba(255,255,255,0.7)'} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15, letterSpacing: 0.2 }}>{a.label}</Text>
                    {a.label === 'Photo Magic' && (
                      <View
                        className="ml-2 px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10"
                        accessibilityLabel="New feature"
                      >
                        <Text className="text-amber-300 text-[10px] font-extrabold tracking-wider">NEW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 }}>Custom text edits</Text>
                </View>
              </View>
              <View style={{ 
                width: 28, 
                height: 28, 
                borderRadius: 14, 
                backgroundColor: 'rgba(255,255,255,0.05)',
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <IconSymbol name={'arrow.right'} size={14} color={'rgba(255,255,255,0.6)'} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}


