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

// Storage keys for language detection system
const LANGUAGE_STORAGE_KEY = '@app_language'; // Current selected language
const DEVICE_LANGUAGE_STORAGE_KEY = '@app_device_language'; // Last detected device language
const MANUAL_SELECTION_STORAGE_KEY = '@app_language_manual'; // Was language manually selected by user

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

  if (__DEV__) {
    console.log('🌍 [i18n] Device locales:', locales);
  }

  if (locales && locales.length > 0) {
    const deviceLocale = locales[0].languageTag;

    if (__DEV__) {
      console.log('🌍 [i18n] Primary device locale:', deviceLocale);
      console.log('🌍 [i18n] Language code:', locales[0].languageCode);
    }

    // Try exact match first
    if (deviceLocale in resources) {
      if (__DEV__) {
        console.log('🌍 [i18n] Exact locale match found:', deviceLocale);
      }
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
        if (__DEV__) {
          console.log('🌍 [i18n] Language code match found:', matchingLang);
        }
        return matchingLang as AvailableLanguage;
      }
    }
  }

  if (__DEV__) {
    console.log('🌍 [i18n] No match found, falling back to en-US');
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
      // ALWAYS detect current device language first
      const currentDeviceLanguage = getDeviceLanguage();

      if (__DEV__) {
        console.log('🌍 [i18n] Current device language:', currentDeviceLanguage);
      }

      // Get stored values
      const [storedLanguage, storedDeviceLanguage, isManualSelection] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
        AsyncStorage.getItem(DEVICE_LANGUAGE_STORAGE_KEY),
        AsyncStorage.getItem(MANUAL_SELECTION_STORAGE_KEY),
      ]);

      const wasManuallySet = isManualSelection === 'true';

      if (__DEV__) {
        console.log('🌍 [i18n] Stored language:', storedLanguage);
        console.log('🌍 [i18n] Stored device language:', storedDeviceLanguage);
        console.log('🌍 [i18n] Was manually set:', wasManuallySet);
      }

      // Determine the situation
      const isFirstTime = !storedDeviceLanguage;
      const deviceLanguageChanged = storedDeviceLanguage && storedDeviceLanguage !== currentDeviceLanguage;

      if (__DEV__) {
        console.log('🌍 [i18n] Is first time:', isFirstTime);
        if (deviceLanguageChanged) {
          console.log('🌍 [i18n] Device language changed from', storedDeviceLanguage, 'to', currentDeviceLanguage);
        }
      }

      let selectedLanguage: string;

      if (isFirstTime) {
        // First time - always use device language
        selectedLanguage = currentDeviceLanguage;

        if (__DEV__) {
          console.log('🌍 [i18n] First time detection, using device language:', selectedLanguage);
        }
      } else if (deviceLanguageChanged && !wasManuallySet) {
        // Device language changed and user didn't manually override - use new device language
        selectedLanguage = currentDeviceLanguage;

        if (__DEV__) {
          console.log('🌍 [i18n] Switching to new device language:', selectedLanguage);
        }
      } else if (storedLanguage && storedLanguage in resources) {
        // Use stored language preference (same device language or manual selection)
        selectedLanguage = storedLanguage;

        if (__DEV__) {
          console.log('🌍 [i18n] Using stored language preference:', selectedLanguage);
        }
      } else {
        // Fallback to device language
        selectedLanguage = currentDeviceLanguage;

        if (__DEV__) {
          console.log('🌍 [i18n] Fallback to device language:', selectedLanguage);
        }
      }

      // Update stored values
      await Promise.all([
        AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage),
        AsyncStorage.setItem(DEVICE_LANGUAGE_STORAGE_KEY, currentDeviceLanguage),
        // Only clear manual flag if device language changed and we switched
        deviceLanguageChanged && !wasManuallySet
          ? AsyncStorage.removeItem(MANUAL_SELECTION_STORAGE_KEY)
          : Promise.resolve(),
      ]);

      if (__DEV__) {
        console.log('🌍 [i18n] Final language selection:', selectedLanguage);
        console.log('🌍 [i18n] Available resources:', Object.keys(resources));
      }

      return callback(selectedLanguage);
    } catch (error) {
      console.error('🌍 [i18n] Failed to detect language:', error);
      return callback('en-US');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      // When user manually changes language, mark it as manual selection
      await Promise.all([
        AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language),
        AsyncStorage.setItem(MANUAL_SELECTION_STORAGE_KEY, 'true'),
      ]);

      if (__DEV__) {
        console.log('🌍 [i18n] Manually cached user language:', language);
      }
    } catch (error) {
      console.error('🌍 [i18n] Failed to cache user language:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,

    // Proper regional fallback configuration for all 26 languages
    fallbackLng: {
      // English variants fallback to each other, then to base English
      'en-CA': ['en-US', 'en-GB', 'en-AU'],
      'en-GB': ['en-US', 'en-CA', 'en-AU'],
      'en-AU': ['en-US', 'en-GB', 'en-CA'],
      'en-US': ['en-GB', 'en-CA', 'en-AU'],

      // French variants fallback to each other, then to English
      'fr-CA': ['fr', 'en-CA', 'en-US'],
      'fr': ['fr-CA', 'en-US'],

      // Spanish variants fallback to each other, then to English
      'es-MX': ['es-ES', 'en-US'],
      'es-ES': ['es-MX', 'en-US'],

      // Portuguese variants fallback to each other, then to English
      'pt-BR': ['pt-PT', 'en-US'],
      'pt-PT': ['pt-BR', 'en-US'],

      // All other languages fallback to English variants
      'ar': ['en-US'],
      'hr': ['en-US'],
      'da': ['sv', 'no', 'en-US'], // Nordic languages fallback to each other
      'sv': ['da', 'no', 'en-US'],
      'no': ['sv', 'da', 'en-US'],
      'nl': ['de', 'en-US'], // Germanic languages fallback to each other
      'de': ['nl', 'en-US'],
      'fi': ['sv', 'en-US'], // Finnish fallback to Swedish (common in Finland)
      'it': ['en-US'],
      'ja': ['en-US'],
      'ko': ['en-US'],
      'pl': ['en-US'],
      'ru': ['uk', 'en-US'], // Slavic languages fallback to each other
      'uk': ['ru', 'en-US'],
      'tr': ['en-US'],
      'zh-CN': ['en-US'],

      // Default fallback chain
      'default': ['en-US', 'en-GB', 'en-CA']
    },

    // Enhanced debug logging
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

// Add comprehensive debugging helpers
if (__DEV__) {
  // Log language info after i18n is initialized
  i18n.on('initialized', () => {
    console.log('🌍 [i18n] i18next initialized');
    console.log('🌍 [i18n] Current language:', i18n.language);
    console.log('🌍 [i18n] Detected languages:', i18n.languages);
    console.log('🌍 [i18n] Fallback languages:', i18n.options.fallbackLng);
  });

  // Log language changes
  i18n.on('languageChanged', (lng) => {
    console.log('🌍 [i18n] Language changed to:', lng);
  });

  // Log when fallback is used
  i18n.on('missingKey', (lng, namespace, key) => {
    console.log('🌍 [i18n] Missing translation key:', { lng, namespace, key });
    console.log('🌍 [i18n] Will use fallback language');
  });

  // Override the t function to log which locale provides translations
  const originalT = i18n.t.bind(i18n);
  i18n.t = function(key: string, ...args: any[]) {
    const result = originalT(key, ...args);

    // Log translation resolution for specific keys we care about
    if (key.includes('showcase') || key.includes('onboarding')) {
      console.log('🌍 [i18n] Translation resolved:', {
        key,
        currentLanguage: i18n.language,
        resolvedFrom: i18n.hasResourceBundle(i18n.language, 'translation') ? i18n.language : 'fallback',
        result: result.slice(0, 50) + (result.length > 50 ? '...' : '')
      });
    }

    return result;
  };
}

// Debug helper functions for testing
export const debugHelpers = {
  // Force a specific language for testing
  forceLanguage: async (language: AvailableLanguage) => {
    if (__DEV__) {
      console.log('🌍 [i18n] DEBUG: Forcing language to:', language);
      await i18n.changeLanguage(language);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      await AsyncStorage.setItem(MANUAL_SELECTION_STORAGE_KEY, 'true');
    }
  },

  // Get current language info
  getCurrentLanguageInfo: async () => {
    const [storedLanguage, storedDeviceLanguage, isManualSelection] = await Promise.all([
      AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
      AsyncStorage.getItem(DEVICE_LANGUAGE_STORAGE_KEY),
      AsyncStorage.getItem(MANUAL_SELECTION_STORAGE_KEY),
    ]);

    return {
      currentLanguage: i18n.language,
      detectedLanguages: i18n.languages,
      currentDeviceLanguage: getDeviceLanguage(),
      storedLanguage,
      storedDeviceLanguage,
      isManualSelection: isManualSelection === 'true',
      availableResources: Object.keys(resources),
      fallbackChain: i18n.options.fallbackLng
    };
  },

  // Test a specific translation key
  testTranslation: (key: string) => {
    if (__DEV__) {
      const result = i18n.t(key);
      console.log('🌍 [i18n] DEBUG: Translation test:', {
        key,
        currentLanguage: i18n.language,
        result,
        exists: i18n.exists(key),
        hasResourceBundle: i18n.hasResourceBundle(i18n.language, 'translation')
      });
      return result;
    }
  },

  // Clear all language preferences and re-detect from device
  resetToDeviceLanguage: async () => {
    if (__DEV__) {
      console.log('🌍 [i18n] DEBUG: Clearing all language preferences');
      await Promise.all([
        AsyncStorage.removeItem(LANGUAGE_STORAGE_KEY),
        AsyncStorage.removeItem(DEVICE_LANGUAGE_STORAGE_KEY),
        AsyncStorage.removeItem(MANUAL_SELECTION_STORAGE_KEY),
      ]);
      const deviceLang = getDeviceLanguage();
      await i18n.changeLanguage(deviceLang);
      console.log('🌍 [i18n] DEBUG: Reset to device language:', deviceLang);
    }
  },

  // Simulate device language change for testing
  simulateDeviceLanguageChange: async (newDeviceLanguage: AvailableLanguage) => {
    if (__DEV__) {
      console.log('🌍 [i18n] DEBUG: Simulating device language change to:', newDeviceLanguage);

      // Clear the stored device language to trigger change detection
      await AsyncStorage.removeItem(DEVICE_LANGUAGE_STORAGE_KEY);

      // Clear manual selection flag so device change is respected
      await AsyncStorage.removeItem(MANUAL_SELECTION_STORAGE_KEY);

      // Trigger language re-detection using i18next API
      await new Promise<void>((resolve) => {
        i18n.changeLanguage(undefined, () => {
          console.log('🌍 [i18n] DEBUG: Language re-detection complete');
          resolve();
        });
      });
    }
  },

  // Check current language state
  getLanguageState: async () => {
    if (__DEV__) {
      const info = await debugHelpers.getCurrentLanguageInfo();
      console.log('🌍 [i18n] DEBUG: Current language state:', info);
      return info;
    }
  }
};

// Make debug helpers available globally in dev mode
if (__DEV__) {
  (global as any).i18nDebug = debugHelpers;
  console.log('🌍 [i18n] Debug helpers available at: global.i18nDebug');
  console.log('🌍 [i18n] Usage: global.i18nDebug.forceLanguage("en-US")');
}

export default i18n;