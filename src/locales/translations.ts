import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

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

// All available translations
export const translations = {
  'en-US': enUS,
  'ar': ar,
  'hr': hr,
  'da': da,
  'nl': nl,
  'en-AU': enAU,
  'en-CA': enCA,
  'en-GB': enGB,
  'fi': fi,
  'fr': fr,
  'fr-CA': frCA,
  'de': de,
  'it': it,
  'ja': ja,
  'ko': ko,
  'no': no,
  'pl': pl,
  'pt-BR': ptBR,
  'pt-PT': ptPT,
  'ru': ru,
  'es-MX': esMX,
  'es-ES': esES,
  'sv': sv,
  'tr': tr,
  'uk': uk,
  'zh-CN': zhCN,
} as const;

export type AvailableLanguage = keyof typeof translations;

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

// Storage key for persisted language preference
const LANGUAGE_STORAGE_KEY = '@app_language';

class TranslationManager {
  private currentLanguage: AvailableLanguage = 'en-US';
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initializeLanguage();
  }

  private async initializeLanguage() {
    try {
      // Check for stored language preference
      const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (storedLanguage && storedLanguage in translations) {
        this.currentLanguage = storedLanguage as AvailableLanguage;
        this.notifyListeners(); // Notify components to re-render with stored language
        return;
      }

      // Get device locale
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        const deviceLocale = locales[0].languageTag;
        
        // Try exact match first
        if (deviceLocale in translations) {
          this.currentLanguage = deviceLocale as AvailableLanguage;
          this.notifyListeners(); // Notify components to re-render with device language
          return;
        }

        // Try language code only (e.g., 'en' from 'en-US')
        const languageCode = locales[0].languageCode;
        if (languageCode) {
          // Find first matching language
          const matchingLang = Object.keys(translations).find(
            lang => lang.startsWith(languageCode)
          );
          if (matchingLang) {
            this.currentLanguage = matchingLang as AvailableLanguage;
            this.notifyListeners(); // Notify components to re-render with matched language
            return;
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize language:', error);
    }
  }

  getCurrentLanguage(): AvailableLanguage {
    return this.currentLanguage;
  }

  async setLanguage(language: AvailableLanguage) {
    if (language in translations) {
      this.currentLanguage = language;
      try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      } catch (error) {
        console.error('Failed to save language preference:', error);
      }
      this.notifyListeners();
    }
  }

  getTranslations() {
    return translations[this.currentLanguage] || translations['en-US'];
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let translation: any = this.getTranslations();
    
    for (const k of keys) {
      translation = translation?.[k];
      if (!translation) {
        // Fallback to English
        translation = translations['en-US'];
        for (const k2 of keys) {
          translation = translation?.[k2];
          if (!translation) break;
        }
        break;
      }
    }

    if (typeof translation !== 'string') {
      console.warn(`Translation not found for key: ${key}`);
      return key;
    }

    // Replace parameters if provided
    if (params) {
      let result = translation;
      for (const [param, value] of Object.entries(params)) {
        result = result.replace(`{{${param}}}`, String(value));
      }
      return result;
    }

    return translation;
  }

  isRTL(): boolean {
    return this.currentLanguage === 'ar';
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

export const translationManager = new TranslationManager();

// Convenience function
export const t = (key: string, params?: Record<string, string | number>) => 
  translationManager.translate(key, params);