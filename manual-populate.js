// Manual cache population script
// Since the webhook needs real RevenueCat data, we'll manually populate the cache

const fetch = require('node-fetch');

async function populateProUser() {
  const userId = "stable:0e59c4b0-2b0e-4ce7-8b0a-5d3f8c2a1e9b";
  
  console.log('🔄 Manually populating subscription cache for Pro user...');
  
  // Create a mock webhook payload that matches your Pro subscription
  const mockWebhookPayload = {
    api_version: "1.0",
    event: {
      app_id: "photo-restoration-hd",
      app_user_id: userId,
      environment: "production", 
      event_timestamp_ms: Date.now(),
      id: "manual-population-" + Date.now(),
      product_id: "photo_restoration_hd_monthly", // Adjust based on your actual product
      purchased_at_ms: Date.now() - (24 * 60 * 60 * 1000), // 1 day ago
      type: "INITIAL_PURCHASE",
      expiration_at_ms: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
      entitlement_id: "pro",
      entitlement_ids: ["pro"],
      period_type: "normal",
      store: "app_store"
    }
  };

  try {
    const response = await fetch('https://jmiimwbdugghuhgturac.supabase.co/functions/v1/rc-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mockWebhookPayload)
    });

    const result = await response.text();
    console.log('📤 Webhook response:', response.status, result);
    
    if (response.ok) {
      console.log('✅ Cache population triggered successfully!');
      
      // Test the cache
      setTimeout(async () => {
        const testResponse = await fetch('https://jmiimwbdugghuhgturac.supabase.co/functions/v1/verify-subscription-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: userId })
        });
        
        const testResult = await testResponse.json();
        console.log('🧪 Cache test result:', testResult);
      }, 2000);
    } else {
      console.error('❌ Failed to populate cache');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

populateProUser();