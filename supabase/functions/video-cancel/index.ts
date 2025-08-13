import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Replicate from "https://esm.sh/replicate@0.15.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VideoCancelResponse {
  success: boolean;
  predictionId: string;
  status: 'canceled';
  message: string;
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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract prediction ID from URL path
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const predictionIdIndex = pathSegments.findIndex(segment => segment.length > 10);
    const predictionId = pathSegments[predictionIdIndex];

    if (!predictionId || predictionId.length < 10) {
      return new Response(JSON.stringify({ error: 'Invalid prediction ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For now, use a fixed user ID to disable JWT requirements
    // TODO: Add proper user authentication when needed
    const userId = 'demo-user';

    // Check if video job exists and belongs to user
    const { data: videoJob, error: dbError } = await supabase
      .from('user_video_jobs')
      .select('*')
      .eq('prediction_id', predictionId)
      .eq('user_id', userId)
      .single();

    if (dbError || !videoJob) {
      console.error('Video job not found for cancellation:', dbError);
      return new Response(JSON.stringify({ error: 'Video not found or already completed' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if video is in a cancellable state
    const cancellableStates = ['starting', 'processing'];
    if (!cancellableStates.includes(videoJob.status)) {
      return new Response(JSON.stringify({ 
        error: `Cannot cancel video in status: ${videoJob.status}`,
        status: videoJob.status 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🛑 Cancelling video generation:', {
      predictionId,
      userId,
      currentStatus: videoJob.status
    });

    // Try to cancel the prediction with Replicate
    let replicateCancelSuccess = false;
    try {
      const replicateToken = Deno.env.get('REPLICATE_API_TOKEN');
      if (!replicateToken) {
        throw new Error('REPLICATE_API_TOKEN not found');
      }
      const replicate = new Replicate({
        auth: replicateToken,
      });
      await replicate.predictions.cancel(predictionId);
      replicateCancelSuccess = true;
      console.log('✅ Replicate prediction cancelled successfully');
    } catch (replicateError) {
      console.error('Failed to cancel Replicate prediction:', replicateError);
      // Continue with database update even if Replicate cancel fails
      // The prediction might already be completed or failed
    }

    // Update video job status in database
    const { data: updatedJob, error: updateError } = await supabase
      .from('user_video_jobs')
      .update({
        status: 'canceled',
        error_message: 'Cancelled by user',
        completed_at: new Date().toISOString(),
        metadata: {
          ...videoJob.metadata,
          cancelled_at: new Date().toISOString(),
          replicate_cancel_success: replicateCancelSuccess
        }
      })
      .eq('prediction_id', predictionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update video job status:', updateError);
      throw new Error('Failed to cancel video generation');
    }

    console.log('💾 Video job marked as cancelled in database');

    // Build success response
    const response: VideoCancelResponse = {
      success: true,
      predictionId: predictionId,
      status: 'canceled',
      message: replicateCancelSuccess 
        ? 'Video generation cancelled successfully'
        : 'Video marked as cancelled (may have already completed)'
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Video cancel error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('Unauthorized') ? 401 :
                      errorMessage.includes('not found') ? 404 :
                      errorMessage.includes('Cannot cancel') ? 400 : 500;

    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});