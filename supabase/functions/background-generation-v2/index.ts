import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Replicate from "https://esm.sh/replicate@1.0.1"

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
    prompt: "Replace only the background with a clear garden scene: visible greenery and foliage with natural daylight. Keep the background mostly in focus (minimal blur) so leaves and shapes are recognizable; avoid heavy bokeh. Maintain balanced exposure and natural colors. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No insects, flowers touching the subject, or added props."
  },
  'bg-2': {
    title: 'Heavenly',
    prompt: "Replace only the background with a bright, heavenly sky of soft white clouds and gentle sunbeams. Keep the cloud forms clearly visible (minimal blur) so the sky reads cleanly; avoid heavy bokeh. Use an airy pastel blue‑to‑white gradient with a subtle, tasteful glow—no halos. Maintain balanced exposure and natural color. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No wings, text, or added objects; do not retouch or brighten the subject."
  },
  'bg-3': {
    title: 'Passport',
    prompt: "Replace only the background with a perfectly uniform pure white background (#FFFFFF), evenly lit. Absolutely no texture, edges, gradients, color casts, or shadows in the background. Keep the person exactly the same—face, skin tone, hair, clothing, pose, and lighting unchanged. Do not retouch the subject or add anything."
  },
  'bg-4': {
    title: 'Studio',
    prompt: "Replace only the background with a seamless studio backdrop in white or light gray, evenly lit and perfectly smooth with no texture or banding. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. Do not retouch or brighten the subject."
  },
  'bg-5': {
    title: 'Blur',
    prompt: "Do not change the location. Keep the same background but apply a soft, natural blur and brighten the background slightly (~25%) while preserving its original color balance. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No added glow or light spill on the subject."
  },
  'bg-6': {
    title: 'Beach',
    prompt: "Replace only the background with a clear, bright beach scene: visible ocean horizon, soft blue sky, and light sand. Keep the background mostly in focus (minimal blur) so details are recognizable; avoid heavy bokeh. Maintain balanced daylight exposure and natural colors. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No umbrellas, text, or added props."
  },
  'bg-7': {
    title: 'City',
    prompt: "Replace only the background with a clear modern city scene in daylight—street or skyline—with recognizable buildings and structure. Keep the background mostly in focus (minimal blur); avoid heavy bokeh. Maintain balanced exposure and natural colors. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No text, logos, or legible signage; no added props."
  },
  'bg-8': {
    title: 'Wedding',
    prompt: "Replace only the background with a clearly visible, elegant wedding venue interior (aisle or reception hall) with warm ambient lighting. Show tasteful decor—soft florals, candles, or string lights—in a refined setting. Keep the background mostly in focus (minimal blur) so details are recognizable; avoid heavy bokeh. Maintain balanced exposure and natural warm tones. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. Do not add veils, bouquets, or accessories to the subject; no text or logos."
  },
  'bg-10': {
    title: 'Soft Lights',
    prompt: "Replace only the background with a premium, cinematic bokeh of soft lights. Use neutral‑to‑warm white/golden highlights, large soft discs, and shallow depth‑of‑field. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No light spill on the subject, no text, shapes, or props. Background should feel elegant and luminous without overexposure or harsh edges."
  },
  'bg-11': {
    title: 'Christmas',
    prompt: "Replace only the background with a clearly visible, elegant Christmas interior scene. Show a decorated Christmas tree, warm ambient string lights, and tasteful holiday decor in a living‑room setting. Keep the background mostly in focus (minimal blur) so details are recognizable; avoid heavy bokeh. Maintain balanced exposure, natural colors, and realistic depth‑of‑field behind the subject. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. Do not place any objects on the subject; no text, logos, snow overlays, or lens effects."
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

    // Store prediction in database
    const { error: dbError } = await supabase
      .from('photo_predictions')
      .insert({
        id: prediction.id,
        user_id: user_id || null,
        mode: 'background',
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