import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

export type ModeCategory = 'all' | 'repair' | 'clothing' | 'background' | 'style';

interface ModesFilterBarProps {
  category: ModeCategory;
  onChange: (c: ModeCategory) => void;
}

const ITEMS: { key: ModeCategory; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'square.grid.2x2' },
  { key: 'repair', label: 'Repair', icon: 'wand.and.stars' },
  { key: 'clothing', label: 'Clothing', icon: 'tshirt' },
  { key: 'background', label: 'Background', icon: 'photo' },
  { key: 'style', label: 'Style', icon: 'sparkles' },
];

export function ModesFilterBar({ category, onChange }: ModesFilterBarProps) {
  const items = ITEMS;

  const tile = (c: typeof items[number]) => {
    const isActive = category === c.key;
    return (
      <TouchableOpacity
        key={c.key}
        onPress={() => onChange(c.key)}
        activeOpacity={0.9}
        style={{
          width: '48%',
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          backgroundColor: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
          borderWidth: 1,
          borderColor: isActive ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'
        }}
      >
        <IconSymbol name={c.icon as any} size={16} color="#EAEAEA" />
        <Text style={{ color: '#EAEAEA', fontWeight: isActive ? '700' : '600', fontSize: 13 }}>{c.label}</Text>
      </TouchableOpacity>
    );
  };

  const rows: (typeof items[number] | null)[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1] ?? null]);
  }

  return (
    <View style={{ backgroundColor: '#0B0B0F', paddingHorizontal: 12, paddingTop: 2, paddingBottom: 8 }}>
      {rows.map((row, idx) => (
        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: idx === rows.length - 1 ? 0 : 8 }}>
          {row[0] ? tile(row[0]) : <View style={{ width: '48%' }} />}
          {row[1] ? tile(row[1]!) : <View style={{ width: '48%' }} />}
        </View>
      ))}
    </View>
  );
}


