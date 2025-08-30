import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Replicate from "https://esm.sh/replicate@1.0.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MemorialRequest {
  image_data: string; // base64 image
  custom_prompt?: string;
  style_key?: string; // Specific memorial style (memorial-1, memorial-2, etc.)
  user_id?: string; // For usage tracking
}

// Memorial style prompts for honoring passed loved ones
const MEMORIAL_STYLES: Record<string, { title: string; prompt: string }> = {
  'memorial-1': {
    title: 'Light Rays',
    prompt: "Add a soft, radiant memorial atmosphere to the entire image. Overlay warm golden light rays and a gentle heavenly glow that fills the photo. Slight haze and soft focus should be applied across the whole image for a dramatic, reverent feeling. The effect should be clearly noticeable, creating a sense of peace, remembrance, and timelessness, while still keeping the person and details visible."
  },
  'memorial-2': {
    title: 'Dove of Peace',
    prompt: "Add multiple glowing white doves of peace in the upper area with soft radiant light. Keep the original color scheme unchanged - if colored, preserve colors; if black and white, keep black and white. The doves should blend naturally into the scene."
  },
  'memorial-3': {
    title: 'Ethereal Glow',
    prompt: "Add a soft ethereal glow surrounding the subject with gentle luminous light. Keep the original color scheme unchanged - if colored, preserve colors; if black and white, keep black and white. The glow should blend naturally and create a peaceful, otherworldly atmosphere without overwhelming the subject."
  },
  'memorial-4': {
    title: 'Heaven Gates',
    prompt: "Add majestic golden heaven gates in the background with soft radiant light streaming through. Keep the subject well-lit and clearly visible with original lighting preserved. Keep the original color scheme unchanged - if colored, preserve colors; if black and white, keep black and white. The gates should blend naturally into the background without casting shadows on the subject."
  },
  'memorial-5': {
    title: 'Memorial Flowers',
    prompt: "Cover the scene with abundant memorial flowers and petals - roses, lilies, and soft blooms cascading throughout the image. Fill the background and foreground with dramatic floral elements. Keep the original color scheme unchanged - if colored, preserve colors; if black and white, keep black and white. Create a powerful, emotional memorial atmosphere with flowers as the dominant visual element."
  },
  'memorial-6': {
    title: 'Clean Background',
    prompt: "Clean background only - remove clutter, trash, objects, and background distractions. Do not remove or alter any people in the main part of the photo. Preserve all subjects completely unchanged."
  }
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
    const { image_data, custom_prompt, style_key, user_id: requestUserId }: MemorialRequest = await req.json()
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
          console.log('❌ Server-side photo limits enforcement blocked request:', {
            userId: user_id,
            reason: 'Photo usage limit exceeded'
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
            userId: user_id
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

    console.log('🕊️ Starting memorial generation with webhooks...')

    // Determine the prompt to use
    let prompt = custom_prompt;
    let selectedStyle = null;
    
    if (!prompt && style_key && MEMORIAL_STYLES[style_key]) {
      selectedStyle = MEMORIAL_STYLES[style_key];
      prompt = selectedStyle.prompt;
      console.log(`🕊️ Using memorial style: ${selectedStyle.title}`);
    }
    
    if (!prompt) {
      prompt = "Add peaceful and spiritual memorial elements to honor a loved one while keeping the person exactly the same";
    }

    // Build input for memorial generation using Kontext Pro
    const input = {
      prompt,
      input_image: `data:image/jpeg;base64,${image_data}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    }

    // Construct webhook URL
    const webhookUrl = `${supabaseUrl}/functions/v1/photo-webhook`

    console.log('🔄 Creating Replicate prediction with webhook...')

    // Create prediction with webhook using Kontext Pro
    const prediction = await replicate.predictions.create({
      model: "black-forest-labs/flux-kontext-pro",
      input,
      webhook: webhookUrl,
      webhook_events_filter: ["completed"] // Only notify when done
    })

    console.log(`✅ Prediction created: ${prediction.id}`)

    // Store prediction in database
    const { error: dbError } = await supabase
      .from('photo_predictions')
      .insert({
        id: prediction.id,
        user_id: user_id || null,
        mode: 'memorial',
        style_key: style_key || null,
        status: prediction.status || 'starting',
        input: {
          prompt,
          style_title: selectedStyle?.title,
          has_custom_prompt: !!custom_prompt
        }
      })

    if (dbError) {
      console.error('Failed to store prediction in database:', dbError)
      // CRITICAL: If we can't track the prediction, rollback usage to compensate user
      if (user_id && user_id !== 'anonymous') {
        try {
          await supabase.rpc('rollback_photo_usage', {
            p_user_id: user_id
          });
          console.log('✅ Photo usage rolled back due to database tracking failure');
        } catch (rollbackError) {
          console.error('❌ CRITICAL: Failed to rollback after database error:', rollbackError);
        }
      }
      return new Response(
        JSON.stringify({ 
          error: 'Failed to initialize prediction tracking',
          details: 'Unable to track generation progress'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return prediction ID to client for polling
    return new Response(
      JSON.stringify({ 
        success: true,
        prediction_id: prediction.id,
        status: prediction.status || 'starting',
        mode: 'memorial',
        style_used: selectedStyle?.title || 'Custom',
        estimated_time: '5-10 seconds'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Memorial generation error:', error)
    
    // Rollback photo usage increment if generation failed after increment
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after memorial generation error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to start memorial generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})