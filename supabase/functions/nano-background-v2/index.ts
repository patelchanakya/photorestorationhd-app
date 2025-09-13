import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Replicate from "https://esm.sh/replicate@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NanoBackgroundRequest {
  image_data: string; // base64 image
  style_key?: string; // Background style key
  custom_prompt?: string; // Optional custom prompt
  user_id?: string; // For usage tracking
}

// Background styles from AnimatedBackgrounds.tsx (13 styles shown in explore)
const NANO_BACKGROUND_STYLES: Record<string, { title: string; prompt: string }> = {
  'background-5': {
    title: 'Clean Background',
    prompt: "Remove all people, objects, or distractions from the background while keeping the main subject completely intact. Fill in the removed areas naturally so the background looks seamless and realistic, as if those objects were never there. Preserve lighting, shadows, and environment continuity around the subject. Only the main subject should remain untouched."
  },
  'background-6': {
    title: 'Blur Background',
    prompt: "Apply a strong, dramatic blur to the background of this image, creating an intense depth-of-field effect. Keep the main subject completely sharp and untouched. Ensure the lighting, shadows, and colors around the subject remain natural, while the background is heavily softened so that all details fade into a smooth, creamy bokeh. The effect should make the subject visually pop and dominate the image."
  },
  'popular-11': {
    title: 'Studio Background',
    prompt: "Replace the background of this image with a professional studio setting. Keep the main subject completely unchanged. Include a clean, seamless backdrop with soft, even lighting typical of portrait studios. Ensure shadows and colors around the subject match the studio environment for a seamless, photorealistic effect. The overall look should feel polished, professional, and focused entirely on the subject."
  },
  'popular-12': {
    title: 'Soft Lights Background',
    prompt: "Replace the background of this image with soft, out-of-focus lights creating beautiful bokeh. Keep the main subject completely unchanged. Include warm golden and amber light circles at varying distances, creating a dreamy, cinematic depth. Ensure the lighting on the subject matches the warm glow for a seamless, photorealistic effect. The overall mood should feel romantic, elegant, and visually striking."
  },
  'background-8': {
    title: 'Office Background',
    prompt: "Replace the background of this image with a realistic office environment. Keep the main subject completely unchanged. Include desks, chairs, and subtle office details, with natural indoor lighting that complements the subject. Ensure shadows and colors around the subject match the new environment for a seamless, photorealistic effect."
  },
  'background-9': {
    title: 'Nature Background',
    prompt: "Replace the background of this image with a lush, natural environment. Keep the main subject completely unchanged. Include elements like trees, greenery, or a soft forest glade, with natural sunlight filtering through leaves. Ensure shadows, colors, and lighting around the subject match the new scene for a seamless, photorealistic effect. The overall look should feel calm, vibrant, and harmonious with the subject."
  },
  'popular-10': {
    title: 'Garden Background',
    prompt: "Replace the background of this image with a beautiful garden scene. Keep the main subject completely unchanged. Include colorful flowers, lush greenery, and natural daylight filtering through the garden. Ensure shadows and colors around the subject match the garden environment for a seamless, photorealistic effect. The overall atmosphere should feel fresh, vibrant, and naturally beautiful."
  },
  'background-7': {
    title: 'Beach Background',
    prompt: "Replace the background of this image with a realistic beach scene. Keep the main subject completely unchanged. The beach should have soft sand, gentle waves, and a warm, natural light that complements the subject's original lighting. Ensure shadows and color tones around the subject match the new beach environment for a seamless, photorealistic effect."
  },
  'background-11': {
    title: 'Sunset Background',
    prompt: "Replace the background of this image with a dramatic sunset scene. Keep the main subject completely unchanged. Include a colorful sky with warm orange, pink, and purple hues, subtle clouds, and soft, directional lighting from the sunset. Ensure shadows and colors around the subject match the new environment for a seamless, photorealistic effect. The overall mood should feel warm, calm, and cinematic."
  },
  'popular-13': {
    title: 'Heavenly Background',
    prompt: "Replace the background of this image with a heavenly, ethereal scene. Keep the main subject completely unchanged. Include soft white clouds, gentle light rays, and a serene sky with pastel blue and white tones. Ensure the lighting around the subject matches the divine glow for a seamless, photorealistic effect. The overall atmosphere should feel peaceful, uplifting, and spiritually serene."
  },
  'background-10': {
    title: 'City Background',
    prompt: "Replace the background of this image with a realistic urban cityscape. Keep the main subject completely unchanged. Include buildings, streets, and subtle city details, with natural or ambient lighting that complements the subject. Ensure shadows and colors around the subject match the new environment for a seamless, photorealistic effect. The overall atmosphere should feel lively and realistic, like the subject is naturally in the city scene."
  },
  'background-13': {
    title: 'Vintage Background',
    prompt: "Replace the background of this image with a vintage-style scene. Keep the main subject completely unchanged. Include aged textures, muted or sepia-toned colors, soft lighting, and subtle retro details like old buildings, antique furniture, or classic patterns. Ensure shadows and colors around the subject match the new environment for a seamless, photorealistic effect. The overall atmosphere should feel nostalgic, warm, and timeless, like a photograph from the past."
  },
  'background-12': {
    title: 'Winter Background',
    prompt: "Replace the background of this image with a realistic winter scene. Keep the main subject completely unchanged. Include snow-covered trees, gentle snowfall, and soft winter lighting that complements the subject. Ensure shadows and colors around the subject match the new environment for a seamless, photorealistic effect. The overall atmosphere should feel crisp, serene, and cold, like a peaceful winter day."
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let user_id: string | undefined;
  let supabase: any;
  
  try {
    // Get request body
    const { image_data, style_key, custom_prompt, user_id: requestUserId }: NanoBackgroundRequest = await req.json()
    user_id = requestUserId;

    if (!image_data) {
      return new Response(
        JSON.stringify({ error: 'image_data is required' }),
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

    // Pro/Free user check (same as other functions)
    const isPro = user_id && user_id !== 'anonymous' && 
      (user_id.startsWith('store:') || user_id.startsWith('orig:') || user_id.startsWith('fallback:'));
    
    if (user_id && user_id !== 'anonymous') {
      if (isPro) {
        console.log('✅ Pro user detected - unlimited photos, skipping database check');
      } else {
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

    // Rate limit for Pro users (40 requests per UTC day)
    if (isPro) {
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      
      const { data: todayRequests, error: rateError } = await supabase
        .from('photo_predictions')
        .select('id')
        .eq('user_id', user_id)
        .gte('created_at', startOfToday.toISOString());
      
      if (!rateError && todayRequests && todayRequests.length >= 40) {
        console.log('❌ Pro user daily limit exceeded:', user_id);
        return new Response(JSON.stringify({ 
          success: false,
          error: "GPU resources exhausted. Team is working on it.",
          code: "SERVICE_BUSY"
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Initialize Replicate
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

    const replicate = new Replicate({
      auth: replicateApiToken,
    })

    console.log('🎨 Starting nano-background generation with webhooks...')

    // Determine the prompt to use
    let prompt = custom_prompt;
    let selectedStyle = null;
    
    if (!prompt && style_key && NANO_BACKGROUND_STYLES[style_key]) {
      selectedStyle = NANO_BACKGROUND_STYLES[style_key];
      prompt = selectedStyle.prompt;
      console.log(`🎨 Using background style: ${selectedStyle.title}`);
    }
    
    if (!prompt) {
      prompt = "Replace the background with a beautiful, natural scene while keeping the person exactly the same";
    }
    
    console.log('🎨 Background prompt:', prompt);

    // Build input for background generation
    const input = {
      prompt,
      image_input: [`data:image/jpeg;base64,${image_data}`], // Array format like nano-banana
      output_format: "jpg"
    }

    // Construct webhook URL (same as other functions)
    const webhookUrl = `${supabaseUrl}/functions/v1/photo-webhook`

    console.log('🔄 Creating Replicate prediction with webhook...')

    // Create prediction with webhook
    const prediction = await replicate.predictions.create({
      model: "google/nano-banana",
      input,
      webhook: webhookUrl,
      webhook_events_filter: ["completed"]
    })

    console.log(`✅ Prediction created: ${prediction.id}`)

    // Upsert prediction into database for status tracking
    const { error: insertError } = await supabase
      .from('photo_predictions')
      .upsert({
        id: prediction.id,
        user_id: user_id || 'anonymous',
        mode: 'nano_background',
        status: 'starting',
        style_key: style_key || null,
        input: {
          prompt: prompt,
          style_title: selectedStyle?.title || null,
          has_custom_prompt: !!custom_prompt,
          custom_prompt: custom_prompt || null
        },
        metadata: {
          model: 'google/nano-banana',
          style_key: style_key || null
        },
        created_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Failed to insert prediction into database:', insertError)
      throw new Error(`Database insert failed: ${insertError.message}`)
    } else {
      console.log(`✅ Prediction ${prediction.id} inserted into database`)
    }

    // Return prediction ID to client for polling
    return new Response(
      JSON.stringify({ 
        success: true,
        prediction_id: prediction.id,
        status: prediction.status || 'starting',
        mode: 'nano_background',
        style_used: selectedStyle?.title || 'Custom Background',
        estimated_time: '5-10 seconds'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Nano-background generation error:', error)
    
    // Rollback photo usage increment if generation failed
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after nano-background generation error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to start nano-background generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})