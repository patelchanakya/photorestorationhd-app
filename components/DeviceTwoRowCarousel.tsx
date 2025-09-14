import { type FunctionType } from '@/services/photoGenerationV2';
import { permissionsService } from '@/services/permissions';
import { useQuickEditStore } from '@/store/quickEditStore';
import { validatePremiumAccess } from '@/services/revenuecat';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Dimensions, Linking, Platform, Text, TouchableOpacity, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';

interface DeviceTwoRowCarouselProps {
  functionType: FunctionType;
  firstTileRef?: React.RefObject<TouchableOpacity | null>;
}

type AssetColumn = { id: string; top?: MediaLibrary.Asset; bottom?: MediaLibrary.Asset };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = Math.round(Math.min(130, SCREEN_WIDTH * 0.28));
const ITEM_RADIUS = 16;
const PAGE_SIZE = 150; // how many assets we fetch per page

// Memoized item component for better performance
const CarouselColumn = React.memo<{
  item: AssetColumn;
  index: number;
  functionType: FunctionType;
  firstTileRef?: React.RefObject<TouchableOpacity | null>;
}>(({ item, index, functionType, firstTileRef }) => {
  return (
    <View style={{ width: COLUMN_WIDTH }}>
      {[item.top, item.bottom].map((asset, idx) => (
        <TouchableOpacity
          key={`${asset?.id ?? 'empty'}-${index}-${idx}`}
          ref={index === 0 && idx === 0 ? firstTileRef : undefined}
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
              const normalized = functionType as any;
              useQuickEditStore.getState().openWithImage({ 
                functionType: normalized as any, 
                imageUri: uri 
              });
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
              recyclingKey={asset.id}
              priority={index < 8 ? "high" : "low"}
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              responsivePolicy="live"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#151515' }} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return prevProps.item.id === nextProps.item.id && 
         prevProps.index === nextProps.index &&
         prevProps.functionType === nextProps.functionType &&
         prevProps.firstTileRef === nextProps.firstTileRef;
});

// Static components for better performance (avoid recreation on each render)
const ItemSeparator = React.memo(() => <View style={{ width: 8 }} />);
const LoadingFooter = React.memo(() => (
  <View style={{ width: 48, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color="#888" />
  </View>
));
const EmptyFooter = React.memo(() => <View style={{ width: 8 }} />);

export function DeviceTwoRowCarousel({ functionType, firstTileRef }: DeviceTwoRowCarouselProps) {
  const { t } = useTranslation();
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
      // Use cached permission state - no need to refresh on every mount
      const granted = permissionsService.hasMediaLibraryPermission();
      setHasPermission(granted);
      if (granted && !didInitRef.current) {
        didInitRef.current = true;
        resetAndLoad();
      }
    };

    // Check immediately with cached state
    checkPermission();
    
    // If no permission initially, listen for app state changes to recheck when app becomes active
    if (!permissionsService.hasMediaLibraryPermission()) {
      const handleAppStateChange = (nextAppState: string) => {
        if (nextAppState === 'active') {
          const granted = permissionsService.hasMediaLibraryPermission();
          setHasPermission(granted);
          if (granted && !didInitRef.current) {
            didInitRef.current = true;
            resetAndLoad();
          }
        }
      };

      const subscription = AppState.addEventListener('change', handleAppStateChange);
      return () => subscription?.remove();
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

  // Memoized callbacks for FlatList
  const keyExtractor = useCallback((c: AssetColumn) => c.id, []);
  
  const renderItem = useCallback(({ item, index }: { item: AssetColumn; index: number }) => (
    <CarouselColumn 
      item={item} 
      index={index} 
      functionType={functionType}
      firstTileRef={firstTileRef}
    />
  ), [functionType, firstTileRef]);
  
  const getItemLayout = useCallback((data: any, index: number) => ({ 
    length: COLUMN_WIDTH + 8, 
    offset: (COLUMN_WIDTH + 8) * index, 
    index 
  }), []);

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
              'Tap "Open Settings" or go to Settings → Clever → Photos.',
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
          <Text style={{ color: '#111', fontFamily: 'Lexend-Black', fontSize: 17, marginBottom: 6 }}>{t('deviceCarousel.photosAccessNeeded')}</Text>
          <Text style={{ color: '#374151', fontSize: 14, marginBottom: 14 }}>{t('deviceCarousel.browsePicsMessage')}</Text>
          <TouchableOpacity
            onPress={handlePermissionPress}
            style={{ backgroundColor: '#111', paddingVertical: 12, borderRadius: 24, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontFamily: 'Lexend-Black' }}>
              {t('deviceCarousel.allowAccess')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({ 
                mediaTypes: ['images'], 
                quality: 1,
                presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
                preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
                exif: false
              });
              if (!result.canceled && result.assets[0]) {
                useQuickEditStore.getState().openWithImage({ 
                  functionType: functionType as any, 
                  imageUri: result.assets[0].uri 
                });
              }
            }}
            style={{ marginTop: 12 }}
          >
            <Text style={{ color: '#111827', textAlign: 'center', fontFamily: 'Lexend-Bold', textDecorationLine: 'underline' }}>{t('deviceCarousel.fixFromDevice')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, height: 2 * COLUMN_WIDTH + 24, paddingTop: 8 }}>
      {loadingInitial && (
        <View style={{ 
          position: 'absolute', 
          left: 0, 
          right: 0, 
          top: 0, 
          bottom: 0, 
          backgroundColor: 'transparent',
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10 
        }}>
          <ActivityIndicator color="#888" />
        </View>
      )}
      <FlashList
        horizontal
        data={columns}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        estimatedListSize={{ height: 2 * COLUMN_WIDTH, width: SCREEN_WIDTH }}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={ItemSeparator}
        renderItem={renderItem}
        estimatedItemSize={COLUMN_WIDTH + 8}
        onEndReachedThreshold={0.6}
        onEndReached={loadNextPage}
        getItemLayout={getItemLayout}
        disableIntervalMomentum={true} // Prevent over-scrolling
        decelerationRate="fast" // Faster deceleration
        ListFooterComponent={loadingMore ? LoadingFooter : EmptyFooter}
      />
    </View>
  );
}