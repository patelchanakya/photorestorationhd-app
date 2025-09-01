import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalNotifications } from '@/components/GlobalNotifications';
import { JobProvider } from '@/contexts/JobContext';
import { RevenueCatProvider } from '@/contexts/RevenueCatContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAutoRollbackRecovery } from '@/hooks/useRollbackRecovery';
import { AppState, AppStateStatus, Dimensions, LogBox, Platform, View } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
// Removed LanguageProvider - translations system removed
// useSubscriptionStore removed - using RevenueCat Context Provider instead
import { clarityService } from '@/services/clarityService';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useAppInitStore } from '@/store/appInitStore';
import * as Clarity from '@microsoft/react-native-clarity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect } from 'react';
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

// Recovery mutex to prevent concurrent operations
let recoveryInProgress = false;

// Recovery function to check for active predictions
async function checkActivePrediction() {
  // Prevent concurrent recovery operations
  if (recoveryInProgress) {
    console.log('🔒 [RECOVERY] Recovery already in progress, skipping duplicate call');
    return;
  }
  
  recoveryInProgress = true;
  try {
    await performRecoveryCheck();
  } finally {
    recoveryInProgress = false;
  }
}

// Actual recovery logic
async function performRecoveryCheck() {
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
      
      // Check if this prediction came from text-edits using multiple detection methods
      let isTextEditsFlow = false;
      
      // Method 1: Check for stored text-edit context with prediction ID
      try {
        const storedContext = await AsyncStorage.getItem(`textEditContext_${activePredictionId}`);
        if (storedContext) {
          const textEditContext = JSON.parse(storedContext);
          isTextEditsFlow = textEditContext?.mode === 'text-edits';
        }
      } catch (error) {
        console.warn('⚠️ [RECOVERY] Failed to parse text-edit context:', error);
      }
      
      // Method 2: Check for text-edits flow flag (fallback for timing issues)
      if (!isTextEditsFlow) {
        try {
          const flowFlag = await AsyncStorage.getItem('isTextEditsFlow');
          isTextEditsFlow = flowFlag === 'true';
          if (isTextEditsFlow && __DEV__) {
            console.log('📝 [RECOVERY] Detected text-edits flow via fallback flag');
          }
        } catch (error) {
          console.warn('⚠️ [RECOVERY] Failed to check text-edits flow flag:', error);
        }
      }
      
      if (isTextEditsFlow) {
        console.log('📝 [RECOVERY] Text-edit prediction detected via deterministic context lookup, navigating to restoration screen');
        
        // Update local restoration record with completed output URL for recovery
        try {
          const { localStorageHelpers } = require('@/services/supabase');
          await localStorageHelpers.updateRestoration(activePredictionId, {
            status: 'completed',
            replicate_url: prediction.output,
            progress: 100
          });
          if (__DEV__) {
            console.log('📊 [RECOVERY] Updated local restoration record with completed output');
          }
        } catch (error) {
          console.warn('⚠️ [RECOVERY] Failed to update local restoration record:', error);
        }
        
        // Check if app is initialized before navigating
        const { isInitialized } = useAppInitStore.getState();
        
        if (!isInitialized) {
          // Cold start - store the recovery intent for after initialization
          console.log('📝 [RECOVERY] App not initialized, deferring navigation until after app loads');
          await AsyncStorage.setItem('pendingRecoveryNavigation', JSON.stringify({
            route: `/restoration/${activePredictionId}`,
            output: prediction.output,
            predictionCreatedAt: prediction.created_at,
            timestamp: Date.now()
          }));
        } else {
          // App already initialized - validate URL before navigating
          try {
            const response = await fetch(prediction.output, { method: 'HEAD' });
            if (response.ok) {
              router.push(`/restoration/${activePredictionId}`);
              console.log('✅ [RECOVERY] Navigated to restoration screen for text-edit prediction:', activePredictionId);
            } else {
              // URL expired - silently cleanup
              await AsyncStorage.removeItem('activePredictionId');
              console.log('🧹 [RECOVERY] Text-edit prediction URL expired, cleaned up');
            }
          } catch {
            // URL validation failed - silently cleanup
            await AsyncStorage.removeItem('activePredictionId');
            console.log('🧹 [RECOVERY] Text-edit prediction URL validation failed, cleaned up');
          }
        }
        return;
      }
      
      // Standard Quick Edit Sheet recovery for non-text-edit predictions
      console.log('📱 [RECOVERY] Quick Edit prediction detected, checking initialization');
      
      // Check if app is initialized
      const { isInitialized } = useAppInitStore.getState();
      
      if (!isInitialized) {
        // Cold start - defer Quick Edit Sheet opening
        console.log('📝 [RECOVERY] App not initialized, deferring Quick Edit Sheet');
        await AsyncStorage.setItem('pendingQuickEditRecovery', JSON.stringify({
          predictionId: activePredictionId,
          output: prediction.output,
          predictionCreatedAt: prediction.created_at,
          timestamp: Date.now()
        }));
      } else {
        // App already initialized - validate URL before opening Quick Edit Sheet
        try {
          const response = await fetch(prediction.output, { method: 'HEAD' });
          if (response.ok) {
            // Check if this is the same prediction that's already displayed
            const currentQuickEditState = useQuickEditStore.getState();
            if (currentQuickEditState.visible && currentQuickEditState.restoredId === activePredictionId) {
              console.log('⚠️ [RECOVERY] Same prediction already displayed, skipping duplicate UI update');
              return;
            }
            
            const { setResult } = useQuickEditStore.getState();
            setResult(activePredictionId, prediction.output);
            useQuickEditStore.setState({ visible: true });
            console.log('✅ [RECOVERY] Quick Edit Sheet opened with completed result');
          } else {
            // URL expired - silently cleanup
            await AsyncStorage.removeItem('activePredictionId');
            console.log('🧹 [RECOVERY] Quick Edit prediction URL expired, cleaned up');
          }
        } catch {
          // URL validation failed - silently cleanup
          await AsyncStorage.removeItem('activePredictionId');
          console.log('🧹 [RECOVERY] Quick Edit prediction URL validation failed, cleaned up');
        }
      }
    } else if (prediction.status === 'processing') {
      console.log('⏳ [RECOVERY] Generation still processing, keeping for user discovery:', {
        prediction_id: activePredictionId,
        progress: prediction.progress,
        elapsed_seconds: prediction.elapsed_seconds,
        mode: prediction.mode
      });
      
      // Check if this is from text-edits and handle appropriately
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
        console.log('📝 [RECOVERY] Text-edit prediction still processing, user should see loading state in text-edits screen');
        // Don't navigate - let text-edits screen handle the recovery via its own polling
        // The activePredictionId will be picked up by the deduplication system
      }
      
      // For other predictions, leave for user discovery
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
    'Lexend-Regular': require('../assets/fonts/Lexend/static/Lexend-Regular.ttf'),
    'Lexend-Medium': require('../assets/fonts/Lexend/static/Lexend-Medium.ttf'),
    'Lexend-SemiBold': require('../assets/fonts/Lexend/static/Lexend-SemiBold.ttf'),
    'Lexend-Bold': require('../assets/fonts/Lexend/static/Lexend-Bold.ttf'),
    'Lexend-ExtraBold': require('../assets/fonts/Lexend/static/Lexend-ExtraBold.ttf'),
    'Lexend-Black': require('../assets/fonts/Lexend/static/Lexend-Black.ttf'),
  });
  
  const [showInitialLoading, setShowInitialLoading] = React.useState(true);

  // Set up network and app state management
  useOnlineManager();
  useAppState(onAppStateChange);

  // Configure RevenueCat and Clarity immediately on app start - following official SDK docs pattern
  useEffect(() => {
    const initializeServices = async () => {
      // Initialize Microsoft Clarity
      try {
        const isExpoGo = Constants.appOwnership === 'expo';
        
        if (!isExpoGo) {
          await Clarity.initialize('t2eqsax833', {
            logLevel: __DEV__ ? Clarity.LogLevel.Verbose : Clarity.LogLevel.None,
          });
          
          if (__DEV__) {
            console.log('✅ Microsoft Clarity initialized');
          }
        } else if (__DEV__) {
          console.log('⚠️ Microsoft Clarity is not available in Expo Go');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Microsoft Clarity initialization failed:', error);
        }
      }
      
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

  // Always render the main navigation - no conditional loading

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
  
  if (__DEV__) {
    console.log('🔥 [MAIN-NAVIGATOR] Rendering Stack Navigator');
  }

  return (
    <Stack 
      screenOptions={{ 
        headerShown: false 
      }}
    />
  );
}