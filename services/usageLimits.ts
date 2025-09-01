/**
 * Usage Limits Configuration Service
 * Centralizes all usage limits with environment variable support
 * Makes it easy to adjust limits without code changes
 */

/**
 * Get photo usage limit for free users
 * Configurable via EXPO_PUBLIC_FREE_PHOTO_LIMIT environment variable
 */
export const getFreePhotoLimit = (): number => {
  const envLimit = process.env.EXPO_PUBLIC_FREE_PHOTO_LIMIT;
  const limit = envLimit ? parseInt(envLimit, 10) : 5; // Default: 5 photos
  
  if (__DEV__) {
    console.log('📸 Free photo limit:', limit);
  }
  
  return limit;
};

/**
 * Get video usage limit for monthly Pro plans
 * Configurable via EXPO_PUBLIC_MONTHLY_VIDEO_LIMIT environment variable
 */
export const getMonthlyVideoLimit = (): number => {
  const envLimit = process.env.EXPO_PUBLIC_MONTHLY_VIDEO_LIMIT;
  const limit = envLimit ? parseInt(envLimit, 10) : 31; // Default: 31 videos/month
  
  if (__DEV__) {
    console.log('🎬 Monthly video limit:', limit);
  }
  
  return limit;
};

/**
 * Get daily video limit for weekly Pro plans
 * Configurable via EXPO_PUBLIC_WEEKLY_VIDEO_DAILY_LIMIT environment variable
 */
export const getWeeklyVideoDailyLimit = (): number => {
  const envLimit = process.env.EXPO_PUBLIC_WEEKLY_VIDEO_DAILY_LIMIT;
  const limit = envLimit ? parseInt(envLimit, 10) : 1; // Default: 1 video/day
  
  if (__DEV__) {
    console.log('🎬 Weekly daily video limit:', limit);
  }
  
  return limit;
};

/**
 * Get usage limits based on plan type
 */
export const getUsageLimits = (planType: 'free' | 'weekly' | 'monthly') => {
  switch (planType) {
    case 'free':
      return {
        photos: getFreePhotoLimit(),
        videos: 0, // Free users blocked from videos
        videosDaily: 0
      };
    case 'weekly':
      return {
        photos: -1, // Unlimited for Pro users
        videos: getMonthlyVideoLimit(),
        videosDaily: getWeeklyVideoDailyLimit()
      };
    case 'monthly':
      return {
        photos: -1, // Unlimited for Pro users
        videos: getMonthlyVideoLimit(),
        videosDaily: -1 // No daily limit for monthly plans
      };
    default:
      return {
        photos: getFreePhotoLimit(),
        videos: 0,
        videosDaily: 0
      };
  }
};

/**
 * Check if a plan has unlimited access to a feature
 */
export const hasUnlimitedAccess = (planType: 'free' | 'weekly' | 'monthly', feature: 'photos' | 'videos') => {
  const limits = getUsageLimits(planType);
  
  if (feature === 'photos') {
    return limits.photos === -1;
  } else if (feature === 'videos') {
    return limits.videos === -1 && limits.videosDaily === -1;
  }
  
  return false;
};

/**
 * Format usage display text
 */
export const formatUsageText = (used: number, limit: number, feature: 'photos' | 'videos'): string => {
  if (limit === -1) {
    return `${used} ${feature} used (unlimited)`;
  } else if (limit === 0) {
    return `${feature} not available`;
  } else {
    return `${used}/${limit} ${feature} used`;
  }
};