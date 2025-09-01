import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StatusRequest {
  prediction_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Get request body
    const { prediction_id }: StatusRequest = await req.json()

    if (!prediction_id) {
      return new Response(
        JSON.stringify({ error: 'prediction_id is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`🔍 Checking status for prediction: ${prediction_id}`)

    // Get prediction status from database
    const { data: prediction, error: dbError } = await supabase
      .from('photo_predictions')
      .select('*')
      .eq('id', prediction_id)
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch prediction status',
          details: dbError.message 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!prediction) {
      return new Response(
        JSON.stringify({ 
          error: 'Prediction not found',
          prediction_id 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate elapsed time
    const createdAt = new Date(prediction.created_at)
    const now = new Date()
    const elapsedSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000)

    // Estimate progress based on elapsed time and typical processing time (5-10 seconds)
    let progress = 0
    if (prediction.status === 'starting') {
      progress = Math.min(elapsedSeconds * 10, 20) // 0-20% while starting
    } else if (prediction.status === 'processing') {
      progress = Math.min(20 + (elapsedSeconds * 8), 90) // 20-90% while processing
    } else if (prediction.status === 'succeeded') {
      progress = 100
    } else if (['failed', 'canceled'].includes(prediction.status)) {
      progress = 0 // Reset for failed/canceled
    }

    console.log(`📊 Status for ${prediction_id}: ${prediction.status} (${progress}%)`)

    // Return status response
    return new Response(
      JSON.stringify({
        success: true,
        prediction_id: prediction.id,
        status: prediction.status,
        mode: prediction.mode,
        style_key: prediction.style_key,
        progress: Math.round(progress),
        elapsed_seconds: elapsedSeconds,
        output: prediction.output,
        error: prediction.error,
        created_at: prediction.created_at,
        completed_at: prediction.completed_at,
        metadata: prediction.metadata,
        // Client helpers
        is_complete: ['succeeded', 'failed', 'canceled'].includes(prediction.status),
        is_successful: prediction.status === 'succeeded',
        has_output: !!prediction.output
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Status check error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to check prediction status',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/* To invoke:
curl -i --location --request POST 'http://localhost:54321/functions/v1/photo-repair-status' \
  --header 'Authorization: Bearer [anon_key]' \
  --header 'Content-Type: application/json' \
  --data '{"prediction_id":"gm3qorzdhgbfurvjtvhg6dckhu"}'

Response example:
{
  "success": true,
  "prediction_id": "gm3qorzdhgbfurvjtvhg6dckhu",
  "status": "succeeded",
  "mode": "repair",
  "progress": 100,
  "elapsed_seconds": 7,
  "output": "https://replicate.delivery/pbxt/abc123.png",
  "error": null,
  "is_complete": true,
  "is_successful": true,
  "has_output": true
}
*/