import { PropsWithChildren, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useColorScheme() ?? 'light';

  return (
    <View className="bg-white dark:bg-gray-900">
      <TouchableOpacity
        className="flex-row items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2"
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}
      >
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
      </TouchableOpacity>
      {isOpen && (
        <View className="mt-2 ml-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {children}
        </View>
      )}
    </View>
  );
}
