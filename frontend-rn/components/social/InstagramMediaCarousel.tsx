import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

interface InstagramMediaCarouselProps {
  images: string[];
  onImagePress?: (uri: string, index: number) => void;
  containerStyle?: any;
  aspectRatio?: number;
}

export const InstagramMediaCarousel: React.FC<InstagramMediaCarouselProps> = ({
  images = [],
  onImagePress,
  containerStyle,
  aspectRatio = 1,
}) => {
  const validImages = images.filter((img) => typeof img === 'string' && img.trim().length > 0);
  const [currentIndex, setCurrentIndex] = useState(0);

  // If index is out of bounds due to deletion, wrap it
  const activeIndex = currentIndex >= validImages.length ? Math.max(0, validImages.length - 1) : currentIndex;

  if (validImages.length === 0) {
    return (
      <View style={[styles.placeholderContainer, { aspectRatio }, containerStyle]}>
        <Ionicons name="image-outline" size={36} color={Colors.textMuted} />
        <Text style={styles.placeholderText}>Upload media to preview</Text>
      </View>
    );
  }

  const handlePrev = (e: any) => {
    e?.stopPropagation?.();
    if (activeIndex > 0) {
      setCurrentIndex(activeIndex - 1);
    }
  };

  const handleNext = (e: any) => {
    e?.stopPropagation?.();
    if (activeIndex < validImages.length - 1) {
      setCurrentIndex(activeIndex + 1);
    }
  };

  const handleDotPress = (index: number, e: any) => {
    e?.stopPropagation?.();
    setCurrentIndex(index);
  };

  const handleImagePress = () => {
    if (onImagePress) {
      onImagePress(validImages[activeIndex], activeIndex);
    }
  };

  const isMultiple = validImages.length > 1;

  return (
    <View style={[styles.container, { aspectRatio }, containerStyle]}>
      {/* Current Active Image */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={handleImagePress}
        style={[styles.imageTouchable, { cursor: 'pointer' as any }]}
      >
        <Image
          source={{ uri: validImages[activeIndex] }}
          style={styles.image}
          resizeMode="cover"
        />
      </TouchableOpacity>

      {/* Multiple Photos Indicator Pill (Top Right) */}
      {isMultiple && (
        <View style={styles.counterBadge}>
          <Text style={styles.counterBadgeText}>
            {activeIndex + 1}/{validImages.length}
          </Text>
        </View>
      )}

      {/* Navigation Arrows for Web/Desktop */}
      {isMultiple && activeIndex > 0 && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePrev}
          style={[styles.navButton, styles.prevButton, { cursor: 'pointer' as any }]}
        >
          <Ionicons name="chevron-back" size={16} color="#262626" />
        </TouchableOpacity>
      )}

      {isMultiple && activeIndex < validImages.length - 1 && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleNext}
          style={[styles.navButton, styles.nextButton, { cursor: 'pointer' as any }]}
        >
          <Ionicons name="chevron-forward" size={16} color="#262626" />
        </TouchableOpacity>
      )}

      {/* Pagination Dots at Bottom */}
      {isMultiple && (
        <View style={styles.dotsContainer}>
          {validImages.map((_, idx) => {
            const isActive = idx === activeIndex;
            return (
              <TouchableOpacity
                key={idx}
                onPress={(e) => handleDotPress(idx, e)}
                activeOpacity={0.8}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                  { cursor: 'pointer' as any },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  imageTouchable: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  counterBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(18, 18, 18, 0.72)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 15,
  },
  counterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  prevButton: {
    left: 10,
  },
  nextButton: {
    right: 10,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 15,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#0095F6',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  placeholderContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
