import { Text, type TextProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  className,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  const getTypeClasses = () => {
    switch (type) {
      case 'title':
        return 'text-3xl font-bold leading-8';
      case 'subtitle':
        return 'text-xl font-bold';
      case 'defaultSemiBold':
        return 'text-base font-semibold leading-6';
      case 'link':
        return 'text-base text-blue-600 dark:text-blue-400 leading-8';
      default:
        return 'text-base leading-6';
    }
  };

  const combinedClassName = `${getTypeClasses()} text-gray-900 dark:text-white ${className || ''}`;

  return (
    <Text
      style={[{ color }, style]}
      className={combinedClassName}
      {...rest}
    />
  );
}
