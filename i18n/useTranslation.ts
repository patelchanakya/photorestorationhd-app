import { useContext } from 'react';
import { LanguageContext } from './context';
import type { SupportedLanguage } from './config';
import type { TranslationKeys } from './types';

// Import all translation files
import enTranslations from './translations/en.json';
import esTranslations from './translations/es.json';
import frTranslations from './translations/fr.json';
import deTranslations from './translations/de.json';
import itTranslations from './translations/it.json';
import ptTranslations from './translations/pt.json';

const translations = {
  en: enTranslations,
  es: esTranslations,
  fr: frTranslations,
  de: deTranslations,
  it: itTranslations,
  pt: ptTranslations,
} as const;

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((current, key) => current?.[key], obj) || path;
}

/**
 * Replace placeholders in a translation string
 */
function replacePlaceholders(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  
  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }, text);
}

/**
 * Hook for accessing translations in components
 */
export function useTranslation() {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  
  const { currentLanguage, setLanguage } = context;
  
  /**
   * Get a translation for a given key
   */
  function t(key: TranslationKeys, params?: Record<string, string | number>): string {
    const languageTranslations = translations[currentLanguage];
    let translation = getNestedValue(languageTranslations, key);
    
    // Fallback to English if translation not found
    if (translation === key && currentLanguage !== 'en') {
      translation = getNestedValue(translations.en, key);
    }
    
    // If still not found, return the key
    if (translation === key && __DEV__) {
      console.warn(`Translation missing for key: ${key} in language: ${currentLanguage}`);
    }
    
    return replacePlaceholders(translation, params);
  }
  
  return {
    t,
    currentLanguage,
    setLanguage,
  };
}

/**
 * Hook for getting current language without translations
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  
  return {
    currentLanguage: context.currentLanguage,
    setLanguage: context.setLanguage,
  };
}