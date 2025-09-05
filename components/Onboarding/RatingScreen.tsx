import { useTranslation } from '@/src/hooks/useTranslation';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as StoreReview from 'expo-store-review';
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingButton } from './shared/OnboardingButton';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { ONBOARDING_SPACING } from './shared/constants';

interface RatingScreenProps {
  onContinue: () => void;
}

export function RatingScreen({ onContinue }: RatingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const requestReview = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      } else {
        const appStoreUrl = Platform.select({
          ios: 'https://apps.apple.com/app/photo-restoration-hd/id6748838784?action=write-review',
          android: 'market://details?id=com.photorestorationhd',
          default: 'https://apps.apple.com/app/photo-restoration-hd/id6748838784?action=write-review'
        });
        if (appStoreUrl) {
          const canOpen = await Linking.canOpenURL(appStoreUrl);
          if (canOpen) {
            await Linking.openURL(appStoreUrl);
          }
        }
      }
    } catch (error) {
      // Silent fail - continue
    } finally {
      // Always advance after attempting rating (completed or canceled)
      onContinue();
    }
  };

  return (
    <OnboardingContainer>
      {/* Header with Skip */}
      <View style={{ paddingHorizontal: ONBOARDING_SPACING.xxl, paddingTop: 8, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
        <TouchableOpacity onPress={onContinue} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: '#FFFFFF', fontFamily: 'Lexend-Medium', fontSize: 16 }}>
            {(() => { const k = 'onboarding.rating.skip'; const v = t(k); return v === k ? 'Skip' : v; })()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Center content */}
      <View style={{ flex: 1, paddingHorizontal: ONBOARDING_SPACING.xxl, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 32, fontFamily: 'Lexend-Bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 }}>
          {(() => { const k = 'onboarding.rating.title'; const v = t(k); return v === k ? 'Ready for your photo edit?' : v; })()}
        </Text>
        <Text style={{ fontSize: 16, fontFamily: 'Lexend-Regular', color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 24, marginBottom: 28 }}>
          {(() => { const k = 'onboarding.rating.subtitle'; const v = t(k); return v === k ? 'A quick rating helps us a lot and takes just a moment.' : v; })()}
        </Text>
      </View>

      {/* Bottom action area */}
      <View style={{ 
        paddingHorizontal: ONBOARDING_SPACING.xxl, 
        paddingBottom: Math.max(insets.bottom, ONBOARDING_SPACING.huge), 
        paddingTop: ONBOARDING_SPACING.xl
      }}>
        <OnboardingButton
          title={(() => { const k = 'onboarding.rating.rateNow'; const v = t(k); return v === k ? 'Rate now' : v; })()}
          onPress={requestReview}
          variant="primary"
          size="large"
          style={{ width: '100%' }}
        />
      </View>
    </OnboardingContainer>
  );
}


