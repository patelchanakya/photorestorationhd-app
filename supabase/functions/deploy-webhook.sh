#!/bin/bash

# Deploy RevenueCat webhook edge function to Supabase
# Usage: ./deploy-webhook.sh

echo "🚀 Deploying RevenueCat webhook function..."

# Deploy the function
supabase functions deploy rc-webhook \
  --project-ref $SUPABASE_PROJECT_REF

echo "✅ Function deployed!"

echo ""
echo "📝 Next steps:"
echo "1. Set environment variables in Supabase Dashboard:"
echo "   - RC_API_KEY: Your RevenueCat REST API key"
echo "   - RC_WEBHOOK_SECRET: Optional webhook secret for authentication"
echo ""
echo "2. Configure webhook in RevenueCat Dashboard:"
echo "   - URL: https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/rc-webhook"
echo "   - Events: Select all subscription lifecycle events"
echo "   - Secret: Set if using RC_WEBHOOK_SECRET"
echo ""
echo "3. Test with RevenueCat's webhook tester"