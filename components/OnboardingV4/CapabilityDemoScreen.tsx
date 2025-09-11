import React from 'react';
import { View, Text, StyleSheet, Image, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withRepeat,
  withSpring,
  runOnJS
} from 'react-native-reanimated';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';
import { IconSymbol } from '../ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';

// Toggle for mock vs real API - change to false for production
const USE_MOCK_API = true;

interface IntentOption {
  id: string;
  label: string;
  icon: string;
  demoImages: string[];
  video?: any;
  image?: any;
  functionType?: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'restore_repair' | 'water_damage' | null;
  customPrompt?: string;
}

interface PhotoSelection {
  uri: string;
  width: number;
  height: number;
}

interface CapabilityDemoScreenProps {
  intent: IntentOption | undefined;
  onContinue: (photo?: PhotoSelection) => void;
}

export function CapabilityDemoScreen({ intent, onContinue }: CapabilityDemoScreenProps) {
  const insets = useSafeAreaInsets();
  const [showAfter, setShowAfter] = React.useState(false);
  const [selectedPhoto, setSelectedPhoto] = React.useState<PhotoSelection | null>(null);
  const [isSelectingPhoto, setIsSelectingPhoto] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processedResult, setProcessedResult] = React.useState<string | null>(null);
  const [processingError, setProcessingError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  
  const titleOpacity = useSharedValue(0);
  const beforeOpacity = useSharedValue(0);
  const afterOpacity = useSharedValue(0);
  const arrowOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  React.useEffect(() => {
    // Entrance animations - standardized timings
    titleOpacity.value = withTiming(1, { duration: 500 });
    
    setTimeout(() => {
      beforeOpacity.value = withTiming(1, { duration: 400 });
    }, 200);
    
    setTimeout(() => {
      arrowOpacity.value = withTiming(1, { duration: 400 });
    }, 400);
    
    // Show transformation after delay
    setTimeout(() => {
      runOnJS(setShowAfter)(true);
      afterOpacity.value = withTiming(1, { duration: 400 });
    }, 600);
    
    setTimeout(() => {
      taglineOpacity.value = withTiming(1, { duration: 400 });
    }, 800);
    
    setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 400 });
    }, 1000);
  }, []);

  const handlePhotoSelection = async () => {
    if (isSelectingPhoto) return;
    
    try {
      setIsSelectingPhoto(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: undefined,
        quality: 0.8,
        base64: false,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
        exif: false
      });

      if (!result.canceled && result.assets[0]) {
        const photo = result.assets[0];
        const photoData = {
          uri: photo.uri,
          width: photo.width || 0,
          height: photo.height || 0
        };
        setSelectedPhoto(photoData);
        
        // Start processing immediately after photo selection
        processPhoto(photoData);
      }
    } catch (error) {
      console.error('Photo selection failed:', error);
      Alert.alert(
        'Photo Selection Failed',
        'Unable to select photo. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSelectingPhoto(false);
    }
  };

  const photoRestoration = usePhotoRestoration();

  const processPhoto = async (photo: PhotoSelection) => {
    try {
      setIsProcessing(true);
      setProcessingError(null);
      setProcessedResult(null);

      // Set global flag for mock mode
      (global as any).USE_MOCK_API = USE_MOCK_API;

      if (USE_MOCK_API) {
        // Mock API processing with delay
        console.log('🎭 Mock processing started for:', intent?.functionType);
        
        // Simulate processing time (3-5 seconds)
        await new Promise(resolve => setTimeout(resolve, 3500));
        
        // Use demo image as mock result
        const mockResult = intent?.image;
        if (mockResult) {
          setProcessedResult(mockResult);
          console.log('✅ Mock processing completed');
        } else {
          throw new Error('No demo image available for mock result');
        }
      } else {
        // Use same pipeline as Explore
        console.log('🚀 Real API processing started for:', intent?.functionType);
        
        const result = await photoRestoration.mutateAsync({
          imageUri: photo.uri,
          functionType: intent?.functionType || 'restore_repair',
          customPrompt: intent?.customPrompt,
          imageSource: 'gallery'
        });

        setProcessedResult(result.restoredImageUri);
        console.log('✅ Real API processing completed');
      }
    } catch (error) {
      console.error('Processing failed:', error);
      setProcessingError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToPhotos = async () => {
    if (!processedResult) return;
    
    try {
      setIsSaving(true);
      
      // Request permission to save to photos
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to photos to save your restored image.',
          [{ text: 'OK' }]
        );
        return;
      }

      let imageUri = processedResult;
      
      // If it's a mock result (require() asset), we need to copy it to a file
      if (USE_MOCK_API && typeof processedResult !== 'string') {
        // For demo images (require() assets), we can't save them directly
        // In a real app, you'd have the actual processed file URI
        Alert.alert(
          'Demo Mode',
          'This is a demo result. In production, your actual processed photo would be saved.',
          [
            { text: 'OK', onPress: () => onContinue(selectedPhoto || undefined) }
          ]
        );
        return;
      }

      // Save the image to photos
      await MediaLibrary.saveToLibraryAsync(imageUri);
      
      Alert.alert(
        'Success!',
        'Your restored photo has been saved to your photo library.',
        [
          { text: 'Continue', onPress: () => onContinue(selectedPhoto || undefined) }
        ]
      );
      
    } catch (error) {
      console.error('Failed to save photo:', error);
      Alert.alert(
        'Save Failed',
        'Unable to save the photo to your library. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const beforeStyle = useAnimatedStyle(() => ({
    opacity: beforeOpacity.value,
  }));

  const afterStyle = useAnimatedStyle(() => ({
    opacity: afterOpacity.value,
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  if (!intent) {
    return null;
  }

  return (
    <LinearGradient
      colors={['#000000', '#000000']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Header */}
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>{intent.label}</Text>
        </Animated.View>

        {/* Demo Area */}
        <View style={styles.demoContainer}>
          {/* Before/After Images */}
          <View style={styles.imageContainer}>
            {/* Before Image */}
            <Animated.View style={[styles.imageWrapper, beforeStyle]}>
              {selectedPhoto ? (
                <View style={styles.selectedImageContainer}>
                  <ExpoImage
                    source={{ uri: selectedPhoto.uri }}
                    style={styles.selectedImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  <View style={styles.imageLabel}>
                    <Text style={styles.imageLabelText}>Before</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.placeholderImage} 
                  onPress={handlePhotoSelection}
                  disabled={isSelectingPhoto}
                >
                  <IconSymbol name="photo" size={32} color="#f97316" />
                  <Text style={styles.placeholderText}>Tap to Upload</Text>
                  <Text style={styles.placeholderSubtext}>Your Photo</Text>
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Arrow */}
            <Animated.View style={[styles.arrow, arrowStyle]}>
              <Text style={styles.arrowText}>→</Text>
            </Animated.View>

            {/* After Image - Processing Result */}
            <Animated.View style={[styles.imageWrapper, afterStyle]}>
              {selectedPhoto ? (
                <View style={styles.demoResultContainer}>
                  {isProcessing ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#f97316" />
                      <Text style={styles.loadingText}>Processing...</Text>
                      <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
                    </View>
                  ) : processedResult ? (
                    <View style={styles.resultImageContainer}>
                      <ExpoImage
                        source={typeof processedResult === 'string' ? { uri: processedResult } : processedResult}
                        style={styles.resultImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                      <View style={styles.imageLabel}>
                        <Text style={styles.imageLabelText}>After</Text>
                      </View>
                      <View style={styles.resultOverlay}>
                        <Text style={styles.resultText}>{USE_MOCK_API ? 'Mock Result' : 'Processed'}</Text>
                      </View>
                    </View>
                  ) : processingError ? (
                    <View style={styles.errorContainer}>
                      <IconSymbol name="exclamationmark.triangle" size={32} color="#ef4444" />
                      <Text style={styles.errorText}>Processing Failed</Text>
                      <Text style={styles.errorSubtext}>{processingError}</Text>
                    </View>
                  ) : (
                    <View style={styles.placeholderImageEmpty} />
                  )}
                </View>
              ) : showAfter ? (
                <View style={styles.placeholderImageAfter}>
                  <Text style={styles.placeholderText}>After</Text>
                  <Text style={styles.placeholderSubtext}>Restored ✨</Text>
                </View>
              ) : (
                <View style={styles.placeholderImageEmpty} />
              )}
            </Animated.View>
          </View>

          {/* Tagline */}
          <Animated.View style={[styles.taglineContainer, taglineStyle]}>
            <Text style={styles.tagline}>See what Clever can do</Text>
          </Animated.View>
        </View>

        {/* Bottom Button */}
        <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={buttonStyle}>
            {selectedPhoto && processedResult ? (
              <OnboardingButton
                title={isSaving ? "Saving..." : "Save to Photos"}
                onPress={saveToPhotos}
                variant="primary"
                size="large"
                disabled={isSaving}
              />
            ) : selectedPhoto && isProcessing ? (
              <OnboardingButton
                title="Processing..."
                onPress={() => {}}
                variant="secondary"
                size="large"
                disabled={true}
              />
            ) : selectedPhoto && processingError ? (
              <OnboardingButton
                title="Retry"
                onPress={() => processPhoto(selectedPhoto)}
                variant="secondary"
                size="large"
              />
            ) : (
              <OnboardingButton
                title="Select Photo"
                onPress={handlePhotoSelection}
                variant="secondary"
                size="large"
                disabled={isSelectingPhoto}
              />
            )}
          </Animated.View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.5,
    paddingHorizontal: 16,
  },
  demoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  imageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  imageWrapper: {
    flex: 1,
    maxWidth: '42%',
    backgroundColor: 'transparent',
  },
  placeholderImage: {
    aspectRatio: 3/4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f97316',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  placeholderImageAfter: {
    aspectRatio: 3/4,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImageEmpty: {
    aspectRatio: 3/4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  arrow: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  arrowText: {
    fontSize: 20,
    color: '#f97316',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  taglineContainer: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bottomContent: {
    paddingHorizontal: 8,
  },
  selectedImageContainer: {
    position: 'relative',
    aspectRatio: 3/4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  imageLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imageLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  demoResultContainer: {
    aspectRatio: 3/4,
    backgroundColor: 'transparent',
  },
  demoImageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  demoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  demoOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  demoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    aspectRatio: 3/4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  resultImageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    aspectRatio: 3/4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  resultOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    aspectRatio: 3/4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});