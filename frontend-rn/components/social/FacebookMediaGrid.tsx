import React, { useState, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, Platform, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { resolveImageUrl } from '../../services/api';

export const isImageMedia = (file: any): boolean => {
  if (!file) return false;
  const mimeType = String(file?.mimeType || file?.type || file?.file?.type || file?.mime_type || '').toLowerCase();
  if (mimeType === 'image' || mimeType.startsWith('image/')) return true;
  const name = String(file?.name || file?.filename || file?.original_name || file?.original_filename || file?.uri || file?.url || file?.file_path || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|avif|heic|jfif)$/i.test(name.split('?')[0]);
};

export const getImageUrisFromMedia = (mediaList: any[]): string[] => {
  if (!Array.isArray(mediaList)) return [];
  return mediaList
    .filter(isImageMedia)
    .map((m: any) => resolveImageUrl(m?.url || m?.file_url || m?.file_path || m?.uri) || m?.uri || m?.url)
    .filter((uri: any): uri is string => typeof uri === 'string' && uri.trim().length > 0);
};

interface FacebookMediaGridProps {
  images: string[];
  onImagePress?: (uri: string, index: number) => void;
  containerStyle?: any;
}

export const FacebookMediaGrid: React.FC<FacebookMediaGridProps> = ({
  images = [],
  onImagePress,
  containerStyle,
}) => {
  const validImages = images.filter((img) => typeof img === 'string' && img.trim().length > 0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || lightboxIndex === null) return;
    const handleKeyDown = (e: any) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight' && validImages.length > 1) {
        setLightboxIndex((prev) => (prev !== null ? (prev + 1) % validImages.length : 0));
      } else if (e.key === 'ArrowLeft' && validImages.length > 1) {
        setLightboxIndex((prev) => (prev !== null ? (prev - 1 + validImages.length) % validImages.length : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, validImages.length]);

  if (validImages.length === 0) {
    return (
      <View style={[styles.placeholderContainer, containerStyle]}>
        <Ionicons name="image-outline" size={36} color={Colors.textMuted} />
        <Text style={styles.placeholderText}>No images to preview</Text>
      </View>
    );
  }

  const extraCount = Math.max(0, validImages.length - 5);

  const handlePress = (index: number) => {
    // If clicking the 5th tile when +N extra images exist, open directly to the 6th (+1) hidden image
    const targetIndex = index === 4 && extraCount > 0 ? 5 : index;
    setLightboxIndex(targetIndex);
  };

  const renderLightboxModal = () => {
    if (lightboxIndex === null || !validImages[lightboxIndex]) return null;
    const total = validImages.length;
    const currentUri = validImages[lightboxIndex];

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={true}
        onRequestClose={() => setLightboxIndex(null)}
      >
        <View style={styles.lightboxBackdrop}>
          {/* Top Bar: Counter + Close Button */}
          <View style={styles.lightboxHeader}>
            <View style={styles.lightboxCounterPill}>
              <Text style={styles.lightboxCounterText}>
                {lightboxIndex + 1} / {total}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.lightboxCloseBtn, styles.pointerCursor]}
              onPress={() => setLightboxIndex(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Main Image Area with Prev / Next Controls */}
          <View style={styles.lightboxMainArea}>
            {total > 1 && (
              <TouchableOpacity
                style={[styles.lightboxNavBtn, styles.lightboxPrevBtn, styles.pointerCursor]}
                onPress={() => setLightboxIndex((lightboxIndex - 1 + total) % total)}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            <Image
              source={{ uri: currentUri }}
              style={styles.lightboxMainImage}
              resizeMode="contain"
            />

            {total > 1 && (
              <TouchableOpacity
                style={[styles.lightboxNavBtn, styles.lightboxNextBtn, styles.pointerCursor]}
                onPress={() => setLightboxIndex((lightboxIndex + 1) % total)}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom Thumbnail Strip for Multi-Photo Posts */}
          {total > 1 && (
            <View style={styles.lightboxThumbBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.lightboxThumbScroll}
              >
                {validImages.map((imgUri, idx) => {
                  const isActive = idx === lightboxIndex;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setLightboxIndex(idx)}
                      activeOpacity={0.85}
                      style={[
                        styles.lightboxThumbItem,
                        isActive && styles.lightboxThumbItemActive,
                        styles.pointerCursor,
                      ]}
                    >
                      <Image source={{ uri: imgUri }} style={styles.fullImage} resizeMode="cover" />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // 1 Image: Full width, 4:3 aspect ratio
  if (validImages.length === 1) {
    return (
      <>
        <View style={[styles.mainWrapper, containerStyle]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(0)}
            style={[styles.singleImageContainer, { cursor: 'pointer' as any }]}
          >
            <Image source={{ uri: validImages[0] }} style={styles.fullImage} resizeMode="cover" />
          </TouchableOpacity>
        </View>
        {renderLightboxModal()}
      </>
    );
  }

  // 2 Images: Side-by-side 50% split
  if (validImages.length === 2) {
    return (
      <>
        <View style={[styles.mainWrapper, styles.fixedHeightContainer, containerStyle]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(0)}
            style={[styles.flexOne, styles.pointerCursor, { marginRight: 2 }]}
          >
            <Image source={{ uri: validImages[0] }} style={styles.fullImage} resizeMode="cover" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(1)}
            style={[styles.flexOne, styles.pointerCursor, { marginLeft: 2 }]}
          >
            <Image source={{ uri: validImages[1] }} style={styles.fullImage} resizeMode="cover" />
          </TouchableOpacity>
        </View>
        {renderLightboxModal()}
      </>
    );
  }

  // 3 Images: 1 large left, 2 stacked right
  if (validImages.length === 3) {
    return (
      <>
        <View style={[styles.mainWrapper, styles.fixedHeightContainer, containerStyle]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(0)}
            style={[styles.flexTwo, styles.pointerCursor, { marginRight: 2 }]}
          >
            <Image source={{ uri: validImages[0] }} style={styles.fullImage} resizeMode="cover" />
          </TouchableOpacity>
          <View style={[styles.flexOne, { marginLeft: 2, gap: 3 }]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handlePress(1)}
              style={[styles.flexOne, styles.pointerCursor]}
            >
              <Image source={{ uri: validImages[1] }} style={styles.fullImage} resizeMode="cover" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handlePress(2)}
              style={[styles.flexOne, styles.pointerCursor]}
            >
              <Image source={{ uri: validImages[2] }} style={styles.fullImage} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        </View>
        {renderLightboxModal()}
      </>
    );
  }

  // 4 Images: 2x2 symmetrical grid
  if (validImages.length === 4) {
    return (
      <>
        <View style={[styles.mainWrapper, styles.tallHeightContainer, containerStyle, { gap: 3 }]}>
          <View style={[styles.row, { gap: 3 }]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handlePress(0)}
              style={[styles.flexOne, styles.pointerCursor]}
            >
              <Image source={{ uri: validImages[0] }} style={styles.fullImage} resizeMode="cover" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handlePress(1)}
              style={[styles.flexOne, styles.pointerCursor]}
            >
              <Image source={{ uri: validImages[1] }} style={styles.fullImage} resizeMode="cover" />
            </TouchableOpacity>
          </View>
          <View style={[styles.row, { gap: 3 }]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handlePress(2)}
              style={[styles.flexOne, styles.pointerCursor]}
            >
              <Image source={{ uri: validImages[2] }} style={styles.fullImage} resizeMode="cover" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handlePress(3)}
              style={[styles.flexOne, styles.pointerCursor]}
            >
              <Image source={{ uri: validImages[3] }} style={styles.fullImage} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        </View>
        {renderLightboxModal()}
      </>
    );
  }

  // 5+ Images: 2 on top row, 3 on bottom row with +N badge overlay on the 5th image when > 5 images

  return (
    <>
      <View style={[styles.mainWrapper, styles.tallHeightContainer, containerStyle, { gap: 3 }]}>
        {/* Top Row: 2 images */}
        <View style={[styles.row, { flex: 1.2, gap: 3 }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(0)}
            style={[styles.flexOne, styles.pointerCursor]}
          >
            <Image source={{ uri: validImages[0] }} style={styles.fullImage} resizeMode="cover" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(1)}
            style={[styles.flexOne, styles.pointerCursor]}
          >
            <Image source={{ uri: validImages[1] }} style={styles.fullImage} resizeMode="cover" />
          </TouchableOpacity>
        </View>

        {/* Bottom Row: 3 images, 3rd has +N overlay when more than 5 images exist */}
        <View style={[styles.row, { flex: 1, gap: 3 }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(2)}
            style={[styles.flexOne, styles.pointerCursor]}
          >
            <Image source={{ uri: validImages[2] }} style={styles.fullImage} resizeMode="cover" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(3)}
            style={[styles.flexOne, styles.pointerCursor]}
          >
            <Image source={{ uri: validImages[3] }} style={styles.fullImage} resizeMode="cover" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(4)}
            style={[styles.flexOne, styles.pointerCursor, { position: 'relative' }]}
          >
            <Image source={{ uri: validImages[4] }} style={styles.fullImage} resizeMode="cover" />
            {extraCount > 0 && (
              <View style={styles.moreOverlay}>
                <Text style={styles.moreOverlayText}>+{extraCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {renderLightboxModal()}
    </>
  );
};

const styles = StyleSheet.create({
  mainWrapper: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  singleImageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  fixedHeightContainer: {
    height: 240,
    flexDirection: 'row',
  },
  tallHeightContainer: {
    height: 280,
    flexDirection: 'column',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  flexOne: {
    flex: 1,
    height: '100%',
  },
  flexTwo: {
    flex: 2,
    height: '100%',
  },
  pointerCursor: {
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as any,
  fullImage: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreOverlayText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  placeholderContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    aspectRatio: 4 / 3,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textMuted,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  lightboxHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    zIndex: 20,
  },
  lightboxCounterPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  lightboxCounterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  lightboxCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxMainArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 64,
    marginVertical: 12,
  },
  lightboxMainImage: {
    width: '100%',
    height: '100%',
  },
  lightboxNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
  },
  lightboxPrevBtn: {
    left: 16,
  },
  lightboxNextBtn: {
    right: 16,
  },
  lightboxThumbBar: {
    width: '100%',
    maxHeight: 76,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxThumbScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  lightboxThumbItem: {
    width: 60,
    height: 60,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    opacity: 0.6,
  },
  lightboxThumbItemActive: {
    borderColor: '#FFFFFF',
    opacity: 1,
  },
});
