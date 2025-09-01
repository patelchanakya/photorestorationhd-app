import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const STABLE_USER_ID_KEY = 'stable_user_id';

/**
 * Generate RFC 4122 version 4 UUID using expo-crypto random bytes
 * This creates a stable, unique identifier per device installation
 * that follows RevenueCat's recommendation for custom App User IDs
 */
async function generateUUID(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  
  // Convert to hex string and format as UUID v4
  const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Format as UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuid = [
    hex.substring(0, 8),
    hex.substring(8, 12),
    '4' + hex.substring(13, 16), // Version 4
    ((parseInt(hex.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.substring(17, 20), // Variant bits
    hex.substring(20, 32)
  ].join('-');
  
  return uuid;
}

/**
 * Get or create a stable user ID that persists across app updates
 * This ID is used for RevenueCat identification and device-specific tracking
 * 
 * Note: This ID will change on app reinstall, which is intentional for
 * this use case as it provides device-specific identification while
 * the subscription-based transaction ID provides cross-device persistence
 */
export async function getOrCreateStableUserId(): Promise<string> {
  try {
    let stableId = await AsyncStorage.getItem(STABLE_USER_ID_KEY);
    
    if (!stableId) {
      // Generate new RFC 4122 version 4 UUID as recommended by RevenueCat
      stableId = await generateUUID();
      await AsyncStorage.setItem(STABLE_USER_ID_KEY, stableId);
      
      if (__DEV__) {
        console.log('🔑 Generated new stable user ID:', stableId);
        console.log('📱 This ID is device-specific and will change on reinstall');
      }
    } else {
      if (__DEV__) {
        console.log('✅ Retrieved existing stable user ID:', stableId);
      }
    }
    
    return stableId;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to get/create stable user ID:', error);
    }
    // Fallback to a temporary UUID if storage fails
    return await generateUUID();
  }
}

/**
 * Get the current stable user ID without creating a new one
 * Returns null if no ID exists yet
 */
export async function getStableUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STABLE_USER_ID_KEY);
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to get stable user ID:', error);
    }
    return null;
  }
}

/**
 * Clear the stable user ID (for testing purposes only)
 * WARNING: This will cause the user to get a new ID on next app launch
 */
export async function clearStableUserId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STABLE_USER_ID_KEY);
    if (__DEV__) {
      console.log('🗑️ Cleared stable user ID');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to clear stable user ID:', error);
    }
  }
}

/**
 * Validate that a string is a properly formatted UUID v4
 * Used for testing and validation
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}