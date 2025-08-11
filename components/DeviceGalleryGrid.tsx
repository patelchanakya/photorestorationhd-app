import { IconSymbol } from '@/components/ui/IconSymbol';
import { type FunctionType } from '@/services/modelConfigs';
import { permissionsService } from '@/services/permissions';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, FlatList, Linking, Platform, Text, TouchableOpacity, View } from 'react-native';

interface DeviceGalleryGridProps {
  functionType: FunctionType;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getNumColumns = () => {
  if (SCREEN_WIDTH < 360) return 3;
  if (SCREEN_WIDTH < 768) return 4;
  if (SCREEN_WIDTH < 1024) return 5;
  return 6;
};

export function DeviceGalleryGrid({ functionType }: DeviceGalleryGridProps) {
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const numColumns = useMemo(() => getNumColumns(), []);

  useEffect(() => {
    // Check if we have media library permission from our centralized service
    const checkPermission = () => {
      const granted = permissionsService.hasMediaLibraryPermission();
      setHasPermission(granted);
      if (granted) {
        loadAllPhotos();
      }
    };

    // Check immediately
    checkPermission();
    
    // If no permission initially, check periodically in case user grants it later
    if (!permissionsService.hasMediaLibraryPermission()) {
      const interval = setInterval(checkPermission, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  const loadAllPhotos = async () => {
    let allAssets: MediaLibrary.Asset[] = [];
    let hasNextPage = true;
    let after: string | undefined = undefined;

    // Just load everything
    while (hasNextPage) {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 1000, // Max allowed
        sortBy: MediaLibrary.SortBy.creationTime,
        after,
      });
      allAssets = [...allAssets, ...result.assets];
      hasNextPage = result.hasNextPage;
      after = result.endCursor || undefined;
    }
    
    setAssets(allAssets);
  };

  const handlePermissionRequest = async () => {
    try {
      // First, try the native permission dialog
      const result = await permissionsService.requestSpecificPermission('mediaLibrary');
      if (result === 'granted') {
        setHasPermission(true);
        loadAllPhotos();
      } else if (result === 'denied') {
        // Check if we can still ask again or if user permanently denied
        const currentStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (currentStatus.canAskAgain === false) {
          // User permanently denied, need to go to settings
          Alert.alert(
            'Permission Required',
            'Photo access was permanently denied. Please enable it in Settings to use this feature.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: async () => {
                  try {
                    if (Platform.OS === 'ios') {
                      await Linking.openURL('app-settings:');
                    } else {
                      await Linking.openSettings();
                    }
                  } catch (error) {
                    if (__DEV__) {
                      console.error('Failed to open settings:', error);
                    }
                  }
                }
              }
            ]
          );
        }
        // If canAskAgain is true, the dialog was just dismissed - don't do anything
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Permission request error:', error);
      }
    }
  };

  if (!hasPermission) {
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: '#151515', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <IconSymbol name="photo" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 10 }}>Allow access to Photos</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
            To get started, Clever needs access to your photos or you can select one from your device.
          </Text>
          <TouchableOpacity
            onPress={handlePermissionRequest}
            style={{ backgroundColor: '#ffffff', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: '#111827', fontWeight: '700' }}>
              Allow Photo Access
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
              });
              if (!result.canceled && result.assets[0]) {
                router.push(`/crop-modal?imageUri=${encodeURIComponent(result.assets[0].uri)}&functionType=${functionType}&imageSource=gallery`);
              }
            }}
            style={{ marginTop: 14 }}
          >
            <Text style={{ color: '#93c5fd', fontWeight: '600', textAlign: 'center' }}>Enhance from Device</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 28 }}
        columnWrapperStyle={{ gap: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={async () => {
              const info = await MediaLibrary.getAssetInfoAsync(item.id);
              const uri = info.localUri || info.uri;
              if (uri) {
                router.push(`/crop-modal?imageUri=${encodeURIComponent(uri)}&functionType=${functionType}&imageSource=gallery`);
              }
            }}
            style={{ flex: 1 / numColumns }}
            activeOpacity={0.8}
          >
            <View style={{ aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#111' }}>
              <ExpoImage 
                source={{ uri: item.uri }} 
                style={{ width: '100%', height: '100%' }} 
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          </TouchableOpacity>
        )}
        initialNumToRender={50}
        maxToRenderPerBatch={50}
        windowSize={50}
        removeClippedSubviews={false}
      />
    </View>
  );
}