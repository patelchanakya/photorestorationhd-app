import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Replicate from "https://esm.sh/replicate@0.15.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackgroundRequest {
  image_data: string; // base64 image
  custom_prompt?: string;
  style_key?: string; // Specific background style (bg-1, bg-2, etc.)
  user_id?: string; // For usage tracking (future)
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

    console.log('🖼️ Starting background generation...')

    // Determine the prompt to use
    let prompt = custom_prompt;
    let selectedStyle = null;
    
    if (!prompt && style_key && BACKGROUND_STYLES[style_key]) {
      selectedStyle = BACKGROUND_STYLES[style_key];
      prompt = selectedStyle.prompt;
      console.log(`🖼️ Using background style: ${selectedStyle.title}`);
    }
    
    if (!prompt) {
      prompt = "replace only the background with professional studio setting, keep the exact same person, face, facial features, hair, clothing, pose, and body position unchanged";
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

    console.log('🔄 Calling Replicate API for background generation...')

    // Call Replicate API
    const output = await replicate.run(
      "aa776ca45ce7f7d185418f700df8ec6ca6cb367bfd88e9cd225666c4c179d1d7",
      { input }
    )

    console.log('✅ Background generation completed successfully')

    // Return the result
    return new Response(
      JSON.stringify({ 
        success: true,
        output,
        model: "black-forest-labs/flux-kontext-pro",
        mode: "background",
        style_used: selectedStyle?.title || "Custom",
        prompt_used: prompt
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
        error: 'Failed to generate background',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/* To invoke:
curl -i --location --request POST 'http://localhost:54321/functions/v1/background-generation' \
  --header 'Authorization: Bearer [anon_key]' \
  --header 'Content-Type: application/json' \
  --data '{"image_data":"[base64_string]","custom_prompt":"tropical beach background"}'
*/