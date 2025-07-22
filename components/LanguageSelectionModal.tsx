import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTranslation, getSupportedLanguages, type SupportedLanguage } from '@/i18n';
import * as Haptics from 'expo-haptics';

interface LanguageSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSelectionModal({ visible, onClose }: LanguageSelectionModalProps) {
  const { t, currentLanguage, setLanguage } = useTranslation();
  const supportedLanguages = getSupportedLanguages();

  const handleLanguageSelect = async (languageCode: SupportedLanguage) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setLanguage(languageCode);
      onClose();
    } catch (error) {
      if (__DEV__) {
        console.error('Error setting language:', error);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-black">
        {/* Header */}
        <View className="flex-row justify-between items-center px-4 py-3 border-b border-white/10">
          <View className="w-8" />
          <Text className="text-white text-lg font-semibold">
            {t('language.selectLanguage')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 items-center justify-center"
          >
            <IconSymbol name="chevron.down" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Language List */}
        <ScrollView className="flex-1 px-4">
          <View className="py-5">
            {supportedLanguages.map((language) => (
              <TouchableOpacity
                key={language.code}
                onPress={() => handleLanguageSelect(language.code)}
                className="flex-row items-center p-4 bg-white/5 rounded-xl mb-3"
                activeOpacity={0.7}
              >
                <Text className="text-2xl mr-4">{language.flag}</Text>
                <View className="flex-1">
                  <Text className="text-white text-base font-medium">
                    {language.nativeName}
                  </Text>
                  <Text className="text-white/60 text-sm">
                    {language.name}
                  </Text>
                </View>
                {currentLanguage === language.code && (
                  <IconSymbol name="checkmark" size={20} color="#22c55e" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}