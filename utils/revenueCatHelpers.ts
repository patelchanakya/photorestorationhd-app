import Purchases from 'react-native-purchases';

/**
 * Executes an async operation with exponential backoff retry logic
 */
export const withExponentialBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on user cancellation or certain error types
      if (error && typeof error === 'object' && 'userCancelled' in error && error.userCancelled) {
        throw error;
      }
      
      // Don't retry on configuration errors
      if (error && typeof error === 'object' && 'message' in error) {
        const message = error.message as string;
        if (message.includes('API key') || message.includes('configuration')) {
          throw error;
        }
      }
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        if (__DEV__) {
          console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms for operation`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

/**
 * Waits for RevenueCat to be properly configured with timeout
 */
export const waitForConfiguration = async (timeoutMs: number = 5000): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      if (await Purchases.isConfigured()) {
        return true;
      }
    } catch (error) {
      // Ignore errors during configuration check
      if (__DEV__) {
        console.warn('⚠️ Error checking RevenueCat configuration:', error);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
};

/**
 * Safely executes a RevenueCat operation with proper error handling
 */
export const safeRevenueCatOperation = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  fallbackValue?: T
): Promise<T | undefined> => {
  try {
    return await withExponentialBackoff(operation, 2); // Max 2 retries for RevenueCat operations
  } catch (error) {
    if (__DEV__) {
      console.error(`❌ RevenueCat ${operationName} failed:`, error);
    }
    
    // Return fallback value if provided
    if (fallbackValue !== undefined) {
      if (__DEV__) {
        console.log(`🔄 Using fallback value for ${operationName}`);
      }
      return fallbackValue;
    }
    
    return undefined;
  }
};

/**
 * Checks if an error should trigger a retry
 */
export const shouldRetryError = (error: any): boolean => {
  if (!error) return false;
  
  // Don't retry user cancellations
  if (error.userCancelled) return false;
  
  // Don't retry configuration errors
  if (error.message && typeof error.message === 'string') {
    const message = error.message.toLowerCase();
    if (message.includes('api key') || 
        message.includes('configuration') ||
        message.includes('invalid credentials')) {
      return false;
    }
  }
  
  // Retry network errors, temporary failures, etc.
  return true;
};

/**
 * Creates a timeout promise that rejects after specified milliseconds
 */
export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

/**
 * Utility to safely get customer info with retries and timeout
 */
export const safeGetCustomerInfo = async (timeoutMs: number = 30000) => {
  return safeRevenueCatOperation(
    () => withTimeout(Purchases.getCustomerInfo(), timeoutMs),
    'getCustomerInfo'
  );
};

/**
 * Utility to safely restore purchases with retries and timeout
 */
export const safeRestorePurchases = async (timeoutMs: number = 30000) => {
  return safeRevenueCatOperation(
    () => withTimeout(Purchases.restorePurchases(), timeoutMs),
    'restorePurchases'
  );
};

/**
 * Utility to safely get offerings with retries and timeout
 */
export const safeGetOfferings = async (timeoutMs: number = 30000) => {
  return safeRevenueCatOperation(
    () => withTimeout(Purchases.getOfferings(), timeoutMs),
    'getOfferings'
  );
};