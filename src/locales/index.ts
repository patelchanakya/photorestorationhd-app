import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import all translation files
import ar from './ar/translations.json';
import da from './da/translations.json';
import de from './de/translations.json';
import enAU from './en-AU/translations.json';
import enCA from './en-CA/translations.json';
import enGB from './en-GB/translations.json';
import enUS from './en-US/translations.json';
import esES from './es-ES/translations.json';
import esMX from './es-MX/translations.json';
import fi from './fi/translations.json';
import frCA from './fr-CA/translations.json';
import fr from './fr/translations.json';
import hr from './hr/translations.json';
import it from './it/translations.json';
import ja from './ja/translations.json';
import ko from './ko/translations.json';
import nl from './nl/translations.json';
import no from './no/translations.json';
import pl from './pl/translations.json';
import ptBR from './pt-BR/translations.json';
import ptPT from './pt-PT/translations.json';
import ru from './ru/translations.json';
import sv from './sv/translations.json';
import tr from './tr/translations.json';
import uk from './uk/translations.json';
import zhCN from './zh-CN/translations.json';

// Storage key for persisted language preference
const LANGUAGE_STORAGE_KEY = '@app_language';

// Create resources object - react-i18next expects translation namespace
const resources = {
  'en-US': { translation: enUS },
  'ar': { translation: ar },
  'hr': { translation: hr },
  'da': { translation: da },
  'nl': { translation: nl },
  'en-AU': { translation: enAU },
  'en-CA': { translation: enCA },
  'en-GB': { translation: enGB },
  'fi': { translation: fi },
  'fr': { translation: fr },
  'fr-CA': { translation: frCA },
  'de': { translation: de },
  'it': { translation: it },
  'ja': { translation: ja },
  'ko': { translation: ko },
  'no': { translation: no },
  'pl': { translation: pl },
  'pt-BR': { translation: ptBR },
  'pt-PT': { translation: ptPT },
  'ru': { translation: ru },
  'es-MX': { translation: esMX },
  'es-ES': { translation: esES },
  'sv': { translation: sv },
  'tr': { translation: tr },
  'uk': { translation: uk },
  'zh-CN': { translation: zhCN },
};

export type AvailableLanguage = keyof typeof resources;

// Language display names in their native language
export const languageNames: Record<AvailableLanguage, string> = {
  'en-US': 'English (US)',
  'ar': 'العربية',
  'hr': 'Hrvatski',
  'da': 'Dansk',
  'nl': 'Nederlands',
  'en-AU': 'English (Australia)',
  'en-CA': 'English (Canada)',
  'en-GB': 'English (UK)',
  'fi': 'Suomi',
  'fr': 'Français',
  'fr-CA': 'Français (Canada)',
  'de': 'Deutsch',
  'it': 'Italiano',
  'ja': '日本語',
  'ko': '한국어',
  'no': 'Norsk',
  'pl': 'Polski',
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  'ru': 'Русский',
  'es-MX': 'Español (México)',
  'es-ES': 'Español (España)',
  'sv': 'Svenska',
  'tr': 'Türkçe',
  'uk': 'Українська',
  'zh-CN': '中文 (简体)',
};

export const availableLanguages = Object.keys(resources) as AvailableLanguage[];

// Function to detect device language and return supported language
function getDeviceLanguage(): AvailableLanguage {
  const locales = Localization.getLocales();
  if (locales && locales.length > 0) {
    const deviceLocale = locales[0].languageTag;
    
    // Try exact match first
    if (deviceLocale in resources) {
      return deviceLocale as AvailableLanguage;
    }

    // Try language code only (e.g., 'en' from 'en-US')
    const languageCode = locales[0].languageCode;
    if (languageCode) {
      // Find first matching language, prioritizing main variants
      let matchingLang = Object.keys(resources).find(
        lang => lang === languageCode
      );
      
      if (!matchingLang) {
        matchingLang = Object.keys(resources).find(
          lang => lang.startsWith(languageCode + '-')
        );
      }
      
      if (matchingLang) {
        return matchingLang as AvailableLanguage;
      }
    }
  }

  return 'en-US';
}

// Check if language is RTL
export function isRTL(language?: AvailableLanguage): boolean {
  const lang = language || i18n.language;
  return lang === 'ar';
}

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (language: string) => void) => {
    try {
      // Check for stored language preference
      const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (storedLanguage && storedLanguage in resources) {
        return callback(storedLanguage);
      }

      // Use device language
      const deviceLanguage = getDeviceLanguage();
      
      // Save device language as preference
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, deviceLanguage);
      return callback(deviceLanguage);
    } catch (error) {
      console.error('Failed to detect language:', error);
      return callback('en-US');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.error('Failed to cache user language:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,
    fallbackLng: 'en-US',
    debug: __DEV__,
    defaultNS: 'translation',
    ns: ['translation'],
    keySeparator: '.',
    nsSeparator: ':',
    interpolation: {
      escapeValue: false, // not needed for React Native
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;