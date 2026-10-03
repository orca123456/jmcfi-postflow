import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { resolveImageUrl } from '../../services/api';

export const isImageMedia = (file: any): boolean => {
  if (!file) return false;
  if (file.type === 'image' || file.mime_type?.startsWith('image/')) return true;
  const name = (file.name || file.filename || file.original_filename || file.uri || file.url || file.file_path || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp)$/i.test(name.split('?')[0]);
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

  if (validImages.length === 0) {
    return (
      <View style={[styles.placeholderContainer, containerStyle]}>
        <Ionicons name="image-outline" size={36} color={Colors.textMuted} />
        <Text style={styles.placeholderText}>No images to preview</Text>
      </View>
    );
  }

  const handlePress = (index: number) => {
    if (onImagePress) {
      onImagePress(validImages[index], index);
    }
  };

  // 1 Image: Full width, 4:3 aspect ratio
  if (validImages.length === 1) {
    return (
      <View style={[styles.mainWrapper, containerStyle]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(0)}
          style={[styles.singleImageContainer, { cursor: 'pointer' as any }]}
        >
          <Image source={{ uri: validImages[0] }} style={styles.fullImage} resizeMode="cover" />
        </TouchableOpacity>
      </View>
    );
  }

  // 2 Images: Side-by-side 50% split
  if (validImages.length === 2) {
    return (
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
    );
  }

  // 3 Images: 1 large left, 2 stacked right
  if (validImages.length === 3) {
    return (
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
    );
  }

  // 4 Images: 2x2 symmetrical grid
  if (validImages.length === 4) {
    return (
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
    );
  }

  // 5+ Images: 2 on top row, 3 on bottom row with +N badge overlay on the 5th image
  const extraCount = validImages.length - 4;

  return (
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

      {/* Bottom Row: 3 images, 3rd has +N overlay */}
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
});
