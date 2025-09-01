import React from 'react';
import { View, Text } from 'react-native';

export default function OnboardingTestSimple() {
  console.log('🔥 [SIMPLE-TEST] Component mounting...');
  
  return (
    <View style={{ flex: 1, backgroundColor: '#FF0000', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' }}>
        SIMPLE TEST WORKING
      </Text>
    </View>
  );
}