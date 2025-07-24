import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LanguageProvider } from '@/i18n';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import Constants from 'expo-constants';
import { deviceTrackingService } from '@/services/deviceTracking';
// import { SuperwallProvider } from 'expo-superwall';

// Configure LogBox for production
if (!__DEV__) {
  // Disable all LogBox logs in production
  LogBox.ignoreAllLogs(true);
  
  // Disable yellow box warnings
  console.disableYellowBox = true;
  
  // Override console methods to prevent logs in production
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
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

// App state change handler
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { setIsPro } = useSubscriptionStore();

  // Set up network and app state management
  useOnlineManager();
  useAppState(onAppStateChange);

  // Initialize RevenueCat after component mounts
  useEffect(() => {
    if (!loaded) return;
    
    async function initRevenueCat() {
      try {
        // Only initialize RevenueCat in development builds, not Expo Go
        const isExpoGo = Constants.appOwnership === 'expo';
        
        if (isExpoGo) {
          if (__DEV__) {
            console.log('⚠️ RevenueCat is not available in Expo Go. Using mock data.');
          }
          // Set default free state for Expo Go
          setIsPro(false);
          return;
        }
        
        // Set log level to reduce noise
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.WARN);
        } else {
          // Set to error level in production to reduce logs
          Purchases.setLogLevel(LOG_LEVEL.ERROR);
        }
        
        // Configure RevenueCat with Apple API key
        if (Platform.OS === 'ios') {
          try {
            const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
            
            if (!apiKey) {
              if (__DEV__) {
                console.error('❌ RevenueCat Apple API key not found in environment variables');
                console.log('🔄 Continuing without RevenueCat...');
              }
              return;
            }
            
            if (__DEV__) {
              console.log('🔧 Configuring RevenueCat...');
            }
            await Purchases.configure({ 
              apiKey: apiKey
            });
            
            if (__DEV__) {
              console.log('✅ RevenueCat configured successfully');
            }
            
            // Listen for customer info updates
            Purchases.addCustomerInfoUpdateListener((customerInfo) => {
              if (__DEV__) {
                console.log('📱 Customer info updated:', customerInfo);
              }
              
              // Check if user has active pro entitlement
              const hasProEntitlement = customerInfo.entitlements.active['pro'] !== undefined;
              setIsPro(hasProEntitlement);
              
              if (__DEV__) {
                console.log('🔄 Pro status updated:', hasProEntitlement);
              }
            });
            
            // Check initial subscription status
            const customerInfo = await Purchases.getCustomerInfo();
            const hasProEntitlement = customerInfo.entitlements.active['pro'] !== undefined;
            setIsPro(hasProEntitlement);
            
            if (__DEV__) {
              console.log('🎯 Initial pro status:', hasProEntitlement);
            }
          } catch (error) {
            if (__DEV__) {
              console.error('❌ RevenueCat configuration failed:', error);
              console.log('🔄 Continuing without RevenueCat...');
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Failed to initialize RevenueCat:', error);
        }
        // Set default state on error
        setIsPro(false);
      }
    }
    
    // Initialize device tracking service
    deviceTrackingService.initialize().catch((error) => {
      if (__DEV__) {
        console.error('❌ Failed to initialize device tracking service:', error);
      }
    });
    
    // Add a small delay to ensure other providers are ready
    const timer = setTimeout(() => {
      initRevenueCat();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [loaded, setIsPro]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            {/* <SuperwallProvider apiKey="pk_9463ee79e9c6a66da3118d96b615f85d505d307dbce01cf3"> */}
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false, title: "Photo Restoration HD" }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="restoration/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="gallery-modal" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="settings-modal" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="crop-modal" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="gallery-image/[id]" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          {/* </SuperwallProvider> */}
        </QueryClientProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
