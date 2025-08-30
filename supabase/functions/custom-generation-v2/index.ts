import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Replicate from "https://esm.sh/replicate@1.0.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CustomRequest {
  image_data: string; // base64 image
  custom_prompt: string; // Required for custom mode
  user_id?: string; // For usage tracking
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let user_id: string | undefined; // Declare in outer scope for error handler
  let supabase: any; // Declare in outer scope for error handler
  
  try {
    // Get request body
    const { image_data, custom_prompt, user_id: requestUserId }: CustomRequest = await req.json()
    user_id = requestUserId; // Store for error handler

    if (!image_data) {
      return new Response(
        JSON.stringify({ error: 'image_data is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!custom_prompt) {
      return new Response(
        JSON.stringify({ error: 'custom_prompt is required for custom generation' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client early for limits validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey)

    // SERVER-SIDE PHOTO LIMITS ENFORCEMENT (primary protection)
    if (user_id && user_id !== 'anonymous') {
      console.log('🔍 Starting server-side photo usage check for user:', user_id);
      
      try {
        // Use atomic function to check and increment usage (same as client-side)
        const { data: result, error } = await supabase.rpc('check_and_increment_photo_usage', {
          p_user_id: user_id
        });

        if (error) {
          console.error('❌ Server-side photo atomic usage check failed:', error);
          // Allow request to proceed if database error (fallback to client-side)
          console.log('⚠️ Falling back to client-side photo limits due to server error');
        } else if (!result) {
          // Boolean response from database function
          console.log('❌ Server-side photo limits enforcement blocked request:', {
            userId: user_id,
            reason: 'Photo usage limit exceeded',
            
            
          });
          
          return new Response(JSON.stringify({ 
            success: false,
            error: 'Photo usage limit exceeded',
            code: 'PHOTO_LIMIT_EXCEEDED'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          console.log('✅ Server-side photo atomic increment succeeded:', {
            userId: user_id,
            current_count: result.current_count,
            limit: result.limit,
            
          });
        }
      } catch (error) {
        console.error('❌ Critical error in server-side photo usage check:', error);
        // Allow request to proceed if critical error (fallback to client-side)
        console.log('⚠️ Falling back to client-side photo limits due to critical server error');
      }
    } else {
      console.log('⚠️ No user_id provided - skipping server-side photo limits check');
    }

    // Initialize Replicate with server-side API key
    const replicateApiToken = Deno.env.get('REPLICATE_API_TOKEN')
    if (!replicateApiToken) {
      console.error('REPLICATE_API_TOKEN not found in environment')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Supabase client already initialized above for limits validation
    const replicate = new Replicate({
      auth: replicateApiToken,
    })

    console.log('✨ Starting custom generation with webhooks...')
    console.log(`✨ Custom prompt: ${custom_prompt}`)

    // Build input for custom generation
    const input = {
      prompt: custom_prompt,
      input_image: `data:image/jpeg;base64,${image_data}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    }

    // Construct webhook URL
    const webhookUrl = `${supabaseUrl}/functions/v1/photo-webhook`

    console.log('🔄 Creating Replicate prediction with webhook...')

    // Create prediction with webhook
    const prediction = await replicate.predictions.create({
      model: "black-forest-labs/flux-kontext-pro",
      input,
      webhook: webhookUrl,
      webhook_events_filter: ["completed"] // Only notify when done
    })

    console.log(`✅ Prediction created: ${prediction.id}`)

    // Upsert prediction into database for status tracking
    const { error: insertError } = await supabase
      .from('photo_predictions')
      .upsert({
        id: prediction.id,
        user_id: user_id || 'anonymous',
        mode: 'custom',
        status: 'starting',
        input: {
          prompt: custom_prompt,
          has_custom_prompt: true
        },
        created_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Failed to insert prediction into database:', insertError)
      // Continue anyway - webhook will handle updates
    } else {
      console.log(`✅ Prediction ${prediction.id} inserted into database`)
    }

    // Return prediction ID to client for polling
    return new Response(
      JSON.stringify({ 
        success: true,
        prediction_id: prediction.id,
        status: prediction.status || 'starting',
        mode: 'custom',
        prompt_used: custom_prompt,
        estimated_time: '5-10 seconds'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Custom generation error:', error)
    
    // Rollback photo usage increment if generation failed after increment
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after custom generation error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to start custom generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})