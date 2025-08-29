// Onboarding Design System Constants

export const ONBOARDING_COLORS = {
  // Backgrounds  
  background: '#000000',
  backgroundGradientStart: '#000000', 
  backgroundGradientEnd: '#000000',
  cardBackground: '#000000',
  cardBackgroundHover: '#111111',
  overlay: 'rgba(15, 15, 26, 0.95)',

  // Accents
  accent: '#F97316',
  accentLight: '#FB923C', 
  accentDark: '#EA580C',
  accentBackground: 'rgba(249, 115, 22, 0.08)',
  accentBackgroundSelected: 'rgba(249, 115, 22, 0.12)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#E5E7EB',
  textMuted: '#9CA3AF',
  textDisabled: '#6B7280',

  // States
  success: '#10B981',
  successBackground: 'rgba(16, 185, 129, 0.1)',
  error: '#EF4444',
  warning: '#F59E0B',

  // Borders
  border: 'rgba(255, 255, 255, 0.1)',
  borderActive: 'rgba(249, 115, 22, 0.25)',
  borderSelected: 'rgba(249, 115, 22, 0.5)',
} as const;

export const ONBOARDING_SPACING = {
  xs: 4,
  sm: 8, 
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
} as const;

export const ONBOARDING_BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const ONBOARDING_TYPOGRAPHY = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  huge: 32,
  massive: 36,
  giant: 48,

  // Font weights
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

export const ONBOARDING_SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  accent: {
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const ONBOARDING_ANIMATIONS = {
  // Durations
  fast: 200,
  normal: 300,
  slow: 400,
  slower: 600,

  // Spring configs
  spring: {
    damping: 15,
    stiffness: 200,
  },
  springBouncy: {
    damping: 10,
    stiffness: 300,
  },
} as const;