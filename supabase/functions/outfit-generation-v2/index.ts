import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Replicate from "https://esm.sh/replicate@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OutfitRequest {
  image_data: string; // base64 image
  custom_prompt?: string;
  style_key?: string; // Specific outfit style (outfit-1, outfit-2, etc.)
  user_id?: string; // For usage tracking
}

// Outfit style prompts from AnimatedOutfits.tsx
const OUTFIT_STYLES: Record<string, { title: string; prompt: string }> = {
  'outfit-1': {
    title: 'Fix Clothes',
    prompt: "Clean ALL clothing completely on the person. Remove ALL stains and dirt from every piece of clothing while maintaining original fabric texture and material properties. Keep the same colors, style, and design. Preserve exact facial features, hairstyle, body position, and original lighting conditions with natural shadows. Only clean the clothing - keep background and pose completely unchanged."
  },
  'outfit-2': {
    title: 'Change Color',
    prompt: "Keep the person's clothing design, fabric texture, material properties, shape, and style exactly the same, but change the color to a random, attractive color that looks natural and flattering. Avoid overly bright colors - choose stylish, wearable colors. Ensure the new color appears natural under existing lighting conditions with proper fabric sheen and material behavior. Maintain exact facial features, hairstyle, body position, and original lighting with natural shadows. Do not alter background, accessories, or pose - only change the clothing color."
  },
  'outfit-3': {
    title: 'Job Interview',
    prompt: "Replace the person's clothing with smart business casual attire: cotton blazer with wool trousers or professional skirt made of quality fabric. Use neutral, professional colors. Maintain exact facial features, hairstyle, body position, and original lighting conditions. Ensure fabric appears realistic with natural cotton weave texture, wool properties, and proper garment drape under existing lighting. Preserve shadows and highlights. Keep background and pose completely unchanged."
  },
  'outfit-4': {
    title: 'Wedding Outfit',
    prompt: "Replace clothing with elegant wedding attire: silk wedding dress with lace details or formal wool suit with silk tie. Preserve exact head position, facial features, and body positioning of all subjects. Maintain original lighting conditions with natural fabric sheen and texture - silk should appear lustrous, lace delicate, wool structured. Ensure proper garment drape under existing lighting. Keep pose, background, and lighting completely unchanged."
  },
  'outfit-5': {
    title: 'Professional',
    prompt: "Replace ALL of the person's clothing with a complete professional business outfit: well-tailored wool suit with cotton dress shirt and silk tie, or elegant professional wool blazer with quality fabric trousers or skirt. Maintain exact facial features, hairstyle, body position, and original lighting conditions. Ensure fabric appears realistic with natural wool texture, cotton weave, and silk properties. Proper suit drape and authentic fabric folds under existing lighting. Preserve shadows and highlights. Keep background and pose completely unchanged."
  },
  'outfit-6': {
    title: 'Casual Day',
    prompt: "Change the person's clothing to casual, comfortable wear: soft cotton t-shirt with denim jeans or lightweight cotton summer outfit. Maintain exact facial features, hairstyle, body position, and original lighting conditions. Ensure clothing appears realistic with natural cotton weave texture, authentic denim properties, and proper fabric drape under existing lighting. Preserve shadows and highlights. Keep background and pose completely unchanged."
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

    console.log('🎨 Starting outfit generation with webhooks...')

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
        mode: 'outfit',
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
        mode: 'outfit',
        style_used: selectedStyle?.title || 'Custom',
        estimated_time: '5-10 seconds'
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
        error: 'Failed to start outfit generation',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})