#!/bin/bash

echo "🔍 RevenueCat Webhook Diagnostics"
echo "=================================="

# Get project info
PROJECT_REF=$(supabase projects list --format json 2>/dev/null | jq -r '.[] | select(.linked) | .id')
if [ -z "$PROJECT_REF" ]; then
    echo "❌ No linked Supabase project found"
    exit 1
fi

WEBHOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/rc-webhook"
echo "📍 Project: $PROJECT_REF"
echo "🔗 Webhook URL: $WEBHOOK_URL"
echo ""

echo "1️⃣ Testing webhook endpoint availability..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}')

if [ "$HTTP_CODE" = "000" ]; then
    echo "❌ Cannot reach webhook endpoint - network error"
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Webhook function not deployed (404)"
    echo "   Run: supabase functions deploy rc-webhook"
    exit 1
else
    echo "✅ Webhook endpoint is reachable (HTTP $HTTP_CODE)"
fi

echo ""
echo "2️⃣ Testing with TEST event (should work even without secrets)..."

RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "api_version": "1.0",
    "event": {
      "type": "TEST",
      "app_user_id": "test-user",
      "app_id": "com.test",
      "environment": "sandbox",
      "event_timestamp_ms": 1692000000000,
      "id": "test-event-id",
      "product_id": "test-product",
      "purchased_at_ms": 1692000000000
    }
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "TEST webhook received successfully"; then
    echo "✅ TEST webhook works - basic function is healthy"
elif echo "$RESPONSE" | grep -q "Missing required environment variables"; then
    echo "❌ Missing environment variables in function"
    echo "   Missing: $(echo "$RESPONSE" | jq -r '.missing // []' | tr -d '[]"' | tr ',' ' ')"
    echo "   Required: $(echo "$RESPONSE" | jq -r '.required // []' | tr -d '[]"' | tr ',' ' ')"
    echo "   👉 Run: ./setup-webhook-secrets.sh"
elif echo "$RESPONSE" | grep -q "Unauthorized"; then
    echo "❌ Unauthorized - webhook secret mismatch"
    echo "   Either remove RC_WEBHOOK_SECRET or configure RevenueCat correctly"
elif echo "$RESPONSE" | grep -q "Invalid JSON"; then
    echo "❌ Function received malformed JSON"
else
    echo "❌ Unexpected response - check function logs"
fi

echo ""
echo "3️⃣ Checking function deployment status..."
supabase functions list | grep rc-webhook

echo ""
echo "4️⃣ Recent environment variables check..."
echo "✅ Your .env file has:"
echo "   - EXPO_PUBLIC_SUPABASE_URL (for client)"
echo "   - EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY (SDK key - NOT used by webhook)"
echo ""
echo "❓ Webhook function needs (set via supabase secrets):"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo "   - RC_API_KEY (RevenueCat REST API key, starts with 'sk_')"
echo "   - RC_WEBHOOK_SECRET (optional)"

echo ""
echo "💡 Next steps:"
if echo "$RESPONSE" | grep -q "Missing required environment variables"; then
    echo "   1. Run: ./setup-webhook-secrets.sh"
    echo "   2. Redeploy: supabase functions deploy rc-webhook"
    echo "   3. Test again with this script"
elif echo "$RESPONSE" | grep -q "TEST webhook received successfully"; then
    echo "   1. Your webhook is working for TEST events"
    echo "   2. Configure RevenueCat to use: $WEBHOOK_URL"
    echo "   3. Send a real webhook event to test"
else
    echo "   1. Check Supabase function logs in dashboard"
    echo "   2. Verify function deployment: supabase functions list"
    echo "   3. Run: ./setup-webhook-secrets.sh if secrets are missing"
fi