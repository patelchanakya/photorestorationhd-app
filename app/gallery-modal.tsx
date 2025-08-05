import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRefreshHistory, useRestorationHistory } from '@/hooks/useRestorationHistory';
import { photoStorage } from '@/services/storage';
import { localStorageHelpers } from '@/services/supabase';
import { useRestorationStore } from '@/store/restorationStore';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  Image as RNImage,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MAX_WIDTH = 500;
const ITEM_HEIGHT = 140; // Height of each grid item including padding

// Responsive columns: 3 for phones, 4-6 for tablets
const getNumColumns = () => {
  if (SCREEN_WIDTH < 768) return 3; // Phones
  if (SCREEN_WIDTH < 1024) return 4; // Small tablets
  return 6; // Large tablets
};

const NUM_COLUMNS = getNumColumns();
const GRID_SPACING = 8;
const CONTAINER_PADDING = 16;
const GRID_ITEM_SIZE = Math.floor((SCREEN_WIDTH - CONTAINER_PADDING * 2 - (GRID_SPACING * (NUM_COLUMNS - 1))) / NUM_COLUMNS);

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function GalleryModalScreen() {
  const router = useRouter();
  const refreshHistory = useRefreshHistory();
  const galleryViewMode = useRestorationStore((state) => state.galleryViewMode);
  const toggleGalleryViewMode = useRestorationStore((state) => state.toggleGalleryViewMode);
  
  // Use the React Query hook for data management
  const { data: restorationHistory, isLoading: loading } = useRestorationHistory(true);
  
  // Convert RestorationHistoryItem[] to match the existing interface
  // Note: restorationHistory is already validated in the hook
  const restorations = restorationHistory?.map(item => ({
    id: item.id,
    user_id: 'anonymous',
    original_filename: item.original_filename,
    restored_filename: item.restored_filename || undefined,
    thumbnail_filename: item.thumbnail_filename || undefined,
    status: item.status as 'completed',
    created_at: item.createdAt.toISOString(),
    function_type: item.function_type as 'restoration' | 'unblur' | 'colorize' | 'descratch' | undefined,
  })) || [];
  
  // Refresh on mount and cleanup orphaned records
  useEffect(() => {
    if (__DEV__) {
      console.log('🔄 Gallery Modal: Refreshing history on mount');
    }
    
    // Clean up orphaned records in the background
    localStorageHelpers.cleanupOrphanedRecords().then((cleanedCount) => {
      if (cleanedCount > 0) {
        // Only refresh if cleanup actually removed records
        refreshHistory();
      } else {
        // Otherwise, just refresh once
        refreshHistory();
      }
    }).catch(() => {
      // Fallback if cleanup fails
      refreshHistory();
    });
  }, []);
  
  // Debug restorations
  useEffect(() => {
    console.log('📸 Gallery Modal: Restorations loaded:', {
      count: restorations.length,
      loading,
      hasData: !!restorationHistory,
      items: restorations.slice(0, 3) // First 3 items for debugging
    });
  }, [restorations, loading]);

  // Group restorations by date
  const grouped = restorations.reduce((acc, item) => {
    const date = formatDate(item.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, typeof restorations[0][]>);

  const sections = Object.keys(grouped).map(date => ({
    title: date,
    data: grouped[date],
  })).filter(section => section.data.length > 0);

  const renderItem = ({ item }: { item: typeof restorations[0] }) => {
    let thumbnailUri = undefined;
    try {
      thumbnailUri = item.thumbnail_filename
        ? photoStorage.getPhotoUri('thumbnail', item.thumbnail_filename)
        : undefined;
    } catch (err) {
      // Silently handle missing files
    }
    return (
      <TouchableOpacity
        style={[styles.card, { maxWidth: CARD_MAX_WIDTH, width: SCREEN_WIDTH - 32 }]}
        onPress={() => {
          // Dismiss the modal first, then navigate
          router.dismiss();
          setTimeout(() => {
            router.push(`/restoration/${item.id}`);
          }, 100);
        }}
        activeOpacity={0.7}
      >
        {thumbnailUri && (
          <View style={styles.thumbnail}>
            {/* Blurred background image */}
            <RNImage
              source={{ uri: thumbnailUri }}
              style={[styles.thumbnail, styles.thumbnailBackground]}
              resizeMode="cover"
              blurRadius={15}
            />
            {/* Main contained image on top */}
            <RNImage
              source={{ uri: thumbnailUri }}
              style={[styles.thumbnail, styles.thumbnailForeground]}
              resizeMode="contain"
            />
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.function_type === 'unblur' ? 'Unblurred' : 
             item.function_type === 'colorize' ? 'Colorized' : 
             item.function_type === 'descratch' ? 'Descratched' : 'Auto Restored'}
          </Text>
          <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <IconSymbol name="chevron.right" size={22} color="#bbb" style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  // Custom section header: centered date with lines
  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionHeaderLine} />
      <Text style={styles.sectionHeaderText}>{`  ${section.title}  `}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading your restorations...</Text>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!loading && restorations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <IconSymbol name="photo" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Restorations Yet</Text>
          <Text style={styles.emptyText}>Your restored photos will appear here</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={async () => {
              try {
                // Dismiss gallery modal BEFORE opening image picker
                router.dismiss();
                
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  allowsEditing: false,
                  quality: 1,
                });

                if (!result.canceled && result.assets[0]) {
                  const imageUri = result.assets[0].uri;
                  router.push(`/crop-modal?imageUri=${encodeURIComponent(imageUri)}&functionType=restoration&imageSource=gallery`);
                }
              } catch (error) {
                console.error('Error picking image:', error);
              }
            }}
          >
            <Text style={styles.emptyButtonText}>Start Restoring</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Animated.View entering={FadeIn} style={styles.modalContent}>
        {/* Modern, organized header row */}
        <View style={styles.newHeaderRow}>
          {/* Left section with toggle button */}
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={styles.singleToggleButton}
              onPress={toggleGalleryViewMode}
              accessibilityLabel={galleryViewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              activeOpacity={0.8}
            >
              <IconSymbol
                name={galleryViewMode === 'grid' ? 'list.bullet' : 'square.grid.2x2'}
                size={22}
                color={'#f97316'}
              />
            </TouchableOpacity>
          </View>
          
          {/* Center section with title */}
          <View style={styles.headerCenterSection}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">My Restorations</Text>
          </View>
          
          {/* Right section with badge and close */}
          <View style={styles.headerSection}>
            <View style={styles.restoredBadge}>
              <IconSymbol name="photo" size={18} color="#888" />
              <Text style={styles.restoredBadgeText}>{restorations.length}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButtonNew}
              onPress={() => router.dismiss()}
              accessibilityLabel="Close gallery"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconSymbol name="chevron.down" size={22} color="#888" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Remove old header and toggle row */}
        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="photo" size={64} color="#bbb" />
            <Text style={styles.emptyTitle}>No Images Yet</Text>
            <Text style={styles.emptySubtitle}>Your generated images will appear here.</Text>
          </View>
        ) : galleryViewMode === 'grid' ? (
          <View style={styles.gridContainer}>
            <FlatList
              data={restorations}
              key={'grid'}
              numColumns={NUM_COLUMNS}
              keyExtractor={item => item.id}
              columnWrapperStyle={NUM_COLUMNS > 1 ? styles.gridRow : undefined}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={12}
              getItemLayout={(data, index) => ({
                length: ITEM_HEIGHT,
                offset: ITEM_HEIGHT * Math.floor(index / NUM_COLUMNS),
                index,
              })}
              updateCellsBatchingPeriod={50}
              disableVirtualization={false}
              renderItem={({ item, index }) => {
                let thumbnailUri = undefined;
                try {
                  thumbnailUri = item.thumbnail_filename
                    ? photoStorage.getPhotoUri('thumbnail', item.thumbnail_filename)
                    : undefined;
                } catch (err) {
                  // Silently handle missing files
                }
                // Remove right margin from last item in each row
                const isLastInRow = (index + 1) % NUM_COLUMNS === 0;
                return (
                  <TouchableOpacity
                    style={[styles.gridItem, isLastInRow && { marginRight: 0 }]}
                    onPress={() => {
          // Dismiss the modal first, then navigate
          router.dismiss();
          setTimeout(() => {
            router.push(`/restoration/${item.id}`);
          }, 100);
        }}
                    activeOpacity={0.7}
                  >
                    {thumbnailUri && (
                      <>
                        {/* Blurred background image */}
                        <RNImage
                          source={{ uri: thumbnailUri }}
                          style={[styles.gridImage, styles.gridImageBackground]}
                          resizeMode="cover"
                          blurRadius={20}
                        />
                        {/* Main contained image on top */}
                        <RNImage
                          source={{ uri: thumbnailUri }}
                          style={[styles.gridImage, styles.gridImageForeground]}
                          resizeMode="contain"
                        />
                      </>
                    )}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.gridContentContainer}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <View style={{ flex: 1, marginBottom: -34 }}>
            <SectionList
              sections={sections}
              key={'list'}
              keyExtractor={item => item.id}
              renderSectionHeader={renderSectionHeader}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 0, paddingTop: 0 }}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={8}
              updateCellsBatchingPeriod={50}
            />
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    paddingTop: 0,
  },
  modalContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 0,
    paddingHorizontal: 0,
    backgroundColor: '#f5f6fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    minWidth: 0,
  },
  headerSide: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  photoCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  photoCountText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 6,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    alignSelf: 'center',
    minHeight: 110,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 14,
    marginRight: 16,
    backgroundColor: '#eee',
    overflow: 'hidden',
  },
  thumbnailBackground: {
    position: 'absolute',
    opacity: 0.4,
    marginRight: 0,
  },
  thumbnailForeground: {
    position: 'relative',
    backgroundColor: 'transparent',
    marginRight: 0,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
    minWidth: 0,
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 0,
    letterSpacing: 0.1,
  },
  chevron: {
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#888',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#888',
    marginTop: 32,
    textAlign: 'center',
  },
  headerLeftButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 56,
    backgroundColor: '#f5f6fa',
    width: '100%',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  newHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginHorizontal: 8,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  headerCenterSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },
  restoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 2,
    height: 36,
  },
  restoredBadgeText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '600',
    marginLeft: 4,
  },
  closeButtonNew: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginLeft: 2,
    zIndex: 10,
  },
  singleToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    zIndex: 20,
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: CONTAINER_PADDING,
    marginBottom: -34, // Extend into safe area
  },
  gridContentContainer: {
    paddingBottom: 0,
    paddingTop: 8,
  },
  gridRow: {
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: Math.floor(GRID_ITEM_SIZE * 1.4), // Make it 40% taller (rectangle instead of square)
    marginRight: GRID_SPACING,
    marginBottom: GRID_SPACING,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: '#eee',
  },
  gridImageBackground: {
    position: 'absolute',
    opacity: 0.3,
  },
  gridImageForeground: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  toggleRowBelowHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 0,
  },
  segmentedToggleSegment: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  segmentedToggleActive: {
    backgroundColor: '#e0e7ef',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  flexHeaderTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 10,
    width: '100%',
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  sectionHeaderText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 