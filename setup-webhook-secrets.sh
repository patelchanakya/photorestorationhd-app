#!/bin/bash

echo "🔧 Setting up RevenueCat Webhook Function Secrets"
echo "================================================"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if supabase CLI is available
if ! command_exists supabase; then
    echo "❌ Supabase CLI not found. Please install it first."
    exit 1
fi

# Get project reference
PROJECT_REF=$(supabase projects list --format json | jq -r '.[] | select(.linked) | .id')
if [ -z "$PROJECT_REF" ]; then
    echo "❌ No linked Supabase project found. Run 'supabase link' first."
    exit 1
fi

echo "📍 Project: $PROJECT_REF"
echo ""

# Required secrets for the webhook function
echo "🔑 Please provide the following secrets:"
echo ""

# Supabase URL (we can get this from the project)
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
echo "✅ SUPABASE_URL: $SUPABASE_URL"

# Service Role Key
echo ""
echo "🔍 Getting service role key..."
SERVICE_ROLE_KEY=$(supabase projects api-keys --format json | jq -r '.service_role')
if [ -z "$SERVICE_ROLE_KEY" ] || [ "$SERVICE_ROLE_KEY" = "null" ]; then
    echo "⚠️  Could not auto-retrieve service role key."
    echo "   Please get it from: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
    read -p "   Enter SUPABASE_SERVICE_ROLE_KEY: " -s SERVICE_ROLE_KEY
    echo
else
    echo "✅ SUPABASE_SERVICE_ROLE_KEY: sk_***...${SERVICE_ROLE_KEY: -4}"
fi

# RevenueCat API Key
echo ""
echo "🏪 RevenueCat REST API Key Required:"
echo "   - Go to https://app.revenuecat.com/projects"
echo "   - Select your project → API Keys"
echo "   - Use the REST API key (starts with 'sk_', NOT the SDK key)"
echo "   - This is different from your EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY"
echo ""
read -p "   Enter RC_API_KEY: " -s RC_API_KEY
echo

# Optional webhook secret
echo ""
echo "🔐 Optional webhook secret (leave empty to skip):"
echo "   If you set this, you must also configure RevenueCat to send this in Authorization header"
read -p "   Enter RC_WEBHOOK_SECRET (optional): " -s RC_WEBHOOK_SECRET
echo

# Validate inputs
if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ] || [ -z "$RC_API_KEY" ]; then
    echo "❌ Missing required values. Exiting."
    exit 1
fi

echo ""
echo "🚀 Setting function secrets..."

# Set the secrets
supabase secrets set \
    --project-ref "$PROJECT_REF" \
    SUPABASE_URL="$SUPABASE_URL" \
    SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
    RC_API_KEY="$RC_API_KEY"

# Set optional webhook secret if provided
if [ -n "$RC_WEBHOOK_SECRET" ]; then
    supabase secrets set --project-ref "$PROJECT_REF" RC_WEBHOOK_SECRET="$RC_WEBHOOK_SECRET"
    echo "⚠️  Remember to configure RevenueCat webhook with Authorization header:"
    echo "   Authorization: Bearer $RC_WEBHOOK_SECRET"
fi

echo ""
echo "✅ Secrets configured successfully!"
echo ""
echo "📦 Now redeploy the function:"
echo "   supabase functions deploy rc-webhook"
echo ""
echo "🧪 Test the webhook:"
echo "   curl -X POST $SUPABASE_URL/functions/v1/rc-webhook \\"
echo "     -H \"Content-Type: application/json\" \\"
if [ -n "$RC_WEBHOOK_SECRET" ]; then
    echo "     -H \"Authorization: Bearer $RC_WEBHOOK_SECRET\" \\"
fi
echo "     -d '{\"api_version\": \"1.0\", \"event\": {\"type\": \"TEST\", \"app_user_id\": \"test-user\", \"app_id\": \"com.test\", \"environment\": \"sandbox\", \"event_timestamp_ms\": 1692000000000, \"id\": \"test-event-id\", \"product_id\": \"test-product\", \"purchased_at_ms\": 1692000000000}}'"
echo ""
echo "🎯 RevenueCat webhook URL:"
echo "   $SUPABASE_URL/functions/v1/rc-webhook"