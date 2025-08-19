import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Replicate from "https://esm.sh/replicate@0.15.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OutfitRequest {
  image_data: string; // base64 image
  custom_prompt?: string;
  style_key?: string; // Specific outfit style (outfit-1, outfit-2, etc.)
  user_id?: string; // For usage tracking (future)
}

// Outfit style prompts from AnimatedOutfits.tsx
const OUTFIT_STYLES: Record<string, { title: string; prompt: string }> = {
  'outfit-1': {
    title: 'Fix Clothes',
    prompt: "Clean ALL clothing completely. Remove ALL stains and dirt from shirt, pants, dress, everything. Keep same colors. Keep same style. Only clean, nothing else changes."
  },
  'outfit-2': {
    title: 'Change Color',
    prompt: "Keep the subject's clothing design, texture, shape, and style exactly the same, but change the color to a random, attractive color that looks natural and flattering. Avoid overly bright or obnoxious colors - choose something stylish and wearable. Make sure the new color appears natural under the existing lighting and shadows. Do not alter the subject's face, hair, background, accessories, or any other aspect of the photo - only change the clothing color."
  },
  'outfit-3': {
    title: 'Job Interview',
    prompt: "Replace the subject's clothing with smart business casual attire suitable for a job interview: a nice blazer with dark jeans or smart trousers, or a professional dress that's approachable and friendly. Use neutral, professional colors that look confident but not intimidating. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Ensure clothing appears realistic with natural fabric folds and texture."
  },
  'outfit-4': {
    title: 'Wedding Outfit',
    prompt: "Replace clothing with wedding attire. Preserve exact head position of all subjects, specifically keeping facial features and head positioning the same, along with pose, background, and lighting. Do not alter any other elements of the image."
  },
  'outfit-5': {
    title: 'Professional',
    prompt: "Replace ALL of the subject's clothing with a complete professional outfit: a well-tailored black suit with white dress shirt and tie for men, or an elegant professional dress or suit for women. This includes replacing shirts, pants, shorts, dresses, skirts - EVERY piece of clothing. Keep the subject's facial features, hairstyle, pose, lighting, and background exactly the same. Ensure the entire outfit is cohesive, properly fitted, and has natural fabric folds and realistic texture under the existing lighting."
  },
  'outfit-6': {
    title: 'Casual Day',
    prompt: "Change the subject's clothing to casual, comfortable wear such as a t-shirt and jeans or a relaxed summer outfit. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Ensure the clothing appears soft, naturally worn, and fits realistically with natural fabric folds and textures."
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
    const { image_data, custom_prompt, style_key, user_id: requestUserId }: OutfitRequest = await req.json()
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

    console.log('🎨 Starting outfit generation...')

    // Determine the prompt to use
    let prompt = custom_prompt;
    let selectedStyle = null;
    
    if (!prompt && style_key && OUTFIT_STYLES[style_key]) {
      selectedStyle = OUTFIT_STYLES[style_key];
      prompt = selectedStyle.prompt;
      console.log(`🎨 Using outfit style: ${selectedStyle.title}`);
    }
    
    if (!prompt) {
      prompt = "change only the clothing and outfit, keep the exact same face, facial features, hair, pose, body position, and background unchanged, professional business attire";
    }

    // Build input for outfit generation
    const input = {
      prompt,
      input_image: `data:image/jpeg;base64,${image_data}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    }

    console.log('🔄 Calling Replicate API for outfit generation...')

    // Create prediction
    const prediction = await replicate.predictions.create({
      model: "black-forest-labs/flux-kontext-pro",
      input
    })

    console.log('🔄 Polling for completion...')

    // Poll for completion
    let completedPrediction = prediction
    while (completedPrediction.status !== 'succeeded' && completedPrediction.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      completedPrediction = await replicate.predictions.get(completedPrediction.id)
    }

    if (completedPrediction.status === 'failed') {
      throw new Error(completedPrediction.error || 'Prediction failed')
    }

    const output = completedPrediction.output

    console.log('✅ Outfit generation completed successfully')

    // Return the result
    return new Response(
      JSON.stringify({ 
        success: true,
        output,
        model: "black-forest-labs/flux-kontext-pro",
        mode: "outfit",
        style_used: selectedStyle?.title || "Custom",
        prompt_used: prompt
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Outfit generation error:', error)
    
    // Rollback photo usage increment if generation failed after increment
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after outfit generation error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate outfit',
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
curl -i --location --request POST 'http://localhost:54321/functions/v1/outfit-generation' \
  --header 'Authorization: Bearer [anon_key]' \
  --header 'Content-Type: application/json' \
  --data '{"image_data":"[base64_string]","custom_prompt":"casual summer outfit"}'
*/