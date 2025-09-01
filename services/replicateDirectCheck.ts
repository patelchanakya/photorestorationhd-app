import Replicate from 'replicate';

// Direct Replicate API check for fallback when backend fails
// This provides a way to recover videos even when our backend is having issues

const apiToken = process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN;

if (!apiToken && __DEV__) {
  console.warn('EXPO_PUBLIC_REPLICATE_API_TOKEN not found - direct Replicate check will fail');
}

const replicate = new Replicate({
  auth: apiToken,
});

// Cache for recent successful checks to reduce API calls
const checkCache = new Map<string, {
  status: string;
  output?: string;
  error?: string;
  timestamp: number;
}>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface ReplicateDirectCheckResult {
  success: boolean;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'expired';
  videoUrl?: string;
  error?: string;
  isExpired: boolean;
  fromCache?: boolean;
}

// Test network connectivity to Replicate
async function testReplicateConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const response = await fetch('https://api.replicate.com/v1/predictions?page_size=1', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.status === 200 || response.status === 401; // 401 is fine, means API is responding
  } catch (error) {
    if (__DEV__) {
      console.log('🌐 Replicate connectivity test failed:', error);
    }
    return false;
  }
}

export async function checkReplicateDirectStatus(predictionId: string): Promise<ReplicateDirectCheckResult> {
  if (!apiToken) {
    return {
      success: false,
      status: 'failed',
      error: 'No Replicate API token available',
      isExpired: false
    };
  }

  // Check cache first
  const cached = checkCache.get(predictionId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    if (__DEV__) {
      console.log('📄 Using cached Replicate status for:', predictionId);
    }
    
    return {
      success: true,
      status: cached.status as any,
      videoUrl: cached.output,
      error: cached.error,
      isExpired: false,
      fromCache: true
    };
  }

  // Test connectivity first
  const hasConnection = await testReplicateConnection();
  if (!hasConnection) {
    return {
      success: false,
      status: 'failed',
      error: 'No connection to Replicate API',
      isExpired: false
    };
  }

  try {
    if (__DEV__) {
      console.log('🔗 Checking Replicate directly for prediction:', predictionId);
    }

    const prediction = await replicate.predictions.get(predictionId);
    
    if (__DEV__) {
      console.log('📡 Direct Replicate response:', {
        id: prediction.id,
        status: prediction.status,
        hasOutput: !!prediction.output,
        hasError: !!prediction.error
      });
    }

    // Cache the result
    const cacheEntry = {
      status: prediction.status,
      output: prediction.output as string,
      error: prediction.error as string,
      timestamp: Date.now()
    };
    checkCache.set(predictionId, cacheEntry);

    // Clean old cache entries (keep last 10)
    if (checkCache.size > 10) {
      const entries = Array.from(checkCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      checkCache.clear();
      entries.slice(0, 10).forEach(([id, data]) => checkCache.set(id, data));
    }

    const result: ReplicateDirectCheckResult = {
      success: true,
      status: prediction.status as any,
      isExpired: false
    };

    if (prediction.status === 'succeeded' && prediction.output) {
      result.videoUrl = prediction.output as string;
    } else if (prediction.status === 'failed' && prediction.error) {
      result.error = prediction.error as string;
    }

    return result;

  } catch (error: any) {
    if (__DEV__) {
      console.error('❌ Direct Replicate check failed:', error);
    }

    // Handle 404 - video expired on Replicate
    if (error?.response?.status === 404 || error?.status === 404) {
      if (__DEV__) {
        console.log('🗑️ Video expired on Replicate (404)');
      }
      
      return {
        success: true,
        status: 'expired',
        isExpired: true,
        error: 'Video has expired on Replicate servers'
      };
    }

    // Handle rate limiting
    if (error?.response?.status === 429 || error?.status === 429) {
      return {
        success: false,
        status: 'failed',
        error: 'Rate limited by Replicate API',
        isExpired: false
      };
    }

    // Handle auth errors
    if (error?.response?.status === 401 || error?.status === 401) {
      return {
        success: false,
        status: 'failed',
        error: 'Invalid Replicate API token',
        isExpired: false
      };
    }

    // Network or other errors
    return {
      success: false,
      status: 'failed',
      error: error?.message || 'Unknown error checking Replicate',
      isExpired: false
    };
  }
}

// Check if we should use direct Replicate as fallback
export function shouldUseDirectReplicateFallback(backendError: string): boolean {
  const networkErrorKeywords = [
    'network request failed',
    'fetch',
    'timeout',
    'connection',
    'NETWORK_ERROR',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED'
  ];
  
  const errorLower = backendError.toLowerCase();
  return networkErrorKeywords.some(keyword => errorLower.includes(keyword));
}

// Clear cache for a specific prediction (useful when we know it's completed)
export function clearReplicateCache(predictionId?: string) {
  if (predictionId) {
    checkCache.delete(predictionId);
    if (__DEV__) {
      console.log('🧹 Cleared Replicate cache for:', predictionId);
    }
  } else {
    checkCache.clear();
    if (__DEV__) {
      console.log('🧹 Cleared all Replicate cache');
    }
  }
}