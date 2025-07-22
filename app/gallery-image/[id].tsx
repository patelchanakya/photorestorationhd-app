import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { Restoration } from '@/types';
import { useRefreshHistory } from '@/hooks/useRestorationHistory';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, ActionSheetIOS } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence, 
  withTiming,
  interpolate,
  runOnJS,
  withDelay
} from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function GalleryImageModal() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const refreshHistory = useRefreshHistory();
  const { decrementFreeRestorations } = useSubscriptionStore();
  const [restoration, setRestoration] = useState<Restoration | null>(null);
  const [loading, setLoading] = useState(true);
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [restoredUri, setRestoredUri] = useState<string | null>(null);
  const [downloadText, setDownloadText] = useState('Save');
  
  // Animation values
  const buttonScale = useSharedValue(1);
  const iconScale = useSharedValue(1);
  const iconRotation = useSharedValue(0);
  const progressScale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const successBackground = useSharedValue(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await restorationService.getById(id as string);
        setRestoration(data);
        if (data?.original_filename) {
          setOriginalUri(photoStorage.getPhotoUri('original', data.original_filename));
        } else {
          setOriginalUri(null);
        }
        if (data?.restored_filename) {
          setRestoredUri(photoStorage.getPhotoUri('restored', data.restored_filename));
        } else {
          setRestoredUri(null);
        }
      } catch (err) {
        setOriginalUri(null);
        setRestoredUri(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Reset animation function
  const resetAnimation = () => {
    setDownloadText('Save');
  };

  // Save restored image to device with satisfying animation
  const handleSave = async () => {
    if (!restoredUri) return;
    
    try {
      // Start animation sequence
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Button press animation
      buttonScale.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withSpring(1.05, { damping: 15 })
      );
      
      // Icon animation - bounce and rotate
      iconScale.value = withSequence(
        withTiming(1.2, { duration: 150 }),
        withSpring(1, { damping: 10 })
      );
      
      iconRotation.value = withSequence(
        withTiming(10, { duration: 100 }),
        withTiming(-10, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
      
      // Glow effect
      glowOpacity.value = withSequence(
        withTiming(0.8, { duration: 200 }),
        withTiming(0.3, { duration: 300 })
      );
      
      // Progress animation
      progressScale.value = withTiming(1, { duration: 800 });
      
      // Change text
      runOnJS(setDownloadText)('Saving...');
      
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your media library to save images.');
        // Reset animation
        progressScale.value = withTiming(0, { duration: 300 });
        runOnJS(resetAnimation)();
        return;
      }
      
      const asset = await MediaLibrary.createAssetAsync(restoredUri);
      await MediaLibrary.createAlbumAsync('Restorations', asset, false);
      
      // Success animation
      progressScale.value = withTiming(0, { duration: 300 });
      
      // Green highlight effect
      successBackground.value = withTiming(1, { duration: 300 });
      
      buttonScale.value = withSequence(
        withTiming(1.1, { duration: 200 }),
        withSpring(1, { damping: 10 })
      );
      
      // Heavy haptic for success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success text
      runOnJS(setDownloadText)('Saved!');
      
      // Reset after delay
      setTimeout(() => {
        glowOpacity.value = withTiming(0, { duration: 300 });
        successBackground.value = withTiming(0, { duration: 300 });
        setDownloadText('Save');
      }, 1500);
      
    } catch (err) {
      // Error animation
      buttonScale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withSpring(1, { damping: 15 })
      );
      
      iconRotation.value = withSequence(
        withTiming(20, { duration: 100 }),
        withTiming(-20, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      progressScale.value = withTiming(0, { duration: 300 });
      runOnJS(resetAnimation)();
      Alert.alert('Error', 'Failed to save image.');
    }
  };

  // Share restored image
  const handleShare = async () => {
    if (!restoredUri) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Sharing.shareAsync(restoredUri);
    } catch (err) {
      Alert.alert('Error', 'Failed to share image.');
    }
  };

  // Delete restoration with confirmation
  const handleDelete = async () => {
    if (!restoration) return;
    Alert.alert(
      'Delete Image',
      'Are you sure you want to permanently delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              
              // Delete the restoration and photos
              await restorationService.delete(restoration.id);
              await photoStorage.deleteRestoration(restoration);
              
              // Decrement free restoration count if applicable
              if (restoration.status === 'completed' && restoration.created_at) {
                await decrementFreeRestorations(restoration.created_at);
              }
              
              // Refresh the gallery data before dismissing
              refreshHistory();
              Alert.alert('Deleted', 'Image deleted.');
              router.dismiss();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete image.');
            }
          }
        }
      ]
    );
  };

  // Animated styles
  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: iconScale.value },
        { rotate: `${iconRotation.value}deg` }
      ],
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
    };
  });

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: progressScale.value }],
      opacity: progressScale.value,
    };
  });

  const animatedSuccessStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: successBackground.value === 1 ? '#10b981' : '#f97316',
    };
  });


  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.closeButton} onPress={() => router.dismiss()}>
        <IconSymbol name="xmark" size={22} color="#888" />
      </TouchableOpacity>
      <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', paddingTop: 64, paddingBottom: 120 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : originalUri && restoredUri ? (
          <BeforeAfterSlider beforeUri={originalUri} afterUri={restoredUri} style={{ width: '100%', maxWidth: 600, alignSelf: 'center' }} />
        ) : (
          <Text style={styles.errorText}>Image not found.</Text>
        )}
      </View>
      {/* Floating action row for Save, Share, Delete */}
      <View style={[styles.actionRowBlur, { paddingBottom: Math.max(insets.bottom - 2, 0) }]}>
        <View style={styles.actionRow}>
          {/* Large Circular Save Button */}
          <AnimatedTouchableOpacity style={[styles.circularSaveButton, animatedButtonStyle, animatedSuccessStyle]} onPress={handleSave}>
            {/* Glow effect */}
            <Animated.View style={[styles.glowEffect, animatedGlowStyle]} />
            
            {/* Progress ring */}
            <Animated.View style={[styles.progressRing, animatedProgressStyle]} />
            
            {/* Main icon */}
            <Animated.View style={animatedIconStyle}>
              <IconSymbol name="arrow.down.to.line" size={22} color="#fff" />
            </Animated.View>
            
            {/* Save text inside button */}
            <Text style={styles.saveTextInside}>{downloadText}</Text>
          </AnimatedTouchableOpacity>
          
          {/* Secondary Action Buttons */}
          <View style={styles.secondaryButtons}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
              <IconSymbol name="square.and.arrow.up" size={16} color="#f97316" />
              <Text style={styles.secondaryButtonText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleDelete}>
              <IconSymbol name="trash" size={16} color="#ef4444" />
              <Text style={[styles.secondaryButtonText, { color: '#ef4444' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 36 : 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginLeft: 2,
    zIndex: 10,
  },
  actionRowBlur: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    marginHorizontal: 8,
  },
  actionRow: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  circularSaveButton: {
    width: 140,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'relative',
    paddingHorizontal: 16,
  },
  glowEffect: {
    position: 'absolute',
    width: 160,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f97316',
    opacity: 0.3,
  },
  progressRing: {
    position: 'absolute',
    width: 150,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  saveTextInside: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f97316',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 32,
  },
}); 