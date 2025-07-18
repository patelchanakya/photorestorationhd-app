import { IconSymbol } from '@/components/ui/IconSymbol';
import { photoStorage } from '@/services/storage';
import { useRestorationHistory, useRefreshHistory } from '@/hooks/useRestorationHistory';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
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
  const [gridView, setGridView] = useState(false);
  const router = useRouter();
  const refreshHistory = useRefreshHistory();
  
  // Use the React Query hook for data management
  const { data: restorationHistory, isLoading: loading } = useRestorationHistory(true);
  
  // Convert RestorationHistoryItem[] to match the existing interface
  const restorations = restorationHistory?.map(item => ({
    id: item.id,
    user_id: 'anonymous',
    original_filename: item.original_filename,
    restored_filename: item.restored_filename || undefined,
    thumbnail_filename: item.thumbnail_filename || undefined,
    status: item.status as 'completed',
    created_at: item.createdAt.toISOString(),
    function_type: item.function_type as 'restoration' | 'unblur' | 'colorize' | undefined,
  })) || [];
  
  // Refresh on mount to ensure we have latest data
  useEffect(() => {
    console.log('🔄 Gallery Modal: Refreshing history on mount');
    refreshHistory();
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
      console.error('[GalleryModal] Error getting image URIs for item:', item, err);
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
          <RNImage
            source={{ uri: thumbnailUri }}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={e => console.error('[GalleryModal] Image load error:', e.nativeEvent)}
          />
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.function_type === 'unblur' ? 'Unblurred' : 
             item.function_type === 'colorize' ? 'Colorized' : 'Restored'}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>{item.original_filename}</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.modalContent}>
        {/* Modern, organized header row */}
        <View style={styles.newHeaderRow}>
          {/* Left section with toggle button */}
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={styles.singleToggleButton}
              onPress={() => setGridView(g => !g)}
              accessibilityLabel={gridView ? 'Switch to list view' : 'Switch to grid view'}
              activeOpacity={0.8}
            >
              <IconSymbol
                name={gridView ? 'list.bullet' : 'square.grid.2x2'}
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
              <IconSymbol name="xmark" size={22} color="#888" />
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
        ) : gridView ? (
          <View style={styles.gridContainer}>
            <FlatList
              data={restorations}
              key={'grid'}
              numColumns={NUM_COLUMNS}
              keyExtractor={item => item.id}
              columnWrapperStyle={NUM_COLUMNS > 1 ? styles.gridRow : undefined}
              renderItem={({ item, index }) => {
                let thumbnailUri = undefined;
                try {
                  thumbnailUri = item.thumbnail_filename
                    ? photoStorage.getPhotoUri('thumbnail', item.thumbnail_filename)
                    : undefined;
                } catch (err) {
                  console.error('[GalleryModal] Error getting image URIs for item:', item, err);
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
                      <RNImage
                        source={{ uri: thumbnailUri }}
                        style={styles.gridImage}
                        resizeMode="cover"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.gridContentContainer}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <SectionList
            sections={sections}
            key={'list'}
            keyExtractor={item => item.id}
            renderSectionHeader={renderSectionHeader}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 32, paddingTop: 0 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    paddingTop: Platform.OS === 'android' ? 32 : 0,
  },
  modalContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 8,
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
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    minWidth: 0,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 0,
    minWidth: 0,
    maxWidth: '100%',
    letterSpacing: 0.1,
    lineHeight: 17,
    marginBottom: 1,
  },
  cardDate: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
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
  },
  gridContentContainer: {
    paddingBottom: 32,
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
}); 