import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { debugHelpers } from '@/src/locales/index';

// Debug component to display current i18n state
// Add this temporarily to any screen to see language info
export function DebugI18n() {
  const { t, i18n } = useTranslation();

  if (!__DEV__) {
    return null; // Hide in production
  }

  const showLanguageInfo = () => {
    const info = debugHelpers.getCurrentLanguageInfo();
    Alert.alert(
      'i18n Debug Info',
      `Current: ${info.currentLanguage}\nDevice: ${info.deviceLanguage}\nDetected: ${info.detectedLanguages?.join(', ')}\nResources: ${info.availableResources.length} languages`,
      [{ text: 'OK' }]
    );
  };

  const testShowcaseTranslation = () => {
    console.log('🌍 [i18n] Testing showcase translations:');
    debugHelpers.testTranslation('onboardingV4.showcase.backgrounds.title');
    debugHelpers.testTranslation('onboardingV4.showcase.outfits.subtitle');
    Alert.alert('Translation Test', 'Check console for translation resolution details', [{ text: 'OK' }]);
  };

  const forceLanguage = (lang: string) => {
    debugHelpers.forceLanguage(lang as any);
    Alert.alert('Language Changed', `Forced to ${lang}. Check console for details.`, [{ text: 'OK' }]);
  };

  return (
    <View style={{
      position: 'absolute',
      top: 50,
      right: 10,
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: 10,
      borderRadius: 8,
      zIndex: 9999,
      maxWidth: 200,
    }}>
      <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
        i18n Debug
      </Text>
      <Text style={{ color: 'white', fontSize: 10 }}>
        Current: {i18n.language}
      </Text>

      <TouchableOpacity
        onPress={showLanguageInfo}
        style={{ backgroundColor: '#333', padding: 4, marginTop: 4, borderRadius: 4 }}
      >
        <Text style={{ color: 'white', fontSize: 10 }}>Language Info</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={testShowcaseTranslation}
        style={{ backgroundColor: '#333', padding: 4, marginTop: 4, borderRadius: 4 }}
      >
        <Text style={{ color: 'white', fontSize: 10 }}>Test Showcase</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => forceLanguage('en-US')}
        style={{ backgroundColor: '#333', padding: 4, marginTop: 4, borderRadius: 4 }}
      >
        <Text style={{ color: 'white', fontSize: 10 }}>Force en-US</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => forceLanguage('en-CA')}
        style={{ backgroundColor: '#333', padding: 4, marginTop: 4, borderRadius: 4 }}
      >
        <Text style={{ color: 'white', fontSize: 10 }}>Force en-CA</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => debugHelpers.resetToDeviceLanguage()}
        style={{ backgroundColor: '#333', padding: 4, marginTop: 4, borderRadius: 4 }}
      >
        <Text style={{ color: 'white', fontSize: 10 }}>Reset Device</Text>
      </TouchableOpacity>
    </View>
  );
}