import React from 'react';
import InitialLoadingScreen from '@/components/InitialLoadingScreen';
import { useRouter } from 'expo-router';

export default function InitialLoadingRoute() {
  const router = useRouter();
  
  if (__DEV__) {
    console.log('🔥 [INITIAL-LOADING-ROUTE] Component mounting...');
  }

  const handleLoadingComplete = () => {
    if (__DEV__) {
      console.log('🔥 [INITIAL-LOADING-ROUTE] Loading complete - navigating back to index');
    }
    router.replace('/');
  };

  return (
    <InitialLoadingScreen onLoadingComplete={handleLoadingComplete} />
  );
}