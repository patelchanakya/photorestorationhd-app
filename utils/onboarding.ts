import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'hasSeenOnboarding';
const ONBOARDING_DATA_KEY = 'onboardingData';

export interface OnboardingData {
  hasSeenOnboarding: boolean;
  selectedFeatures: string[];
  primaryInterest: string;
  completedAt: string;
  freeAttemptUsed: boolean;
  freeAttemptFeature?: string;
}

export const ONBOARDING_FEATURES = [
  {
    id: 'fix_old_damaged',
    name: 'Fix Old/Damaged Photos',
    description: 'Repair cracks, tears, and age damage',
    icon: 'wand.and.stars',
    mapsTo: 'restoration' as const,
    gradient: ['#f97316', '#fb923c']
  },
  {
    id: 'add_color_bw',
    name: 'Add Color to Black & White',
    description: 'Bring old B&W photos to life with realistic color',
    icon: 'paintbrush',
    mapsTo: 'colorize' as const,
    gradient: ['#10b981', '#34d399']
  },
  {
    id: 'remove_scratches',
    name: 'Remove Scratches & Marks',
    description: 'Clean up surface damage and scratches',
    icon: 'bandage',
    mapsTo: 'descratch' as const,
    gradient: ['#ef4444', '#f87171']
  },
  {
    id: 'sharpen_blurry',
    name: 'Sharpen Blurry Photos',
    description: 'Make blurry or out-of-focus photos crisp',
    icon: 'eye',
    mapsTo: 'unblur' as const,
    gradient: ['#8b5cf6', '#a78bfa']
  },
  {
    id: 'memorial_touches',
    name: 'Memorial/Tribute Touches',
    description: 'Add angel wings, halos, gentle glows',
    icon: 'heart',
    mapsTo: 'custom' as const,
    gradient: ['#6366f1', '#8b5cf6']
  },
  {
    id: 'create_videos',
    name: 'Create Moving Videos',
    description: 'Turn photos into magical videos (Pro feature)',
    icon: 'video',
    mapsTo: 'back_to_life' as const,
    gradient: ['#dc2626', '#f87171']
  }
] as const;

export const onboardingUtils = {
  // Check if user has seen onboarding
  async hasSeenOnboarding(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  },

  // Get onboarding data
  async getOnboardingData(): Promise<OnboardingData | null> {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting onboarding data:', error);
      return null;
    }
  },

  // Save onboarding selections
  async saveOnboardingSelections(selectedFeatures: string[], primaryInterest: string): Promise<void> {
    try {
      const data: OnboardingData = {
        hasSeenOnboarding: false, // Not completed yet
        selectedFeatures,
        primaryInterest,
        completedAt: '',
        freeAttemptUsed: false
      };
      await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving onboarding selections:', error);
    }
  },

  // Mark free attempt as used
  async markFreeAttemptUsed(feature: string): Promise<void> {
    try {
      const existing = await this.getOnboardingData();
      if (existing) {
        const updated: OnboardingData = {
          ...existing,
          freeAttemptUsed: true,
          freeAttemptFeature: feature
        };
        await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error marking free attempt used:', error);
    }
  },

  // Mark onboarding as completed
  async completeOnboarding(): Promise<void> {
    try {
      // Update both the simple flag and the detailed data
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      
      const existing = await this.getOnboardingData();
      if (existing) {
        const updated: OnboardingData = {
          ...existing,
          hasSeenOnboarding: true,
          completedAt: new Date().toISOString()
        };
        await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
    }
  },

  // Reset onboarding (for testing)
  async resetOnboarding(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      await AsyncStorage.removeItem(ONBOARDING_DATA_KEY);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  },

  // Get feature by ID
  getFeatureById(id: string) {
    return ONBOARDING_FEATURES.find(f => f.id === id);
  },

  // Get primary feature from selections
  getPrimaryFeature(selectedFeatures: string[], primaryInterest: string) {
    return this.getFeatureById(primaryInterest) || this.getFeatureById(selectedFeatures[0]);
  }
};