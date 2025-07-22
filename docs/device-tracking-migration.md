# Device ID Tracking Migration Guide

## Overview

This migration adds persistent device ID tracking to enforce free generation limits even after app deletion/reinstall. Previously, usage limits were stored only locally in AsyncStorage and could be bypassed by reinstalling the app.

## What Changed

### 1. Database Schema
- Added `device_usage` table in Supabase to track:
  - `device_id`: Unique device identifier
  - `free_restorations_used`: Current usage count
  - `last_reset_date`: When the daily limit was last reset
  - `created_at` & `updated_at`: Timestamps

### 2. New Services
- **`services/supabaseClient.ts`**: Supabase client configuration
- **`services/deviceTracking.ts`**: Device ID generation and usage tracking

### 3. Updated Store
- `subscriptionStore.ts` now uses async methods:
  - `canRestore()` → `canRestore(): Promise<boolean>`
  - `incrementFreeRestorations()` → `incrementFreeRestorations(): Promise<void>`
  - Added `getRemainingRestorations(): Promise<number>`

### 4. Updated UI
- `crop-modal.tsx` now awaits async methods

## How It Works

1. **Device ID Generation**: 
   - Uses combination of device properties (brand, model, OS build)
   - Adds timestamp for uniqueness
   - Stored persistently in AsyncStorage

2. **Usage Tracking**:
   - Checks Supabase first for device usage
   - Falls back to local cache if offline
   - Syncs with server when online

3. **Daily Reset**:
   - Automatically resets count at midnight
   - Works both online and offline

## Migration Steps

1. **Run Database Migration**:
   ```bash
   supabase migration up
   ```

2. **Update Environment Variables**:
   Make sure you have:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

3. **Test the Implementation**:
   - Try restoring 3 photos (should hit limit)
   - Delete and reinstall app
   - Try restoring again (should still be limited)

## Benefits

- ✅ Persistent usage tracking across app reinstalls
- ✅ Server-side validation prevents tampering
- ✅ Works offline with local cache
- ✅ Automatic daily limit reset
- ✅ Seamless integration with existing Pro subscription system

## Rollback Plan

If needed, you can rollback by:
1. Reverting the code changes
2. The app will fall back to local-only tracking
3. No data loss - local storage still works