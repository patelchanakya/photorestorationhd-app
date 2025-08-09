import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: '#000000' } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}