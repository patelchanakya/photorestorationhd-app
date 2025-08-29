import NetInfo from '@react-native-community/netinfo';
import { networkQueue } from '@/utils/networkSafeOperation';

class NetworkListener {
  private hasStarted = false;
  private unsubscribe: (() => void) | null = null;

  /**
   * Start listening for network changes
   * Automatically retries queued operations when network becomes available
   */
  start(): void {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;

    if (__DEV__) {
      console.log('🌐 [NetworkListener] Starting network monitoring...');
    }

    this.unsubscribe = NetInfo.addEventListener((state) => {
      if (__DEV__) {
        console.log('🌐 [NetworkListener] Network state changed:', {
          connected: state.isConnected,
          reachable: state.isInternetReachable,
          type: state.type
        });
      }

      // If network became available, flush the queue
      if (state.isConnected && state.isInternetReachable) {
        this.handleNetworkRestored();
      }
    });
  }

  /**
   * Stop listening for network changes
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.hasStarted = false;

    if (__DEV__) {
      console.log('🌐 [NetworkListener] Stopped network monitoring');
    }
  }

  private async handleNetworkRestored(): Promise<void> {
    try {
      const queueSize = networkQueue.getQueueSize();
      
      if (queueSize > 0) {
        if (__DEV__) {
          console.log(`🚀 [NetworkListener] Network restored - processing ${queueSize} queued operations`);
        }
        
        await networkQueue.flush();
        
        if (__DEV__) {
          console.log('✅ [NetworkListener] Queued operations processed');
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [NetworkListener] Failed to process queued operations:', error);
      }
    }
  }

  /**
   * Get current network listener status
   */
  isListening(): boolean {
    return this.hasStarted;
  }
}

export const networkListener = new NetworkListener();

// Auto-start listener (can be stopped manually if needed)
if (__DEV__) {
  // Start immediately in development
  networkListener.start();
} else {
  // Small delay in production to avoid interfering with app startup
  setTimeout(() => {
    networkListener.start();
  }, 1000);
}