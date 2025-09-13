import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Replicate from "https://esm.sh/replicate@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NanoOutfitRequest {
  image_data: string; // base64 image
  style_key?: string; // Outfit style key
  custom_prompt?: string; // Optional custom prompt
  user_id?: string; // For usage tracking
}

// Outfit styles (7 styles) - SAME FORMAT AS NANO-BACKGROUND
const NANO_OUTFIT_STYLES: Record<string, { title: string; prompt: string }> = {
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
  },
  'outfit-7': {
    title: 'Make Doctor',
    prompt: "Replace the person's clothing with professional medical attire: crisp white cotton doctor's coat over quality dress shirt and trousers, or medical scrubs made of professional cotton blend fabric. Maintain exact facial features, hairstyle, body position, and original lighting conditions. Ensure fabric appears realistic with natural cotton texture, proper coat drape, and authentic medical garment fit under existing lighting. Preserve shadows and highlights. Keep background and pose completely unchanged."
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
    const { image_data, style_key, custom_prompt, user_id: requestUserId }: NanoOutfitRequest = await req.json()
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

    console.log('👔 Starting nano-outfit generation with webhooks...')

    // Determine the prompt to use
    let prompt = custom_prompt;
    let selectedStyle = null;

    if (!prompt && style_key && NANO_OUTFIT_STYLES[style_key]) {
      selectedStyle = NANO_OUTFIT_STYLES[style_key];
      prompt = selectedStyle.prompt;
      console.log(`👔 Using outfit style: ${selectedStyle.title}`);
    }

    if (!prompt) {
      prompt = "Change the clothing while keeping the person exactly the same";
    }

    console.log('👔 Outfit prompt:', prompt);

    // Build input for outfit generation (SAME AS NANO-BACKGROUND)
    const input = {
      prompt,
      image_input: [`data:image/jpeg;base64,${image_data}`], // Array format like nano-background
      output_format: "jpg"
    }

    // Construct webhook URL (same as other functions)
    const webhookUrl = `${supabaseUrl}/functions/v1/photo-webhook`

    console.log('🔄 Creating Replicate prediction with webhook...')

    // Create prediction with webhook (SAME MODEL AS NANO-BACKGROUND)
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
        mode: 'nano_outfit',
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
        mode: 'nano_outfit',
        style_used: selectedStyle?.title || 'Custom Outfit',
        estimated_time: '5-10 seconds'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Nano-outfit generation error:', error)

    // Rollback photo usage increment if generation failed
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after nano-outfit generation error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to start nano-outfit generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})