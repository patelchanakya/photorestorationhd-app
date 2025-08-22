import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Replicate from "https://esm.sh/replicate@1.0.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VideoCheckRequest {
  predictionId: string;
  startedAt: string;  // ISO timestamp when generation started
}

interface VideoCheckResponse {
  status: 'starting' | 'processing' | 'completed' | 'failed' | 'expired';
  videoUrl?: string;
  error?: string;
  progress?: number;
  isExpired: boolean;
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
    console.log('🔍 Starting simple video check...');
    
    // Initialize Replicate client
    const replicateToken = Deno.env.get('REPLICATE_API_TOKEN');
    if (!replicateToken) {
      throw new Error('REPLICATE_API_TOKEN not found');
    }
    
    const replicate = new Replicate({
      auth: replicateToken,
      useFileOutput: false, // Return URLs instead of FileOutput objects
    });
    console.log('✅ Replicate client created');

    // Parse request body
    const body: VideoCheckRequest = await req.json();
    
    if (!body.predictionId || !body.startedAt) {
      return new Response(JSON.stringify({ error: 'Missing required fields: predictionId, startedAt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { predictionId, startedAt } = body;

    console.log('🎬 Checking video:', { predictionId, startedAt });

    // RULE 1: Check age (59 minutes max)
    const age = Date.now() - new Date(startedAt).getTime();
    const maxAge = 59 * 60 * 1000; // 59 minutes in milliseconds
    
    if (age > maxAge) {
      console.log('⏰ Video expired (age > 59 minutes):', { ageMinutes: Math.floor(age / 60000) });
      
      const response: VideoCheckResponse = {
        status: 'expired',
        isExpired: true,
        error: 'Video generation expired (>59 minutes)'
      };
      
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // RULE 2: Check Replicate directly (source of truth)
    try {
      console.log('📡 Fetching prediction from Replicate:', predictionId);
      const prediction = await replicate.predictions.get(predictionId);
      
      console.log('📊 Replicate response:', {
        id: prediction.id,
        status: prediction.status,
        hasOutput: !!prediction.output,
        hasError: !!prediction.error
      });

      // Map Replicate status to our simple status
      let status: VideoCheckResponse['status'];
      switch (prediction.status) {
        case 'starting':
          status = 'starting';
          break;
        case 'processing':
          status = 'processing';
          break;
        case 'succeeded':
          status = 'completed';
          break;
        case 'failed':
        case 'canceled':
          status = 'failed';
          break;
        default:
          status = 'processing';
      }

      // Calculate rough progress based on elapsed time and status
      let progress = 0;
      const elapsedMinutes = Math.floor(age / 60000);
      
      if (status === 'starting') {
        progress = 10;
      } else if (status === 'processing') {
        // Rough progress: 2-3 minutes expected, so after 1 min = ~40%, after 2 min = ~80%
        progress = Math.min(90, 30 + (elapsedMinutes * 30));
      } else if (status === 'completed') {
        progress = 100;
      }

      const response: VideoCheckResponse = {
        status,
        videoUrl: prediction.output as string || undefined,
        error: prediction.error as string || undefined,
        progress,
        isExpired: false
      };

      console.log('✅ Returning video status:', { status, hasVideoUrl: !!response.videoUrl, progress });

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error: any) {
      console.error('❌ Replicate API error:', error);

      // Handle 404 (prediction not found - expired on Replicate)
      if (error?.response?.status === 404 || error?.status === 404) {
        console.log('🗑️ Video not found on Replicate (404 - expired)');
        
        const response: VideoCheckResponse = {
          status: 'expired',
          isExpired: true,
          error: 'Video no longer available on Replicate servers'
        };
        
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle rate limiting
      if (error?.response?.status === 429 || error?.status === 429) {
        const response: VideoCheckResponse = {
          status: 'failed',
          isExpired: false,
          error: 'Rate limited by Replicate API - please try again in a moment'
        };
        
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle auth errors
      if (error?.response?.status === 401 || error?.status === 401) {
        const response: VideoCheckResponse = {
          status: 'failed',
          isExpired: false,
          error: 'Authentication error with Replicate API'
        };
        
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Re-throw other errors to be handled by outer catch block
      throw error;
    }

  } catch (error) {
    console.error('❌ Video check error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;

    return new Response(JSON.stringify({ 
      error: errorMessage,
      status: 'failed',
      isExpired: false 
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});