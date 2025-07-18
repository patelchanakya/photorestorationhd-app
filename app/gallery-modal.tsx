import { IconSymbol } from '@/components/ui/IconSymbol';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { Restoration } from '@/types';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

const NUM_COLUMNS = 3;
const GRID_SPACING = 8;
const GRID_ITEM_SIZE = Math.floor((SCREEN_WIDTH - (GRID_SPACING * (NUM_COLUMNS + 1))) / NUM_COLUMNS);

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function GalleryModalScreen() {
  const [restorations, setRestorations] = useState<Restoration[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridView, setGridView] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadRestorations();
  }, []);

  // Debug: Log restorations before rendering
  useEffect(() => {
    console.log('restorations:', restorations);
  }, [restorations]);

  const loadRestorations = async () => {
    setLoading(true);
    try {
      const data = await restorationService.getUserRestorations('anonymous');
      setRestorations(data.filter(r => r.status === 'completed'));
    } catch (err) {
      console.error('[GalleryModal] Failed to load restorations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group restorations by date
  let grouped = {} as Record<string, Restoration[]>;
  try {
    grouped = restorations.reduce((acc, item) => {
      const date = formatDate(item.created_at);
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    }, {} as Record<string, Restoration[]>);
  } catch (err) {
    console.error('[GalleryModal] Error grouping restorations:', err);
  }

  let sections = [] as { title: string; data: Restoration[] }[];
  try {
    sections = Object.keys(grouped).map(date => ({
      title: date,
      data: grouped[date],
    })).filter(section => section.data.length > 0);
  } catch (err) {
    console.error('[GalleryModal] Error creating sections:', err);
  }

  const renderItem = ({ item }: { item: Restoration }) => {
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
        onPress={() => router.push(`/gallery-image/${item.id}`)}
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
          <Text style={styles.cardTitle} numberOfLines={1}>{item.function_type === 'unblur' ? 'Unblurred' : 'Restored'}</Text>
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
          {/* Left: Single grid/list toggle button */}
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
          {/* Center: Title (absolutely centered, visually aligned) */}
          <Text style={styles.absoluteHeaderTitle} numberOfLines={1} ellipsizeMode="tail">My Restorations</Text>
          {/* Right: Restored photo badge and Close */}
          <View style={styles.headerRightGroup}>
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
          <FlatList
            data={restorations}
            key={'grid'}
            numColumns={NUM_COLUMNS}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              let thumbnailUri = undefined;
              try {
                thumbnailUri = item.thumbnail_filename
                  ? photoStorage.getPhotoUri('thumbnail', item.thumbnail_filename)
                  : undefined;
              } catch (err) {
                console.error('[GalleryModal] Error getting image URIs for item:', item, err);
              }
              // Debug: Log thumbnailUri and item
              console.log('thumbnailUri:', thumbnailUri, 'item:', item);
              return (
                <TouchableOpacity
                  style={styles.gridItem}
                  onPress={() => router.push(`/gallery-image/${item.id}`)}
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
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          />
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
    alignItems: 'center',
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
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  headerSide: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 56,
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
    gap: 0,
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
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE + 40,
    marginLeft: GRID_SPACING,
    marginTop: GRID_SPACING,
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
  absoluteHeaderTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    zIndex: 1,
    top: 26,
    transform: [{ translateY: -10 }],
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