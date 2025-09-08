import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Replicate from "https://esm.sh/replicate@1.0.1";

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
  },
  'candlelight_vigil': {
    title: 'Candlelight Vigil',
    prompt: "Transform this photo into a warm candlelit memorial-style portrait. Keep the person's face and features unchanged. Add soft golden candlelight in front of the subject, casting a gentle warm glow across the image without darkening the background too much. Place several realistic candles at the bottom, making the scene feel peaceful, emotional, and respectful."
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

    // Simple Pro/Free user check
    if (user_id && user_id !== 'anonymous') {
      const isPro = user_id.startsWith('store:') || user_id.startsWith('orig:') || user_id.startsWith('fallback:');
      
      if (isPro) {
        console.log('✅ Pro user detected - unlimited photos, skipping database check');
      } else {
        // Only check database for free users
        console.log('🔍 Free user - checking photo limits');
        const { data: result, error } = await supabase.rpc('check_and_increment_photo_usage', {
          p_user_id: user_id
        });
        
        if (!result && !error) {
          console.log('❌ Free user photo limit exceeded');
          return new Response(JSON.stringify({ 
            success: false,
            error: 'Photo usage limit exceeded',
            code: 'PHOTO_LIMIT_EXCEEDED'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
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

    // Upsert prediction into database for status tracking
    const { error: insertError } = await supabase
      .from('photo_predictions')
      .upsert({
        id: prediction.id,
        user_id: user_id || 'anonymous',
        mode: 'memorial',
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