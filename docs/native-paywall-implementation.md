# RevenueCat Native Paywall Implementation Guide

## Overview
This app now supports RevenueCat's native paywall UI through the `react-native-purchases-ui` package. The implementation provides a seamless, native experience for iOS and Android users while maintaining a fallback custom paywall for Expo Go development.

## Implementation Details

### 1. Service Layer (`services/revenuecat.ts`)
Added three new functions for native paywall presentation:

- **`presentPaywall()`**: Shows the default offering's paywall modally
- **`presentPaywallIfNeeded(entitlement)`**: Shows paywall only if user lacks the specified entitlement
- **`presentPaywallForOffering(offering)`**: Shows paywall for a specific offering

Each function returns a boolean indicating success (purchase/restore) or failure (cancelled/error).

### 2. Native Paywall Component (`components/NativePaywall.tsx`)
A wrapper component for embedded paywall display using `<RevenueCatUI.Paywall />`. Features:
- Full event handling (purchase, restore, error, cancel)
- Automatic subscription status updates
- User-friendly alerts for all outcomes
- Support for custom offerings

### 3. Screen Updates

#### Home Screen (`app/index.tsx`)
- Pro button now checks environment (Expo Go vs production)
- Uses native `presentPaywall()` in production builds
- Falls back to custom paywall in Expo Go

#### Crop Modal (`app/crop-modal.tsx`)
- Restoration flow checks environment before showing paywall
- Automatically proceeds with restoration after successful purchase
- Maintains same UX flow regardless of paywall type

### 4. Environment Detection
Uses `Constants.appOwnership === 'expo'` to detect Expo Go and switch between:
- **Production**: Native RevenueCat paywall UI
- **Expo Go**: Custom paywall component (fallback)

## Testing the Implementation

### In Development (Expo Go)
1. The app will automatically use the custom paywall fallback
2. You'll see a warning that purchases aren't available in Expo Go
3. All UI flows work, but actual purchases are mocked

### In Production (EAS Build)
1. Native paywall UI will be presented
2. Paywall appearance is customized via RevenueCat dashboard
3. All purchase flows, restore, and cancellation work natively

### Test Component
Use `test-native-paywall.tsx` to verify the implementation:
```tsx
import { TestNativePaywall } from './test-native-paywall';
// Add to any screen for testing
<TestNativePaywall />
```

## Configuration Requirements

### iOS
- Minimum iOS version: 13.4
- Enable In-App Purchase capability in Apple Developer Portal
- No additional Info.plist entries required

### Android
- Minimum SDK: API 23 (Android 6.0)
- Minimum Kotlin: 1.8.0
- Ensure AndroidX App Startup is not removed from manifest

### React Native
- Minimum version: 0.73.0
- Both packages installed:
  - `react-native-purchases: ^9.0.0`
  - `react-native-purchases-ui: ^9.0.0`

## Paywall Results

The native paywall returns these possible results:
- `PURCHASED`: User completed a purchase
- `RESTORED`: User restored previous purchases
- `CANCELLED`: User cancelled the paywall
- `ERROR`: An error occurred
- `NOT_PRESENTED`: Paywall wasn't shown (user already has access)

## Customization

Paywall appearance is managed through the RevenueCat dashboard:
1. Log into RevenueCat dashboard
2. Navigate to Paywalls section
3. Customize colors, text, layout
4. Changes reflect instantly in the app

## Benefits of Native Implementation

1. **Native UI**: Matches iOS/Android design guidelines
2. **Performance**: Smoother animations and transitions
3. **Reliability**: Battle-tested by RevenueCat
4. **Dashboard Control**: Easy A/B testing and customization
5. **Automatic Handling**: Purchase flows, restore, and errors managed automatically

## Troubleshooting

### Paywall Not Showing
- Check if running in Expo Go (will use fallback)
- Verify RevenueCat SDK is initialized
- Ensure offerings are configured in dashboard

### Purchase Failures
- Check RevenueCat API key configuration
- Verify products are approved in App Store/Play Store
- Review device logs for specific errors

### Testing Purchases
- Use sandbox accounts for iOS
- Use test tracks for Android
- Never use production credentials in development