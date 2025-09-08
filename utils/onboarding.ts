import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'hasSeenOnboarding';
const ONBOARDING_DATA_KEY = 'onboardingData';
const ONBOARDING_ALWAYS_SKIP_KEY = 'alwaysSkipOnboarding';
const ONBOARDING_ALWAYS_SHOW_KEY = 'alwaysShowOnboarding';

export interface OnboardingData {
  hasSeenOnboarding: boolean;
  selectedFeatures: string[];
  primaryInterest: string;
  completedAt: string;
  freeAttemptUsed: boolean;
  freeAttemptFeature?: string;
}

export interface OnboardingFeature {
  id: string;
  name: string;
  description: string;
  icon: string;
  mapsTo: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'outfit' | 'background' | 'enlighten' | 'custom' | 'memorial' | 'water_damage' | 'skip';
  gradient: [string, string];
  styleKey?: string;
  isCustomPrompt?: boolean;
  isSkip?: boolean;
}

export const ONBOARDING_FEATURES: OnboardingFeature[] = [
  // Custom Option (First)
  {
    id: 'custom_prompt',
    name: 'Choose Your Own',
    description: 'Describe what you want to do with your photo',
    icon: 'text.cursor',
    mapsTo: 'custom',
    isCustomPrompt: true,
    gradient: ['#8b5cf6', '#a78bfa']
  },

  // Repair Photos (Position 2)
  {
    id: 'repair',
    name: 'Repair',
    description: 'Repair while staying consistent with features',
    icon: 'arrow.clockwise',
    mapsTo: 'repair',
    gradient: ['#f97316', '#fb923c']
  },

  // Most Popular Features (Positions 3-6)
  {
    id: 'clear_skin',
    name: 'Clear Skin',
    description: 'Remove acne, blemishes & imperfections',
    icon: 'sparkles',
    mapsTo: 'custom',
    gradient: ['#f472b6', '#fb7185']
  },
  {
    id: 'add_smile',
    name: 'Add Smile',
    description: 'Add a natural, authentic smile',
    icon: 'face.smiling',
    mapsTo: 'custom', 
    gradient: ['#facc15', '#fbbf24']
  },
  {
    id: 'fix_hair',
    name: 'Fix Hair',
    description: 'Clean up messy or stray hairs',
    icon: 'scissors',
    mapsTo: 'custom',
    gradient: ['#a855f7', '#c084fc']
  },
  {
    id: 'make_younger',
    name: 'Make Younger',
    description: 'Subtle age reduction while keeping identity',
    icon: 'clock.arrow.circlepath',
    mapsTo: 'custom',
    gradient: ['#06b6d4', '#38bdf8']
  },
  {
    id: 'add_wings',
    name: 'Add Angel Wings',
    description: 'Beautiful wings that match your photo',
    icon: 'bird',
    mapsTo: 'custom',
    gradient: ['#e879f9', '#f0abfc']
  },

  // Magic Sections
  {
    id: 'water_stain_damage',
    name: 'Water/Stain Damage',
    description: 'Remove water damage, stains, and discoloration',
    icon: 'drop',
    mapsTo: 'water_damage',
    gradient: ['#0ea5e9', '#3b82f6']
  },
  {
    id: 'professional_outfit',
    name: 'Professional Outfit',
    description: 'Change to professional business attire',
    icon: 'person.crop.square',
    mapsTo: 'outfit',
    gradient: ['#8b5cf6', '#a78bfa']
  },
  {
    id: 'blur_background',
    name: 'Blur Background',
    description: 'Create professional blurred background effect',
    icon: 'camera.aperture',
    mapsTo: 'background',
    styleKey: 'bg-5',
    gradient: ['#0ea5e9', '#38bdf8']
  },

  // Other Popular Creative Features
  {
    id: 'add_halo',
    name: 'Add Halo',
    description: 'Subtle glowing halo above head',
    icon: 'sun.max',
    mapsTo: 'custom',
    gradient: ['#fbbf24', '#f59e0b']
  },
  {
    id: 'memorial_flowers',
    name: 'Memorial Flowers',
    description: 'Cover scene with memorial flowers and petals',
    icon: 'heart.fill',
    mapsTo: 'memorial',
    styleKey: 'memorial-5',
    gradient: ['#f472b6', '#fb7185']
  },
  {
    id: 'make_slimmer',
    name: 'Make Slimmer',
    description: 'Natural body enhancement',
    icon: 'figure.stand',
    mapsTo: 'custom',
    gradient: ['#10b981', '#34d399']
  },

  // Core Repair & Enhance
  {
    id: 'add_color_bw',
    name: 'Colorize',
    description: 'Bring old B&W photos to life with realistic color',
    icon: 'paintbrush',
    mapsTo: 'colorize',
    gradient: ['#10b981', '#34d399']
  },
  {
    id: 'unblur_sharpen',
    name: 'Clarify',
    description: 'Make blurry photos crystal clear',
    icon: 'eye',
    mapsTo: 'unblur',
    gradient: ['#059669', '#10b981']
  },

  
  // Skip Option (Last)
  {
    id: 'none_above',
    name: 'Explore App',
    description: 'Skip and explore the app',
    icon: 'arrow.right',
    mapsTo: 'skip',
    isSkip: true,
    gradient: ['#3b82f6', '#60a5fa']
  }
];

// Performance optimization: Create lookup object for O(1) feature access
const FEATURES_LOOKUP = ONBOARDING_FEATURES.reduce((acc, feature) => {
  acc[feature.id] = feature;
  return acc;
}, {} as Record<string, OnboardingFeature>);

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

  // Always skip onboarding flag
  async getAlwaysSkipOnboarding(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_ALWAYS_SKIP_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Error getting always skip onboarding flag:', error);
      return false;
    }
  },

  async setAlwaysSkipOnboarding(skip: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_ALWAYS_SKIP_KEY, skip ? 'true' : 'false');
    } catch (error) {
      console.error('Error setting always skip onboarding flag:', error);
    }
  },

  async getAlwaysShowOnboarding(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_ALWAYS_SHOW_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Error getting always show onboarding flag:', error);
      return false;
    }
  },

  async setAlwaysShowOnboarding(show: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_ALWAYS_SHOW_KEY, show ? 'true' : 'false');
    } catch (error) {
      console.error('Error setting always show onboarding flag:', error);
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
      // Do not modify always-skip flag when resetting content
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  },

  // Get feature by ID (O(1) lookup)
  getFeatureById(id: string) {
    return FEATURES_LOOKUP[id];
  },

  // Get primary feature from selections
  getPrimaryFeature(selectedFeatures: string[], primaryInterest: string) {
    return this.getFeatureById(primaryInterest) || this.getFeatureById(selectedFeatures[0]);
  }
};