import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { resolveImageUrl } from '../../services/api';
import { FacebookMediaGrid } from '../social/FacebookMediaGrid';
import { InstagramMediaCarousel } from '../social/InstagramMediaCarousel';
import { FormattedText } from '../ui/FormattedText';

export interface PublicationReviewModalProps {
  visible: boolean;
  request: any | null;
  onClose: () => void;
  onPublish: (req: any, payload: { finalCaption: string; replacementFiles: any[] }) => Promise<void> | void;
  onReject: (req: any) => void;
  onOpenFullScreenImage?: (url: string) => void;
}

interface ReplacementImageItem {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  file?: File | Blob;
}

const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDisplayDate = (rawDate: any): string => {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return String(rawDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

export const PublicationReviewModal: React.FC<PublicationReviewModalProps> = ({
  visible,
  request,
  onClose,
  onPublish,
  onReject,
  onOpenFullScreenImage,
}) => {
  const { width } = useWindowDimensions();
  const isTwoColumn = width >= 880;

  const [finalCaption, setFinalCaption] = useState('');
  const [activeOrigIndex, setActiveOrigIndex] = useState(0);
  const [replacementFiles, setReplacementFiles] = useState<ReplacementImageItem[]>([]);
  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram' | 'website'>('facebook');
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Extract original media items with resolved URLs
  const originalMedia = useMemo(() => {
    const sourceMedia =
      Array.isArray(request?.imc_branding_checklist?.original_media) &&
      request.imc_branding_checklist.original_media.length > 0
        ? request.imc_branding_checklist.original_media
        : request?.media;
    if (!request || !Array.isArray(sourceMedia)) return [];
    return sourceMedia
      .filter((m: any) => {
        const type = String(m?.type || m?.mime_type || '').toLowerCase();
        return !type || type === 'image' || type.startsWith('image/');
      })
      .map((m: any, idx: number) => ({
        id: m.id || idx,
        url: resolveImageUrl(m.url || m.file_url || m.file_path) || '',
        name: m.original_filename || m.name || `photo-${idx + 1}.jpg`,
        size: m.size || 0,
      }))
      .filter((m: any) => Boolean(m.url));
  }, [request]);

  // Extract replacement final media items if IMC uploaded edited photos
  const finalPublishedMedia = useMemo(() => {
    const checklist = request?.imc_branding_checklist;
    const source =
      Array.isArray(checklist?.final_media) && checklist.final_media.length > 0
        ? checklist.final_media
        : checklist?.has_replacement_media && Array.isArray(request?.media)
        ? request.media
        : [];
    if (!Array.isArray(source)) return [];
    return source
      .map((m: any, idx: number) => ({
        id: m.id || idx,
        url: resolveImageUrl(m.url || m.file_url || m.file_path) || '',
        name: m.original_filename || m.name || `final-${idx + 1}.jpg`,
        size: m.size || 0,
      }))
      .filter((m: any) => Boolean(m.url));
  }, [request]);

  // Normalized target platforms
  const targetPlatforms = useMemo(() => {
    if (!request) return ['facebook'];
    const raw = request.platforms || request.target_platforms || [];
    if (!Array.isArray(raw) || raw.length === 0) return ['facebook'];
    return raw.map((p: string) => {
      const lp = String(p).toLowerCase();
      if (lp === 'portal' || lp === 'wp' || lp === 'wordpress') return 'website';
      return lp;
    });
  }, [request]);

  // Reset modal state whenever a new request is opened
  useEffect(() => {
    if (visible && request) {
      const cleanCaption = stripHtmlTags(
        request.imc_branding_checklist?.refined_caption ||
          request.caption ||
          request.caption_narrative ||
          ''
      );
      setFinalCaption(cleanCaption);
      setActiveOrigIndex(0);
      setReplacementFiles([]);
      setIsPublishing(false);
      setPreviewDevice('mobile');
      if (targetPlatforms.includes('facebook')) setPreviewPlatform('facebook');
      else if (targetPlatforms.includes('instagram')) setPreviewPlatform('instagram');
      else if (targetPlatforms.includes('website')) setPreviewPlatform('website');
      else setPreviewPlatform('facebook');
    }
  }, [visible, request?.id]);

  if (!visible || !request) return null;

  const isPending = (() => {
    const s = String(request.status || request.rawStatus || '').toUpperCase();
    return s === 'PENDING' || s === 'PENDING_IMC_QA' || s === 'PENDING_OFFICE_HEAD' || s === 'PENDING_VICE_PRESIDENT' || s === 'PENDING_PRESIDENT';
  })();

  const submittedDateText = formatDisplayDate(request.created_at || request.rawDate || request.date);
  const deptName = request.dept || request.requestor?.department || request.other_category_name || 'Department';
  const requestorName = request.requestedBy || request.requestor?.full_name || 'Requestor';
  const photoCountLabel =
    originalMedia.length === 0
      ? 'Text only'
      : originalMedia.length === 1
      ? '1 photo'
      : `${originalMedia.length} photos`;

  const additionalInstructions =
    request.remarks ||
    request.additional_instructions ||
    (request.preferred_schedule_at ? `Preferred Schedule: ${formatDisplayDate(request.preferred_schedule_at)}` : '');

  // Active preview media (uses final uploaded images if any, otherwise published finals or originals)
  const previewMediaList =
    replacementFiles.length > 0
      ? replacementFiles.map((f, i) => ({ id: `rep-${i}`, url: f.uri, name: f.name }))
      : finalPublishedMedia.length > 0
      ? finalPublishedMedia
      : originalMedia;

  const handleBrowseFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const picked: ReplacementImageItem[] = res.assets
          .slice(0, Math.max(0, 10 - replacementFiles.length))
          .map((asset) => ({
            uri: asset.uri,
            name: asset.name || 'edited-image.jpg',
            size: asset.size || 0,
            mimeType: asset.mimeType || 'image/jpeg',
            file: (asset as any).file,
          }));
        setReplacementFiles((prev) => [...prev, ...picked].slice(0, 10));
      }
    } catch {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/jpeg,image/png,image/webp,image/jpg';
        input.onchange = (e: any) => {
          const files = Array.from(e.target.files || []) as File[];
          const picked: ReplacementImageItem[] = files
            .filter((f) => f.size <= 15 * 1024 * 1024)
            .slice(0, Math.max(0, 10 - replacementFiles.length))
            .map((f) => ({
              uri: URL.createObjectURL(f),
              name: f.name,
              size: f.size,
              mimeType: f.type || 'image/jpeg',
              file: f,
            }));
          setReplacementFiles((prev) => [...prev, ...picked].slice(0, 10));
        };
        input.click();
      }
    }
  };

  const handleWebDrop = (e: any) => {
    if (Platform.OS !== 'web') return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []) as File[];
    const valid = files.filter(
      (f) => ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(f.type) && f.size <= 15 * 1024 * 1024
    );
    if (valid.length > 0) {
      const picked: ReplacementImageItem[] = valid
        .slice(0, Math.max(0, 10 - replacementFiles.length))
        .map((f) => ({
          uri: URL.createObjectURL(f),
          name: f.name,
          size: f.size,
          mimeType: f.type || 'image/jpeg',
          file: f,
        }));
      setReplacementFiles((prev) => [...prev, ...picked].slice(0, 10));
    }
  };

  const handleDownloadAllPhotos = async () => {
    if (originalMedia.length === 0) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      for (const item of originalMedia) {
        try {
          const res = await fetch(item.url);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = item.name || 'photo.jpg';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        } catch {
          window.open(item.url, '_blank');
        }
      }
    }
  };

  const handlePublishPress = async () => {
    if (!finalCaption.trim()) {
      alert('Please provide a Final Caption before publishing.');
      return;
    }
    setIsPublishing(true);
    try {
      await onPublish(request, {
        finalCaption: finalCaption.trim(),
        replacementFiles,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const renderPlatformBadge = (plat: string, idx: number) => {
    const lp = plat.toLowerCase();
    const isFb = lp === 'facebook';
    const isIg = lp === 'instagram';
    const iconName = isFb ? 'logo-facebook' : isIg ? 'logo-instagram' : 'globe-outline';
    const iconColor = isFb ? '#1877F2' : isIg ? '#E4405F' : '#4C007C';
    const label = isFb ? 'Facebook' : isIg ? 'Instagram' : 'Website';
    return (
      <View key={`${plat}-${idx}`} style={styles.platformChip}>
        <Ionicons name={iconName as any} size={13} color={iconColor} style={{ marginRight: 5 }} />
        <Text style={styles.platformChipText}>{label}</Text>
      </View>
    );
  };

  const activeOrig = originalMedia[activeOrigIndex] || null;
  const previewCardWidth = previewDevice === 'mobile' ? 370 : Math.min(620, width - 90);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* ── Top Header ── */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.headerIconBadge}>
                <View style={styles.headerIconInner}>
                  <Ionicons name="newspaper" size={14} color="#4C007C" />
                </View>
                <View style={styles.headerIconCornerBadge}>
                  <Ionicons name="checkmark-sharp" size={9} color="#FFC72C" />
                </View>
              </View>
              <Text style={styles.headerTitle}>Publication Review</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* ── Scrollable Body ── */}
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator>
            {/* Title + Date Line */}
            <View style={styles.titleRow}>
              <Text style={styles.postTitle}>{request.title || 'Untitled Request'}</Text>
              {submittedDateText ? (
                <Text style={styles.submittedDate}>Submitted {submittedDateText}</Text>
              ) : null}
            </View>

            {/* 3 Metadata Cards */}
            <View style={[styles.metaCardsRow, !isTwoColumn && { flexDirection: 'column' }]}>
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>DEPARTMENT</Text>
                <Text style={styles.metaValue} numberOfLines={1}>{deptName}</Text>
              </View>
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>REQUESTED BY</Text>
                <Text style={styles.metaValue} numberOfLines={1}>{requestorName}</Text>
              </View>
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>PHOTO ATTACHMENTS</Text>
                <Text style={styles.metaValue}>{photoCountLabel}</Text>
              </View>
            </View>

            {/* 2-Column Workspace */}
            <View style={[styles.columnsContainer, !isTwoColumn && { flexDirection: 'column' }]}>
              {/* ── LEFT COLUMN: Submitted Materials ── */}
              <View style={styles.columnCard}>
                <Text style={styles.sectionTitle}>Submitted Materials</Text>
                <Text style={styles.sectionSubtitle}>Original requestor attachments</Text>

                {/* Carousel Frame */}
                <View style={styles.carouselFrame}>
                  {activeOrig ? (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.92}
                        style={styles.carouselImageTouch}
                        onPress={() => onOpenFullScreenImage?.(activeOrig.url)}
                      >
                        <Image
                          source={{ uri: activeOrig.url }}
                          style={styles.carouselMainImage}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>

                      {originalMedia.length > 1 && (
                        <>
                          <TouchableOpacity
                            style={[styles.carouselArrowBtn, { left: 10 }]}
                            onPress={() =>
                              setActiveOrigIndex((prev) => (prev - 1 + originalMedia.length) % originalMedia.length)
                            }
                            activeOpacity={0.85}
                          >
                            <Ionicons name="chevron-back" size={18} color="#1E293B" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.carouselArrowBtn, { right: 10 }]}
                            onPress={() => setActiveOrigIndex((prev) => (prev + 1) % originalMedia.length)}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="chevron-forward" size={18} color="#1E293B" />
                          </TouchableOpacity>
                        </>
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyMediaBox}>
                      <Ionicons name="images-outline" size={32} color="#94A3B8" />
                      <Text style={styles.emptyMediaText}>No photo attachments (Text only)</Text>
                    </View>
                  )}
                </View>

                {/* Thumbnails + Counter */}
                {originalMedia.length > 0 && (
                  <>
                    <View style={styles.thumbRow}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {originalMedia.map((m: any, idx: number) => (
                          <TouchableOpacity
                            key={m.id || idx}
                            onPress={() => setActiveOrigIndex(idx)}
                            style={[
                              styles.thumbBox,
                              idx === activeOrigIndex && styles.thumbBoxActive,
                            ]}
                            activeOpacity={0.8}
                          >
                            <Image source={{ uri: m.url }} style={styles.thumbImg} resizeMode="cover" />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <Text style={styles.counterText}>
                        {activeOrigIndex + 1} of {originalMedia.length}
                      </Text>
                    </View>
                    <Text style={styles.filenameText} numberOfLines={1}>
                      {activeOrig?.name}
                    </Text>

                    {/* Download All Photos */}
                    <TouchableOpacity
                      style={styles.downloadAllBtn}
                      onPress={handleDownloadAllPhotos}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="download-outline" size={16} color="#1E293B" style={{ marginRight: 6 }} />
                      <Text style={styles.downloadAllText}>Download All Photos</Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.divider} />

                {/* Target Platforms */}
                <Text style={styles.subLabel}>TARGET PLATFORMS</Text>
                <View style={styles.platformRow}>
                  {targetPlatforms.map((plat: string, idx: number) => renderPlatformBadge(plat, idx))}
                </View>

                <View style={styles.divider} />

                {/* Original Caption */}
                <Text style={styles.subLabel}>CAPTION</Text>
                <View style={styles.readOnlyBox}>
                  <FormattedText style={styles.readOnlyText}>
                    {request.imc_branding_checklist?.original_caption ||
                      request.caption ||
                      request.caption_narrative ||
                      'No caption provided.'}
                  </FormattedText>
                </View>

                {/* Additional Instructions */}
                {Boolean(additionalInstructions) && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.subLabel}>ADDITIONAL INSTRUCTIONS</Text>
                    <View style={styles.readOnlyBox}>
                      <Text style={styles.readOnlyText}>{additionalInstructions}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* ── RIGHT COLUMN: Final Preparation ── */}
              <View style={styles.columnCard}>
                <Text style={styles.sectionTitle}>
                  {isPending ? 'Final Preparation' : 'Final Published Content'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {isPending
                    ? 'Prepare the final caption and images'
                    : 'Final approved caption and images used for publication'}
                </Text>

                {/* Final Caption */}
                <Text style={styles.fieldLabel}>
                  Final Caption {isPending && <Text style={{ color: '#DC2626' }}>*</Text>}
                </Text>
                <TextInput
                  style={[styles.captionInput, !isPending && { backgroundColor: '#F8FAFC', color: '#1E293B' }]}
                  value={finalCaption}
                  onChangeText={setFinalCaption}
                  editable={isPending}
                  multiline
                  placeholder="Edit or refine the final caption for publication..."
                  placeholderTextColor="#94A3B8"
                  textAlignVertical="top"
                  maxLength={2200}
                />
                {isPending && (
                  <Text style={styles.charCount}>{finalCaption.length} / 2200</Text>
                )}

                {isPending ? (
                  <>
                    {/* Upload Final Images */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 8 }}>
                      <Text style={styles.fieldLabelNoMargin}>Upload Final Images</Text>
                      <Text style={styles.optionalTag}>Optional</Text>
                    </View>

                    <View
                      style={[
                        styles.uploadDropzone,
                        isDragOver && styles.uploadDropzoneActive,
                      ]}
                      {...(Platform.OS === 'web'
                        ? ({
                            onDragOver: (e: any) => {
                              e.preventDefault();
                              setIsDragOver(true);
                            },
                            onDragLeave: () => setIsDragOver(false),
                            onDrop: handleWebDrop,
                          } as any)
                        : {})}
                    >
                      <View style={styles.uploadIconBox}>
                        <Ionicons name="cloud-upload-outline" size={22} color="#5B21B6" />
                      </View>
                      <Text style={styles.uploadTitle}>Upload images</Text>
                      <Text style={styles.uploadSubtitle}>
                        Drop your edited photos here, or select files below.
                      </Text>
                      <Text style={styles.uploadHint}>
                        JPG, PNG or WEBP · Up to 10 images · 15 MB per image
                      </Text>
                      <TouchableOpacity
                        style={styles.browseBtn}
                        onPress={handleBrowseFiles}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.browseBtnText}>Browse Files</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Selected Images Bar */}
                    <View style={styles.selectedBar}>
                      <Text style={styles.selectedBarCount}>
                        {replacementFiles.length > 0
                          ? `${replacementFiles.length} image${replacementFiles.length > 1 ? 's' : ''} selected`
                          : 'Using original attachments'}
                      </Text>
                      {replacementFiles.length > 0 && (
                        <TouchableOpacity onPress={() => setReplacementFiles([])} activeOpacity={0.7}>
                          <Text style={styles.useOriginalsText}>Use Originals</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Uploaded Replacement Grid */}
                    {replacementFiles.length > 0 && (
                      <View style={styles.replacementGrid}>
                        {replacementFiles.map((file, idx) => (
                          <View key={`${file.name}-${idx}`} style={styles.replacementCard}>
                            <Image source={{ uri: file.uri }} style={styles.replacementThumb} resizeMode="cover" />
                            <View style={styles.replacementInfo}>
                              <Text style={styles.replacementName} numberOfLines={1}>
                                {file.name}
                              </Text>
                              <Text style={styles.replacementSize}>{formatFileSize(file.size)}</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.removeBtn}
                              onPress={() =>
                                setReplacementFiles((prev) => prev.filter((_, i) => i !== idx))
                              }
                              activeOpacity={0.8}
                            >
                              <Text style={styles.removeBtnText}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.fieldLabel}>Final Published Images</Text>
                    {finalPublishedMedia.length > 0 ? (
                      <View style={styles.replacementGrid}>
                        {finalPublishedMedia.map((file, idx) => (
                          <TouchableOpacity
                            key={`${file.name}-${idx}`}
                            style={styles.replacementCard}
                            activeOpacity={0.85}
                            onPress={() => onOpenFullScreenImage?.(file.url)}
                          >
                            <Image source={{ uri: file.url }} style={styles.replacementThumb} resizeMode="cover" />
                            <View style={styles.replacementInfo}>
                              <Text style={styles.replacementName} numberOfLines={1}>
                                {file.name}
                              </Text>
                              <Text style={styles.replacementSize}>Final uploaded image</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.readOnlyBox}>
                        <Text style={styles.readOnlyText}>
                          Original submitted photos were used for publication.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* ── LIVE PREVIEW CARD ── */}
            <View style={styles.livePreviewSection}>
              <View style={styles.livePreviewCard}>
                <View style={styles.livePreviewHeader}>
                  <View style={styles.livePreviewIcon}>
                    <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.livePreviewTitle}>Live Preview</Text>
                </View>

                {/* Platform Switcher */}
                <View style={styles.platformSwitchBar}>
                  {(['facebook', 'instagram', 'website'] as const).map((plat) => {
                    const active = previewPlatform === plat;
                    const iconName =
                      plat === 'facebook' ? 'logo-facebook' : plat === 'instagram' ? 'logo-instagram' : 'globe-outline';
                    const activeColor = plat === 'facebook' ? '#1877F2' : plat === 'instagram' ? '#E4405F' : '#4C007C';
                    const label = plat === 'facebook' ? 'Facebook' : plat === 'instagram' ? 'Instagram' : 'Website';
                    return (
                      <TouchableOpacity
                        key={plat}
                        style={[styles.platformTab, active && styles.platformTabActive]}
                        onPress={() => setPreviewPlatform(plat)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={iconName as any}
                          size={14}
                          color={active ? activeColor : '#64748B'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.platformTabText, active && { color: activeColor, fontWeight: '700' }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Device Switcher */}
                <View style={styles.deviceSwitchBar}>
                  <TouchableOpacity
                    style={[styles.deviceTab, previewDevice === 'mobile' && styles.deviceTabActive]}
                    onPress={() => setPreviewDevice('mobile')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.deviceTabText, previewDevice === 'mobile' && styles.deviceTabTextActive]}>
                      Mobile
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deviceTab, previewDevice === 'desktop' && styles.deviceTabActive]}
                    onPress={() => setPreviewDevice('desktop')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.deviceTabText, previewDevice === 'desktop' && styles.deviceTabTextActive]}>
                      Desktop
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Mockup Preview Frame */}
                <View style={[styles.mockupFrame, { width: previewCardWidth }]}>
                  {previewPlatform === 'facebook' && (
                    <View>
                      <View style={styles.fbHeader}>
                        <Image
                          source={require('../../assets/images/jmc_logo_sm.png')}
                          style={styles.fbAvatar}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fbPageName}>Jose Maria College Foundation Inc.</Text>
                          <Text style={styles.fbMeta}>Just now · Public</Text>
                        </View>
                        <Ionicons name="ellipsis-horizontal" size={16} color="#64748B" />
                      </View>
                      <Text style={styles.fbCaption}>
                        {finalCaption.trim() || 'Your final caption will appear here...'}
                      </Text>
                      {previewMediaList.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                          <FacebookMediaGrid
                            images={previewMediaList.map((m: any) => m.url)}
                            onImagePress={(uri: string) => onOpenFullScreenImage?.(uri)}
                          />
                        </View>
                      )}
                      <View style={styles.fbActionsRow}>
                        <View style={styles.fbActionBtn}>
                          <Ionicons name="thumbs-up-outline" size={15} color="#64748B" />
                          <Text style={styles.fbActionText}>Like</Text>
                        </View>
                        <View style={styles.fbActionBtn}>
                          <Ionicons name="chatbubble-outline" size={15} color="#64748B" />
                          <Text style={styles.fbActionText}>Comment</Text>
                        </View>
                        <View style={styles.fbActionBtn}>
                          <Ionicons name="arrow-redo-outline" size={15} color="#64748B" />
                          <Text style={styles.fbActionText}>Share</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {previewPlatform === 'instagram' && (
                    <View>
                      <View style={styles.fbHeader}>
                        <Image
                          source={require('../../assets/images/jmc_logo_sm.png')}
                          style={styles.fbAvatar}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fbPageName}>jmcfi_official</Text>
                          <Text style={styles.fbMeta}>Davao City, Philippines</Text>
                        </View>
                        <Ionicons name="ellipsis-horizontal" size={16} color="#64748B" />
                      </View>
                      {previewMediaList.length > 0 ? (
                        <InstagramMediaCarousel
                          images={previewMediaList.map((m: any) => m.url)}
                          onImagePress={(uri: string) => onOpenFullScreenImage?.(uri)}
                        />
                      ) : (
                        <View style={[styles.emptyMediaBox, { height: 180 }]}>
                          <Text style={styles.emptyMediaText}>No image for Instagram post</Text>
                        </View>
                      )}
                      <View style={styles.igActionsRow}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <Ionicons name="heart-outline" size={20} color="#0F172A" />
                          <Ionicons name="chatbubble-outline" size={19} color="#0F172A" />
                          <Ionicons name="paper-plane-outline" size={19} color="#0F172A" />
                        </View>
                        <Ionicons name="bookmark-outline" size={19} color="#0F172A" />
                      </View>
                      <Text style={styles.igCaption}>
                        <Text style={{ fontWeight: '700' }}>jmcfi_official </Text>
                        {finalCaption.trim() || 'Your final caption will appear here...'}
                      </Text>
                    </View>
                  )}

                  {previewPlatform === 'website' && (
                    <View style={{ padding: 12 }}>
                      {previewMediaList.length > 0 && (
                        <Image
                          source={{ uri: previewMediaList[0].url }}
                          style={styles.webCoverImg}
                          resizeMode="cover"
                        />
                      )}
                      <View style={styles.webDeptBadge}>
                        <Text style={styles.webDeptBadgeText}>{deptName}</Text>
                      </View>
                      <Text style={styles.webTitle}>{request.title || 'Untitled Article'}</Text>
                      <Text style={styles.webMeta}>Published by IMC · {submittedDateText || 'Today'}</Text>
                      <Text style={styles.webBody}>
                        {finalCaption.trim() || 'Your final article content will appear here...'}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.previewDisclaimer}>
                  Preview is illustrative; the published layout may vary by platform.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* ── Sticky Footer ── */}
          {isPending && (
            <View style={styles.footer}>
              <View style={styles.footerActions}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => onReject(request)}
                  disabled={isPublishing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.publishBtn, isPublishing && { opacity: 0.7 }]}
                  onPress={handlePublishPress}
                  disabled={isPublishing}
                  activeOpacity={0.85}
                >
                  {isPublishing ? (
                    <ActivityIndicator size="small" color="#0F172A" />
                  ) : (
                    <Text style={styles.publishBtnText}>Publish</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 1120,
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    backgroundColor: '#4C007C',
    paddingHorizontal: 24,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 44, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerIconInner: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#FFC72C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconCornerBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#4C007C',
    borderWidth: 1.5,
    borderColor: '#FFC72C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 8,
  },
  bodyScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bodyContent: {
    padding: 24,
    paddingBottom: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  postTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  submittedDate: {
    fontSize: 13,
    color: '#64748B',
  },
  metaCardsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  metaCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'stretch',
  },
  columnCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  sectionSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 16,
  },
  carouselFrame: {
    width: '100%',
    height: 240,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  carouselImageTouch: {
    width: '100%',
    height: '100%',
  },
  carouselMainImage: {
    width: '100%',
    height: '100%',
  },
  carouselArrowBtn: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyMediaBox: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyMediaText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  thumbBox: {
    width: 68,
    height: 50,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbBoxActive: {
    borderColor: '#4C007C',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  counterText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  filenameText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  downloadAllBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  downloadAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  platformChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  readOnlyBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  readOnlyText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  fieldLabelNoMargin: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionalTag: {
    fontSize: 12,
    color: '#64748B',
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    minHeight: 110,
    fontSize: 13.5,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    lineHeight: 20,
  },
  charCount: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 5,
  },
  uploadDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FAFAFC',
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  uploadDropzoneActive: {
    borderColor: '#5B21B6',
    backgroundColor: '#F5F3FF',
  },
  uploadIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 14,
  },
  browseBtn: {
    backgroundColor: '#4C007C',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 7,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedBar: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedBarCount: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
  },
  useOriginalsText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#4C007C',
  },
  replacementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  replacementCard: {
    width: 145,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  replacementThumb: {
    width: '100%',
    height: 98,
    backgroundColor: '#F1F5F9',
  },
  replacementInfo: {
    padding: 8,
  },
  replacementName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  replacementSize: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  removeBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 7,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  livePreviewSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  livePreviewCard: {
    width: '100%',
    maxWidth: 700,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  livePreviewHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  livePreviewIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  platformSwitchBar: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 9,
    padding: 4,
    marginBottom: 12,
  },
  platformTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 7,
  },
  platformTabActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  platformTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  deviceSwitchBar: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 9,
    padding: 3,
    marginBottom: 16,
  },
  deviceTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 7,
  },
  deviceTabActive: {
    backgroundColor: '#0F172A',
  },
  deviceTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  deviceTabTextActive: {
    color: '#FFFFFF',
  },
  mockupFrame: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
    paddingVertical: 12,
  },
  fbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 8,
  },
  fbAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  fbPageName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  fbMeta: {
    fontSize: 11.5,
    color: '#64748B',
  },
  fbCaption: {
    fontSize: 13.5,
    color: '#1E293B',
    lineHeight: 19,
    paddingHorizontal: 14,
  },
  fbActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  fbActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fbActionText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  igActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  igCaption: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
    paddingHorizontal: 14,
  },
  webCoverImg: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 10,
  },
  webDeptBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  webDeptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B21B6',
  },
  webTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  webMeta: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  webBody: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
  },
  previewDisclaimer: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 12,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  publishBtn: {
    backgroundColor: '#FFC72C',
    borderRadius: 8,
    paddingHorizontal: 28,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 110,
  },
  publishBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
});
