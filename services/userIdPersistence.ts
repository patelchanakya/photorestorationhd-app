import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REVENUECAT_USER_ID_KEY = 'rc_persisted_user_id';
const PRO_STATUS_FLAG_KEY = 'rc_had_pro_status';

/**
 * Service for persisting RevenueCat user IDs across app installations
 * This prevents creation of multiple anonymous IDs for the same user
 */
export class UserIdPersistenceService {
  /**
   * Save the RevenueCat user ID securely
   * Uses SecureStore on iOS, AsyncStorage on web
   */
  static async saveUserId(userId: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // SecureStore not available on web
        await AsyncStorage.setItem(REVENUECAT_USER_ID_KEY, userId);
      } else {
        await SecureStore.setItemAsync(REVENUECAT_USER_ID_KEY, userId);
      }
      
      if (__DEV__) {
        console.log('💾 Saved RevenueCat User ID:', userId);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to save user ID:', error);
      }
    }
  }

  /**
   * Retrieve the saved RevenueCat user ID
   * Returns null if no ID is saved
   */
  static async getSavedUserId(): Promise<string | null> {
    try {
      let userId: string | null = null;
      
      if (Platform.OS === 'web') {
        userId = await AsyncStorage.getItem(REVENUECAT_USER_ID_KEY);
      } else {
        userId = await SecureStore.getItemAsync(REVENUECAT_USER_ID_KEY);
      }
      
      if (__DEV__ && userId) {
        console.log('🔑 Retrieved saved User ID:', userId);
      }
      
      return userId;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to retrieve user ID:', error);
      }
      return null;
    }
  }

  /**
   * Clear the saved user ID (use carefully)
   * Only for debugging or account switching scenarios
   */
  static async clearSavedUserId(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(REVENUECAT_USER_ID_KEY);
      } else {
        await SecureStore.deleteItemAsync(REVENUECAT_USER_ID_KEY);
      }
      
      if (__DEV__) {
        console.log('🗑️ Cleared saved User ID');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to clear user ID:', error);
      }
    }
  }

  /**
   * Save a flag indicating user has had PRO status
   * Used to trigger automatic restoration
   */
  static async saveProStatusFlag(hadPro: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(PRO_STATUS_FLAG_KEY, hadPro ? 'true' : 'false');
      
      if (__DEV__) {
        console.log('💾 Saved PRO status flag:', hadPro);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to save PRO flag:', error);
      }
    }
  }

  /**
   * Check if user previously had PRO status
   */
  static async getHadProStatus(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(PRO_STATUS_FLAG_KEY);
      return value === 'true';
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to get PRO flag:', error);
      }
      return false;
    }
  }

  /**
   * Check if this is likely a reinstall
   * (Has saved ID but RevenueCat hasn't been configured yet)
   */
  static async isReinstall(): Promise<boolean> {
    const savedId = await this.getSavedUserId();
    return savedId !== null;
  }

  /**
   * Debug helper to log persistence state
   */
  static async debugLogState(): Promise<void> {
    if (__DEV__) {
      const userId = await this.getSavedUserId();
      const hadPro = await this.getHadProStatus();
      
      console.log('🔍 ID Persistence State:', {
        savedUserId: userId,
        hadProStatus: hadPro,
        isReinstall: userId !== null
      });
    }
  }
}