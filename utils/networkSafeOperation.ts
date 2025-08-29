import NetInfo from '@react-native-community/netinfo';

/**
 * Wraps async operations to handle network issues gracefully
 * Prevents app crashes when network is unavailable
 */
export async function networkSafeOperation<T>(
  operation: () => Promise<T>,
  fallbackValue?: T,
  operationName?: string
): Promise<T | null> {
  try {
    // Quick network check
    const netState = await NetInfo.fetch();
    
    if (!netState.isConnected || !netState.isInternetReachable) {
      if (__DEV__ && operationName) {
        console.log(`🔌 [NetworkSafe] Skipping ${operationName} - no network connection`);
      }
      return fallbackValue ?? null;
    }

    // Execute the operation
    const result = await operation();
    return result;
  } catch (error) {
    if (__DEV__) {
      console.warn(`⚠️ [NetworkSafe] ${operationName || 'Operation'} failed:`, error);
    }
    
    // Return fallback value instead of throwing
    return fallbackValue ?? null;
  }
}

/**
 * Wraps sync operations that might depend on network state
 */
export async function networkSafeSyncOperation<T>(
  operation: () => T,
  fallbackValue?: T,
  operationName?: string
): Promise<T | null> {
  try {
    const netState = await NetInfo.fetch();
    
    if (!netState.isConnected || !netState.isInternetReachable) {
      if (__DEV__ && operationName) {
        console.log(`🔌 [NetworkSafe] Skipping ${operationName} - no network connection`);
      }
      return fallbackValue ?? null;
    }

    const result = operation();
    return result;
  } catch (error) {
    if (__DEV__) {
      console.warn(`⚠️ [NetworkSafe] ${operationName || 'Operation'} failed:`, error);
    }
    
    return fallbackValue ?? null;
  }
}

/**
 * Queue operations for when network becomes available
 */
class NetworkQueue {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;

  async add<T>(operation: () => Promise<T>, operationName?: string): Promise<void> {
    if (__DEV__ && operationName) {
      console.log(`📥 [NetworkQueue] Queuing ${operationName}`);
    }
    
    this.queue.push(operation);
    
    // Try to process queue immediately
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const netState = await NetInfo.fetch();
      
      if (!netState.isConnected || !netState.isInternetReachable) {
        if (__DEV__) {
          console.log(`🔌 [NetworkQueue] No network - keeping ${this.queue.length} operations queued`);
        }
        return;
      }

      // Process all queued operations
      const operations = [...this.queue];
      this.queue = [];

      if (__DEV__) {
        console.log(`🚀 [NetworkQueue] Processing ${operations.length} queued operations`);
      }

      for (const operation of operations) {
        try {
          await operation();
        } catch (error) {
          if (__DEV__) {
            console.warn('⚠️ [NetworkQueue] Queued operation failed:', error);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Call this when network becomes available
  async flush(): Promise<void> {
    await this.processQueue();
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

export const networkQueue = new NetworkQueue();

/**
 * Enhanced network-safe operation that queues failed operations
 */
export async function networkSafeOperationWithQueue<T>(
  operation: () => Promise<T>,
  operationName?: string,
  enableQueue: boolean = true
): Promise<T | null> {
  try {
    const netState = await NetInfo.fetch();
    
    if (!netState.isConnected || !netState.isInternetReachable) {
      if (enableQueue) {
        await networkQueue.add(operation, operationName);
      }
      
      if (__DEV__ && operationName) {
        console.log(`🔌 [NetworkSafe] ${enableQueue ? 'Queued' : 'Skipped'} ${operationName} - no network`);
      }
      
      return null;
    }

    const result = await operation();
    return result;
  } catch (error) {
    if (__DEV__) {
      console.warn(`⚠️ [NetworkSafe] ${operationName || 'Operation'} failed:`, error);
    }
    
    // Queue for retry if network-related error
    if (enableQueue && isNetworkError(error)) {
      await networkQueue.add(operation, operationName);
    }
    
    return null;
  }
}

function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code;
  
  // Common network error patterns
  const networkErrorPatterns = [
    'network',
    'connection',
    'fetch',
    'timeout',
    'unreachable',
    'offline'
  ];
  
  const networkErrorCodes = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CONNECTION_ERROR',
    'FETCH_ERROR'
  ];
  
  return networkErrorPatterns.some(pattern => errorMessage.includes(pattern)) ||
         networkErrorCodes.includes(errorCode);
}