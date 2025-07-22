import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPPORTED_LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇵🇹',
  },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;
export type LanguageInfo = typeof SUPPORTED_LANGUAGES[SupportedLanguage];

const LANGUAGE_STORAGE_KEY = 'user_selected_language';
const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Get the device's preferred language, falling back to supported languages
 */
export function getDeviceLanguage(): SupportedLanguage {
  const locales = getLocales();
  
  for (const locale of locales) {
    const languageCode = locale.languageCode?.toLowerCase();
    if (languageCode && languageCode in SUPPORTED_LANGUAGES) {
      return languageCode as SupportedLanguage;
    }
  }
  
  return DEFAULT_LANGUAGE;
}

/**
 * Get the user's selected language or detect from device
 */
export async function getCurrentLanguage(): Promise<SupportedLanguage> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && stored in SUPPORTED_LANGUAGES) {
      return stored as SupportedLanguage;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Error getting stored language:', error);
    }
  }
  
  return getDeviceLanguage();
}

/**
 * Save the user's language preference
 */
export async function setCurrentLanguage(language: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    if (__DEV__) {
      console.error('Error saving language:', error);
    }
  }
}

/**
 * Get language info for a language code
 */
export function getLanguageInfo(code: SupportedLanguage): LanguageInfo {
  return SUPPORTED_LANGUAGES[code];
}

/**
 * Get all supported languages as an array
 */
export function getSupportedLanguages(): LanguageInfo[] {
  return Object.values(SUPPORTED_LANGUAGES);
}