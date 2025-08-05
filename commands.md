# Expo Development Commands Reference

## 🚀 Quick Reference

### Daily Development
```bash
# No native modules (use Expo Go)
npx expo start

# With native modules (use dev client)
npx expo start --dev-client
```

### Production Build & Release
```bash
# Build locally (free, ~30 min)
npx eas build --platform ios --profile production --local

# Build in cloud (uses credits, ~15 min)
npx eas build --platform ios --profile production

# Submit to App Store
npx eas submit --platform ios 
                              --path ./build-xxxxx.ipa
```

### Troubleshooting
```bash
# Metro cache issues
npx expo start --clear

# Build failures
npx expo prebuild --clean
rm -rf node_modules && npm install

# Skip eager bundling (local build fix)
EAS_LOCAL_BUILD_SKIP_EAGER_BUNDLE=1 npx eas build --platform ios --profile production --local
```

## 📱 Development Workflows

### Standard App (No Native Modules)
1. `npx expo start`
2. Open in Expo Go
3. Code with hot reload
4. Build for App Store when ready

### App with Native Modules (RevenueCat, etc)
1. Build dev client: `npx eas build --platform ios --profile development`
2. Install on device (like TestFlight)
3. Daily: `npx expo start --dev-client`
4. Rebuild only when adding new native modules

## ✅ What You Can Change Without Rebuilding
- UI (layouts, colors, screens)
- API calls and endpoints
- Business logic
- State management
- Images and assets
- All JavaScript/React code

## ❌ What Requires a New Build
- Adding native modules
- Changing permissions
- Updating native module versions
- App icon or splash screen

## 💡 Key Concepts

### Expo Go vs Dev Client
- **Expo Go**: Generic dev app from Apple, works for standard React Native
- **Dev Client**: Your custom dev app with YOUR native modules

### Local vs Cloud Builds
- **Local**: Free, requires Mac, ~30 min
- **Cloud**: Costs credits, works anywhere, ~15 min
- **Both**: Use `eas submit` for easy App Store upload

### Build Types
- **development**: For testing with hot reload
- **preview**: Production-like but testable
- **production**: For App Store submission

## 📋 Complete Workflow Examples

### New Project Setup
```bash
npm install
npx expo start  # Test in Expo Go first
```

### Adding Native Modules
```bash
npm install react-native-purchases
npx eas build --platform ios --profile development
# Install dev build on phone
npx expo start --dev-client
```

### Releasing to App Store
```bash
# Ensure version is updated in app.json
npx eas build --platform ios --profile production --local
npx eas submit --platform ios --path ./build-xxxxx.ipa
```

## 🛠 Common Scenarios

### "Expo Go crashed after adding RevenueCat"
You need a dev client now:
```bash
npx eas build --platform ios --profile development
```

### "Build failed with Metro error"
```bash
npx expo prebuild --clean
npx expo start --clear
# Retry with:
EAS_LOCAL_BUILD_SKIP_EAGER_BUNDLE=1 npx eas build --platform ios --profile production --local
```

### "Out of free build credits"
Use local builds or wait for monthly reset

### "Submission to App Store is tedious"
Always use `eas submit` instead of Xcode