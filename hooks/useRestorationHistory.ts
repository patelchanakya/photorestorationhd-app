import { useQuery, useQueryClient } from '@tanstack/react-query';
import { restorationService } from '@/services/supabase';
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
export function useRestorationHistory() {
  return useQuery({
    queryKey: photoRestorationKeys.history(),
    queryFn: async (): Promise<RestorationHistoryItem[]> => {
      try {
        // Always use 'anonymous' since we don't have auth
        const restorations = await restorationService.getUserRestorations('anonymous');
        return restorations
          .filter(r => r.status === 'completed')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(restoration => ({
            id: restoration.id,
            originalImageUri: restoration.original_filename || '',
            restoredImageUri: restoration.restored_filename || '',
            createdAt: new Date(restoration.created_at),
            original_filename: restoration.original_filename || '',
            restored_filename: restoration.restored_filename,
            thumbnail_filename: restoration.thumbnail_filename,
            status: restoration.status,
            function_type: restoration.function_type,
          }));
      } catch (error) {
        console.error('Failed to load restoration history:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

// Hook to refresh restoration history
export function useRefreshHistory() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: photoRestorationKeys.history() });
  };
}