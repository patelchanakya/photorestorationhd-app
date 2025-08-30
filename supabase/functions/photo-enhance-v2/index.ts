import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Replicate from "https://esm.sh/replicate@1.0.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EnhanceMode = 'unblur' | 'colorize' | 'descratch' | 'enlighten'

interface EnhanceRequest {
  image_data: string; // base64 image
  mode: EnhanceMode; // Which enhancement mode to use
  custom_prompt?: string; // Optional custom prompt override
  user_id?: string; // For usage tracking
}

// Predefined prompts for each mode from the original photo-enhance function
const MODE_PROMPTS: Record<EnhanceMode, string> = {
  unblur: "enhance and restore this image, sharpen and unblur, improve clarity and focus without losing any facial features or adding anything extra",
  colorize: "add color and upscale image without losing any specific facial feature or adding anything extra",
  descratch: "remove scratches, dust, stains, and damage from this image while preserving all facial features and original details without adding anything extra",
  enlighten: "fix lighting and exposure, enhance shadows and highlights, improve overall illumination"
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
    const { image_data, mode, custom_prompt, user_id: requestUserId }: EnhanceRequest = await req.json()
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

    if (!mode || !MODE_PROMPTS[mode]) {
      return new Response(
        JSON.stringify({ 
          error: 'Valid mode is required', 
          valid_modes: Object.keys(MODE_PROMPTS) 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
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

    const replicate = new Replicate({
      auth: replicateApiToken,
    })

    console.log(`🔧 Starting ${mode} enhancement with webhooks...`)

    // Get the appropriate prompt
    const prompt = custom_prompt || MODE_PROMPTS[mode]

    // Build input for enhancement
    const input = {
      prompt,
      input_image: `data:image/jpeg;base64,${image_data}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: mode === 'descratch' ? false : true // descratch doesn't use upsampling
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

    // Return prediction ID to client for polling
    return new Response(
      JSON.stringify({ 
        success: true,
        prediction_id: prediction.id,
        status: prediction.status || 'starting',
        mode: 'enhance',
        enhance_mode: mode,
        prompt_used: prompt,
        estimated_time: '5-10 seconds'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error(`❌ Photo enhancement error:`, error)
    
    // Rollback photo usage increment if generation failed after increment
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after photo enhancement error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to start photo enhancement',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})