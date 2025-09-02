import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAppInitStore } from '@/store/appInitStore';

// Root index - handles initial routing based on app state
export default function Index() {
  if (__DEV__) {
    console.log('🔥 [INDEX] Component mounting...');
  }

  const router = useRouter();
  const { initialRoute } = useAppInitStore();
  
  if (__DEV__) {
    console.log('🔥 [INDEX] Router available:', !!router);
    console.log('🔥 [INDEX] InitialRoute from store:', initialRoute);
  }
  
  useEffect(() => {
    if (__DEV__) {
      console.log('🔥 [INDEX] useEffect triggered');
    }
    
    // If no route set yet, show loading screen first
    if (!initialRoute) {
      if (__DEV__) {
        console.log('🔥 [INDEX] No route set, navigating to initial-loading');
      }
      router.replace('/initial-loading');
      return;
    }
    
    // Route to the determined target
    if (__DEV__) {
      console.log('🔥 [INDEX] Route determined, navigating to:', initialRoute);
    }
    
    try {
      router.replace(`/${initialRoute}`);
      
      if (__DEV__) {
        console.log('🔥 [INDEX] Navigation successful');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('🔥 [INDEX] ERROR in routing:', error);
      }
    }
  }, [router, initialRoute]);
  
  if (__DEV__) {
    console.log('🔥 [INDEX] Rendering initial view');
  }
  
  // Show brief black screen while determining route
  return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
}