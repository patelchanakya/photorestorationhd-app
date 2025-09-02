import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import * as Localization from 'expo-localization';
import { translationManager, AvailableLanguage, languageNames } from '@/src/locales/translations';

export function useTranslation() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = translationManager.subscribe(() => {
      forceUpdate({});
    });

    // Listen for app state changes to detect locale changes on Android
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Check if device locale changed and update if needed
        const locales = Localization.getLocales();
        if (locales && locales.length > 0) {
          const deviceLocale = locales[0].languageTag;
          const currentLanguage = translationManager.getCurrentLanguage();
          
          // Only auto-update if user hasn't manually set a language
          // (You could add a flag to track manual vs automatic language selection)
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      unsubscribe();
      subscription?.remove();
    };
  }, []);

  const translate = (key: string, params?: Record<string, string | number>) => {
    return translationManager.translate(key, params);
  };

  const setLanguage = async (language: AvailableLanguage) => {
    await translationManager.setLanguage(language);
  };

  return {
    t: translate,
    setLanguage,
    currentLanguage: translationManager.getCurrentLanguage(),
    availableLanguages: Object.keys(languageNames) as AvailableLanguage[],
    languageNames,
    isRTL: translationManager.isRTL(),
  };
}

// Convenience hook for just getting the translation function
export function useT() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = translationManager.subscribe(() => {
      forceUpdate({});
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const translate = (key: string, params?: Record<string, string | number>) => {
    return translationManager.translate(key, params);
  };

  return translate;
}