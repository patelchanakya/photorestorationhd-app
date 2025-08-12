#!/bin/bash

echo "🔑 RevenueCat API Key Diagnostic Tool"
echo "===================================="

if [ -z "$1" ]; then
    echo "Usage: $0 <api_key>"
    echo ""
    echo "This script tests your RevenueCat REST API key to ensure it has"
    echo "the correct permissions for your webhook integration."
    echo ""
    echo "Get your API keys from:"
    echo "https://app.revenuecat.com/projects → Your Project → API Keys"
    echo ""
    echo "You need the REST API key (starts with sk_), not the SDK key."
    exit 1
fi

API_KEY="$1"
USER_ID="$RCAnonymousID:4ac5a19e0ddf4cda85d5a48e680a2c18"

echo "🧪 Testing API key: ${API_KEY:0:8}..."
echo "👤 Testing with user: $USER_ID"
echo ""

echo "1️⃣ Testing basic API access..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X GET "https://api.revenuecat.com/v1/subscribers/$USER_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Platform: ios")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1 | cut -d: -f2)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"

case $HTTP_CODE in
    200)
        echo "✅ SUCCESS: API key works and can access subscriber data!"
        echo ""
        echo "📊 Subscriber data preview:"
        echo "$BODY" | jq '.subscriber | {
            original_app_user_id: .original_app_user_id,
            entitlements: .entitlements | keys,
            active_subscriptions: .subscriptions | keys,
            first_seen: .first_seen
        }'
        ;;
    401)
        echo "❌ UNAUTHORIZED: Invalid API key"
        echo "   • Double-check your API key from RevenueCat dashboard"
        echo "   • Make sure you're using the REST API key (sk_), not SDK key"
        ;;
    403)
        echo "❌ FORBIDDEN: API key lacks permissions"
        echo "   • Key might be for wrong project"
        echo "   • Key might be for wrong environment (production vs sandbox)"
        echo "   • Key might not have 'subscriber read' permissions"
        echo ""
        echo "💡 Solutions:"
        echo "   1. Check if this is the right project in RevenueCat dashboard"
        echo "   2. Verify environment matches (sandbox vs production)"
        echo "   3. Generate a new REST API key with full permissions"
        ;;
    404)
        echo "⚠️  NOT FOUND: User doesn't exist in this project/environment"
        echo "   • User might be in different RevenueCat project"
        echo "   • User might be in different environment (sandbox vs production)"
        ;;
    *)
        echo "❌ UNEXPECTED ERROR: $HTTP_CODE"
        echo "Response: $BODY"
        ;;
esac

echo ""
echo "🔧 Next steps for webhook:"
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Your API key is working! The webhook should work now."
    echo "   Update your webhook function with this API key."
else
    echo "❌ Fix the API key issue first, then test the webhook again."
    echo "   Go to: https://app.revenuecat.com/projects"
    echo "   Select your project → API Keys → Generate new REST API key"
fi