import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Device breakpoints based on actual iOS devices
export const DEVICE_BREAKPOINTS = {
  // iPhone categories
  COMPACT_PHONE: 380, // iPhone SE, 12 mini, 13 mini
  STANDARD_PHONE: 430, // iPhone 14-16, Pro models
  // iPad categories
  IPAD_MINI: 768, // iPad mini
  IPAD_REGULAR: 834, // iPad Air 11-inch
  IPAD_PRO_11: 852, // iPad Pro 11-inch variations
  IPAD_PRO_13: 1000, // iPad Pro 13-inch
} as const;

// Device type detection
export const getDeviceType = () => {
  const shortestSide = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);
  const longestSide = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT);

  if (shortestSide < DEVICE_BREAKPOINTS.COMPACT_PHONE) {
    return 'compact_phone';
  } else if (shortestSide < DEVICE_BREAKPOINTS.STANDARD_PHONE) {
    return 'standard_phone';
  } else if (shortestSide < DEVICE_BREAKPOINTS.IPAD_MINI) {
    return 'plus_phone';
  } else if (shortestSide < DEVICE_BREAKPOINTS.IPAD_REGULAR) {
    return 'ipad_mini';
  } else if (shortestSide < DEVICE_BREAKPOINTS.IPAD_PRO_11) {
    return 'ipad_regular';
  } else if (shortestSide < DEVICE_BREAKPOINTS.IPAD_PRO_13) {
    return 'ipad_pro_11';
  } else {
    return 'ipad_pro_13';
  }
};

export const isTablet = () => {
  const deviceType = getDeviceType();
  return deviceType.includes('ipad');
};

export const isPhone = () => !isTablet();

// Responsive scaling based on device type - enhanced for tablets
export const getScaleMultiplier = () => {
  const deviceType = getDeviceType();

  switch (deviceType) {
    case 'compact_phone':
      return 0.85;
    case 'standard_phone':
      return 1.0;
    case 'plus_phone':
      return 1.1;
    case 'ipad_mini':
      return 1.3; // Increased from 1.15 for better readability
    case 'ipad_regular':
      return 1.5; // Increased from 1.2 for better readability
    case 'ipad_pro_11':
      return 1.7; // Increased from 1.25 for better readability
    case 'ipad_pro_13':
      return 2.0; // Increased from 1.3 for better readability
    default:
      return 1.0;
  }
};

// Font size scaling
export const responsiveFontSize = (baseSize: number): number => {
  const scale = getScaleMultiplier();
  return Math.round(baseSize * scale);
};

// Spacing scaling
export const responsiveSpacing = (baseSpacing: number): number => {
  const scale = getScaleMultiplier();
  return Math.round(baseSpacing * scale);
};

// Width percentage calculations
export const widthPercentage = (percentage: number): number => {
  return Math.round((SCREEN_WIDTH * percentage) / 100);
};

// Height percentage calculations
export const heightPercentage = (percentage: number): number => {
  return Math.round((SCREEN_HEIGHT * percentage) / 100);
};

// Content padding based on screen width - optimized for screen utilization
export const getContentPadding = (): number => {
  if (isTablet()) {
    const tabletPadding = widthPercentage(5); // Reduced from 8% to 5%
    return Math.min(tabletPadding, 60); // Cap at 60px for very large screens
  } else {
    return widthPercentage(6); // 6% on phones
  }
};

// Button width constraints - improved for tablets
export const getButtonWidth = (maxWidth?: number): { width?: number; maxWidth: number; minWidth?: number } => {
  if (isTablet()) {
    const tabletMaxWidth = widthPercentage(75); // Increased from 60% to 75%
    const tabletMinWidth = 400; // Minimum 400px for proper proportions
    return {
      maxWidth: maxWidth ? Math.min(maxWidth, tabletMaxWidth) : tabletMaxWidth,
      minWidth: tabletMinWidth
    };
  } else {
    const phoneMaxWidth = widthPercentage(90); // 90% max on phones
    return {
      maxWidth: maxWidth ? Math.min(maxWidth, phoneMaxWidth) : phoneMaxWidth
    };
  }
};

// Grid column calculation for tiles
export const getGridColumns = (): number => {
  const deviceType = getDeviceType();

  if (deviceType.includes('ipad_pro_13')) {
    return 3; // 3 columns on large iPad Pro
  } else if (deviceType.includes('ipad')) {
    return 2; // 2 columns on other iPads
  } else {
    return 2; // 2 columns on all phones
  }
};

// Image container dimensions - full width on tablets
export const getImageContainerDimensions = (aspectRatio: number = 1): { width: number; height: number } => {
  const deviceType = getDeviceType();

  if (isTablet()) {
    // On tablets, use FULL WIDTH for better screen utilization
    const containerWidth = widthPercentage(100); // Changed from 70% to 100%
    const containerHeight = containerWidth / aspectRatio;
    return { width: containerWidth, height: containerHeight };
  } else {
    // On phones, use percentage of screen height but constrain by width
    const maxHeightFromScreen = heightPercentage(45);
    const maxWidthFromScreen = widthPercentage(90);
    const heightFromWidth = maxWidthFromScreen / aspectRatio;

    const containerHeight = Math.min(maxHeightFromScreen, heightFromWidth);
    const containerWidth = containerHeight * aspectRatio;

    return { width: containerWidth, height: containerHeight };
  }
};

// Line height calculation
export const responsiveLineHeight = (fontSize: number, multiplier: number = 1.2): number => {
  return Math.round(fontSize * multiplier);
};

// Border radius scaling
export const responsiveBorderRadius = (baseRadius: number): number => {
  const scale = getScaleMultiplier();
  return Math.round(baseRadius * Math.min(scale, 1.15)); // Cap scaling for border radius
};

// Screen dimensions
export const SCREEN_DIMENSIONS = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  shortestSide: Math.min(SCREEN_WIDTH, SCREEN_HEIGHT),
  longestSide: Math.max(SCREEN_WIDTH, SCREEN_HEIGHT),
} as const;

// Responsive hooks
export const useResponsive = () => {
  return {
    deviceType: getDeviceType(),
    isTablet: isTablet(),
    isPhone: isPhone(),
    scale: getScaleMultiplier(),
    dimensions: SCREEN_DIMENSIONS,
    fontSize: responsiveFontSize,
    spacing: responsiveSpacing,
    contentPadding: getContentPadding(),
    buttonWidth: getButtonWidth,
    gridColumns: getGridColumns(),
    imageContainer: getImageContainerDimensions,
    lineHeight: responsiveLineHeight,
    borderRadius: responsiveBorderRadius,
    width: widthPercentage,
    height: heightPercentage,
  };
};