import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentLanguage, setCurrentLanguage, type SupportedLanguage } from './config';

interface LanguageContextType {
  currentLanguage: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  isLoading: boolean;
}

export const LanguageContext = createContext<LanguageContextType | null>(null);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [currentLanguage, setCurrentLanguageState] = useState<SupportedLanguage>('en');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Initialize language on app start
    async function initializeLanguage() {
      try {
        const language = await getCurrentLanguage();
        setCurrentLanguageState(language);
      } catch (error) {
        if (__DEV__) {
          console.error('Error initializing language:', error);
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    initializeLanguage();
  }, []);
  
  const setLanguage = async (language: SupportedLanguage) => {
    try {
      await setCurrentLanguage(language);
      setCurrentLanguageState(language);
    } catch (error) {
      if (__DEV__) {
        console.error('Error setting language:', error);
      }
    }
  };
  
  const value: LanguageContextType = {
    currentLanguage,
    setLanguage,
    isLoading,
  };
  
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}