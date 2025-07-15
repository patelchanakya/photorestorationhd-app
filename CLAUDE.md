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