import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Cleanup function for cached videos
 * Removes videos older than 30 days from storage and database
 * Can be triggered manually or via cron job
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete video jobs older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    console.log('🧹 Starting video cleanup for videos older than:', thirtyDaysAgo);

    // Get old video jobs with local paths
    const { data: oldVideos, error: fetchError } = await supabase
      .from('user_video_jobs')
      .select('id, prediction_id, local_video_path')
      .lt('created_at', thirtyDaysAgo)
      .not('local_video_path', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch old videos: ${fetchError.message}`);
    }

    if (!oldVideos || oldVideos.length === 0) {
      console.log('✅ No old videos to clean up');
      return new Response(JSON.stringify({ 
        message: 'No videos to clean up',
        cleaned: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🗑️ Found ${oldVideos.length} old videos to clean up`);

    let cleanedCount = 0;
    let errors: string[] = [];

    // Clean up each video
    for (const video of oldVideos) {
      try {
        // Delete from storage if local path exists
        if (video.local_video_path) {
          const { error: storageError } = await supabase.storage
            .from('video-cache')
            .remove([video.local_video_path]);

          if (storageError) {
            console.error(`⚠️ Failed to delete storage file ${video.local_video_path}:`, storageError.message);
            errors.push(`Storage cleanup failed for ${video.prediction_id}: ${storageError.message}`);
          } else {
            console.log(`🗑️ Deleted storage file: ${video.local_video_path}`);
          }
        }

        // Delete database record
        const { error: dbError } = await supabase
          .from('user_video_jobs')
          .delete()
          .eq('id', video.id);

        if (dbError) {
          console.error(`⚠️ Failed to delete database record ${video.id}:`, dbError.message);
          errors.push(`Database cleanup failed for ${video.prediction_id}: ${dbError.message}`);
        } else {
          console.log(`🗑️ Deleted database record: ${video.prediction_id}`);
          cleanedCount++;
        }

      } catch (error) {
        const errorMsg = `Cleanup failed for ${video.prediction_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('❌', errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`✅ Cleanup completed: ${cleanedCount} videos cleaned, ${errors.length} errors`);

    return new Response(JSON.stringify({
      message: 'Video cleanup completed',
      cleaned: cleanedCount,
      total_found: oldVideos.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Video cleanup error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: 'Cleanup failed',
      details: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});