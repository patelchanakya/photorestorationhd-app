// Responsive Design System Constants
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius } from '@/utils/responsive';

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

// Responsive spacing - scales based on device type
export const ONBOARDING_SPACING = {
  xs: responsiveSpacing(4),
  sm: responsiveSpacing(8),
  md: responsiveSpacing(12),
  lg: responsiveSpacing(16),
  xl: responsiveSpacing(20),
  xxl: responsiveSpacing(24),
  xxxl: responsiveSpacing(32),
  huge: responsiveSpacing(40),
  massive: responsiveSpacing(48),
} as const;

// Responsive border radius - scales appropriately
export const ONBOARDING_BORDER_RADIUS = {
  sm: responsiveBorderRadius(8),
  md: responsiveBorderRadius(12),
  lg: responsiveBorderRadius(16),
  xl: responsiveBorderRadius(20),
  xxl: responsiveBorderRadius(24),
} as const;

// Responsive typography - scales based on device type
export const ONBOARDING_TYPOGRAPHY = {
  // Font sizes - responsive
  xs: responsiveFontSize(12),
  sm: responsiveFontSize(14),
  base: responsiveFontSize(16),
  lg: responsiveFontSize(18),
  xl: responsiveFontSize(20),
  xxl: responsiveFontSize(24),
  xxxl: responsiveFontSize(28),
  huge: responsiveFontSize(32),
  massive: responsiveFontSize(36),
  giant: responsiveFontSize(48),

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