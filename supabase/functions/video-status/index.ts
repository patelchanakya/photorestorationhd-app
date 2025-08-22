import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Replicate from "https://esm.sh/replicate@1.0.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VideoStatusResponse {
  predictionId: string;
  status: 'starting' | 'processing' | 'completed' | 'downloaded' | 'failed' | 'canceled' | 'expired';
  videoUrl?: string;
  localVideoPath?: string;
  imageUri: string;
  prompt: string;
  modeTag: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  progress?: {
    elapsedSeconds: number;
    phase: string;
  };
}

function getProgressPhase(status: string, elapsedSeconds: number): string {
  if (status === 'starting') return 'Preparing your video...';
  if (status === 'processing') {
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 1) return 'Analyzing your photo...';
    if (minutes < 2) return 'Creating video frames...';
    return 'Adding final touches...';
  }
  if (status === 'completed') return 'Video ready!';
  if (status === 'failed') return 'Generation failed';
  return 'Processing...';
}

async function refreshPredictionStatus(replicate: any, predictionId: string): Promise<any> {
  try {
    return await replicate.predictions.get(predictionId);
  } catch (error) {
    console.error('Failed to fetch prediction status:', error);
    return null;
  }
}

function mapReplicateStatus(status: string): string {
  switch (status) {
    case 'starting':
      return 'starting';
    case 'processing':
      return 'processing';
    case 'succeeded':
      return 'completed';
    case 'failed':
    case 'canceled':
      return 'failed';
    default:
      return 'processing';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
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
    const predictionId = pathSegments[pathSegments.length - 1];

    if (!predictionId || predictionId.length < 10) {
      return new Response(JSON.stringify({ error: 'Invalid prediction ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // First, try to get prediction record to find the associated user_id
    const { data: videoJob, error: lookupError } = await supabase
      .from('user_video_jobs')
      .select('user_id')
      .eq('prediction_id', predictionId)
      .single();

    if (lookupError || !videoJob) {
      return new Response(JSON.stringify({ 
        error: 'Video prediction not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = videoJob.user_id;

    // Fetch full video job from database
    const { data: fullVideoJob, error: dbError } = await supabase
      .from('user_video_jobs')
      .select('*')
      .eq('prediction_id', predictionId)
      .eq('user_id', userId)
      .single();

    if (dbError || !fullVideoJob) {
      console.error('Video job not found:', dbError);
      return new Response(JSON.stringify({ error: 'Video not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let currentStatus = fullVideoJob.status;
    let videoUrl = fullVideoJob.video_url;
    let errorMessage = fullVideoJob.error_message;
    let completedAt = fullVideoJob.completed_at;

    // If video is still processing, optionally check live status from Replicate
    const shouldRefresh = ['starting', 'processing'].includes(currentStatus);
    const timeSinceLastCheck = fullVideoJob.webhook_received_at 
      ? Date.now() - new Date(fullVideoJob.webhook_received_at).getTime()
      : Date.now() - new Date(fullVideoJob.created_at).getTime();
    
    // Only refresh if it's been more than 30 seconds since last update and status is pending
    if (shouldRefresh && timeSinceLastCheck > 30000) {
      const replicateToken = Deno.env.get('REPLICATE_API_TOKEN');
      if (!replicateToken) {
        throw new Error('REPLICATE_API_TOKEN not found');
      }
      const replicate = new Replicate({
        auth: replicateToken,
        useFileOutput: false, // Return URLs instead of FileOutput objects for compatibility
      });
        const prediction = await refreshPredictionStatus(replicate, predictionId);
        
        if (prediction) {
          const newStatus = mapReplicateStatus(prediction.status);
          
          // Update database if status changed
          if (newStatus !== currentStatus) {
            const updateData: any = {
              status: newStatus,
              webhook_received_at: new Date().toISOString(),
            };

            if (prediction.status === 'succeeded' && prediction.output) {
              updateData.video_url = prediction.output;
              updateData.completed_at = prediction.completed_at || new Date().toISOString();
              updateData.expires_at = new Date(Date.now() + 3600000).toISOString(); // 1 hour
            } else if (prediction.status === 'failed' && prediction.error) {
              updateData.error_message = prediction.error;
            }

            const { error: updateError } = await supabase
              .from('user_video_jobs')
              .update(updateData)
              .eq('prediction_id', predictionId)
              .eq('user_id', userId);

            if (!updateError) {
              currentStatus = newStatus;
              videoUrl = updateData.video_url || videoUrl;
              errorMessage = updateData.error_message || errorMessage;
              completedAt = updateData.completed_at || completedAt;
              
              console.log('📡 Status refreshed from Replicate:', {
                predictionId,
                oldStatus: fullVideoJob.status,
                newStatus: currentStatus
              });
            }
          }
        }
    }

    // Calculate progress info
    const createdAt = new Date(fullVideoJob.created_at);
    const elapsedSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
    const progressPhase = getProgressPhase(currentStatus, elapsedSeconds);

    // Build response
    const response: VideoStatusResponse = {
      predictionId: fullVideoJob.prediction_id,
      status: currentStatus as any,
      imageUri: fullVideoJob.image_uri,
      prompt: fullVideoJob.prompt,
      modeTag: fullVideoJob.mode_tag || 'Life',
      createdAt: fullVideoJob.created_at,
      progress: {
        elapsedSeconds,
        phase: progressPhase
      }
    };

    // Handle video URL with fallback to cached version
    if (videoUrl || fullVideoJob.local_video_path) {
      // Check if original URL has expired (1 hour after completion)
      const videoExpired = fullVideoJob.completed_at && 
        (Date.now() - new Date(fullVideoJob.completed_at).getTime()) > 3600000; // 1 hour
      
      if (fullVideoJob.local_video_path && (videoExpired || !videoUrl)) {
        // Use cached video URL
        const { data } = supabase.storage
          .from('video-cache')
          .getPublicUrl(fullVideoJob.local_video_path);
        
        response.videoUrl = data.publicUrl;
        response.localVideoPath = fullVideoJob.local_video_path;
        console.log('📱 Serving cached video URL (original expired)');
      } else if (videoUrl) {
        // Use original Replicate URL (still valid)
        response.videoUrl = videoUrl;
        if (fullVideoJob.local_video_path) response.localVideoPath = fullVideoJob.local_video_path;
      }
    }
    if (completedAt) response.completedAt = completedAt;
    if (errorMessage) response.errorMessage = errorMessage;

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Video status error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('Unauthorized') ? 401 :
                      errorMessage.includes('not found') ? 404 : 500;

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});