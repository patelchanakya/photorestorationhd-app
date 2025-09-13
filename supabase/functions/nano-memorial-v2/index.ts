import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Replicate from "https://esm.sh/replicate@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NanoMemorialRequest {
  image_data: string; // base64 image
  style_key?: string; // Memorial style key
  custom_prompt?: string; // Optional custom prompt
  user_id?: string; // For usage tracking
}

// Memorial styles from AnimatedMemorial.tsx (11 styles) - NANO FORMAT
const NANO_MEMORIAL_STYLES: Record<string, { title: string; prompt: string }> = {
  'memorial-3': {
    title: 'White Background',
    prompt: "Remove all background distractions while keeping the person completely unchanged. Create a clean, pure white or soft gradient background perfect for memorial displays. Ensure the subject remains well-lit with natural shadows preserved. The effect should focus all attention on the person while maintaining a respectful, professional appearance suitable for memorial services."
  },
  'popular-3': {
    title: 'Add Halo',
    prompt: "Add a subtle, glowing golden halo above the person's head while keeping their face, features, and body completely unchanged. The halo should appear ethereal and luminous, positioned naturally above the head with soft radiant light. Ensure the glow integrates seamlessly with existing lighting without overwhelming the subject. The overall effect should feel divine, peaceful, and respectful."
  },
  'memorial-4': {
    title: 'Light Rays',
    prompt: "Add divine golden light rays streaming down from above while keeping the person completely unchanged. The rays should be soft and radiant, creating volumetric lighting that fills the scene with warmth. Ensure the light naturally illuminates the subject without harsh shadows, blending seamlessly with existing lighting. The overall atmosphere should feel heavenly, spiritual, and profoundly peaceful."
  },
  'popular-7': {
    title: 'Angel Wings',
    prompt: "Add beautiful, realistic angel wings behind the person while keeping their body, face, and features completely unchanged. The wings should appear naturally positioned based on the subject's pose, with detailed feathers that catch the existing light. Ensure the wings integrate seamlessly with shadows and perspective, appearing as if they truly belong. The overall effect should feel ethereal, protective, and spiritually uplifting."
  },
  'memorial-1': {
    title: 'Memorial Flowers',
    prompt: "Add beautiful memorial flowers like lilies, roses, or white flowers around the photo border or background, symbolizing love, remembrance, and peace."
  },
  'memorial-6': {
    title: 'Ethereal Glow',
    prompt: "Add a soft, ethereal glow around the subject creating a peaceful and spiritual memorial atmosphere. The glow should be gentle and respectful, not overwhelming."
  },
  'memorial-8': {
    title: 'Candlelight Vigil',
    prompt: "Transform this photo into a warm candlelit memorial-style portrait. Keep the person's face and features unchanged. Add soft golden candlelight in front of the subject, casting a gentle warm glow across the image without darkening the background too much. Place several realistic candles at the bottom, making the scene feel peaceful, emotional, and respectful."
  },
  'memorial-11': {
    title: 'Heavenly',
    prompt: "Replace the background with soft, ethereal clouds while keeping the person completely unchanged. Include billowing white and pastel blue clouds with gentle light filtering through, creating depth and dimension. Ensure the subject appears naturally lit as if standing in this heavenly setting, with appropriate edge lighting and atmospheric perspective. The overall mood should feel serene, uplifting, and spiritually peaceful."
  },
  'memorial-5': {
    title: 'Dove of Peace',
    prompt: "Add a white dove symbolizing peace, hope, and the Holy Spirit. Position it gracefully in the background or near the subject, perfect for memorial and remembrance photos."
  },
  'memorial-2': {
    title: 'Heaven Gates',
    prompt: "Add subtle heavenly gate elements in the background for a spiritual and comforting memorial effect. The gates should be elegant and not dominate the photo."
  },
  'memorial-9': {
    title: 'Rest in Peace',
    prompt: "Add elegant 'Rest in Peace' text overlay to the image in a respectful, tasteful font that complements the memorial photo."
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
    const { image_data, style_key, custom_prompt, user_id: requestUserId }: NanoMemorialRequest = await req.json()
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

    console.log('🕊️ Starting nano-memorial generation with webhooks...')

    // Determine the prompt to use
    let prompt = custom_prompt;
    let selectedStyle = null;

    if (!prompt && style_key && NANO_MEMORIAL_STYLES[style_key]) {
      selectedStyle = NANO_MEMORIAL_STYLES[style_key];
      prompt = selectedStyle.prompt;
      console.log(`🕊️ Using memorial style: ${selectedStyle.title}`);
    }

    if (!prompt) {
      prompt = "Add peaceful and spiritual memorial elements to honor a loved one while keeping the person exactly the same";
    }

    console.log('🕊️ Memorial prompt:', prompt);

    // Build input for memorial generation (SAME FORMAT AS NANO-BACKGROUND/NANO-OUTFIT)
    const input = {
      prompt,
      image_input: [`data:image/jpeg;base64,${image_data}`], // Array format like nano-banana
      output_format: "jpg"
    }

    // Construct webhook URL (same as other functions)
    const webhookUrl = `${supabaseUrl}/functions/v1/photo-webhook`

    console.log('🔄 Creating Replicate prediction with webhook...')

    // Create prediction with webhook (SAME MODEL AS NANO-BACKGROUND/NANO-OUTFIT)
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
        mode: 'nano_memorial',
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
        mode: 'nano_memorial',
        style_used: selectedStyle?.title || 'Custom Memorial',
        estimated_time: '5-10 seconds'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Nano-memorial generation error:', error)

    // Rollback photo usage increment if generation failed
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after nano-memorial generation error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to start nano-memorial generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})