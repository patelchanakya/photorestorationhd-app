import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Replicate from "https://esm.sh/replicate@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackgroundRequest {
  image_data: string; // base64 image
  custom_prompt?: string;
  style_key?: string; // Specific background style (bg-1, bg-2, etc.)
  user_id?: string; // For usage tracking
}

// Background style prompts from AnimatedBackgrounds.tsx
const BACKGROUND_STYLES: Record<string, { title: string; prompt: string }> = {
  'bg-1': {
    title: 'Garden',
    prompt: "Replace the background with a clear garden scene of greenery and foliage in natural daylight. Keep leaves and shapes recognizable without heavy blur. Maintain balanced exposure and natural colors. Keep the subject exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No insects, flowers touching the subject, or props."
  },
  'bg-2': {
    title: 'Heavenly',
    prompt: "Replace the background with a bright heavenly sky of soft white clouds and gentle sunbeams. Keep clouds clear and recognizable, using a soft pastel blue-to-white gradient with a subtle glow. Maintain balanced exposure and natural colors. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No halos, wings, text, or added objects."
  },
  'bg-3': {
    title: 'Passport',
    prompt: "Replace the background with a perfectly uniform pure white (#FFFFFF), evenly lit and seamless. No texture, gradients, shadows, or color cast. Keep the subject unchanged—face, skin tone, hair, clothing, pose, and lighting. No retouching or added elements."
  },
  'bg-4': {
    title: 'Studio',
    prompt: "Replace the background with a seamless studio backdrop in white or light gray, evenly lit and smooth. No texture, gradients, or banding. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No retouching."
  },
  'bg-5': {
    title: 'Blur',
    prompt: "Keep the original background but apply a soft natural blur and brighten it slightly (~25%) while preserving color balance. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No added glow or light spill."
  },
  'bg-6': {
    title: 'Beach',
    prompt: "Replace the background with a clear beach scene: visible ocean horizon, soft blue sky, and light sand. Keep details recognizable without heavy blur. Maintain daylight exposure and natural colors. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No umbrellas, props, or text."
  },
  'bg-7': {
    title: 'City',
    prompt: "Replace the background with a modern city scene in daylight—street or skyline—with recognizable buildings. Keep details clear without heavy blur. Maintain balanced exposure and natural colors. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No text, logos, or props."
  },
  'bg-8': {
    title: 'Wedding',
    prompt: "Replace the background with an elegant wedding venue interior (aisle or reception hall) lit warmly. Include tasteful decor such as soft florals, candles, or string lights. Keep details recognizable without heavy blur. Maintain warm balanced tones. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No veils, bouquets, text, or props on the subject."
  },
  'bg-10': {
    title: 'Soft Lights',
    prompt: "Replace the background with a cinematic bokeh of soft neutral-to-warm lights. Use large, smooth discs with shallow depth-of-field. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No light spill, text, or props."
  },
  'bg-11': {
    title: 'Christmas',
    prompt: "Replace the background with an elegant Christmas interior scene: decorated tree, warm string lights, and tasteful holiday decor in a living-room setting. Keep details recognizable without heavy blur. Maintain balanced exposure, natural colors, and realistic depth-of-field. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No objects on the subject, no text, logos, snow overlays, or effects."
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
    const { image_data, custom_prompt, style_key, user_id: requestUserId }: BackgroundRequest = await req.json()
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

    console.log('🌅 Starting background generation with webhooks...')

    // Determine the prompt to use
    let prompt = custom_prompt;
    let selectedStyle = null;
    
    if (!prompt && style_key && BACKGROUND_STYLES[style_key]) {
      selectedStyle = BACKGROUND_STYLES[style_key];
      prompt = selectedStyle.prompt;
      console.log(`🌅 Using background style: ${selectedStyle.title}`);
    }
    
    if (!prompt) {
      prompt = "replace only the background with a beautiful, natural scene while keeping the person exactly the same";
    }

    // Build input for background generation
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
        mode: 'background',
        status: 'starting',
        style_key: style_key || null,
        input: {
          prompt: prompt,
          style_title: selectedStyle?.title || null,
          has_custom_prompt: !!custom_prompt,
          custom_prompt: custom_prompt || null
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
        mode: 'background',
        style_used: selectedStyle?.title || 'Custom',
        estimated_time: '5-10 seconds'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Background generation error:', error)
    
    // Rollback photo usage increment if generation failed after increment
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after background generation error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to start background generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})