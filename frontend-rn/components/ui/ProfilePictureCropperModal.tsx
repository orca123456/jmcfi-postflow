import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

interface ProfilePictureCropperModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onSave: (croppedFile: File, previewUrl: string) => Promise<void> | void;
}

const VIEWPORT_SIZE = 340;
const CIRCLE_DIAMETER = 260;
const CIRCLE_RADIUS = CIRCLE_DIAMETER / 2;

export const ProfilePictureCropperModal: React.FC<ProfilePictureCropperModalProps> = ({
  visible,
  imageUri,
  onClose,
  onSave,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<any>(null);

  // Reset transforms whenever a new image is loaded
  useEffect(() => {
    if (visible && imageUri) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setIsProcessing(false);

      if (Platform.OS === 'web') {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          setImageSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
          imgRef.current = img;
        };
        img.src = imageUri;
      }
    }
  }, [visible, imageUri]);

  // Compute base dimensions to fit inside viewport
  const getRenderDimensions = () => {
    if (!imageSize.width || !imageSize.height) {
      return { width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, minScale: 1 };
    }

    // Cover the circle aperture completely at zoom = 1
    const scaleToCoverCircle = Math.max(
      CIRCLE_DIAMETER / imageSize.width,
      CIRCLE_DIAMETER / imageSize.height
    );

    const baseWidth = imageSize.width * scaleToCoverCircle;
    const baseHeight = imageSize.height * scaleToCoverCircle;

    return {
      width: baseWidth,
      height: baseHeight,
      minScale: 1,
    };
  };

  const { width: baseW, height: baseH } = getRenderDimensions();

  // Mouse / Touch handlers for dragging on web
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile web
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(3, Math.max(1, parseFloat((prev + delta).toFixed(2)))));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleCropAndSave = async () => {
    if (!imageUri || !imgRef.current) {
      onClose();
      return;
    }

    setIsProcessing(true);

    try {
      if (Platform.OS === 'web') {
        const OUTPUT_SIZE = 512;
        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setIsProcessing(false);
          onClose();
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Scale ratio from VIEWPORT / CIRCLE to high-res OUTPUT_SIZE
        const outputRatio = OUTPUT_SIZE / CIRCLE_DIAMETER;

        // Center point in canvas
        ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);

        // Apply pan offset mapped to output scale
        ctx.translate(pan.x * outputRatio, pan.y * outputRatio);

        // Apply rotation
        ctx.rotate((rotation * Math.PI) / 180);

        // Apply zoom and draw image centered
        const drawW = baseW * zoom * outputRatio;
        const drawH = baseH * zoom * outputRatio;

        ctx.drawImage(
          imgRef.current,
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH
        );

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              setIsProcessing(false);
              return;
            }

            const croppedFile = new File([blob], `profile-photo-${Date.now()}.jpg`, {
              type: 'image/jpeg',
            });
            const previewUrl = URL.createObjectURL(blob);

            try {
              await onSave(croppedFile, previewUrl);
            } finally {
              setIsProcessing(false);
              onClose();
            }
          },
          'image/jpeg',
          0.92
        );
      } else {
        setIsProcessing(false);
        onClose();
      }
    } catch (err) {
      console.error('Error during profile picture crop:', err);
      setIsProcessing(false);
    }
  };

  if (!visible || !imageUri) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ gap: 2 }}>
              <Text style={styles.modalTitle}>Update Profile Picture</Text>
              <Text style={styles.modalSubtitle}>Drag to reposition or adjust zoom to fit your frame.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={isProcessing}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Interactive Crop Viewport */}
          <View style={styles.viewportOuter}>
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              style={{
                width: VIEWPORT_SIZE,
                height: VIEWPORT_SIZE,
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#0F172A',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Image with transforms */}
              <div
                style={{
                  position: 'absolute',
                  transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <img
                  src={imageUri}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    width: baseW,
                    height: baseH,
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Circular Aperture Overlay (Facebook Style) */}
              <svg
                width={VIEWPORT_SIZE}
                height={VIEWPORT_SIZE}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                }}
              >
                <defs>
                  <mask id="fb-profile-crop-mask">
                    {/* Fill white for full mask */}
                    <rect x="0" y="0" width={VIEWPORT_SIZE} height={VIEWPORT_SIZE} fill="white" />
                    {/* Cut out center circle */}
                    <circle
                      cx={VIEWPORT_SIZE / 2}
                      cy={VIEWPORT_SIZE / 2}
                      r={CIRCLE_RADIUS}
                      fill="black"
                    />
                  </mask>
                </defs>
                {/* Darkened area outside the circular aperture */}
                <rect
                  x="0"
                  y="0"
                  width={VIEWPORT_SIZE}
                  height={VIEWPORT_SIZE}
                  fill="rgba(15, 23, 42, 0.65)"
                  mask="url(#fb-profile-crop-mask)"
                />
                {/* Crisp circular boundary guide */}
                <circle
                  cx={VIEWPORT_SIZE / 2}
                  cy={VIEWPORT_SIZE / 2}
                  r={CIRCLE_RADIUS}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              </svg>

              {/* Pan Hint Overlay in Center */}
              {zoom === 1 && pan.x === 0 && pan.y === 0 && !isDragging && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 14,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#FFFFFF',
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    pointerEvents: 'none',
                  }}
                >
                  <Ionicons name="move" size={13} color="#FFFFFF" />
                  Drag to frame
                </div>
              )}
            </div>
          </View>

          {/* Controls: Zoom & Rotate Bar */}
          <View style={styles.controlsContainer}>
            {/* Zoom Slider */}
            <View style={styles.zoomRow}>
              <TouchableOpacity
                onPress={() => setZoom((prev) => Math.max(1, parseFloat((prev - 0.1).toFixed(2))))}
                style={styles.zoomIconBtn}
                disabled={zoom <= 1}
              >
                <Ionicons name="remove-outline" size={18} color={zoom <= 1 ? '#94A3B8' : '#334155'} />
              </TouchableOpacity>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: '#4F46E5',
                    cursor: 'pointer',
                    height: 5,
                  }}
                />
              </div>

              <TouchableOpacity
                onPress={() => setZoom((prev) => Math.min(3, parseFloat((prev + 0.1).toFixed(2))))}
                style={styles.zoomIconBtn}
                disabled={zoom >= 3}
              >
                <Ionicons name="add-outline" size={18} color={zoom >= 3 ? '#94A3B8' : '#334155'} />
              </TouchableOpacity>

              <Text style={styles.zoomPercentText}>{Math.round(zoom * 100)}%</Text>
            </View>

            {/* Additional Actions: Rotate & Reset */}
            <View style={styles.auxRow}>
              <TouchableOpacity onPress={handleRotate} style={styles.auxBtn}>
                <Ionicons name="reload" size={15} color="#4F46E5" />
                <Text style={styles.auxBtnText}>Rotate 90°</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleReset} style={styles.auxBtn}>
                <Ionicons name="refresh-outline" size={15} color="#64748B" />
                <Text style={[styles.auxBtnText, { color: '#64748B' }]}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelBtn}
              disabled={isProcessing}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCropAndSave}
              style={[styles.saveBtn, isProcessing && { opacity: 0.7 }]}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Saving...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Profile Picture</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 999999,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewportOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  zoomIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    minWidth: 42,
    textAlign: 'right',
  },
  auxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 2,
  },
  auxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  auxBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
