import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create a simple persister for specific queries
export function usePersistentQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    gcTime?: number;
    enabled?: boolean;
  }
) {
  const queryClient = useQueryClient();
  const cacheKey = `rq_cache_${queryKey.join('_')}`;

  // Load from AsyncStorage on mount
  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const isStale = Date.now() - timestamp > (options?.staleTime || 1000 * 60 * 5);
          
          if (!isStale) {
            queryClient.setQueryData(queryKey, data);
          }
        }
      } catch (error) {
        console.error('Failed to load from AsyncStorage:', error);
      }
    };

    loadFromStorage();
  }, [queryKey, cacheKey, queryClient, options?.staleTime]);

  const query = useQuery({
    queryKey,
    queryFn,
    staleTime: options?.staleTime || 1000 * 60 * 5,
    gcTime: options?.gcTime || 1000 * 60 * 60 * 24,
    enabled: options?.enabled !== false,
  });

  // Save to AsyncStorage when data changes
  useEffect(() => {
    if (query.data) {
      const saveToStorage = async () => {
        try {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              data: query.data,
              timestamp: Date.now(),
            })
          );
        } catch (error) {
          console.error('Failed to save to AsyncStorage:', error);
        }
      };

      saveToStorage();
    }
  }, [query.data, cacheKey]);

  return query;
}

// Clear specific cache from AsyncStorage
export async function clearPersistentCache(queryKey: string[]) {
  const cacheKey = `rq_cache_${queryKey.join('_')}`;
  try {
    await AsyncStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

// Clear all TanStack Query caches from AsyncStorage
export async function clearAllPersistentCaches() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const queryKeys = keys.filter(key => key.startsWith('rq_cache_'));
    await AsyncStorage.multiRemove(queryKeys);
  } catch (error) {
    console.error('Failed to clear all caches:', error);
  }
}