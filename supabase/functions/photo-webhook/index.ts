import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReplicateWebhookPayload {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string[] | string | null;
  error?: string | null;
  logs?: string;
  started_at?: string;
  completed_at?: string;
  metrics?: {
    predict_time?: number;
  };
  model?: string;
  version?: string;
  input?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    })
  }

  try {
    console.log('🪝 Unified photo webhook received')

    // Parse webhook payload from Replicate
    const webhookData: ReplicateWebhookPayload = await req.json()
    
    console.log(`📄 Webhook data for prediction ${webhookData.id}:`, {
      status: webhookData.status,
      hasOutput: !!webhookData.output,
      hasError: !!webhookData.error
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      return new Response('Server configuration error', { 
        status: 500,
        headers: corsHeaders 
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // First, check if this prediction exists in our database
    const { data: existingPrediction, error: fetchError } = await supabase
      .from('photo_predictions')
      .select('mode, user_id')
      .eq('id', webhookData.id)
      .single()

    if (fetchError) {
      console.error(`Failed to find prediction ${webhookData.id} in database:`, fetchError)
      return new Response('Prediction not found', { 
        status: 404,
        headers: corsHeaders 
      })
    }

    const mode = existingPrediction.mode
    console.log(`📋 Processing webhook for ${mode} mode`)

    // Extract output URL (Replicate returns array of URLs, we want the first one)
    let outputUrl: string | null = null
    if (webhookData.output) {
      if (Array.isArray(webhookData.output)) {
        outputUrl = webhookData.output[0] || null
      } else if (typeof webhookData.output === 'string') {
        outputUrl = webhookData.output
      }
    }

    // Prepare update data
    const updateData: any = {
      status: webhookData.status,
      output: outputUrl,
      error: webhookData.error,
    }

    // Add completion timestamp if status is terminal
    if (['succeeded', 'failed', 'canceled'].includes(webhookData.status)) {
      updateData.completed_at = webhookData.completed_at || new Date().toISOString()
    }

    // Add metadata if available
    if (webhookData.metrics || webhookData.started_at) {
      updateData.metadata = {
        predict_time: webhookData.metrics?.predict_time,
        started_at: webhookData.started_at,
        model: webhookData.model,
        version: webhookData.version
      }
    }

    console.log(`📝 Updating ${mode} prediction ${webhookData.id} with status: ${webhookData.status}`)

    // Update the prediction in database
    const { error: updateError } = await supabase
      .from('photo_predictions')
      .update(updateData)
      .eq('id', webhookData.id)

    if (updateError) {
      console.error('Failed to update prediction in database:', updateError)
      return new Response('Database update failed', { 
        status: 500,
        headers: corsHeaders 
      })
    }

    console.log(`✅ Successfully updated ${mode} prediction ${webhookData.id}`)

    // CRITICAL: Handle failed predictions with usage rollback
    if (['failed', 'canceled'].includes(webhookData.status)) {
      const predictionUserId = existingPrediction.user_id
      
      if (predictionUserId && predictionUserId !== 'anonymous') {
        console.log(`🔄 Rolling back photo usage for failed ${mode} prediction:`, webhookData.id)
        
        try {
          const { data: rollbackResult, error: rollbackError } = await supabase.rpc('rollback_photo_usage', {
            p_user_id: predictionUserId
          })
          
          if (rollbackError) {
            console.error(`❌ Failed to rollback photo usage for ${mode} prediction:`, rollbackError)
          } else {
            console.log(`✅ Successfully rolled back photo usage for failed ${mode} prediction`)
          }
        } catch (error) {
          console.error(`❌ Critical error during photo usage rollback for ${mode}:`, error)
        }
      } else {
        console.log(`⚠️ No user_id found for failed ${mode} prediction - skipping rollback`)
      }
    }

    // Log successful completion with mode context
    if (webhookData.status === 'succeeded' && outputUrl) {
      console.log(`🎉 Photo ${mode} completed successfully: ${outputUrl}`)
    } else if (webhookData.status === 'failed') {
      console.log(`❌ Photo ${mode} failed: ${webhookData.error || 'Unknown error'}`)
    }

    // Return success response to Replicate
    return new Response('OK', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })

  } catch (error) {
    console.error('❌ Unified webhook processing error:', error)
    
    // Return error response (Replicate will retry)
    return new Response(`Webhook processing failed: ${error.message}`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }
})

/* 
This unified webhook handler processes completion notifications for all photo modes:
- repair
- outfit
- background  
- custom
- enhance (unblur, colorize, descratch, enlighten)

Webhook payload example from Replicate:
{
  "id": "gm3qorzdhgbfurvjtvhg6dckhu",
  "status": "succeeded",
  "output": ["https://replicate.delivery/pbxt/abc123.png"],
  "error": null,
  "logs": "",
  "started_at": "2023-09-08T16:19:34.779176Z",
  "completed_at": "2023-09-08T16:19:34.791859Z",
  "metrics": {
    "predict_time": 5.234
  }
}
*/