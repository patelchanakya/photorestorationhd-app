#!/bin/bash

# Test script for edge functions
# Replace PROJECT_URL with your actual Supabase project URL
PROJECT_URL="https://jmiimwbdugghuhgturac.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiaWltd2JkdWdnaHVoZ3R1cmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQxNDEyNTEsImV4cCI6MjA0OTcxNzI1MX0.K_6xzVk2LUGlQgaJRwgUh8uVnN2xUjzJ5-pAqI3V-M4"

echo "🔍 Testing verify-subscription edge function..."

# Test 1: Verify subscription for test user
curl -X POST "$PROJECT_URL/functions/v1/verify-subscription" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test-user-123"}' \
  | jq '.'

echo -e "\n📊 Testing with force refresh..."

# Test 2: Force refresh verification
curl -X POST "$PROJECT_URL/functions/v1/verify-subscription" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test-user-123", "force_refresh": true}' \
  | jq '.'

echo -e "\n🎣 Testing RevenueCat webhook..."

# Test 3: Test webhook endpoint (will fail auth, but shows it's working)
curl -X POST "$PROJECT_URL/functions/v1/revenuecat-webhook" \
  -H "Authorization: Bearer test-webhook-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "INITIAL_PURCHASE",
      "app_user_id": "test-user-webhook",
      "entitlements": {
        "pro": {
          "expires_date": "2025-02-17T00:00:00Z",
          "product_identifier": "monthly_pro"
        }
      },
      "product_id": "monthly_pro",
      "period_type": "monthly",
      "original_transaction_id": "test-transaction-webhook"
    }
  }' \
  | jq '.'

echo -e "\n🎬 Testing video-start with new verification..."

# Test 4: Test video generation with new security
curl -X POST "$PROJECT_URL/functions/v1/video-start" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-pro-user",
    "prompt": "animate with a warm smile",
    "modeTag": "back_to_life",
    "dataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
  }' \
  | jq '.'

echo -e "\n✅ Edge function tests completed!"
echo "📋 Check the responses above for:"
echo "  • verify-subscription: Should return subscription status"
echo "  • revenuecat-webhook: Should show auth error (expected)"
echo "  • video-start: Should show access verification results"