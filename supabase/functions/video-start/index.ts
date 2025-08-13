import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Replicate from "https://esm.sh/replicate@0.15.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VideoStartRequest {
  imageUri?: string;
  dataUrl?: string;
  uploadId?: string;
  prompt: string;
  modeTag: string;
  duration?: number;
}

interface VideoStartResponse {
  predictionId: string;
  status: 'starting';
  etaSeconds: number;
}

// Animation-specific prompts optimized for Kling v2.1
const ANIMATION_PROMPTS = {
  'animate with a warm hug gesture': 'In this scene, people very slowly embrace in a warm, affectionate hug with extremely gentle, natural movements. For groups, show a very calm group hug where everyone leans in very softly; for pairs or individuals, display very tender, gradual hugging gestures. Keep all actions realistic, extremely gentle, and ultra-fluid without any fast or sudden motions, maintaining the original photo\'s composition and background still.',
  'animate as a group celebration': 'The subjects celebrate together with very slow, peaceful joyful gestures like soft, gradual cheers or gentle high-fives, expressing happiness very naturally. In groups, show extremely subtle interactions such as slow smiling nods or very light pats on backs; for individuals, display quiet, gradual celebratory poses. Ensure movements are ultra-smooth, realistic, and extremely slow, preserving the photo\'s essence with a static background.',
  'animate with love and affection': 'People express love through extremely gentle, affectionate actions like very soft touches or slow, warm gazes, with natural and very calm movements. For groups or families, include very subtle caring interactions; for couples or individuals, show tender, gradual expressions. All animations should be ultra-fluid, realistic, and free of any quick or sudden elements, keeping the background unchanged.',
  'animate with dancing movements': 'Subjects move with very slow, rhythmic dancing steps that feel natural and extremely gentle, like a very slow sway or soft, gradual twirl. In groups, coordinate very calm collective dances; for singles, show extremely subtle personal rhythms. Avoid any quick motions, ensuring ultra-realistic, slow flow suitable for Kling v2.1, with the background remaining still.',
  'animate with fun and playful movements': 'The scene comes alive with fun, playful yet extremely calm movements like very gentle waves or soft, slow laughs, keeping everything natural and ultra-smooth. Groups interact with light, coordinated, slow playfulness; individuals display very subtle joyful gestures. Prevent any fast actions, focusing on realistic, ultra-fluid, gradual animations while the background stays static.',
  'animate with a warm smile': 'Faces very slowly light up with warm, genuine smiles that spread naturally across the group or individual, accompanied by extremely subtle, gentle head tilts or soft eye sparkles. For multiple people, smiles ripple very softly between them; ensure all expressions are calm, realistic, and gradual, with no sudden changes and a motionless background.',
  'bring this photo to life with natural animation': 'Bring the photo to life with extremely subtle, natural animations like very gentle breathing, soft blinks, or calm, gradual shifts in posture, suitable for individuals or groups. Movements should be ultra-smooth, realistic, and very unhurried, avoiding any fast or artificial effects, while keeping the background completely still for a lifelike feel.'
} as const;

function optimizePromptForKling(originalPrompt: string): string {
  const optimized = ANIMATION_PROMPTS[originalPrompt as keyof typeof ANIMATION_PROMPTS];
  return optimized || originalPrompt;
}

async function validateImageSize(imageData: string): Promise<void> {
  // Estimate size from base64 (roughly 4/3 of original)
  const estimatedSize = (imageData.length * 3) / 4;
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (estimatedSize > maxSize) {
    throw new Error('Image is too large. Please select an image smaller than 10MB.');
  }
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    // In Supabase Edge Functions, get user ID from auth context
    // This would typically be passed in the request headers
    return null; // TODO: Implement proper auth extraction
  } catch (error) {
    console.error('Failed to get user ID:', error);
    return null;
  }
}

async function checkUserUsage(supabase: any, userId: string): Promise<{ canUse: boolean; reason?: string }> {
  try {
    // Check user's video usage limits
    const { data: usage, error } = await supabase
      .from('user_video_usage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error is OK
      throw error;
    }

    // For now, allow all requests - usage checking will be handled by existing client-side logic
    // In production, implement proper server-side usage validation here
    return { canUse: true };
  } catch (error) {
    console.error('Error checking usage:', error);
    return { canUse: false, reason: 'Failed to check usage limits' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('🔍 Starting video-start function...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔍 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasReplicateToken: !!Deno.env.get('REPLICATE_API_TOKEN')
    });
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase client created');

    // Initialize Replicate client
    const replicateToken = Deno.env.get('REPLICATE_API_TOKEN');
    if (!replicateToken) {
      throw new Error('REPLICATE_API_TOKEN not found');
    }
    
    const replicate = new Replicate({
      auth: replicateToken,
    });
    console.log('✅ Replicate client created');

    // Parse request body
    const body: VideoStartRequest = await req.json();
    
    if (!body.prompt || !body.modeTag) {
      return new Response(JSON.stringify({ error: 'Missing required fields: prompt, modeTag' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For now, use a fixed user ID to disable JWT requirements
    // TODO: Add proper user authentication when needed
    const userId = 'demo-user';

    // Check usage limits (disabled for demo)
    // const usageCheck = await checkUserUsage(supabase, userId);
    // if (!usageCheck.canUse) {
    //   return new Response(JSON.stringify({ error: usageCheck.reason || 'Usage limit exceeded' }), {
    //     status: 403,
    //     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    //   });
    // }

    // Process image input
    let imageUrl: string;
    if (body.dataUrl) {
      // Validate image size
      await validateImageSize(body.dataUrl);
      imageUrl = body.dataUrl;
    } else if (body.imageUri) {
      // For imageUri, we'd need to fetch and convert - for now, assume it's already a data URL
      imageUrl = body.imageUri;
    } else {
      return new Response(JSON.stringify({ error: 'Either imageUri or dataUrl is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Optimize prompt for Kling
    const optimizedPrompt = optimizePromptForKling(body.prompt);

    // Prepare Replicate input
    const input = {
      prompt: optimizedPrompt,
      start_image: imageUrl,
      mode: 'standard',
      duration: body.duration || 5,
      negative_prompt: 'blurry, distorted, low quality, static, frozen'
    };

    console.log('🎬 Starting video generation:', {
      userId,
      modeTag: body.modeTag,
      prompt: optimizedPrompt.substring(0, 100) + '...'
    });

    // Get webhook URL
    const webhookUrl = `${supabaseUrl}/functions/v1/video-webhook`;

    // Create Replicate prediction
    const prediction = await replicate.predictions.create({
      version: '97da1f6c1fae926420a16b3c538b778f7fc317b8a16b3750f6bc39b106747793',
      input,
      webhook: webhookUrl,
      webhook_events_filter: ['completed']
    });

    if (!prediction.id) {
      throw new Error('Failed to create prediction');
    }

    console.log('🚀 Prediction created:', prediction.id);

    // Store job in database
    const { data: videoJob, error: dbError } = await supabase
      .from('user_video_jobs')
      .insert({
        user_id: userId,
        prediction_id: prediction.id,
        image_uri: body.imageUri || 'data_url',
        prompt: optimizedPrompt,
        mode_tag: body.modeTag,
        status: 'starting',
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        metadata: { 
          original_prompt: body.prompt,
          model: 'kwaivgi/kling-v2.1',
          version: '97da1f6c1fae926420a16b3c538b778f7fc317b8a16b3750f6bc39b106747793',
          input_params: input
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to cancel the prediction if DB insert failed
      try {
        await replicate.predictions.cancel(prediction.id);
      } catch (cancelError) {
        console.error('Failed to cancel prediction after DB error:', cancelError);
      }
      throw new Error('Failed to store video job');
    }

    console.log('💾 Video job stored:', videoJob.id);

    // Return success response
    const response: VideoStartResponse = {
      predictionId: prediction.id,
      status: 'starting',
      etaSeconds: 120 // 2 minute estimate
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Video start error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('Unauthorized') ? 401 :
                      errorMessage.includes('Usage limit') ? 403 :
                      errorMessage.includes('too large') ? 413 :
                      errorMessage.includes('required') ? 400 : 500;

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});