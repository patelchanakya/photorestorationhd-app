import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

// This file is no longer used - the app now starts with explore.tsx
// Keeping minimal redirect for compatibility
export default function Index() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/explore');
  }, [router]);
  
  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}