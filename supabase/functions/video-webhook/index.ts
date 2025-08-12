import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReplicateWebhook {
  id: string
  version: string
  created_at: string
  started_at: string
  completed_at: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  input: {
    prompt: string
    image: string
  }
  output?: string
  error?: string
  logs?: string
  metrics?: {
    predict_time?: number
  }
  webhook_completed_at?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse webhook payload
    const payload: ReplicateWebhook = await req.json()
    console.log('Received Replicate webhook:', {
      id: payload.id,
      status: payload.status,
      completed_at: payload.completed_at,
    })

    // Update video job in database
    const updateData: any = {
      status: mapReplicateStatus(payload.status),
      webhook_received_at: new Date().toISOString(),
    }

    if (payload.status === 'succeeded' && payload.output) {
      updateData.video_url = payload.output
      updateData.completed_at = payload.completed_at
      // Set expiration to 1 hour from now (Replicate URL expires)
      updateData.expires_at = new Date(Date.now() + 3600000).toISOString()
    }

    if (payload.status === 'failed' && payload.error) {
      updateData.error_message = payload.error
    }

    if (payload.metrics?.predict_time) {
      updateData.metadata = {
        predict_time: payload.metrics.predict_time,
        logs: payload.logs,
      }
    }

    // Update the video job
    const { data: videoJob, error: updateError } = await supabase
      .from('user_video_jobs')
      .update(updateData)
      .eq('prediction_id', payload.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating video job:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to update video job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Video job updated successfully:', videoJob)

    // If video completed successfully, send push notification
    if (payload.status === 'succeeded' && videoJob) {
      await sendVideoReadyNotification(supabase, videoJob.user_id, payload.id)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      prediction_id: payload.id,
      status: payload.status 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function mapReplicateStatus(status: string): string {
  switch (status) {
    case 'starting':
      return 'starting'
    case 'processing':
      return 'processing'
    case 'succeeded':
      return 'completed'
    case 'failed':
    case 'canceled':
      return 'failed'
    default:
      return 'processing'
  }
}

async function sendVideoReadyNotification(
  supabase: any,
  userId: string,
  predictionId: string
) {
  try {
    // Get user's push token
    const { data: userData } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single()

    if (userData?.push_token) {
      // In production, you'd send to Expo Push Notification Service
      console.log('Would send push notification to:', userData.push_token)
      
      // Store notification record for later retrieval
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'video_ready',
          title: 'Your video is ready! 🎬',
          body: 'Tap to view your restored video',
          data: { prediction_id: predictionId },
          read: false,
        })
    }
  } catch (error) {
    console.error('Error sending notification:', error)
  }
}