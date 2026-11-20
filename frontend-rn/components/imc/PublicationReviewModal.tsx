import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { postsApi, resolveImageUrl } from '../../services/api';
import { useThemeStore } from '../../store/theme';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { dashboardStyles, dashboardUi } from '../ui/dashboardDesign';
import { FacebookMediaGrid, isImageMedia } from '../social/FacebookMediaGrid';
import { InstagramMediaCarousel } from '../social/InstagramMediaCarousel';

const BRAND_PURPLE = '#4C007C';

export interface FinalUploadedImage {
  uri: string;
  name: string;
  file?: any;
}

export interface Photo {
  uri: string;
  name: string;
}

export const isDirectImcRequest = (request: any): boolean =>
  String(
    request?.routing_type ?? request?.routingType ??
    request?.rawPost?.routing_type ?? request?.rawPost?.routingType ?? ''
  ).trim().toLowerCase() === 'direct_imc';

export interface PublicationReviewModalProps {
  visible: boolean;
  request: any;
  onClose: () => void;
  onPublish: (finalCaption: string, finalImages: FinalUploadedImage[]) => Promise<void> | void;
  onReject: (request: any) => void;
  onDraftSaved?: (savedPost?: any) => void;
  isPublishing?: boolean;
}

const textValue = (value: any): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return value && typeof value === 'object'
    ? textValue(value.full_name ?? value.name ?? value.title ?? value.label)
    : '';
};

const formatDate = (value: any): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

const photosFrom = (media: any): Photo[] => Array.isArray(media)
  ? media.filter(isImageMedia).flatMap((item: any) => {
    const path = item.url || item.file_url || item.uri || item.file_path;
    const uri = resolveImageUrl(path) || path;
    if (typeof uri !== 'string' || !uri.trim()) return [];
    let name = textValue(item.original_filename || item.original_name || item.filename || item.name);
    if (!name) {
      try { name = decodeURIComponent(uri.split('?')[0].split('/').pop() || ''); } catch { /* fallback */ }
    }
    return [{ uri, name: name || 'Image attachment' }];
  }) : [];

const platformsFrom = (raw: any): { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }[] => {
  const result: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }[] = [];
  const add = (label: string, icon: keyof typeof Ionicons.glyphMap, color: string, bg: string) => {
    if (!result.some((p) => p.label === label)) result.push({ label, icon, color, bg });
  };
  const list = raw?.platforms ?? raw?.target_platforms ?? raw?.targetPlatforms ?? [];
  const arr = Array.isArray(list) ? list : typeof list === 'string' ? list.split(',').map((s: string) => s.trim()) : [];
  arr.forEach((p: any) => {
    const text = (typeof p === 'string' ? p : p?.name ?? p?.platform ?? p?.platform_name ?? '').toLowerCase();
    if (text.includes('facebook') || text.includes('fb')) add('Facebook', 'logo-facebook', '#1877F2', '#EFF6FF');
    if (text.includes('instagram') || text.includes('ig')) add('Instagram', 'logo-instagram', '#E1306C', '#FDF2F8');
    if (text.includes('web') || text.includes('site') || text.includes('portal')) add('Website', 'globe-outline', '#059669', '#ECFDF5');
  });
  if (result.length === 0) {
    if (Boolean(raw?.target_facebook ?? raw?.post_to_facebook)) add('Facebook', 'logo-facebook', '#1877F2', '#EFF6FF');
    if (Boolean(raw?.target_instagram ?? raw?.post_to_instagram)) add('Instagram', 'logo-instagram', '#E1306C', '#FDF2F8');
    if (Boolean(raw?.target_website ?? raw?.post_to_website)) add('Website', 'globe-outline', '#059669', '#ECFDF5');
  }
  return result.length > 0 ? result : [
    { label: 'Facebook', icon: 'logo-facebook', color: '#1877F2', bg: '#EFF6FF' },
    { label: 'Instagram', icon: 'logo-instagram', color: '#E1306C', bg: '#FDF2F8' },
    { label: 'Website', icon: 'globe-outline', color: '#059669', bg: '#ECFDF5' },
  ];
};

function RenderedCaption({ value, dark }: { value: string; dark: boolean }) {
  const [width, setWidth] = useState(0);
  if (!value) return null;
  return (
    <View style={styles.captionWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && <RenderHtml
        contentWidth={width}
        source={{ html: value.includes('<') ? value : value.replace(/&/g, '&amp;').replace(/\n/g, '<br />') }}
        baseStyle={{ color: dark ? '#F1F5F9' : Colors.textPrimary, fontSize: 13, lineHeight: 19 }}
        tagsStyles={{ p: { marginTop: 0, marginBottom: 6 }, body: { margin: 0 }, img: { maxWidth: '100%' } }}
        defaultTextProps={{ selectable: true, style: Platform.OS === 'web' ? { overflowWrap: 'anywhere' } as any : undefined }}
      />}
    </View>
  );
}

export const PublicationReviewModal: React.FC<PublicationReviewModalProps> = ({
  visible,
  request,
  onClose,
  onPublish,
  onReject,
  onDraftSaved,
  isPublishing = false,
}) => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  // Form states
  const [finalCaption, setFinalCaption] = useState<string>('');
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [finalImages, setFinalImages] = useState<FinalUploadedImage[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram' | 'website'>('facebook');
  const [websiteActiveIndex, setWebsiteActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [lightboxFailed, setLightboxFailed] = useState(false);
  const [activeMediaFailed, setActiveMediaFailed] = useState(false);
  const [activeMediaLoading, setActiveMediaLoading] = useState(true);

  const openLightbox = (photo: Photo | null, allPhotos?: Photo[], initialIndex?: number) => {
    if (!photo) {
      setLightbox(null);
      return;
    }
    const list = allPhotos && allPhotos.length > 0 ? allPhotos : [photo];
    const idx = initialIndex !== undefined && initialIndex >= 0
      ? initialIndex
      : Math.max(0, list.findIndex((p) => p.uri === photo.uri));
    setLightbox({ photos: list, index: idx });
    setLightboxFailed(false);
  };

  const handleLightboxPrev = () => {
    if (!lightbox || lightbox.photos.length <= 1) return;
    const newIndex = lightbox.index > 0 ? lightbox.index - 1 : lightbox.photos.length - 1;
    setLightbox({ photos: lightbox.photos, index: newIndex });
    setLightboxFailed(false);
  };

  const handleLightboxNext = () => {
    if (!lightbox || lightbox.photos.length <= 1) return;
    const newIndex = lightbox.index < lightbox.photos.length - 1 ? lightbox.index + 1 : 0;
    setLightbox({ photos: lightbox.photos, index: newIndex });
    setLightboxFailed(false);
  };

  const currentLightboxPhoto = lightbox ? (lightbox.photos[lightbox.index] || lightbox.photos[0]) : null;

  const raw = request?.rawPost || request || {};

  // Extract submitted photos
  const submittedPhotos = useMemo<Photo[]>(() => {
    if (!request) return [];
    const snapshot = raw.submitted_materials || request.submitted_materials;
    const hasSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot);
    const media = hasSnapshot && Array.isArray(snapshot.media) && snapshot.media.length > 0
      ? snapshot.media
      : (raw.media || request.media || []);
    const list = photosFrom(media);
    if (list.length > 0) return list;
    if (request.thumbnailUrl) {
      const uri = resolveImageUrl(request.thumbnailUrl) || request.thumbnailUrl;
      return [{ uri, name: 'Attachment 1' }];
    }
    if (request.featured_image) {
      const uri = resolveImageUrl(request.featured_image) || request.featured_image;
      return [{ uri, name: 'Attachment 1' }];
    }
    return [];
  }, [request, raw]);

  // Original caption as submitted by requestor
  const originalCaption = useMemo(() => {
    if (!request) return '';
    const snapshot = raw.submitted_materials || request.submitted_materials;
    const hasSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot);
    if (hasSnapshot && snapshot.caption_narrative) {
      return textValue(snapshot.caption_narrative);
    }
    return textValue(
      raw.original_caption || raw.caption || raw.caption_narrative ||
      request.original_caption || request.caption || request.caption_narrative || ''
    );
  }, [request, raw]);

  // Initialize or reset form whenever request changes
  useEffect(() => {
    if (request) {
      const initialCaption = raw.caption_narrative || raw.caption || request.caption || request.caption_narrative || '';
      setFinalCaption(initialCaption);
      setCarouselIndex(0);
      const snapshot = raw.submitted_materials || request.submitted_materials;
      const hasSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot);
      const activeMedia = raw.media || request.media || [];
      if (hasSnapshot && Array.isArray(activeMedia) && activeMedia.length > 0) {
        setFinalImages(activeMedia.map((m: any, idx: number) => ({
          uri: resolveImageUrl(m.url || m.file_path) || m.url || m.file_path,
          name: m.original_filename || m.original_name || `Replacement Photo ${idx + 1}`,
        })));
      } else {
        setFinalImages([]);
      }
      setLightbox(null);
      setPreviewPlatform('facebook');
      setWebsiteActiveIndex(0);
      setActiveMediaFailed(false);
      setActiveMediaLoading(true);

      if (visible && request.id) {
        // Form initialized for review
      }
    }
  }, [request?.id, visible]);

  useEffect(() => {
    setActiveMediaFailed(false);
    const uri = submittedPhotos[carouselIndex]?.uri;
    if (!uri) {
      setActiveMediaLoading(false);
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const probe = new (window as any).Image();
      probe.src = uri;
      if (probe.complete && probe.naturalWidth > 0) {
        setActiveMediaLoading(false);
        return;
      }
      probe.onload = () => setActiveMediaLoading(false);
      probe.onerror = () => {
        setActiveMediaFailed(true);
        setActiveMediaLoading(false);
      };
    }

    setActiveMediaLoading(true);
    const timer = setTimeout(() => {
      setActiveMediaLoading(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [carouselIndex, submittedPhotos]);

  useEffect(() => {
    setLightboxFailed(false);
  }, [currentLightboxPhoto?.uri]);

  // Handle keyboard navigation on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (lightbox) {
          setLightbox(null);
        } else {
          onClose();
        }
      } else if (lightbox && lightbox.photos.length > 1) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleLightboxPrev();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleLightboxNext();
        }
      }
    };
    window.addEventListener('keyup', onKey, true);
    return () => window.removeEventListener('keyup', onKey, true);
  }, [visible, lightbox, onClose]);

  const photoCount = submittedPhotos.length;

  const formattedSubmittedDate = useMemo(() => {
    if (!request) return '';
    const dateVal = raw.submitted_at || raw.created_at || raw.rawDate || request.created_at || request.date;
    return formatDate(dateVal) || 'Nov 17, 2026';
  }, [request, raw]);

  const departmentName = useMemo(() => {
    if (!request) return 'Department';
    const candidates = [raw.dept, raw.department, raw.requestor?.department, request.dept, request.department];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (c && typeof c === 'object') {
        const name = c.display_name || c.name;
        if (typeof name === 'string' && name.trim()) return name.trim();
      }
    }
    return 'College of Information Technology Education';
  }, [request, raw]);

  const requestedByName = useMemo(() => {
    if (!request) return 'Requestor';
    return textValue(raw.requestedBy || raw.requestor?.full_name || raw.requestor?.name || request.requestedBy) || 'Requestor';
  }, [request, raw]);

  const targetPlatforms = useMemo(() => platformsFrom(raw), [raw]);

  // Handle file picker for Upload Final Images
  const handlePickFinalImages = () => {
    if (!isDirectImcRequest(request)) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e: any) => {
        const files = Array.from(e.target.files || []) as File[];
        if (files.length === 0) return;
        const newItems: FinalUploadedImage[] = files.map((f) => ({
          uri: URL.createObjectURL(f),
          name: f.name,
          file: f,
        }));
        setFinalImages((prev) => [...prev, ...newItems]);
      };
      input.click();
    }
  };

  const handleRemoveFinalImage = (idxToRemove: number) => {
    if (!isDirectImcRequest(request)) return;
    setFinalImages((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Carousel navigation
  const handlePrevMedia = () => {
    if (photoCount <= 1) return;
    setCarouselIndex((prev) => (prev > 0 ? prev - 1 : photoCount - 1));
  };

  const handleNextMedia = () => {
    if (photoCount <= 1) return;
    setCarouselIndex((prev) => (prev < photoCount - 1 ? prev + 1 : 0));
  };

  const handleDownloadAllPhotos = async () => {
    if (!request || submittedPhotos.length === 0) return;
    try {
      await postsApi.startEditing(Number(request.id));
    } catch { }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      submittedPhotos.forEach((photo, idx) => {
        const link = document.createElement('a');
        link.href = photo.uri;
        link.download = `request-${request.id}-${photo.name || `photo-${idx + 1}`}.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
  };

  const handleSaveDraft = async () => {
    if (!request) return;
    setIsSavingDraft(true);
    try {
      const hasNewFiles = finalImages.some((img) => Boolean(img.file));
      let payload: any = { caption_narrative: finalCaption };
      if (hasNewFiles) {
        const formData = new FormData();
        formData.append('caption_narrative', finalCaption);
        finalImages.forEach((img) => {
          if (img.file) {
            formData.append('media[]', img.file);
          }
        });
        payload = formData;
      }
      const res = await postsApi.saveDraftEditing(Number(request.id), payload);
      alert('Draft saved! This request is now filed under "In-Progress Editing" in Publication Management.');
      const savedData = res?.data?.data || res?.data;
      if (onDraftSaved) {
        onDraftSaved(savedData);
      }
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to save draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePublishClick = () => {
    if (!isDirectImcRequest(request)) return;
    if (!finalCaption.trim()) {
      alert('Please provide a final caption before publishing.');
      return;
    }
    onPublish(finalCaption, finalImages);
  };

  if (!visible || !isDirectImcRequest(request)) return null;

  // Active photos for live preview: if IMC uploaded replacement images, show replacement; otherwise show original
  const previewPhotoUris = finalImages.length > 0
    ? finalImages.map((img) => img.uri)
    : submittedPhotos.map((p) => p.uri);

  const previewCaptionText = finalCaption || originalCaption;

  return (
    <>
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={() => (lightbox ? setLightbox(null) : onClose())}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              isDarkMode && styles.modalCardDark,
              { maxHeight: Math.max(0, Math.min(height * 0.94, height - 32)) },
            ]}
          >
            {/* ================= MODAL HEADER BAR ================= */}
            <View style={[styles.modalHeader, isDarkMode && styles.modalHeaderDark]}>
              <View style={styles.headerLeftRow}>
                <View style={styles.headerBadge}>
                  <Ionicons name="document-text" size={17} color={BRAND_PURPLE} />
                </View>
                <View>
                  <View style={styles.badgeRow}>
                    <Text style={styles.badgeLabel}>POST REVIEW</Text>
                    <View style={styles.directBadge}>
                      <Text style={styles.directBadgeText}>Direct to IMC</Text>
                    </View>
                  </View>
                  <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
                    Publication Review
                  </Text>
                </View>
              </View>

              {/* Close button */}
              <TouchableOpacity
                style={[styles.headerCloseBtn, isDarkMode && styles.headerCloseBtnDark]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close publication review"
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDarkMode ? '#F1F5F9' : Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* ================= SCROLLABLE BODY ================= */}
            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={true}
            >
              {/* Approval Progress Stepper */}
              <View style={[styles.stepperCard, isDarkMode && styles.stepperCardDark]}>
                <View style={styles.stepperHeader}>
                  <Text style={[styles.stepperTitle, isDarkMode && styles.stepperTitleDark]}>
                    Tracking progress
                  </Text>
                </View>
                <View style={styles.stepsRow}>
                  {/* Step 1: Submitted */}
                  <View style={styles.stepItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#059669" />
                    <Text style={[styles.stepName, isDarkMode && styles.stepNameDark]}>Submitted</Text>
                  </View>

                  <View style={[styles.stepConnector, { backgroundColor: '#059669' }]} />

                  {/* Step 2: IMC Review */}
                  <View style={styles.stepItem}>
                    <Ionicons name="time" size={20} color={BRAND_PURPLE} />
                    <Text style={[styles.stepName, isDarkMode && styles.stepNameDark]}>IMC review</Text>
                    <Text style={[styles.stepSubText, { color: BRAND_PURPLE }]}>
                      {isSavingDraft ? 'DRAFT SAVED' : 'REVIEWING'}
                    </Text>
                  </View>

                  <View style={[styles.stepConnector, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />

                  {/* Step 3: Publish */}
                  <View style={styles.stepItem}>
                    <Ionicons name="time" size={20} color="#94A3B8" />
                    <Text style={[styles.stepName, isDarkMode && styles.stepNameDark]}>Publish</Text>
                    <Text style={[styles.stepSubText, { color: '#94A3B8' }]}>WAITING</Text>
                  </View>
                </View>
                <Text style={[styles.stepperGuidance, isDarkMode && styles.stepperGuidanceDark]}>
                  Review original requestor materials, finalize the caption and replacement graphics, and check the live publication preview before publishing.
                </Text>
              </View>

              {/* Main Two-Column Grid */}
              <View style={[styles.splitGrid, !isDesktop && styles.splitGridStacked]}>
                {/* ----------------- LEFT COLUMN: REQUEST INFO, ORIGINAL MATERIALS & LIVE PREVIEW ----------------- */}
                <View style={[styles.leftColumnWrap, { flex: isDesktop ? 1 : undefined }]}>
                  {/* 1. Request Information Card */}
                  <View style={[styles.panelCard, isDarkMode && styles.panelCardDark]}>
                    <View style={styles.panelHeaderRow}>
                      <Text style={[styles.panelTitle, isDarkMode && styles.panelTitleDark]}>
                        Request Information
                      </Text>
                    </View>

                    {/* Request Title */}
                    <View style={styles.infoField}>
                      <Text style={styles.fieldHeading}>REQUEST TITLE</Text>
                      <Text selectable style={[styles.titleText, isDarkMode && styles.titleTextDark]}>
                        {request.title || raw.title || 'Untitled Request'}
                      </Text>
                    </View>

                    {/* Department & Requested By in 2 cols */}
                    <View style={styles.gridTwoCols}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.fieldHeading}>DEPARTMENT</Text>
                        <View style={styles.deptBadge}>
                          <Text style={styles.deptBadgeText} numberOfLines={1}>
                            {departmentName}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.fieldHeading}>REQUESTED BY</Text>
                        <Text selectable style={[styles.primaryVal, isDarkMode && styles.primaryValDark]} numberOfLines={1}>
                          {requestedByName}
                        </Text>
                        <Text style={styles.secondaryVal}>Requestor</Text>
                      </View>
                    </View>

                    {/* Submitted On & Target Platforms */}
                    <View style={styles.gridTwoCols}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.fieldHeading}>SUBMITTED ON</Text>
                        <Text selectable style={[styles.dateVal, isDarkMode && styles.dateValDark]}>
                          {formattedSubmittedDate}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.fieldHeading}>TARGET PLATFORMS</Text>
                        <View style={styles.platformBadgeRow}>
                          {targetPlatforms.map((p) => (
                            <View
                              key={p.label}
                              style={[styles.platformPill, { backgroundColor: p.bg }]}
                            >
                              <Ionicons name={p.icon} size={12} color={p.color} style={{ marginRight: 3 }} />
                              <Text style={[styles.platformPillText, { color: p.color }]}>{p.label}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>

                    {/* Original Caption (From Requestor) */}
                    <View style={styles.originalCaptionWrap}>
                      <View style={styles.captionHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="chatbox-ellipses-outline" size={15} color={BRAND_PURPLE} />
                          <Text style={styles.fieldHeading}>ORIGINAL CAPTION</Text>
                        </View>
                        <Text style={styles.captionSub}>Submitted by Requestor</Text>
                      </View>
                      {originalCaption ? (
                        <View style={[styles.originalCaptionBox, isDarkMode && styles.originalCaptionBoxDark]}>
                          <RenderedCaption value={originalCaption} dark={isDarkMode} />
                        </View>
                      ) : (
                        <Text style={[styles.secondaryVal, { fontStyle: 'italic', marginTop: 4 }]}>
                          No caption submitted by requestor.
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* 2. Submitted Photos / Materials Card */}
                  <View style={[styles.panelCard, isDarkMode && styles.panelCardDark]}>
                    <View style={styles.panelHeaderRow}>
                      <View>
                        <Text style={[styles.panelTitle, isDarkMode && styles.panelTitleDark]}>
                          Submitted Photos
                        </Text>
                        <Text style={styles.panelSubtitle}>
                          Original requestor attachments ({photoCount} {photoCount === 1 ? 'photo' : 'photos'})
                        </Text>
                      </View>
                      {photoCount > 0 && (
                        <TouchableOpacity
                          onPress={handleDownloadAllPhotos}
                          style={styles.downloadAllBtn}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="download-outline" size={14} color="#4C007C" style={{ marginRight: 4 }} />
                          <Text style={styles.downloadAllBtnText}>Download All</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Main Photo Preview */}
                    <View style={[styles.previewArea, isDarkMode && styles.previewAreaDark]}>
                      {photoCount > 0 ? (
                        <>
                          {activeMediaFailed ? (
                            <View style={styles.fallbackBox}>
                              <Ionicons name="image-outline" size={34} color="#94A3B8" />
                              <Text style={[styles.fallbackText, isDarkMode && styles.fallbackTextDark]}>
                                Image preview could not load.
                              </Text>
                              <Text style={styles.fallbackSub}>
                                {submittedPhotos[carouselIndex]?.name || 'Original attachment'}
                              </Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={{ width: '100%', height: '100%' }}
                              activeOpacity={0.9}
                              onPress={() => openLightbox(submittedPhotos[carouselIndex], submittedPhotos, carouselIndex)}
                            >
                              <Image
                                source={{ uri: submittedPhotos[carouselIndex]?.uri }}
                                style={styles.mainPreviewImage}
                                resizeMode="contain"
                                onLoad={() => setActiveMediaLoading(false)}
                                onLoadEnd={() => setActiveMediaLoading(false)}
                                onError={() => {
                                  setActiveMediaFailed(true);
                                  setActiveMediaLoading(false);
                                }}
                              />
                            </TouchableOpacity>
                          )}

                          {activeMediaLoading && !activeMediaFailed && (
                            <ActivityIndicator
                              size="small"
                              color={BRAND_PURPLE}
                              style={styles.loadingSpinner}
                            />
                          )}

                          {/* Navigation Arrow: Previous */}
                          {photoCount > 1 && (
                            <TouchableOpacity
                              style={[styles.arrowButton, styles.arrowLeft]}
                              onPress={handlePrevMedia}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="chevron-back" size={20} color="#0F172A" />
                            </TouchableOpacity>
                          )}

                          {/* Navigation Arrow: Next */}
                          {photoCount > 1 && (
                            <TouchableOpacity
                              style={[styles.arrowButton, styles.arrowRight]}
                              onPress={handleNextMedia}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="chevron-forward" size={20} color="#0F172A" />
                            </TouchableOpacity>
                          )}

                          {/* Image Counter Badge */}
                          {photoCount > 1 && (
                            <View style={styles.counterBadge}>
                              <Text style={styles.counterBadgeText}>
                                {carouselIndex + 1} / {photoCount}
                              </Text>
                            </View>
                          )}
                        </>
                      ) : (
                        <View style={styles.fallbackBox}>
                          <Ionicons name="images-outline" size={32} color="#94A3B8" />
                          <Text style={[styles.fallbackText, isDarkMode && styles.fallbackTextDark]}>
                            No photos attached to this request.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Thumbnails Row */}
                    {photoCount > 1 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.thumbnailsRow}
                      >
                        {submittedPhotos.map((photo, idx) => {
                          const isSel = idx === carouselIndex;
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[
                                styles.thumbBox,
                                isDarkMode && styles.thumbBoxDark,
                                isSel && styles.thumbBoxActive,
                              ]}
                              onPress={() => setCarouselIndex(idx)}
                              activeOpacity={0.7}
                            >
                              <Image source={{ uri: photo.uri }} style={styles.thumbImage} resizeMode="cover" />
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>

                  {/* 3. Live Publication Preview Card (Below Submitted Photos) */}
                  <View style={[styles.panelCard, isDarkMode && styles.panelCardDark]}>
                    <View style={styles.panelHeaderRow}>
                      <View>
                        <Text style={[styles.panelTitle, isDarkMode && styles.panelTitleDark]}>
                          Live Publication Preview
                        </Text>
                        <Text style={styles.panelSubtitle}>
                          Real-time rendering of the final publication
                        </Text>
                      </View>
                    </View>

                    {/* Platform Selector Tabs */}
                    <View style={styles.platformTabsRow}>
                      {(['facebook', 'instagram', 'website'] as const).map((platform) => {
                        const active = previewPlatform === platform;
                        const pColor = platform === 'facebook' ? '#1877F2' : platform === 'instagram' ? '#E1306C' : '#059669';
                        const label = platform === 'facebook' ? 'Facebook' : platform === 'instagram' ? 'Instagram' : 'Website';
                        const icon = platform === 'facebook' ? 'logo-facebook' : platform === 'instagram' ? 'logo-instagram' : 'globe-outline';
                        return (
                          <TouchableOpacity
                            key={platform}
                            onPress={() => setPreviewPlatform(platform)}
                            style={[
                              styles.platformTab,
                              active && {
                                backgroundColor: isDarkMode ? '#422006' : '#FEF3C7',
                                borderColor: isDarkMode ? '#92400E' : '#FDE68A',
                              },
                            ]}
                            activeOpacity={0.8}
                          >
                            <Ionicons name={icon as any} size={14} color={active ? pColor : '#94A3B8'} style={{ marginRight: 6 }} />
                            <Text style={[styles.platformTabText, active && { color: '#B45309', fontWeight: '700' }]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Post Mockup Card */}
                    {previewPlatform === 'website' ? (
                      <View style={[styles.websiteArticleCard, isDarkMode && styles.websiteArticleCardDark]}>
                        {/* Website Category Badge & URL */}
                        <View style={styles.websiteBadgeRow}>
                          <View style={[styles.websiteCategoryPill, isDarkMode && styles.websiteCategoryPillDark]}>
                            <Ionicons name="globe-outline" size={12} color="#059669" />
                            <Text style={styles.websiteCategoryText}>Website Article Preview</Text>
                          </View>
                          <Text style={[styles.websiteDomainText, isDarkMode && styles.websiteDomainTextDark]}>jmcfi.edu.ph</Text>
                        </View>

                        {/* Headline Title */}
                        <Text style={[styles.websiteHeadline, isDarkMode && styles.websiteHeadlineDark]}>
                          {request.title || raw.title || 'Untitled Content Request'}
                        </Text>

                        {/* Byline */}
                        <View style={styles.websiteBylineRow}>
                          <Image source={require('../../assets/images/jmc_logo.png')} style={styles.websiteBylineLogo} resizeMode="contain" />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.websiteAuthorText, isDarkMode && styles.websiteAuthorTextDark]}>
                              Jose Maria College Foundation Inc.
                            </Text>
                            <Text style={styles.websiteBylineSub}>
                              Official Web Portal • Final IMC Version
                            </Text>
                          </View>
                        </View>

                        {/* Featured Media / Gallery */}
                        {previewPhotoUris.length > 0 ? (
                          <View style={styles.websiteMediaWrap}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => {
                                const sourceList = finalImages.length > 0 ? finalImages : submittedPhotos;
                                const item = sourceList[websiteActiveIndex] || sourceList[0];
                                openLightbox(item, sourceList, websiteActiveIndex);
                              }}
                              style={styles.websiteFeaturedImageBox}
                              accessibilityRole="button"
                              accessibilityLabel="View featured image"
                            >
                              <Image
                                source={{ uri: previewPhotoUris[websiteActiveIndex] || previewPhotoUris[0] }}
                                style={styles.websiteFeaturedImage}
                                resizeMode="cover"
                              />
                              <View style={styles.websiteFeaturedBadge}>
                                <Ionicons name="globe-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Text style={styles.websiteFeaturedBadgeText}>
                                  Website Featured Image {previewPhotoUris.length > 1 ? `(${websiteActiveIndex + 1} of ${previewPhotoUris.length})` : ''}
                                </Text>
                              </View>
                            </TouchableOpacity>

                            {previewPhotoUris.length > 1 && (
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.websiteThumbnailsRow}>
                                {previewPhotoUris.map((uri, idx) => {
                                  const isSelected = idx === websiteActiveIndex;
                                  return (
                                    <TouchableOpacity
                                      key={`${uri}-${idx}`}
                                      style={[styles.websiteThumbBox, isSelected && styles.websiteThumbBoxActive]}
                                      onPress={() => setWebsiteActiveIndex(idx)}
                                      activeOpacity={0.7}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Select photo ${idx + 1}`}
                                    >
                                      <Image source={{ uri }} style={styles.websiteThumbImage} resizeMode="cover" />
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                            )}
                          </View>
                        ) : (
                          <View style={styles.mockupEmptyMedia}>
                            <Ionicons name="image-outline" size={24} color="#94A3B8" />
                            <Text style={styles.mockupEmptyMediaText}>No featured image attached.</Text>
                          </View>
                        )}

                        {/* Article Body */}
                        <View style={styles.websiteArticleBody}>
                          {previewCaptionText ? (
                            <RenderedCaption value={previewCaptionText} dark={isDarkMode} />
                          ) : (
                            <Text style={styles.mockupCaptionEmpty}>No article caption provided.</Text>
                          )}
                        </View>

                        {/* Clean Portal Footer */}
                        <View style={[styles.websiteFooterBar, isDarkMode && styles.websiteFooterBarDark]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="link-outline" size={13} color="#059669" />
                            <Text style={styles.websiteFooterUrl}>
                              jmcfi.edu.ph/portal/announcements
                            </Text>
                          </View>
                          <View style={[styles.websiteTagPill, isDarkMode && styles.websiteTagPillDark]}>
                            <Text style={[styles.websiteTagPillText, isDarkMode && styles.websiteTagPillTextDark]}>Portal Release</Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.mockupCard, isDarkMode && styles.mockupCardDark]}>
                        {/* Social Header */}
                        <View style={styles.mockupHeader}>
                          <Image
                            source={require('../../assets/images/jmc_logo.png')}
                            style={styles.mockupLogo}
                            resizeMode="contain"
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.mockupAuthor, isDarkMode && styles.mockupAuthorDark]}>
                              Jose Maria College Foundation Inc.
                            </Text>
                            <Text style={styles.mockupPlatformSub}>
                              {previewPlatform.charAt(0).toUpperCase() + previewPlatform.slice(1)} preview • Final IMC Version
                            </Text>
                          </View>
                        </View>

                        {/* Caption (Before media on Facebook) */}
                        {previewPlatform !== 'instagram' && (
                          <View style={styles.mockupCaptionWrap}>
                            {previewCaptionText ? (
                              <RenderedCaption value={previewCaptionText} dark={isDarkMode} />
                            ) : (
                              <Text style={styles.mockupCaptionEmpty}>No caption provided.</Text>
                            )}
                          </View>
                        )}

                        {/* Media Display */}
                        {previewPhotoUris.length > 0 ? (
                          previewPlatform === 'instagram' ? (
                            <InstagramMediaCarousel
                              images={previewPhotoUris}
                              onImagePress={(uri) => {
                                const sourceList = finalImages.length > 0 ? finalImages : submittedPhotos;
                                const idx = sourceList.findIndex((p) => p.uri === uri);
                                const found = idx >= 0 ? sourceList[idx] : { uri, name: 'Preview Image' };
                                openLightbox(found, sourceList.length > 0 ? sourceList : [found], Math.max(0, idx));
                              }}
                            />
                          ) : (
                            <FacebookMediaGrid
                              images={previewPhotoUris}
                              onImagePress={(uri) => {
                                const sourceList = finalImages.length > 0 ? finalImages : submittedPhotos;
                                const idx = sourceList.findIndex((p) => p.uri === uri);
                                const found = idx >= 0 ? sourceList[idx] : { uri, name: 'Preview Image' };
                                openLightbox(found, sourceList.length > 0 ? sourceList : [found], Math.max(0, idx));
                              }}
                              containerStyle={{ marginHorizontal: 0 }}
                            />
                          )
                        ) : (
                          <View style={styles.mockupEmptyMedia}>
                            <Ionicons name="image-outline" size={24} color="#94A3B8" />
                            <Text style={styles.mockupEmptyMediaText}>No photos attached.</Text>
                          </View>
                        )}

                        {/* Caption (After media on Instagram) */}
                        {previewPlatform === 'instagram' && (
                          <View style={styles.mockupCaptionWrap}>
                            {previewCaptionText ? (
                              <RenderedCaption value={previewCaptionText} dark={isDarkMode} />
                            ) : (
                              <Text style={styles.mockupCaptionEmpty}>No caption provided.</Text>
                            )}
                          </View>
                        )}

                        {/* Social Interactions Bar (Facebook & Instagram only) */}
                        <View style={[styles.mockupInteractions, isDarkMode && styles.mockupInteractionsDark]}>
                          <View style={styles.mockupActionBtn}>
                            <Ionicons name="thumbs-up-outline" size={14} color="#64748B" />
                            <Text style={styles.mockupActionText}>Like</Text>
                          </View>
                          <View style={styles.mockupActionBtn}>
                            <Ionicons name="chatbubble-outline" size={14} color="#64748B" />
                            <Text style={styles.mockupActionText}>Comment</Text>
                          </View>
                          <View style={styles.mockupActionBtn}>
                            <Ionicons name="share-social-outline" size={14} color="#64748B" />
                            <Text style={styles.mockupActionText}>Share</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* ----------------- RIGHT COLUMN: IMC FINAL PREPARATION ----------------- */}
                <View style={[styles.rightColumnWrap, { flex: isDesktop ? 1 : undefined }]}>
                  {/* Preparation Card */}
                  <View style={[styles.panelCard, styles.imcPanelHighlight, isDarkMode && styles.panelCardDark]}>
                    <View style={styles.panelHeaderRow}>
                      <Text style={[styles.panelTitle, isDarkMode && styles.panelTitleDark]}>
                        Final Preparation
                      </Text>
                      <View style={styles.imcActiveBadge}>
                        <Text style={styles.imcActiveBadgeText}>Active Editor</Text>
                      </View>
                    </View>
                    <Text style={styles.panelSubtitle}>
                      Refine the caption and attach finalized or replacement artwork for release.
                    </Text>

                    {/* Final Caption Field */}
                    <View style={styles.formGroup}>
                      <View style={styles.labelRow}>
                        <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>
                          Final Caption
                        </Text>
                        {finalCaption !== originalCaption && (
                          <TouchableOpacity
                            onPress={() => setFinalCaption(originalCaption)}
                            style={styles.revertBtn}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="refresh-outline" size={12} color="#4C007C" style={{ marginRight: 3 }} />
                            <Text style={styles.revertBtnText}>Revert to original</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <TextInput
                        style={[styles.captionInput, isDarkMode && styles.captionInputDark]}
                        multiline
                        numberOfLines={8}
                        placeholder="Enter or refine the finalized publication caption..."
                        placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                        value={finalCaption}
                        onChangeText={setFinalCaption}
                        maxLength={2200}
                        textAlignVertical="top"
                      />

                      <View style={styles.charCounterRow}>
                        <Text style={styles.inputHelp}>
                          Changes update the live preview on the left in real time.
                        </Text>
                        <Text style={[styles.charCounter, isDarkMode && styles.charCounterDark]}>
                          {finalCaption.length} / 2200
                        </Text>
                      </View>
                    </View>

                    {/* Upload Replacement / Final Images */}
                    <View style={styles.formGroup}>
                      <View style={styles.labelRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>
                            Upload Final Images
                          </Text>
                          <View style={[styles.optionalBadge, isDarkMode && styles.optionalBadgeDark]}>
                            <Text style={[styles.optionalBadgeText, isDarkMode && styles.optionalBadgeTextDark]}>
                              Optional
                            </Text>
                          </View>
                        </View>
                        {finalImages.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setFinalImages([])}
                            style={styles.clearAllImagesBtn}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={12} color="#DC2626" style={{ marginRight: 3 }} />
                            <Text style={styles.clearAllImagesText}>Clear & use original</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={styles.uploadHelpText}>
                        Leave empty to publish the requestor's original submitted photos. Upload new files below to replace or enhance them.
                      </Text>

                      <TouchableOpacity
                        style={[styles.uploadDropzone, isDarkMode && styles.uploadDropzoneDark]}
                        onPress={handlePickFinalImages}
                        activeOpacity={0.8}
                      >
                        <View style={styles.uploadIconCircle}>
                          <Ionicons name="cloud-upload-outline" size={24} color="#7C3AED" />
                        </View>
                        <Text style={[styles.uploadDropzoneTitle, isDarkMode && styles.uploadDropzoneTitleDark]}>
                          Click to upload replacement or finalized photos
                        </Text>
                        <Text style={styles.uploadDropzoneHint}>
                          Supports PNG, JPG, or WEBP (up to 20MB)
                        </Text>
                      </TouchableOpacity>

                      {/* Uploaded Final Images Previews */}
                      {finalImages.length > 0 && (
                        <View style={styles.uploadedImagesWrap}>
                          <Text style={[styles.uploadedListTitle, isDarkMode && styles.uploadedListTitleDark]}>
                            Replacement photos ready to publish ({finalImages.length}):
                          </Text>
                          <View style={styles.uploadedPhotoGrid}>
                            {finalImages.map((img, idx) => (
                              <View key={idx} style={[styles.uploadedPhotoBox, isDarkMode && styles.uploadedPhotoBoxDark]}>
                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  onPress={() => openLightbox(img, finalImages, idx)}
                                  style={styles.uploadedPhotoThumbWrap}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Preview ${img.name}`}
                                >
                                  <Image source={{ uri: img.uri }} style={styles.uploadedPhotoBoxImage} resizeMode="cover" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.uploadedPhotoRemoveBadge}
                                  onPress={() => handleRemoveFinalImage(idx)}
                                  activeOpacity={0.8}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove ${img.name}`}
                                >
                                  <Ionicons name="close" size={11} color="#FFFFFF" />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* ================= MODAL FOOTER ACTIONS ================= */}
            <View style={[styles.modalFooter, isDarkMode && styles.modalFooterDark]}>
              <View style={styles.footerRightActions}>
                <TouchableOpacity
                  style={[styles.btnReject, isDarkMode && styles.btnRejectDark]}
                  onPress={() => onReject(request)}
                  activeOpacity={0.8}
                  disabled={isPublishing || isSavingDraft}
                >
                  <Text style={styles.btnRejectText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnSaveDraft, isDarkMode && styles.btnSaveDraftDark]}
                  onPress={handleSaveDraft}
                  activeOpacity={0.8}
                  disabled={isPublishing || isSavingDraft}
                >
                  {isSavingDraft ? (
                    <ActivityIndicator size="small" color={BRAND_PURPLE} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={15} color={BRAND_PURPLE} style={{ marginRight: 6 }} />
                      <Text style={styles.btnSaveDraftText}>Save & Continue Later</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnPublish, (isPublishing || isSavingDraft) && { opacity: 0.7 }]}
                  onPress={handlePublishClick}
                  activeOpacity={0.85}
                  disabled={isPublishing || isSavingDraft}
                >
                  {isPublishing ? (
                    <ActivityIndicator size="small" color="#1E293B" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={15} color="#1E293B" style={{ marginRight: 6 }} />
                      <Text style={styles.btnPublishText}>Publish Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Screen Lightbox Viewer with Multi-Photo Gallery Navigation */}
      {!!currentLightboxPhoto && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setLightbox(null)}
        >
          <View nativeID="publication-image-preview" accessibilityViewIsModal style={styles.lightbox}>
            {/* Header Bar */}
            <View style={styles.lightboxHeader}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <Text numberOfLines={1} style={styles.lightboxTitle}>
                  {currentLightboxPhoto.name || 'Photo Preview'}
                </Text>
                {lightbox && lightbox.photos.length > 1 && (
                  <Text style={styles.lightboxSubtext}>
                    Photo {lightbox.index + 1} of {lightbox.photos.length} · Use ← and → keys to browse
                  </Text>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {lightbox && lightbox.photos.length > 1 && (
                  <View style={styles.lightboxIndexPill}>
                    <Text style={styles.lightboxIndexPillText}>
                      {lightbox.index + 1} / {lightbox.photos.length}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close image preview"
                  onPress={() => setLightbox(null)}
                  style={styles.lightboxCloseBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Main Stage with Navigation Arrows */}
            <View style={styles.lightboxStage}>
              {lightboxFailed ? (
                <View style={styles.lightboxFallback}>
                  <Ionicons name="image-outline" size={48} color="#94A3B8" />
                  <Text style={styles.lightboxFallbackText}>
                    This image could not load. Please close the preview and try again.
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: currentLightboxPhoto.uri }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                  accessibilityLabel={currentLightboxPhoto.name}
                  onError={() => setLightboxFailed(true)}
                />
              )}

              {/* Previous Photo Arrow */}
              {lightbox && lightbox.photos.length > 1 && (
                <TouchableOpacity
                  style={[styles.lightboxArrow, styles.lightboxArrowLeft]}
                  onPress={handleLightboxPrev}
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {/* Next Photo Arrow */}
              {lightbox && lightbox.photos.length > 1 && (
                <TouchableOpacity
                  style={[styles.lightboxArrow, styles.lightboxArrowRight]}
                  onPress={handleLightboxNext}
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Bottom Filmstrip Carousel */}
            {lightbox && lightbox.photos.length > 1 && (
              <View style={styles.lightboxFilmstripWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.lightboxFilmstrip}
                >
                  {lightbox.photos.map((item, idx) => {
                    const isActive = idx === lightbox.index;
                    return (
                      <TouchableOpacity
                        key={`${item.uri}-${idx}`}
                        style={[
                          styles.lightboxThumb,
                          isActive && styles.lightboxThumbActive,
                        ]}
                        onPress={() => {
                          setLightbox({ photos: lightbox.photos, index: idx });
                          setLightboxFailed(false);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Jump to ${item.name}`}
                      >
                        <Image source={{ uri: item.uri }} style={styles.lightboxThumbImg} resizeMode="cover" />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    ...dashboardStyles.modalBackdrop,
  },
  modalCard: {
    ...dashboardStyles.modalCard,
    width: '96%',
    maxWidth: 1200,
    borderTopWidth: 4,
    borderTopColor: BRAND_PURPLE,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalCardDark: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  modalHeader: {
    ...dashboardStyles.modalHeader,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderDark: {
    borderBottomColor: '#334155',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: dashboardUi.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  badgeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  directBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  directBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerTitleDark: {
    color: Colors.textPrimary,
  },
  headerCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseBtnDark: {
    borderColor: '#334155',
    backgroundColor: '#1E293B',
  },
  modalBodyScroll: {
    flexShrink: 1,
    minHeight: 0,
  },
  modalBodyContent: {
    padding: 20,
    gap: 16,
  },
  stepperCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  stepperCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  stepperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepperTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  stepperTitleDark: {
    color: Colors.textPrimary,
  },
  stepperSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  stepItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  stepName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  stepNameDark: {
    color: Colors.textPrimary,
  },
  stepSubText: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    marginTop: -16,
  },
  stepperGuidance: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
    lineHeight: 17,
  },
  stepperGuidanceDark: {
    color: '#94A3B8',
  },
  splitGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  splitGridStacked: {
    flexDirection: 'column',
  },
  leftColumnWrap: {
    gap: 16,
  },
  rightColumnWrap: {
    gap: 16,
  },
  panelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  panelCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  imcPanelHighlight: {
    borderColor: '#D8B4FE',
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  panelTitleDark: {
    color: Colors.textPrimary,
  },
  panelSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  infoField: {
    marginBottom: 12,
  },
  fieldHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  titleTextDark: {
    color: Colors.textPrimary,
  },
  gridTwoCols: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  deptBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  deptBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  primaryVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  primaryValDark: {
    color: Colors.textPrimary,
  },
  secondaryVal: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  dateVal: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dateValDark: {
    color: Colors.textPrimary,
  },
  platformBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  platformPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  platformPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  originalCaptionWrap: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  captionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  captionSub: {
    fontSize: 11,
    color: '#64748B',
  },
  originalCaptionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    maxHeight: 150,
  },
  originalCaptionBoxDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  captionWrap: {
    width: '100%',
  },
  downloadAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  downloadAllBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4C007C',
  },
  previewArea: {
    height: 260,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    marginTop: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewAreaDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  mainPreviewImage: {
    width: '100%',
    height: '100%',
  },
  loadingSpinner: {
    position: 'absolute',
  },
  fallbackBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  fallbackTextDark: {
    color: '#94A3B8',
  },
  fallbackSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  arrowLeft: {
    left: 10,
  },
  arrowRight: {
    right: 10,
  },
  counterBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  counterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  thumbnailsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingVertical: 2,
  },
  thumbBox: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  thumbBoxDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  thumbBoxActive: {
    borderColor: BRAND_PURPLE,
    borderWidth: 2.5,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  platformTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  platformTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  platformTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  livePhotoStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 10,
  },
  livePhotoStatusReplaced: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  livePhotoStatusOriginal: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  livePhotoStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  mockupCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    padding: 12,
  },
  mockupCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  mockupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  mockupLogo: {
    width: 32,
    height: 32,
  },
  mockupAuthor: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  mockupAuthorDark: {
    color: Colors.textPrimary,
  },
  mockupPlatformSub: {
    fontSize: 10.5,
    color: '#64748B',
  },
  mockupWebsiteTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  mockupWebsiteTitleDark: {
    color: Colors.textPrimary,
  },
  websiteArticleCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  websiteArticleCardDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  websiteBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  websiteCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  websiteCategoryPillDark: {
    backgroundColor: '#064E3B',
  },
  websiteCategoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  websiteDomainText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  websiteDomainTextDark: {
    color: '#64748B',
  },
  websiteHeadline: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
  },
  websiteHeadlineDark: {
    color: '#F8FAFC',
  },
  websiteBylineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 4,
  },
  websiteBylineLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  websiteAuthorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  websiteAuthorTextDark: {
    color: '#F8FAFC',
  },
  websiteBylineSub: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  websiteMediaWrap: {
    width: '100%',
    gap: 8,
  },
  websiteFeaturedImageBox: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  websiteFeaturedImage: {
    width: '100%',
    height: '100%',
  },
  websiteFeaturedBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  websiteFeaturedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  websiteThumbnailsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  websiteThumbBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  websiteThumbBoxActive: {
    borderColor: '#059669',
    borderWidth: 2,
  },
  websiteThumbImage: {
    width: '100%',
    height: '100%',
  },
  websiteArticleBody: {
    paddingTop: 2,
  },
  websiteFooterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 4,
  },
  websiteFooterBarDark: {
    borderTopColor: '#1E293B',
  },
  websiteFooterUrl: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  websiteTagPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  websiteTagPillDark: {
    backgroundColor: '#1E293B',
  },
  websiteTagPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  websiteTagPillTextDark: {
    color: '#94A3B8',
  },
  mockupCaptionWrap: {
    marginBottom: 8,
  },
  mockupCaptionEmpty: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#94A3B8',
  },
  mockupEmptyMedia: {
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginVertical: 4,
  },
  mockupEmptyMediaText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  mockupInteractions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 8,
  },
  mockupInteractionsDark: {
    borderTopColor: '#1E293B',
  },
  mockupActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mockupActionText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  imcActiveBadge: {
    backgroundColor: '#F3E8FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  imcActiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  formGroup: {
    marginTop: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  fieldLabelDark: {
    color: Colors.textPrimary,
  },
  revertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F3E8FF',
  },
  revertBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4C007C',
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 10,
    fontSize: 13,
    color: Colors.textPrimary,
    minHeight: 140,
    lineHeight: 19,
  },
  captionInputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    color: Colors.textPrimary,
  },
  charCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  inputHelp: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  charCounter: {
    fontSize: 11,
    color: '#64748B',
  },
  charCounterDark: {
    color: '#94A3B8',
  },
  optionalBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionalBadgeDark: {
    backgroundColor: '#334155',
  },
  optionalBadgeText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  optionalBadgeTextDark: {
    color: '#CBD5E1',
  },
  clearAllImagesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearAllImagesText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  uploadHelpText: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 16,
  },
  uploadDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C084FC',
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadDropzoneDark: {
    borderColor: '#9333EA',
    backgroundColor: '#1E1B4B',
  },
  uploadIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  uploadDropzoneTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4C007C',
    textAlign: 'center',
  },
  uploadDropzoneTitleDark: {
    color: '#E9D5FF',
  },
  uploadDropzoneHint: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  uploadedImagesWrap: {
    marginTop: 10,
  },
  uploadedListTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 6,
  },
  uploadedListTitleDark: {
    color: '#86EFAC',
  },
  uploadedPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  uploadedPhotoBox: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  uploadedPhotoBoxDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  uploadedPhotoThumbWrap: {
    width: '100%',
    height: '100%',
    borderRadius: 6.5,
    overflow: 'hidden',
  },
  uploadedPhotoBoxImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6.5,
  },
  uploadedPhotoRemoveBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  releaseSummaryBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 12,
    marginTop: 16,
  },
  releaseSummaryBoxDark: {
    backgroundColor: '#052E16',
    borderColor: '#166534',
  },
  summaryBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  summaryBoxTitleDark: {
    color: '#86EFAC',
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  summaryItemText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#166534',
  },
  summaryItemTextDark: {
    color: '#BBF7D0',
  },
  modalFooter: {
    ...dashboardStyles.modalFooter,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  modalFooterDark: {
    backgroundColor: '#0F172A',
    borderTopColor: '#334155',
  },
  footerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  btnReject: {
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#D91E28',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D91E28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(217, 30, 40, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        transition: 'all 120ms ease',
      } as any)
      : {}),
  },
  btnRejectDark: {
    backgroundColor: '#B91C1C',
    shadowColor: '#000000',
  },
  btnRejectText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnSaveDraft: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 36,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 120ms ease' } : {}),
  },
  btnSaveDraftDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  btnSaveDraftText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: BRAND_PURPLE,
  },
  btnPublish: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFC72C',
    shadowColor: '#FFC72C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 120ms ease' } : {}),
  },
  btnPublishText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    padding: 16,
  },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    flexShrink: 0,
  },
  lightboxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lightboxSubtext: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
  },
  lightboxIndexPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lightboxIndexPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  lightboxCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxStage: {
    flex: 1,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxArrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -22 }],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  lightboxArrowLeft: {
    left: 16,
  },
  lightboxArrowRight: {
    right: 16,
  },
  lightboxImage: {
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
  lightboxFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lightboxFallbackText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  lightboxFilmstripWrap: {
    height: 64,
    marginTop: 10,
    justifyContent: 'center',
  },
  lightboxFilmstrip: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  lightboxThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  lightboxThumbActive: {
    borderColor: '#C084FC',
    borderWidth: 2.5,
  },
  lightboxThumbImg: {
    width: '100%',
    height: '100%',
  },
});
