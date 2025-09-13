import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalNotifications } from '@/components/GlobalNotifications';
import { JobProvider } from '@/contexts/JobContext';
import { RevenueCatProvider } from '@/contexts/RevenueCatContext';
import '@/src/locales/index';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAutoRollbackRecovery } from '@/hooks/useRollbackRecovery';
import { AppState, AppStateStatus, Dimensions, LogBox, Platform, View } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { clarityService } from '@/services/clarityService';
import { memoryManager } from '@/services/memoryManager';
import { appLifecycleService } from '@/services/appLifecycleService';
import * as Clarity from '@microsoft/react-native-clarity';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

// Immediate black background injection to prevent white flash at app startup
if (typeof document !== 'undefined') {
  // Synchronously inject critical styles before React renders
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root, #app-root, .expo-root {
      background-color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

// Configure LogBox for production
if (!__DEV__) {
  // Disable all LogBox logs in production
  LogBox.ignoreAllLogs(true);
  
  // Override console methods to prevent logs in production
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
}

// Also ignore specific warnings in development
if (__DEV__) {
  LogBox.ignoreLogs([
    'RevenueCat',
    'BackendError',
    'SDK Configuration is not valid',
    'MISSING_METADATA',
    'Your products are configured in RevenueCat',
    'The offerings',
    'Product Issues',
    'Offering Issues',
    '⚠️',
    '😿',
    'Reanimated',
    'Layout children',
    'Heavy components preloaded',
    'User has seen onboarding',
    'Starting subscription status check',
    'Customer info:',
    'Customer Info Retrieved:',
    'Pro Entitlement Details:',
    'Entitlement input:',
    'Entitlement validation:',
    'Entitlement validation result:',
    'Store comparison:',
    'Store updated',
    'Final subscription status check result:',
    'No store update needed',
    'Transaction ID extracted:',
    'Setting up RevenueCat customer info listener',
    'RevenueCat customer info listener set up successfully',
    'Network available - triggering rollback recovery',
  ]);
}

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
    mutations: {
      retry: 1,
    },
  },
});

// Network state management hook
function useOnlineManager() {
  useEffect(() => {
    return onlineManager.setEventListener((setOnline) => {
      return NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected);
      });
    });
  }, []);
}

// App state management hook
function useAppState(onChange: (status: AppStateStatus) => void) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, [onChange]);
}

// Recovery is now handled centrally in InitialLoadingScreen.tsx
// This file only handles AppState monitoring and basic app setup

// App state change handler
const onAppStateChange = (status: AppStateStatus) => {
  focusManager.setFocused(status === 'active');
  
  if (status === 'background') {
    // Proactively trim expo-image memory on background to avoid spikes
    try {
      // Clear only memory cache; disk cache remains
      // @ts-ignore: clearMemoryCache is available at runtime
      ExpoImage.clearMemoryCache?.();
    } catch {}
  }
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'PlayfairDisplay-Regular': require('../assets/fonts/PlayfairDisplay-Regular.ttf'),
    'PlayfairDisplay-Medium': require('../assets/fonts/PlayfairDisplay-Medium.ttf'),
    'PlayfairDisplay-SemiBold': require('../assets/fonts/PlayfairDisplay-SemiBold.ttf'),
    'PlayfairDisplay-Bold': require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
    'PlayfairDisplay-Italic': require('../assets/fonts/PlayfairDisplay-Italic.ttf'),
    'Lexend-Regular': require('../assets/fonts/Lexend/static/Lexend-Regular.ttf'),
    'Lexend-Medium': require('../assets/fonts/Lexend/static/Lexend-Medium.ttf'),
    'Lexend-SemiBold': require('../assets/fonts/Lexend/static/Lexend-SemiBold.ttf'),
    'Lexend-Bold': require('../assets/fonts/Lexend/static/Lexend-Bold.ttf'),
    'Lexend-ExtraBold': require('../assets/fonts/Lexend/static/Lexend-ExtraBold.ttf'),
    'Lexend-Black': require('../assets/fonts/Lexend/static/Lexend-Black.ttf'),
  });
  

  // Set up network and app state management
  useOnlineManager();
  useAppState(onAppStateChange);

  // Configure RevenueCat and Clarity immediately on app start - following official SDK docs pattern
  useEffect(() => {
    const initializeServices = async () => {
      // Initialize Microsoft Clarity via service (prevents double initialization)
      await clarityService.initialize();

      // Initialize app lifecycle service for background restart management
      appLifecycleService.initialize();
      
      // Set initial app context for Clarity
      try {
        const { width } = Dimensions.get('window');
        const version = Constants.expoConfig?.version || '1.0.0';
        const deviceType = width > 768 ? 'tablet' : 'phone';
        
        clarityService.setAppContext(version, deviceType);
        
        if (__DEV__) {
          console.log('✅ Clarity app context set:', { version, deviceType });
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Failed to set Clarity app context:', error);
        }
      }
      
      // Initialize RevenueCat
      try {
        const isExpoGo = Constants.appOwnership === 'expo';
        
        if (isExpoGo) {
          if (__DEV__) {
            console.log('⚠️ RevenueCat is not available in Expo Go. Using mock data.');
          }
          return;
        }
        
        // Configure log levels first (official docs pattern)
        if (__DEV__) {
          await Purchases.setLogLevel(LOG_LEVEL.INFO);
        } else {
          await Purchases.setLogLevel(LOG_LEVEL.ERROR);
        }
        
        // Configure RevenueCat with Apple API key (iOS only for now)
        if (Platform.OS === 'ios') {
          const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
          
          if (!apiKey) {
            if (__DEV__) {
              console.error('❌ RevenueCat Apple API key not found');
            }
            return;
          }
          
          // Check if already configured to avoid double configuration
          const isConfigured = await Purchases.isConfigured();
          if (isConfigured) {
            if (__DEV__) {
              console.log('✅ RevenueCat already configured');
            }
            return;
          }

          if (__DEV__) {
            console.log('🔧 Initializing RevenueCat SDK...');
          }
          
          // Configure SDK (following official docs pattern)
          await Purchases.configure({ 
            apiKey: apiKey,
            useAmazon: false,
          });
          
          // Sync purchases after configuration (RevenueCat best practice)
          try {
            await Purchases.syncPurchases();
            if (__DEV__) {
              console.log('✅ RevenueCat configured and purchases synced successfully');
            }
          } catch (syncError) {
            if (__DEV__) {
              console.warn('⚠️ Purchase sync failed (non-fatal):', syncError);
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ RevenueCat initialization error:', error);
        }
      }
    };

    initializeServices();

    // Cleanup services on unmount
    return () => {
      appLifecycleService.destroy();
    };
  }, []);

  if (!loaded) {
    // Show black screen while fonts load to prevent white flash
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }

  // Always render the main navigation - no conditional loading

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1, backgroundColor: '#000000' }}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ErrorBoundary>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
            <RevenueCatProvider>
              <QueryClientProvider client={queryClient}>
                <JobProvider>
                  <ThemeProvider value={{
                    ...(colorScheme === 'dark' ? DarkTheme : DefaultTheme),
                    colors: {
                      ...(colorScheme === 'dark' ? DarkTheme : DefaultTheme).colors,
                      background: '#000000',
                    }
                  }}>
                    <MainNavigator />
                    <GlobalNotifications />
                    <StatusBar style="auto" />
                  </ThemeProvider>
                </JobProvider>
              </QueryClientProvider>
            </RevenueCatProvider>
          </GestureHandlerRootView>
        </ErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}

function MainNavigator() {
  // Auto-rollback recovery for failed usage charges
  useAutoRollbackRecovery();
  
  // Reduced logging noise - only log first render
  const hasLoggedRef = React.useRef(false);
  if (__DEV__ && !hasLoggedRef.current) {
    console.log('🔥 [MAIN-NAVIGATOR] Stack Navigator initialized');
    hasLoggedRef.current = true;
  }

  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' }
      }}
    />
  );
}