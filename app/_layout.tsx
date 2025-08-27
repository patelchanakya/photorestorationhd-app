import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalNotifications } from '@/components/GlobalNotifications';
import InitialLoadingScreen from '@/components/InitialLoadingScreen';
import { useAutoRollbackRecovery } from '@/hooks/useRollbackRecovery';
import { JobProvider } from '@/contexts/JobContext';
import { RevenueCatProvider } from '@/contexts/RevenueCatContext';
import { Platform } from 'react-native';
import { LOG_LEVEL } from 'react-native-purchases';
import { useColorScheme } from '@/hooks/useColorScheme';
// Removed LanguageProvider - translations system removed
// useSubscriptionStore removed - using RevenueCat Context Provider instead
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect } from 'react';
import { AppState, AppStateStatus, LogBox, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Purchases from 'react-native-purchases';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuickEditStore } from '@/store/quickEditStore';

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

// Recovery function to check for active predictions
async function checkActivePrediction() {
  const startTime = Date.now();
  try {
    const activePredictionId = await AsyncStorage.getItem('activePredictionId');
    if (!activePredictionId) {
      console.log('🔍 [RECOVERY] No active prediction found - recovery skipped');
      return;
    }
    
    console.log('🔍 [RECOVERY] Starting recovery check for prediction:', activePredictionId);
    
    // Get Supabase environment variables
    const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('⚠️ [RECOVERY] CRITICAL: Missing Supabase configuration - URL:', !!SUPABASE_URL, 'KEY:', !!SUPABASE_ANON_KEY);
      await AsyncStorage.removeItem('activePredictionId');
      return;
    }
    
    console.log('📡 [RECOVERY] Calling secure photo-status endpoint for prediction:', activePredictionId);
    
    // Check prediction status using secure photo-status endpoint
    const response = await fetch(`${SUPABASE_URL}/functions/v1/photo-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ prediction_id: activePredictionId })
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      // 404 or other error - clear storage
      console.error('🚨 [RECOVERY] photo-status endpoint error:', {
        prediction_id: activePredictionId,
        status: response.status,
        statusText: response.statusText,
        response_time_ms: responseTime
      });
      await AsyncStorage.removeItem('activePredictionId');
      return;
    }
    
    const result = await response.json();
    
    // Handle photo-status endpoint response format
    if (!result.success) {
      console.warn('🧹 [RECOVERY] Prediction not found in database, clearing state:', {
        prediction_id: activePredictionId,
        error: result.error || 'Unknown database error',
        response_time_ms: responseTime
      });
      await AsyncStorage.removeItem('activePredictionId');
      return;
    }
    
    const prediction = result;
    
    console.log('📊 [RECOVERY] Prediction retrieved from database:', {
      prediction_id: activePredictionId,
      status: prediction.status,
      mode: prediction.mode,
      style_key: prediction.style_key,
      has_output: prediction.has_output,
      is_complete: prediction.is_complete,
      is_successful: prediction.is_successful,
      progress: prediction.progress,
      elapsed_seconds: prediction.elapsed_seconds,
      created_at: prediction.created_at,
      completed_at: prediction.completed_at,
      output_url: prediction.output ? prediction.output.substring(0, 60) + '...' : null,
      response_time_ms: responseTime
    });
    
    if (!prediction.has_output && prediction.is_complete) {
      // Completed but no output (likely expired or failed) - clear storage  
      console.warn('🧹 [RECOVERY] Prediction completed but no output available - likely expired:', {
        prediction_id: activePredictionId,
        status: prediction.status,
        error: prediction.error,
        completed_at: prediction.completed_at
      });
      await AsyncStorage.removeItem('activePredictionId');
      return;
    }
    
    // Valid prediction with output available
    if (prediction.status === 'succeeded' && prediction.output) {
      console.log('🎉 [RECOVERY] SUCCESS: Found completed generation, checking recovery context:', {
        prediction_id: activePredictionId,
        mode: prediction.mode,
        style_key: prediction.style_key,
        completed_at: prediction.completed_at,
        processing_time_seconds: prediction.elapsed_seconds,
        total_recovery_time_ms: Date.now() - startTime
      });
      
      // Check if this prediction came from text-edits
      let textEditContext: any = null;
      try {
        const storedContext = await AsyncStorage.getItem('activeTextEditContext');
        if (storedContext) {
          textEditContext = JSON.parse(storedContext);
        }
      } catch (error) {
        console.warn('⚠️ [RECOVERY] Failed to parse text-edit context:', error);
      }
      
      if (textEditContext?.mode === 'text-edits') {
        console.log('📝 [RECOVERY] Text-edit prediction detected, navigating to restoration screen:', {
          prediction_id: activePredictionId,
          context: textEditContext,
          will_navigate_to: `/restoration/${activePredictionId}`
        });
        
        // Clear both prediction ID and text-edit context
        await AsyncStorage.removeItem('activePredictionId');
        await AsyncStorage.removeItem('activeTextEditContext');
        
        // Navigate to restoration screen instead of opening Quick Edit Sheet
        const { router } = await import('expo-router');
        router.replace(`/restoration/${activePredictionId}`);
        
        console.log('✅ [RECOVERY] Navigated to restoration screen for text-edit prediction:', activePredictionId);
        return;
      }
      
      // Standard Quick Edit Sheet recovery for non-text-edit predictions
      console.log('📱 [RECOVERY] Quick Edit prediction detected, opening sheet');
      
      // Check if Quick Edit Sheet is already open to prevent duplicate UI updates
      const currentQuickEditState = useQuickEditStore.getState();
      if (currentQuickEditState.visible) {
        console.log('⚠️ [RECOVERY] Quick Edit Sheet already open, skipping duplicate UI update');
        // Don't clear prediction - let user interact with it first
        return;
      }
      
      // Check if this is the same prediction that's already displayed
      if (currentQuickEditState.restoredId === activePredictionId) {
        console.log('⚠️ [RECOVERY] Same prediction already displayed, skipping duplicate UI update');
        // Don't clear prediction - let user interact with it first
        return;
      }
      
      // Re-open Quick Edit Sheet with the recovered result
      const { setResult } = useQuickEditStore.getState();
      setResult(activePredictionId, prediction.output);
      
      // Show the Quick Edit Sheet
      useQuickEditStore.setState({ visible: true });
      
      console.log('✅ [RECOVERY] Quick Edit Sheet opened successfully for prediction:', activePredictionId);
    } else if (prediction.status === 'processing') {
      console.log('⏳ [RECOVERY] Generation still processing, keeping for user discovery:', {
        prediction_id: activePredictionId,
        progress: prediction.progress,
        elapsed_seconds: prediction.elapsed_seconds,
        mode: prediction.mode
      });
      // Could potentially resume polling here, but for now just leave it for user to discover
    } else if (prediction.status === 'failed') {
      console.error('❌ [RECOVERY] Previous generation failed, clearing state:', {
        prediction_id: activePredictionId,
        error: prediction.error,
        mode: prediction.mode,
        elapsed_seconds: prediction.elapsed_seconds
      });
      await AsyncStorage.removeItem('activePredictionId');
    }
    
  } catch (error) {
    // Network error or other issue - clear storage to be safe
    const totalTime = Date.now() - startTime;
    console.error('🚨 [RECOVERY] CRITICAL ERROR: Recovery check failed:', {
      error: error instanceof Error ? error.message : String(error),
      error_name: error instanceof Error ? error.name : 'Unknown',
      total_time_ms: totalTime,
      stack: error instanceof Error ? error.stack : undefined
    });
    await AsyncStorage.removeItem('activePredictionId');
  }
}

// App state change handler
const onAppStateChange = (status: AppStateStatus) => {
  focusManager.setFocused(status === 'active');
  
  // Check for active predictions when app becomes active
  if (status === 'active') {
    console.log('🔄 [RECOVERY] App became active, initiating recovery check...');
    checkActivePrediction();
  } else if (status === 'background') {
    console.log('🔄 [RECOVERY] App went to background, recovery will resume on return');
    
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
  });
  
  const [showInitialLoading, setShowInitialLoading] = React.useState(true);

  // Set up network and app state management
  useOnlineManager();
  useAppState(onAppStateChange);

  // Configure RevenueCat immediately on app start - following official SDK docs pattern
  useEffect(() => {
    const initializeRevenueCat = async () => {
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

    initializeRevenueCat();
  }, []);

  // Check for active predictions on app launch
  useEffect(() => {
    console.log('🚀 [RECOVERY] App launched, performing initial recovery check...');
    checkActivePrediction();
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
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
              <RevenueCatProvider>
                <QueryClientProvider client={queryClient}>
                  <JobProvider>
                    <InitialLoadingScreen onLoadingComplete={onLoadingComplete} />
                  </JobProvider>
                </QueryClientProvider>
              </RevenueCatProvider>
            </GestureHandlerRootView>
          </ErrorBoundary>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ErrorBoundary>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
            <RevenueCatProvider>
              <QueryClientProvider client={queryClient}>
                <JobProvider>
                  <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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


  // RevenueCat listener removed - handled by RevenueCat Context Provider
  // Old listener removed

  return (
    <Stack initialRouteName="explore">
      <Stack.Screen name="explore" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding-v2" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding-v3" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false, title: "Clever" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="restoration/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings-modal"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          contentStyle: { backgroundColor: 'black' },
        }}
      />
      <Stack.Screen name="text-edits" options={{ headerShown: false }} />
      <Stack.Screen name="photo-magic" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}