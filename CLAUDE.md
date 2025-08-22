# Claude Instructions

## Documentation Search

When you need to find documentation or have trouble locating specific information about frameworks, libraries, or tools used in this project, append "use context7" to your prompt to use the Context7 MCP server for comprehensive documentation search.

Also use https://docs.expo.dev/versions/latest/sdk for any expo related questions.

## Project: Photo Restoration HD Mobile App

### Overview
A React Native (Expo) mobile app for AI-powered photo restoration using Replicate's restore-image model. Photos are stored locally on device with metadata synced to Supabase.

### Core Technologies
- **Frontend**: React Native with Expo
- **AI Model**: flux-kontext-apps/restore-image (Replicate API)
- **Storage**: Local device storage via expo-file-system
- **Backend**: Supabase (authentication & metadata only)
- **State Management**: React Context + React Query

### Key Architecture Decisions
1. **No Cloud Photo Storage**: All photos remain on user's device for privacy
2. **Polling-First Approach**: 5-7 second processing time makes polling optimal
3. **Webhook-Ready**: Infrastructure supports webhooks for future scaling
4. **Offline-First**: Core functionality works without constant internet

### API Configuration
```javascript
// Replicate Model
model: "flux-kontext-apps/restore-image"
API Reference: https://replicate.com/flux-kontext-apps/restore-image/api/api-reference

// Environment Variables
EXPO_PUBLIC_REPLICATE_API_TOKEN=r8_[token]
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### API Token Setup
1. **Replicate API Token**: Must use `EXPO_PUBLIC_` prefix for client-side access
2. **Token Validation**: Service includes automatic token validation and logging
3. **Error Handling**: User-friendly error messages for authentication failures
4. **Rate Limiting**: Handles rate limits with appropriate user feedback

### Implementation Phases
1. **Phase 1 (MVP)**: Polling-based restoration with local storage
2. **Phase 2 (Scale)**: Add webhooks, queue management, push notifications

### Project Structure
```
app/               # Expo Router screens
components/        # Reusable UI components  
services/          # API integrations (Replicate, Supabase, Storage)
contexts/          # React contexts for state
hooks/             # Custom React hooks
types/             # TypeScript definitions
```

### Key Features
- Camera/Gallery photo selection
- Real-time processing status
- Before/After comparison slider
- Local gallery of restored photos
- User authentication & preferences
- Export to camera roll

### Development Guidelines
1. Always resize images before processing (max 2048px)
2. Use expo-file-system for all local storage operations
3. Handle network errors gracefully with retry logic
4. Keep UI responsive during 5-7 second processing time
5. Test on both iOS and Android devices
6. **Use NativeWind/Tailwind classes for all styling** - StyleSheet has been completely replaced

### Styling System
- **Framework**: NativeWind v4 with Tailwind CSS
- **Dark Mode**: Automatic support with `dark:` prefixes
- **Colors**: Blue (#3B82F6), Purple (#8B5CF6), Green (#16A34A), Amber (#F59E0B)
- **Spacing**: Consistent Tailwind spacing scale (p-5, mb-4, gap-5)
- **Typography**: Standardized text sizes and weights
- **Components**: All major components updated to use NativeWind

### Completed NativeWind Migration
✅ PhotoPicker component - Modern gradient buttons with animations
✅ HomeScreen - Clean background with dark mode support
✅ RestorationScreen - Card-based layout with action buttons
✅ GalleryScreen - Grid layout with professional interface
✅ ThemedText - Tailwind typography utilities
✅ ThemedView - Background classes with dark mode
✅ Collapsible - Modern expandable cards
✅ HelloWave - Updated with Tailwind classes
✅ NotFoundScreen - Improved error page design

### Testing Commands
```bash
npm start          # Start Expo development
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run lint       # Check code quality (✅ All issues resolved)
```

## Common Issues & Solutions

### iOS Build Issues

#### Associated Domains Capability Error
**Problem**: `expo run:ios` works once, then fails with "Provisioning profile doesn't support the Associated Domains capability"

**Root Cause**: 
- Empty `associatedDomains: []` in app.json enables the capability in iOS project files
- Removing it from app.json doesn't remove it from generated native files
- Your provisioning profile doesn't have this capability enabled

**Solution**:
1. Remove `associatedDomains: []` from app.json
2. Regenerate iOS project: `npx expo prebuild --clean --platform ios`
3. Run again: `npx expo run:ios`

**Prevention**:
- Don't add capabilities you don't need
- After removing capabilities from app.json, always run `prebuild --clean`
- For local dev, `expo run:ios` is usually sufficient
- For production, use EAS Build which handles provisioning automatically

#### Switching iOS Simulators
```bash
# List available simulators
xcrun simctl list devices | grep -E "iPhone|iPad"

# Run on specific device
npx expo run:ios --device "iPad Pro 13-inch (M4)"
```

## Performance Optimization Tasks

### High Priority (Battery & Performance)

#### 🔋 Battery Drain - Infinite Animation Controls
- [ ] **Add AppState listeners to infinite animations**:
  - components/BottomCameraButton.tsx:24-34 (glow animation)
  - app/index.tsx:142-152 (capture button glow) 
  - app/index.tsx:154-170 (PRO button rotation)
  - components/CircularProgress.tsx:57-85 (4 simultaneous animations)
- [ ] **Create useBackgroundAwareAnimation hook** for centralized control
- [ ] **Integrate polling cancellation with AppState** (services/replicate.ts)
- **Impact**: 30-50% reduction in battery usage

#### 🎯 React Optimization - Missing Memoization
- [ ] **Add React.memo to heavy components**:
  - components/BeforeAfterSlider.tsx
  - components/ProcessingScreen.tsx
  - components/PhotoPicker.tsx
- [ ] **Add useMemo/useCallback for expensive operations**:
  - app/gallery-modal.tsx (renderItem, renderSectionHeader, grouping logic)
  - app/restoration/[id].tsx (missing callback optimizations)
- **Impact**: Smoother UI interactions and reduced jank

### Medium Priority (UI Performance)

#### 📱 FlatList Performance
- [ ] **Add missing FlatList optimizations** to gallery modal:
  - getItemLayout for fixed-size items
  - maxToRenderPerBatch and windowSize  
  - removeClippedSubviews
  - initialNumToRender
- [ ] **Add performance props** to restoration screen horizontal list
- **Impact**: Smoother scrolling in large galleries

#### 🚀 App Launch Optimization
- [ ] **Compress large image assets**:
  - assets/images/icon.png (1.69MB → ~100KB)
  - assets/images/splash-icon.png (1.26MB → ~50KB)
- [ ] **Consider WebP format** for better compression
- **Impact**: Faster app download and launch times

### Low Priority (Code Quality)

#### 🧹 Bundle Size Review
- [ ] **Audit package.json dependencies** for unused packages
- [ ] **Check for unused imports** across components
- [ ] **Consider lazy loading** for heavy dependencies
- **Impact**: Smaller app download size

### ✅ Already Well Implemented (No Action Needed)

The following optimizations are already properly implemented in the codebase:
- **Cleanup functions in useEffect hooks** - Comprehensive cleanup across all components
- **AppState management** - Proper listeners for camera and network management  
- **Timer/interval cleanup** - All timeouts and intervals are properly cleaned up
- **Animation infrastructure** - Solid foundation with Reanimated
- **FlatList basics** - keyExtractor and basic optimization already in place
- **Image resizing** - Already handled with proper loading screens during restoration

### Implementation Notes
- **Test on both iOS and Android** after each optimization
- **Use React DevTools Profiler** to measure re-render improvements
- **Monitor memory usage** with Flipper or similar tools
- **Measure battery impact** using Xcode Instruments or Android Studio Profiler
- **Keep performance metrics** before and after optimizations

## 🚨 CRITICAL SECURITY FIX: Apple ID Switching Exploit Protection

### ⚠️ Vulnerability Fixed
**Date**: 2025-08-22  
**Severity**: CRITICAL  
**CVE**: Apple ID Switching Subscription Bypass  

**Description**: Users could switch Apple IDs to bypass subscription validation and generate unlimited videos without paying. RevenueCat would show stale "Pro" status while App Store showed no subscription.

### 🛡️ Security Measures Implemented

#### 1. **iOS StoreKit Cross-Validation**
- **File**: `services/iOSStoreKitValidator.ts`
- **Purpose**: Direct validation with Apple's servers using `react-native-iap`
- **Function**: `validateSubscriptionForPremiumFeature()` validates directly with Apple StoreKit
- **Protection**: Prevents RevenueCat stale data from being trusted blindly

#### 2. **Cross-Validation Logic**
- **Function**: `crossValidateSubscription(revenueCatStatus: boolean)`
- **Logic**: 
  - ✅ Both RevenueCat + Apple say ACTIVE → ALLOW
  - ✅ Both RevenueCat + Apple say INACTIVE → DENY  
  - 🚨 RevenueCat says ACTIVE, Apple says INACTIVE → **DENY** (EXPLOIT DETECTED)
  - ⚠️ RevenueCat says INACTIVE, Apple says ACTIVE → BACKEND_VERIFY

#### 3. **Enhanced Video Generation Security**
- **File**: `hooks/useSimpleBackToLife.ts`
- **Enhancement**: All video generation now includes iOS StoreKit validation before usage check
- **Function**: `validateForVideoGeneration()` called before every video generation
- **Result**: Apple ID switching exploit is now blocked at the client level

#### 4. **Backend Security Enhancements**
- **File**: `supabase/functions/_shared/verifyAccess.ts`
- **Enhancement**: Added transaction ID format validation
- **Protection**: Validates transaction ID length and format to prevent manipulation

### 🧪 Testing Apple ID Switching Scenarios

#### Test Case 1: Normal User Flow (Should Work)
1. User has valid Pro subscription on Apple ID A
2. RevenueCat and Apple both confirm active subscription
3. Video generation should be allowed

#### Test Case 2: Exploit Attempt (Should Be Blocked)
1. User switches from Apple ID A (with Pro) to Apple ID B (without Pro)
2. RevenueCat shows stale "Pro" status
3. Apple StoreKit shows no active subscription
4. **Expected Result**: Video generation BLOCKED with security violation

#### Test Case 3: Legitimate Apple ID Switch (Should Be Blocked)
1. User switches to Apple ID C that has its own Pro subscription
2. RevenueCat shows old subscription data
3. **Expected Result**: May require app restart to sync properly

### 🔍 Monitoring & Logging

All security validations are logged with these prefixes:
- `🔒 [SECURITY]` - Normal security operations
- `🚨 [SECURITY] SECURITY VIOLATION DETECTED` - Exploit attempts  
- `🚨 [EDGE] SECURITY ALERT` - Backend security issues

### 📋 Security Checklist

- [x] **iOS StoreKit Integration**: Added `react-native-iap` dependency
- [x] **Cross-Validation Service**: Created `iOSStoreKitValidator.ts` 
- [x] **Video Hook Security**: Enhanced `useSimpleBackToLife.ts`
- [x] **Backend Validation**: Updated `verifyAccess.ts`
- [x] **Error Handling**: Added security violation error messages
- [x] **Logging**: Comprehensive security event logging
- [ ] **Backend Receipt Validation**: TODO - Validate receipts on backend for ultimate security
- [ ] **Monitoring Dashboard**: TODO - Create dashboard to monitor exploit attempts
- [ ] **Rate Limiting**: TODO - Add rate limiting for failed validation attempts