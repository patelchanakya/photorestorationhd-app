import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import CustomSplashScreen from '@/components/CustomSplashScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LanguageProvider } from '@/i18n';
import { analyticsService } from '@/services/analytics';
import { deviceTrackingService } from '@/services/deviceTracking';
import { networkStateService } from '@/services/networkState';
import { checkSubscriptionStatus } from '@/services/revenuecat';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import Constants from 'expo-constants';
import React, { useEffect } from 'react';
import { AppState, AppStateStatus, LogBox, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { AppState as RNAppState } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

// Configure LogBox for production
if (!__DEV__) {
  // Disable all LogBox logs in production
  LogBox.ignoreAllLogs(true);
  
  // Override console methods to prevent logs in production
  const originalConsoleError = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = (...args) => {
    // Filter out specific errors we want to suppress
    if (args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('RevenueCat') || 
       arg.includes('BackendError') || 
       arg.includes('😿') ||
       arg.includes('SDK Configuration is not valid'))
    )) {
      return; // Suppress these specific errors
    }
    // For other errors, suppress them too in production
  };
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
  ]);
  
  // Override console methods for RevenueCat in dev too
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = (...args) => {
    if (args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('RevenueCat') || 
       arg.includes('MISSING_METADATA') ||
       arg.includes('App Store Connect'))
    )) {
      return;
    }
    originalWarn.apply(console, args);
  };
  
  console.error = (...args) => {
    if (args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('RevenueCat') || 
       arg.includes('BackendError') || 
       arg.includes('😿') ||
       arg.includes('SDK Configuration is not valid'))
    )) {
      return;
    }
    originalError.apply(console, args);
  };
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
  
  // Refresh subscription status when app becomes active - RevenueCat best practice
  if (status === 'active') {
    // Don't await this to avoid blocking app activation
    checkSubscriptionStatus().catch((error) => {
      if (__DEV__) {
        console.log('🔄 Failed to refresh subscription status on app active:', error);
      }
    });
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'PlayfairDisplay-Regular': require('../assets/fonts/PlayfairDisplay-Regular.ttf'),
    'PlayfairDisplay-Medium': require('../assets/fonts/PlayfairDisplay-Medium.ttf'),
    'PlayfairDisplay-SemiBold': require('../assets/fonts/PlayfairDisplay-SemiBold.ttf'),
    'PlayfairDisplay-Bold': require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
    'PlayfairDisplay-Italic': require('../assets/fonts/PlayfairDisplay-Italic.ttf'),
  });
  const { setIsPro } = useSubscriptionStore();
  const [showCustomSplash, setShowCustomSplash] = React.useState(true);

  // Set up network and app state management
  useOnlineManager();
  useAppState(onAppStateChange);
  // Proactively trim expo-image memory on background to avoid spikes
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (state) => {
      if (state === 'background') {
        try {
          // Clear only memory cache; disk cache remains
          // @ts-ignore: clearMemoryCache is available at runtime
          ExpoImage.clearMemoryCache?.();
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);


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
          // Set to ERROR level in production
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
              apiKey: apiKey,
              // Add additional configuration to prevent errors
              useAmazon: false,
            });
            
            if (__DEV__) {
              console.log('✅ RevenueCat configured successfully');
            }
            
            // Listen for customer info updates
            Purchases.addCustomerInfoUpdateListener((customerInfo) => {
              if (__DEV__) {
                console.log('📱 Customer info updated:', customerInfo);
              }
              
              // Check if user has active pro entitlement using isActive property
              const proEntitlement = customerInfo.entitlements.active['pro'];
              const hasProEntitlement = proEntitlement?.isActive === true;
              const wasProBefore = useSubscriptionStore.getState().isPro;
              
              setIsPro(hasProEntitlement);
              
              // Track subscription events
              if (hasProEntitlement && !wasProBefore) {
                analyticsService.trackSubscriptionEvent('upgraded', 'pro');
              } else if (!hasProEntitlement && wasProBefore) {
                analyticsService.trackSubscriptionEvent('restored', 'free');
              }
              
              if (__DEV__) {
                console.log('🔄 Pro status updated:', hasProEntitlement);
              }
            });
            
            // Check initial subscription status
            const customerInfo = await Purchases.getCustomerInfo();
            const proEntitlement = customerInfo.entitlements.active['pro'];
            const hasProEntitlement = proEntitlement?.isActive === true;
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

    // Set up network monitoring for restoration sync
    const unsubscribeNetworkMonitor = networkStateService.subscribe(async (_isOnline) => {
      // No-op for now (removed syncPendingOperations to avoid type error). We keep the subscription for future use.
    });

    // Initialize analytics service
    analyticsService.initialize().catch((error) => {
      if (__DEV__) {
        console.error('❌ Failed to initialize analytics service:', error);
      }
    });
    
    // Add a small delay to ensure other providers are ready
    const timer = setTimeout(() => {
      initRevenueCat();
    }, 100);
    
    return () => {
      clearTimeout(timer);
      // Cleanup analytics service
      analyticsService.destroy();
      // Cleanup network monitor
      unsubscribeNetworkMonitor();
    };
  }, [loaded, setIsPro]);

  const onCustomSplashComplete = React.useCallback(() => {
    // Don't hide the native splash yet - let the onboarding screen do it
    setShowCustomSplash(false);
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  if (showCustomSplash) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <CustomSplashScreen onAnimationComplete={onCustomSplashComplete} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ErrorBoundary>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
            <OnboardingProvider>
              <LanguageProvider>
                <QueryClientProvider client={queryClient}>
                    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <OnboardingNavigator />
                    <StatusBar style="auto" />
                  </ThemeProvider>
              </QueryClientProvider>
            </LanguageProvider>
            </OnboardingProvider>
          </GestureHandlerRootView>
        </ErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}

function OnboardingNavigator() {
  const { showOnboarding } = useOnboarding();
  const router = useRouter();
  const useExplore = true;

  if (__DEV__) {
    console.log('🚀 OnboardingNavigator: showOnboarding =', showOnboarding);
  }

  useEffect(() => {
    if (showOnboarding === true) {
      if (__DEV__) {
        console.log('🔄 Navigating to onboarding...');
      }
      router.replace('/onboarding');
    } else if (showOnboarding === false) {
      if (__DEV__) console.log('🔄 Navigating to explore...');
      router.replace('/explore');
    }
  }, [showOnboarding, router]);

  if (showOnboarding === null) {
    if (__DEV__) {
      console.log('⏳ OnboardingNavigator: Still checking onboarding status...');
    }
    // Still checking onboarding status
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="onboarding" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
      <Stack.Screen name="explore" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false, title: "Clever" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="restoration/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="gallery-modal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="settings-modal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="crop-modal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="gallery-image/[id]" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
