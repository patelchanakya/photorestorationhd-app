import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  isWifiEnabled: boolean;
  isCellularEnabled: boolean;
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true, // Assume connected initially
    isInternetReachable: true,
    type: 'unknown',
    isWifiEnabled: false,
    isCellularEnabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial network state
    const checkInitialState = async () => {
      try {
        const state = await NetInfo.fetch();
        updateNetworkStatus(state);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch initial network state:', error);
        setIsLoading(false);
      }
    };

    checkInitialState();

    // Listen for network state changes
    const unsubscribe = NetInfo.addEventListener(updateNetworkStatus);

    return () => {
      unsubscribe();
    };
  }, []);

  const updateNetworkStatus = (state: NetInfoState) => {
    setNetworkStatus({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type,
      isWifiEnabled: state.type === 'wifi',
      isCellularEnabled: state.type === 'cellular',
    });

    if (__DEV__) {
      console.log('🌐 [Network] Status updated:', {
        connected: state.isConnected,
        reachable: state.isInternetReachable,
        type: state.type,
      });
    }
  };

  /**
   * Force refresh network status
   */
  const refreshNetworkStatus = async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      updateNetworkStatus(state);
      return (state.isConnected ?? false) && (state.isInternetReachable ?? false);
    } catch (error) {
      console.error('Failed to refresh network status:', error);
      return false;
    }
  };

  /**
   * Check if we have a reliable internet connection
   */
  const hasReliableConnection = (): boolean => {
    return networkStatus.isConnected && networkStatus.isInternetReachable;
  };

  /**
   * Get user-friendly network status message
   */
  const getStatusMessage = (): string => {
    if (!networkStatus.isConnected) {
      return 'No internet connection detected';
    }
    if (!networkStatus.isInternetReachable) {
      return 'Connected but internet not reachable';
    }
    if (networkStatus.isWifiEnabled) {
      return 'Connected via Wi-Fi';
    }
    if (networkStatus.isCellularEnabled) {
      return 'Connected via cellular data';
    }
    return 'Connected';
  };

  return {
    networkStatus,
    isLoading,
    hasReliableConnection,
    refreshNetworkStatus,
    getStatusMessage,
  };
}

export default useNetworkStatus;