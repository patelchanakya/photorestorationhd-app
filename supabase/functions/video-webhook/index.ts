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
  started_at?: string
  completed_at?: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  input: {
    prompt: string
    start_image: string
    [key: string]: any
  }
  output?: string | string[]
  error?: string
  logs?: string
  metrics?: {
    predict_time?: number
    [key: string]: any
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
    console.log('📡 Received Replicate webhook:', {
      id: payload.id,
      status: payload.status,
      completed_at: payload.completed_at,
      has_output: !!payload.output
    })

    // Validate prediction ID
    if (!payload.id || payload.id.length < 10) {
      console.error('Invalid prediction ID in webhook:', payload.id)
      return new Response(JSON.stringify({ error: 'Invalid prediction ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if video job exists first
    const { data: existingJob, error: fetchError } = await supabase
      .from('user_video_jobs')
      .select('id, status, metadata')
      .eq('prediction_id', payload.id)
      .single()

    if (fetchError) {
      console.error('Video job not found for webhook:', payload.id, fetchError)
      // Don't fail the webhook - job might be created by a different service
      return new Response(JSON.stringify({ 
        warning: 'Video job not found',
        prediction_id: payload.id 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prepare update data with better error handling
    const updateData: any = {
      status: mapReplicateStatus(payload.status),
      webhook_received_at: new Date().toISOString(),
    }

    // Handle successful completion
    if (payload.status === 'succeeded' && payload.output) {
      // Handle both single string and array outputs
      const videoUrl = Array.isArray(payload.output) ? payload.output[0] : payload.output
      
      if (!videoUrl || typeof videoUrl !== 'string') {
        console.error('Invalid video output format:', payload.output)
        updateData.status = 'failed'
        updateData.error_message = 'Invalid video output format received'
      } else {
        updateData.video_url = videoUrl
        updateData.completed_at = payload.completed_at || new Date().toISOString()
        updateData.expires_at = new Date(Date.now() + 3600000).toISOString() // 1 hour
        console.log('✅ Video generation completed successfully')
      }
    }

    // Handle failures
    if (payload.status === 'failed' || payload.status === 'canceled') {
      updateData.error_message = payload.error || `Video generation ${payload.status}`
      updateData.completed_at = payload.completed_at || new Date().toISOString()
      console.log(`❌ Video generation ${payload.status}:`, payload.error)
    }

    // Update metadata with enhanced tracking
    const existingMetadata = existingJob.metadata || {}
    updateData.metadata = {
      ...existingMetadata,
      predict_time: payload.metrics?.predict_time,
      logs: payload.logs,
      webhook_received_count: (existingMetadata.webhook_received_count || 0) + 1,
      last_webhook_at: new Date().toISOString(),
      replicate_version: payload.version,
      replicate_metrics: payload.metrics
    }

    // Update the video job with idempotency check
    const { data: videoJob, error: updateError } = await supabase
      .from('user_video_jobs')
      .update(updateData)
      .eq('prediction_id', payload.id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating video job:', updateError)
      return new Response(JSON.stringify({ 
        error: 'Failed to update video job',
        prediction_id: payload.id,
        details: updateError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('💾 Video job updated successfully:', {
      id: videoJob.id,
      prediction_id: payload.id,
      status: updateData.status,
      has_video_url: !!updateData.video_url
    })

    // If video completed successfully, send push notification
    if (payload.status === 'succeeded' && videoJob && updateData.video_url) {
      try {
        await sendVideoReadyNotification(supabase, videoJob.user_id, payload.id, videoJob.mode_tag)
      } catch (notificationError) {
        console.error('Failed to send notification, but webhook succeeded:', notificationError)
        // Don't fail the webhook if notification fails
      }
    }

    // Return success with additional context
    return new Response(JSON.stringify({ 
      success: true, 
      prediction_id: payload.id,
      status: payload.status,
      job_updated: true,
      has_video_url: !!updateData.video_url
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
  predictionId: string,
  modeTag?: string
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
      console.log('📱 Would send push notification to:', userData.push_token)
      
      // Create mode-specific notification message
      const modeDisplay = modeTag ? ` (${modeTag})` : '';
      const title = `Your Back to Life video is ready! 🎬${modeDisplay}`;
      const body = modeTag ? 
        `Your ${modeTag} animation is ready to view` : 
        'Tap to view your restored video';
      
      // Store notification record for later retrieval
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'video_ready',
          title,
          body,
          data: { 
            prediction_id: predictionId,
            mode_tag: modeTag 
          },
          read: false,
          created_at: new Date().toISOString()
        })
        
      console.log('✅ Video ready notification stored for user:', userId)
    }
  } catch (error) {
    console.error('❌ Error sending notification:', error)
    // Don't throw - notifications are not critical for webhook success
  }
}