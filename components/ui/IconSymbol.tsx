// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'gear': 'settings',
  'bolt.fill': 'bolt',
  'bolt.slash': 'bolt', // MaterialIcons does not have a direct 'bolt.slash', use 'bolt' as closest
  'photo': 'photo',
  'photo.stack': 'collections', // MaterialIcon for multiple photos/gallery
  'camera': 'camera-alt',
  'plus': 'add',
  'square.and.arrow.up': 'file-upload', // closest MaterialIcon for upload
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.down': 'keyboard-arrow-down',
  'info.circle': 'info',
  'questionmark.circle': 'help',
  'arrow.clockwise': 'refresh',
  'clock': 'access-time',
  'gift': 'card-giftcard',
  'crown.fill': 'star',
  'person.crop.circle': 'person',
  'square.grid.2x2': 'grid-view',
  'rectangle.stack': 'photo-library',
  'exclamationmark.triangle': 'warning',
  // Additional mappings for action rail
  'wand.and.stars': 'auto-awesome',
  'eye': 'remove-red-eye',
  'paintbrush': 'brush',
  'bandage': 'healing',
  'sparkle': 'auto-awesome',
  'sparkles': 'auto-awesome',
  'pencil': 'edit',
  'square.and.pencil': 'edit',
  'tshirt': 'checkroom',
  'image': 'image',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',
  // Additional icons for FeatureCardsList
  'wrench.and.screwdriver': 'build',
  'paintpalette': 'palette',
  'sun.max': 'wb-sunny',
  'photo.on.rectangle': 'photo-album',
  // Additional missing icons
  'arrow.left': 'arrow-back',
  'chevron.left': 'chevron-left',
  'arrow.down.circle.fill': 'keyboard-arrow-down',
  'photo.fill': 'photo',
  'arrow.counterclockwise': 'refresh',
  'eye.slash': 'visibility-off',
  'lightbulb': 'lightbulb-outline',
  'star.fill': 'star',
  'envelope': 'mail-outline',
  'wifi.slash': 'wifi-off',
  'arrow.2.squarepath': 'repeat',
  'photo.on.rectangle.angled': 'photo-album',
  'arrow.right': 'arrow-forward',
  'xmark': 'close',
  'exclamationmark.triangle.fill': 'warning',
  'info.circle.fill': 'info',
  'square.and.arrow.down': 'file-download',
  'exclamationmark.circle.fill': 'error',
} as const;

type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
