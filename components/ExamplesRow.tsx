import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

type Mode = 'restoration' | 'unblur' | 'colorize' | 'descratch';

interface ExampleCard {
  id: string;
  title: string;
  mode: Mode;
  image: any; // require('...')
  sampleUri?: string; // optional local sample to feed crop-modal
}

const EXAMPLES: ExampleCard[] = [
  {
    id: 'ex1',
    title: 'Old family photo → Repaired',
    mode: 'restoration',
    image: require('../assets/images/onboarding/before-2.jpg'),
  },
  {
    id: 'ex2',
    title: 'Blurred portrait → Unblurred',
    mode: 'unblur',
    image: require('../assets/images/onboarding/after-3.png'),
  },
  {
    id: 'ex3',
    title: 'B&W to Color',
    mode: 'colorize',
    image: require('../assets/images/onboarding/after-4.png'),
  },
];

export function ExamplesRow() {
  const router = useRouter();

  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', paddingHorizontal: 16, marginBottom: 8 }}>Examples</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
        {EXAMPLES.map((ex) => (
          <TouchableOpacity
            key={ex.id}
            onPress={() => {
              // Navigate to crop modal with example mode; sampleUri could be wired in future
              router.push(`/crop-modal?functionType=${ex.mode}&imageSource=gallery`);
            }}
            activeOpacity={0.9}
            style={{ width: 260, height: 150, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
          >
            <ExpoImage source={ex.image} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.35)' }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{ex.title}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}


