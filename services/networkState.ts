import NetInfo from '@react-native-community/netinfo';

export interface NetworkStateService {
  isOnline: boolean;
  subscribe: (callback: (isOnline: boolean) => void) => () => void;
  checkConnection: () => Promise<boolean>;
}

class NetworkStateManager implements NetworkStateService {
  public isOnline: boolean = true;
  private listeners: ((isOnline: boolean) => void)[] = [];
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    if (this.initialized) return;
    
    try {
      // Get initial state
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected ?? false;
      
      // Subscribe to network state changes
      NetInfo.addEventListener(state => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected ?? false;
        
        if (wasOnline !== this.isOnline) {
          this.notifyListeners();
          if (__DEV__) {
            console.log(`🌐 Network state changed: ${this.isOnline ? 'online' : 'offline'}`);
          }
        }
      });
      
      this.initialized = true;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to initialize network state manager:', error);
      }
      // Default to online if NetInfo fails
      this.isOnline = true;
    }
  }

  public subscribe(callback: (isOnline: boolean) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public async checkConnection(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      const isOnline = state.isConnected ?? false;
      
      if (this.isOnline !== isOnline) {
        this.isOnline = isOnline;
        this.notifyListeners();
      }
      
      return isOnline;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to check network connection:', error);
      }
      return this.isOnline; // Return cached state if check fails
    }
  }

  private notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.isOnline);
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Error in network state listener:', error);
        }
      }
    });
  }
}

// Export singleton instance
export const networkStateService = new NetworkStateManager();