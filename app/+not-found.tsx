import { Link, Stack } from 'expo-router';
import { View, Text, SafeAreaView } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center px-4 py-8">
          <IconSymbol name="exclamationmark.triangle" size={64} color="#F59E0B" />
          <Text className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mt-6 mb-2">
            Page Not Found
          </Text>
          <Text className="text-gray-600 dark:text-gray-300 text-center mb-8">
            The screen you&apos;re looking for doesn&apos;t exist.
          </Text>
          <Link href="/" className="bg-blue-600 px-6 py-3 rounded-xl">
            <Text className="text-white font-semibold">Go to Home</Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}
