import { restorationService } from '@/services/supabase';
import { useRestorationStore } from '@/store/restorationStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { photoRestorationKeys } from './usePhotoRestoration';

export interface RestorationHistoryItem {
  id: string;
  originalImageUri: string;
  restoredImageUri: string;
  createdAt: Date;
  original_filename: string;
  restored_filename: string | null;
  thumbnail_filename: string | null;
  status: string;
  function_type: string;
}

// Hook to get restoration history
export function useRestorationHistory(enabled: boolean = true, updateCount: boolean = true) {
  const setRestorationCount = useRestorationStore((state) => state.setRestorationCount);
  return useQuery({
    queryKey: photoRestorationKeys.history(),
    queryFn: async (): Promise<RestorationHistoryItem[]> => {
      try {
        if (__DEV__) {
          console.log('🔍 Loading restoration history...');
        }
        
        // Always use 'anonymous' since we don't have auth
        const restorations = await restorationService.getUserRestorations('anonymous');
        if (__DEV__) {
          console.log('✅ Loaded restoration history:', restorations.length, 'items');
        }
        
        // Import photoStorage to check file existence
        const { photoStorage } = await import('@/services/storage');
        
        // Filter and validate restorations
        const validRestorations = [];
        for (const restoration of restorations) {
          if (restoration.status === 'completed' && restoration.thumbnail_filename) {
            // Check if thumbnail exists
            const exists = await photoStorage.checkPhotoExists('thumbnail', restoration.thumbnail_filename);
            if (exists) {
              validRestorations.push(restoration);
            }
          }
        }
        
        if (__DEV__) {
          console.log(`✅ Valid restorations: ${validRestorations.length} out of ${restorations.length}`);
        }
        
        const processedRestorations = validRestorations
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(restoration => ({
            id: restoration.id,
            originalImageUri: restoration.original_filename || '',
            restoredImageUri: restoration.restored_filename || '',
            createdAt: new Date(restoration.created_at),
            original_filename: restoration.original_filename || '',
            restored_filename: restoration.restored_filename ?? null,
            thumbnail_filename: restoration.thumbnail_filename ?? null,
            status: restoration.status,
            function_type: restoration.function_type || '',
          }));
          
        // Update Zustand store with the count only if updateCount is true
        if (updateCount) {
          if (__DEV__) {
            console.log('[useRestorationHistory] Setting restoration count:', processedRestorations.length);
          }
          setRestorationCount(processedRestorations.length);
        }
        if (__DEV__) {
          console.log('📊 Processed restoration history:', processedRestorations.length, 'completed items');
        }
        return processedRestorations;
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Failed to load restoration history:', error);
        }
        setRestorationCount(0);
        return [];
      }
    },
    enabled,
    initialData: [],
    staleTime: 1000 * 5, // 5 seconds - short cache to prevent immediate duplicates
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnMount: false, // Prevent automatic refetch on mount
    refetchOnWindowFocus: false, // Prevent refetch on focus
  });
}

// Hook to refresh restoration history
export function useRefreshHistory() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: photoRestorationKeys.history() });
  };
}