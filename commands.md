# Expo Development Commands Reference

## 🤔 The Main Confusion: Two Different Workflows

### Local Development Workflow
```bash
npx expo prebuild → npx expo run:ios
```
- **Good for**: Quick testing, debugging native issues
- **Requires**: Mac with Xcode installed
- **Limited by**: Your local environment setup
- **Works when**: Pure React Native code, no complex native modules

### Cloud Development Workflow (EAS)
```bash
npx eas build → Install on device → npx expo start --dev-client
```
- **Good for**: Apps with native modules, consistent builds, production
- **Works from**: Any computer (Mac/PC/Linux)
- **Advantage**: Pre-configured cloud environment
- **Required when**: Native modules, production builds

---

## 🚨 When You MUST Use EAS Build

### ✅ Your Current Situation (Why EAS is Required)
- **Native Modules**: RevenueCat, expo-localization, expo-secure-store, expo-image-crop-tool
- **Expo Go Limitation**: Cannot run apps with custom native modules
- **Local Build Issues**: Environment inconsistencies, missing dependencies

### Other Cases Requiring EAS:
1. Adding any native module not in Expo Go
2. Testing actual app icon, splash screen, bundle ID
3. Push notifications testing
4. App Store submissions
5. Production builds

---

## 📋 Complete EAS Development Workflow

### Step 1: Fix CLI Issues
```bash
# Remove old installations
rm -rf node_modules package-lock.json yarn.lock

# Fresh install dependencies
npm install

# Verify CLI works (use npx, not global)
npx expo --version
npx eas --version
```

### Step 2: Build Development Build
```bash
# Build for iOS development
npx eas build --platform ios --profile development
```

**What happens:**
- Takes your code + native modules to cloud
- Builds complete iOS app with all dependencies
- Takes 10-15 minutes
- Gives you download URL for `.ipa` file

### Step 3: Install Development Build on Device
1. EAS provides URL like: `https://expo.dev/accounts/yourname/projects/...`
2. Open URL on your iPhone
3. Tap "Install" (works like TestFlight)
4. This is your **custom app** (NOT Expo Go)

### Step 4: Start Development Server
```bash
# Now this works because you have dev build installed
npx expo start --dev-client
```

**What happens:**
- Your custom development build connects to this server
- Fast refresh works normally
- All native modules function properly

### Step 5: Daily Development Cycle
```bash
# Make code changes in VS Code
# Save file
# Changes appear instantly in your dev build
# No rebuild needed unless adding NEW native modules
```

---

## 📚 Command Reference Table

| Command | When to Use | What It Does | Requirements |
|---------|-------------|--------------|-------------|
| `npx expo start` | Expo Go development | Starts dev server for Expo Go | Expo Go app |
| `npx expo start --dev-client` | Custom development build | Starts dev server for custom build | Development build installed |
| `npx expo prebuild` | Generate native code locally | Creates ios/ and android/ folders | None |
| `npx expo run:ios` | Local iOS development | Builds and runs on iOS simulator/device | Mac + Xcode |
| `npx eas build --profile development` | Build custom dev app | Creates installable development build | EAS account |
| `npx eas build --profile production` | App Store submission | Creates production build | EAS account + certificates |

---

## 🌳 Decision Tree: Which Command to Use?

```
Do you have native modules? (RevenueCat, etc.)
├── YES → Use EAS Build workflow
│   ├── Development → npx eas build --profile development
│   └── Production → npx eas build --profile production
│
└── NO → Can use either workflow
    ├── Quick testing → npx expo start (Expo Go)
    ├── Local development → npx expo prebuild → npx expo run:ios
    └── Production → npx eas build --profile production
```

---

## 🐛 Troubleshooting Common Issues

### "Cannot find module '@expo/server'" Error
```bash
# Solution: Clean install
rm -rf node_modules package-lock.json
npm install
npx expo --version  # Should work now
```

### "expo start --dev-client" Not Working
**Problem**: No development build installed on device
**Solution**: First run `npx eas build --profile development` and install the result

### Metro Bundler Issues
```bash
# Clear Metro cache
npx expo start --clear

# Or clear all caches
npx expo start --clear --reset-cache
```

### Build Failures
```bash
# Check build logs
npx eas build:list

# View specific build
npx eas build:view [BUILD_ID]
```

---

## 🏗️ EAS Build Profiles Explained

### Development Profile
```json
// In eas.json
"development": {
  "developmentClient": true,
  "distribution": "internal"
}
```
- **Purpose**: Development and testing on physical devices
- **Installation**: Direct install on device (via URL)
- **Includes**: All native modules, debug capabilities

### iOS Simulator Profile
```json
"ios-simulator": {
  "extends": "development", 
  "ios": {
    "simulator": true
  }
}
```
- **Purpose**: Testing on iOS Simulators (different devices/iOS versions)
- **Installation**: Direct install in iOS Simulator
- **Includes**: Same as development but .app format for simulators

### Preview Profile  
```json
"preview": {
  "distribution": "internal"
}
```
- **Purpose**: Testing production-like builds
- **Installation**: Direct install (like TestFlight)
- **Includes**: Production optimizations, but debuggable

### Production Profile
```json
"production": {
  "autoIncrement": true
}
```
- **Purpose**: App Store submission
- **Installation**: Through App Store review process
- **Includes**: Full production optimizations

---

## 🔄 Your Specific Workflow (iOS Only)

### Initial Setup (One Time)
```bash
# 1. Fix any CLI issues
rm -rf node_modules && npm install

# 2a. Build for physical device
npx eas build --platform ios --profile development

# 2b. Build for iOS Simulator testing
npx eas build --platform ios --profile ios-simulator

# 3a. Install on your iPhone (from EAS URL)
# 3b. Install on iOS Simulator (EAS will prompt automatically)

# 4. Start development
npx expo start --dev-client
```

### Daily Development
```bash
# Just start the server, your dev build connects automatically
npx expo start --dev-client

# Make changes in code → See them instantly on device
```

### When to Rebuild
- ✅ **No rebuild needed**: React Native code changes, styling, logic
- 🔄 **Rebuild required**: Adding new native modules, changing native config

### Production Release
```bash
# When ready for App Store
npx eas build --platform ios --profile production

# Submit to App Store
npx eas submit --platform ios
```

---

## 💡 Pro Tips

1. **Use npx**: Always use `npx expo` and `npx eas` instead of global installs
2. **Keep dev build**: Once installed, your development build works for weeks/months
3. **Environment variables**: EAS automatically loads from your eas.json env config
4. **Simulator vs Device**: Development builds work on both simulator and physical device
5. **Multiple profiles**: You can have development, staging, and production builds simultaneously

---

## 🚀 Quick Reference Commands

```bash
# Daily workflow
npx expo start --dev-client

# First time setup - Physical device
npx eas build --platform ios --profile development

# First time setup - iOS Simulator
npx eas build --platform ios --profile ios-simulator

# Production build  
npx eas build --platform ios --profile production

# Clear issues
rm -rf node_modules && npm install

# Check build status
npx eas build:list
```

## 📱 iOS Simulator Testing Workflow

### Build for Simulators
```bash
# Build specifically for iOS Simulator
npx eas build --platform ios --profile ios-simulator
```

### Installation Process
1. When build completes, EAS will ask: **"Install and run on iOS Simulator?"**
2. Press **'y'** to automatically install
3. Or manually: Open Xcode → Devices and Simulators → Install .app file

### Testing Different Devices
```bash
# Start dev server
npx expo start --dev-client

# Press 'i' to choose iOS Simulator
# Select from available simulators:
# - iPhone 15 Pro, iPhone 14, iPad Pro, etc.
# - Different iOS versions (16.0, 17.0, etc.)
```

### Managing Multiple Simulators
- **Xcode → Window → Devices and Simulators**
- Create different device configurations
- Test various screen sizes and iOS versions
- Your development build works on all of them

This reference should eliminate confusion about when and why to use each command! 🎉