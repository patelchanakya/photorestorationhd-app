import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Replicate from "https://esm.sh/replicate@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NanoBananaRequest {
  image_data: string; // base64 image
  user_id?: string; // For usage tracking
}


serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let user_id: string | undefined;
  let supabase: any;
  
  try {
    // Get request body
    const { image_data, user_id: requestUserId }: NanoBananaRequest = await req.json()
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

    console.log('🍌 Starting nano-banana generation with webhooks...')

    // Single purpose: Modern photo restoration
    const prompt = "Make this a modern photo, with modern contrast, natural lens effects, Kodachrome film. Like it was taken yesterday";
    console.log('🍌 Using nano-banana for modern photo restoration');

    // Build input for nano-banana generation
    const input = {
      prompt,
      image_input: [`data:image/jpeg;base64,${image_data}`], // Array with single image
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
        mode: 'nano_banana',
        status: 'starting',
        input: {
          prompt: prompt,
          has_custom_prompt: false,
          custom_prompt: null
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
        mode: 'nano_banana',
        style_used: 'Modern Photo Restoration',
        estimated_time: '5-10 seconds'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Nano-banana generation error:', error)
    
    // Rollback photo usage increment if generation failed
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after nano-banana generation error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to start nano-banana generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})