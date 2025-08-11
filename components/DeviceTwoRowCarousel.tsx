import { type FunctionType } from '@/services/modelConfigs';
import { permissionsService } from '@/services/permissions';
import { validatePremiumAccess } from '@/services/revenuecat';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Linking, Platform, Text, TouchableOpacity, View } from 'react-native';

interface DeviceTwoRowCarouselProps {
  functionType: FunctionType;
}

type AssetColumn = { id: string; top?: MediaLibrary.Asset; bottom?: MediaLibrary.Asset };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = Math.round(Math.min(130, SCREEN_WIDTH * 0.28));
const ITEM_RADIUS = 16;
const PAGE_SIZE = 150; // how many assets we fetch per page

export function DeviceTwoRowCarousel({ functionType }: DeviceTwoRowCarouselProps) {
  const [columns, setColumns] = useState<AssetColumn[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState(false);
  const didInitRef = useRef(false);

  useEffect(() => {
    // Check if we have media library permission from our centralized service
    const checkPermission = () => {
      const granted = permissionsService.hasMediaLibraryPermission();
      setHasPermission(granted);
      if (granted && !didInitRef.current) {
        didInitRef.current = true;
        resetAndLoad();
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

  const appendAssetsAsColumns = useCallback((assets: MediaLibrary.Asset[]) => {
    setColumns(prev => {
      const cols: AssetColumn[] = [];
      for (let i = 0; i < assets.length; i += 2) {
        cols.push({ id: assets[i].id, top: assets[i], bottom: assets[i + 1] });
      }
      return prev.length ? [...prev, ...cols] : cols;
    });
  }, []);

  const resetAndLoad = useCallback(async () => {
    setColumns([]);
    setEndCursor(undefined);
    setHasNextPage(true);
    setLoadingInitial(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: PAGE_SIZE,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      appendAssetsAsColumns(result.assets);
      setEndCursor(result.endCursor || undefined);
      setHasNextPage(result.hasNextPage);
    } finally {
      setLoadingInitial(false);
    }
  }, [appendAssetsAsColumns]);

  const loadNextPage = useCallback(async () => {
    if (!hasNextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: PAGE_SIZE,
        sortBy: MediaLibrary.SortBy.creationTime,
        after: endCursor,
      });
      appendAssetsAsColumns(result.assets);
      setEndCursor(result.endCursor || undefined);
      setHasNextPage(result.hasNextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [appendAssetsAsColumns, endCursor, hasNextPage, loadingMore]);

  const openSettings = async () => {
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
  };

  if (!hasPermission) {
    const handlePermissionPress = async () => {
      try {
        // First, try the native permission dialog
        const result = await permissionsService.requestSpecificPermission('mediaLibrary');
        if (result === 'granted') {
          setHasPermission(true);
          if (!didInitRef.current) {
            didInitRef.current = true;
            await resetAndLoad();
          }
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
                { text: 'Open Settings', onPress: openSettings }
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

    return (
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 16 }}>
          <Text style={{ color: '#111', fontWeight: '800', fontSize: 17, marginBottom: 6 }}>You didn't give Clever access to Photos.</Text>
          <Text style={{ color: '#374151', fontSize: 14, marginBottom: 14 }}>To get started, allow access or select a single photo.</Text>
          <TouchableOpacity
            onPress={handlePermissionPress}
            style={{ backgroundColor: '#111', paddingVertical: 12, borderRadius: 24, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>
              Give Access
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
              if (!result.canceled && result.assets[0]) {
                router.push(`/crop-modal?imageUri=${encodeURIComponent(result.assets[0].uri)}&functionType=${functionType}&imageSource=gallery`);
              }
            }}
            style={{ marginTop: 12 }}
          >
            <Text style={{ color: '#111827', textAlign: 'center', fontWeight: '700', textDecorationLine: 'underline' }}>Enhance from Device</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ height: 2 * COLUMN_WIDTH + 24, paddingTop: 8 }}>
      {loadingInitial && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <ActivityIndicator color="#888" />
        </View>
      )}
      <FlatList
        horizontal
        data={columns}
        keyExtractor={(c, index) => `${c.id}-${index}`}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
        renderItem={({ item, index }) => (
          <View style={{ width: COLUMN_WIDTH }}>
            {[item.top, item.bottom].map((asset, idx) => (
              <TouchableOpacity
                key={`${asset?.id ?? 'empty'}-${index}-${idx}`}
                activeOpacity={0.85}
                onPress={async () => {
                  if (!asset) return;
                  
                  // Validate premium access before proceeding
                  const hasAccess = await validatePremiumAccess();
                  if (__DEV__) {
                    console.log('📱 Premium access validation in carousel:', hasAccess);
                  }
                  
                  const info = await MediaLibrary.getAssetInfoAsync(asset.id);
                  const uri = info.localUri || info.uri;
                  if (uri) {
                    router.push(`/crop-modal?imageUri=${encodeURIComponent(uri)}&functionType=${functionType}&imageSource=gallery`);
                  }
                }}
                style={{
                  height: COLUMN_WIDTH * 0.95,
                  borderRadius: ITEM_RADIUS,
                  overflow: 'hidden',
                  backgroundColor: '#111',
                  marginBottom: idx === 0 ? 8 : 0,
                }}
              >
                {asset ? (
                  <ExpoImage
                    source={{ uri: asset.uri }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <View style={{ flex: 1, backgroundColor: '#151515' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        onEndReachedThreshold={0.6}
        onEndReached={loadNextPage}
        initialNumToRender={16}
        maxToRenderPerBatch={16}
        windowSize={12}
        removeClippedSubviews
        getItemLayout={(_, i) => ({ length: COLUMN_WIDTH + 8, offset: (COLUMN_WIDTH + 8) * i, index: i })}
        ListFooterComponent={loadingMore ? (
          <View style={{ width: 48, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#888" />
          </View>
        ) : <View style={{ width: 8 }} />}
      />
    </View>
  );
}