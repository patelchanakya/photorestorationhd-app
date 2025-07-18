import { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';

// Hook to refresh queries when screen comes into focus
export function useRefreshOnFocus<T>(refetch: () => Promise<T>) {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      refetch();
    }
  }, [isFocused, refetch]);
}

// Hook to invalidate queries when screen comes into focus
export function useInvalidateOnFocus(queryKey: string[], queryClient: any) {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      queryClient.invalidateQueries({ queryKey });
    }
  }, [isFocused, queryKey, queryClient]);
}