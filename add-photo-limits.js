const fs = require('fs');
const path = require('path');

// List of photo generation functions to update
const photoFunctions = [
  'background-generation-v2',
  'custom-generation-v2', 
  'photo-enhance-v2',
  'photo-repair-v2'
];

// The server-side limits code to add
const limitsCode = `
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
        } else if (!result || !result.success) {
          const reason = result?.reason || 'Photo usage limit exceeded';
          console.log('❌ Server-side photo limits enforcement blocked request:', {
            userId: user_id,
            reason,
            current_count: result?.current_count,
            limit: result?.limit
          });
          
          return new Response(JSON.stringify({ 
            success: false,
            error: reason,
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
            plan_type: result.plan_type
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
`;

const rollbackCode = `
    // Rollback photo usage increment if generation failed after increment
    if (user_id && user_id !== 'anonymous') {
      try {
        await supabase.rpc('rollback_photo_usage', {
          p_user_id: user_id
        });
        console.log('✅ Photo usage rollback completed after generation error');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback photo usage after error:', rollbackError);
      }
    }
`;

console.log('🔧 Adding server-side photo limits to functions...');

photoFunctions.forEach(functionName => {
  const functionPath = path.join(__dirname, 'supabase', 'functions', functionName, 'index.ts');
  
  if (!fs.existsSync(functionPath)) {
    console.log(`❌ Function not found: ${functionName}`);
    return;
  }
  
  let content = fs.readFileSync(functionPath, 'utf8');
  
  // Update serve function to declare variables in outer scope
  content = content.replace(
    /serve\(async \(req\) => \{[\s]*\/\/ Handle CORS preflight requests[\s]*if \(req\.method === 'OPTIONS'\)/,
    `serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS')`
  );
  
  content = content.replace(
    /(if \(req\.method === 'OPTIONS'\) \{[\s\S]*?\}[\s]*)(try \{)/,
    `$1
  let user_id: string | undefined; // Declare in outer scope for error handler
  let supabase: any; // Declare in outer scope for error handler
  
  $2`
  );
  
  // Update user_id extraction 
  content = content.replace(
    /(const \{ [^}]*, user_id[^}]*\}: [^=]* = await req\.json\(\))/,
    (match) => {
      return match.replace('user_id', 'user_id: requestUserId') + '\n    user_id = requestUserId; // Store for error handler';
    }
  );
  
  // Add limits validation after request parsing
  const afterValidation = content.includes('if (!image_data)') ? 
    /(\}\s*\n[\s]*\/\/ Initialize)/g :
    /(\}\s*\n[\s]*\/\/ Initialize [^}]*)/g;
    
  if (afterValidation.test(content)) {
    content = content.replace(afterValidation, '}' + limitsCode + '\n\n    // Initialize');
  }
  
  // Remove duplicate Supabase initialization
  content = content.replace(
    /\/\/ Initialize Supabase client[\s\S]*?const supabase = createClient\(supabaseUrl, supabaseServiceKey\)/g,
    '// Supabase client already initialized above for limits validation'
  );
  
  // Add rollback to error handler
  content = content.replace(
    /(} catch \(error\) \{[\s]*console\.error\([^)]*error[^)]*\))/,
    `$1
    
    ${rollbackCode.trim()}`
  );
  
  fs.writeFileSync(functionPath, content);
  console.log(`✅ Updated ${functionName}`);
});

console.log('🎉 All photo functions updated with server-side limits!');