import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRollbackMetrics } from '@/hooks/useRollbackRecovery';

/**
 * Development-only component for monitoring rollback metrics
 * Can be conditionally rendered in debug builds to track rollback performance
 */
export function RollbackMonitor() {
  const { getMetrics } = useRollbackMetrics();
  const [metrics, setMetrics] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  const refreshMetrics = React.useCallback(async () => {
    const currentMetrics = await getMetrics();
    setMetrics(currentMetrics);
  }, [getMetrics]);

  useEffect(() => {
    if (!__DEV__) return;
    
    refreshMetrics();
    
    // Refresh metrics every 30 seconds when visible
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (isVisible) {
      intervalId = setInterval(refreshMetrics, 30000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isVisible, refreshMetrics]);

  // Only show in development builds
  if (!__DEV__) {
    return null;
  }

  if (!isVisible) {
    return (
      <Pressable
        onPress={() => setIsVisible(true)}
        className="absolute top-20 right-4 bg-blue-500 px-3 py-2 rounded-lg opacity-50"
      >
        <Text className="text-white text-xs font-medium">Rollback</Text>
      </Pressable>
    );
  }

  return (
    <View className="absolute top-20 right-4 bg-black/90 p-4 rounded-lg min-w-48">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-white text-sm font-bold">Rollback Monitor</Text>
        <Pressable onPress={() => setIsVisible(false)}>
          <Text className="text-white text-lg">×</Text>
        </Pressable>
      </View>
      
      {metrics && (
        <View className="space-y-1">
          <Text className="text-green-400 text-xs">
            ✅ Success: {metrics.successfulRollbacks}
          </Text>
          <Text className="text-red-400 text-xs">
            ❌ Failed: {metrics.failedRollbacks}
          </Text>
          <Text className="text-yellow-400 text-xs">
            ⏳ Pending: {metrics.currentPendingCount}
          </Text>
          <Text className="text-gray-400 text-xs">
            📊 Total: {metrics.totalAttempts}
          </Text>
          
          {metrics.lastSuccessTime && (
            <Text className="text-gray-400 text-xs mt-2">
              Last success: {new Date(metrics.lastSuccessTime).toLocaleTimeString()}
            </Text>
          )}
          
          {metrics.lastFailureTime && (
            <Text className="text-gray-400 text-xs">
              Last failure: {new Date(metrics.lastFailureTime).toLocaleTimeString()}
            </Text>
          )}
        </View>
      )}
      
      <Pressable
        onPress={refreshMetrics}
        className="bg-blue-500 mt-3 py-1 px-2 rounded"
      >
        <Text className="text-white text-xs text-center">Refresh</Text>
      </Pressable>
    </View>
  );
}

/**
 * Hook for logging rollback events for external analytics systems
 */
export function useRollbackAnalytics() {
  const logRollbackEvent = (
    eventType: 'rollback_attempted' | 'rollback_success' | 'rollback_failed' | 'rollback_queued',
    userId: string,
    type: 'video' | 'photo',
    metadata?: any
  ) => {
    // In a real app, this would send to your analytics service
    // For now, we'll use structured console logging that can be parsed by log aggregation systems
    
    const logData = {
      timestamp: new Date().toISOString(),
      event: eventType,
      userId: userId ? `${userId.substring(0, 8)}...` : 'unknown', // Truncated for privacy
      type,
      metadata,
      app_version: '1.0.0', // Could be dynamic
      platform: 'mobile'
    };

    if (__DEV__) {
      console.log(`📊 [ANALYTICS] ${eventType.toUpperCase()}:`, logData);
    } else {
      // In production, use a more structured format for log parsing
      console.log(JSON.stringify({
        level: 'info',
        category: 'rollback_analytics',
        ...logData
      }));
    }

    // TODO: Send to external analytics service like Mixpanel, Amplitude, etc.
    // Example:
    // analytics.track(eventType, logData);
  };

  return { logRollbackEvent };
}