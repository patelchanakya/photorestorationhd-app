import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalNotifications } from '@/components/GlobalNotifications';
import InitialLoadingScreen from '@/components/InitialLoadingScreen';
import { JobProvider } from '@/contexts/JobContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LanguageProvider } from '@/i18n';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect } from 'react';
import { AppState, AppStateStatus, LogBox, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

// App state change handler
const onAppStateChange = (status: AppStateStatus) => {
  if (__DEV__) {
    console.log('🔄 App state changed:', status);
  }
  focusManager.setFocused(status === 'active');
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
  });
  
  const [showInitialLoading, setShowInitialLoading] = React.useState(true);

  // Set up network and app state management
  useOnlineManager();
  useAppState(onAppStateChange);
  
  // Proactively trim expo-image memory on background to avoid spikes
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
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

  const onLoadingComplete = React.useCallback(() => {
    setShowInitialLoading(false);
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  if (showInitialLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <InitialLoadingScreen onLoadingComplete={onLoadingComplete} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ErrorBoundary>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
            <LanguageProvider>
              <QueryClientProvider client={queryClient}>
                <JobProvider>
                  <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <MainNavigator />
                    <GlobalNotifications />
                    <StatusBar style="auto" />
                  </ThemeProvider>
                </JobProvider>
              </QueryClientProvider>
            </LanguageProvider>
          </GestureHandlerRootView>
        </ErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}

function MainNavigator() {
  return (
    <Stack initialRouteName="explore">
      <Stack.Screen name="explore" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false, title: "Clever" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="restoration/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="video-result/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="gallery-modal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="settings-modal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="crop-modal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="gallery-image/[id]" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="text-edits" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}