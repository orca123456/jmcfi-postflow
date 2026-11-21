import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { resolveImageUrl } from '../../services/api';
import { useThemeStore } from '../../store/theme';
import { FacebookMediaGrid, isImageMedia } from '../social/FacebookMediaGrid';
import { InstagramMediaCarousel } from '../social/InstagramMediaCarousel';

const BRAND_PURPLE = '#4C007C';

export const isDirectImcDetailsRequest = (request: any): boolean =>
  String(
    request?.routing_type ?? request?.routingType ??
    request?.rawPost?.routing_type ?? request?.rawPost?.routingType ?? ''
  ).trim().toLowerCase() === 'direct_imc';

type Photo = { uri: string; name: string };
type Palette = ReturnType<typeof getPalette>;
type ProgressStep = { label: string; detail: string; complete?: boolean; active?: boolean; error?: boolean };

const getPalette = (dark: boolean) => ({
  surface: Platform.OS === 'web' ? Colors.surface : dark ? '#172033' : Colors.surface,
  mutedSurface: Platform.OS === 'web' ? Colors.background : dark ? '#111827' : Colors.background,
  text: Platform.OS === 'web' ? Colors.textPrimary : dark ? '#F1F5F9' : Colors.textPrimary,
  muted: Platform.OS === 'web' ? Colors.textSecondary : dark ? '#CBD5E1' : Colors.textSecondary,
  border: Platform.OS === 'web' ? Colors.border : dark ? '#334155' : Colors.border,
  purple: dark ? '#D8B4FE' : BRAND_PURPLE,
  purpleSurface: dark ? '#2E1744' : '#F7F2FA',
  purpleBadgeBg: dark ? '#3B185F' : '#F3E8FF',
  purpleBadgeText: dark ? '#E9D5FF' : '#7C3AED',
  success: dark ? '#86EFAC' : '#15803D',
  successSurface: dark ? '#052E16' : '#F0FDF4',
  warning: dark ? '#FCD34D' : '#92400E',
  warningSurface: dark ? '#422006' : '#FFFBEB',
  error: dark ? '#FCA5A5' : '#B91C1C',
  errorSurface: dark ? '#450A0A' : '#FEF2F2',
});

const textValue = (value: any): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return value && typeof value === 'object'
    ? textValue(value.full_name ?? value.name ?? value.title ?? value.label)
    : '';
};

const formatDate = (value: any): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, {
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
      try { name = decodeURIComponent(uri.split('?')[0].split('/').pop() || ''); } catch { /* Keep the available path. */ }
    }
    return [{ uri, name: name || 'Image attachment' }];
  }) : [];

function Caption({ value, palette }: { value: string; palette: Palette }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={styles.caption} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && <RenderHtml
        contentWidth={width}
        source={{ html: value.includes('<') ? value : value.replace(/&/g, '&amp;').replace(/\n/g, '<br />') }}
        baseStyle={{ color: palette.text, fontSize: FontSize.sm, lineHeight: 20 }}
        tagsStyles={{ p: { marginTop: 0, marginBottom: Spacing.sm }, body: { margin: 0 }, img: { maxWidth: '100%' } }}
        defaultTextProps={{ selectable: true, style: Platform.OS === 'web' ? { overflowWrap: 'anywhere' } as any : undefined }}
      />}
    </View>
  );
}

function Photos({
  photos,
  palette,
  onView,
  empty,
}: {
  photos: Photo[];
  palette: Palette;
  onView: (photo: Photo, allPhotos?: Photo[]) => void;
  empty: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Keep index within bounds
  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, photos.length - 1));
  const currentPhoto = photos[safeIndex];

  useEffect(() => {
    setFailed(false);
    if (!currentPhoto?.uri) {
      setLoading(false);
      return;
    }

    // On web: check if the browser has already cached/completed loading this image
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const probe = new (window as any).Image();
      probe.src = currentPhoto.uri;
      if (probe.complete && probe.naturalWidth > 0) {
        setLoading(false);
        return;
      }
      probe.onload = () => setLoading(false);
      probe.onerror = () => {
        setFailed(true);
        setLoading(false);
      };
    }

    setLoading(true);

    // Safety timeout: Never allow spinner to loop indefinitely
    const timer = setTimeout(() => {
      setLoading(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [currentPhoto?.uri]);

  const handlePrev = () => {
    if (photos.length <= 1) return;
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    setFailed(false);
  };

  const handleNext = () => {
    if (photos.length <= 1) return;
    setActiveIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    setFailed(false);
  };

  if (!photos || photos.length === 0) {
    return (
      <View style={styles.photoSection}>
        <Text style={[styles.bodyText, { color: palette.muted }]}>{empty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.photoSection}>
      {/* Main Photo Preview */}
      <View
        style={[
          styles.carouselPreviewArea,
          {
            backgroundColor: palette.mutedSurface,
            borderColor: palette.border,
          },
        ]}
      >
        {failed ? (
          <View style={styles.fallbackBox}>
            <Ionicons name="image-outline" size={34} color={palette.muted} />
            <Text style={[styles.fallbackText, { color: palette.muted }]}>
              Image preview could not load.
            </Text>
            <Text style={[styles.fallbackSub, { color: palette.muted }]}>
              {currentPhoto?.name || 'Attachment'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={{ width: '100%', height: '100%' }}
            activeOpacity={0.9}
            onPress={() => onView(currentPhoto, photos)}
            accessibilityRole="button"
            accessibilityLabel={`View ${currentPhoto?.name || 'photo'}`}
          >
            <Image
              source={{ uri: currentPhoto?.uri }}
              style={styles.mainPreviewImage}
              resizeMode="contain"
              onLoad={() => setLoading(false)}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setFailed(true);
                setLoading(false);
              }}
            />
          </TouchableOpacity>
        )}

        {loading && !failed && (
          <ActivityIndicator
            size="small"
            color={palette.purple}
            style={styles.loadingSpinner}
          />
        )}

        {/* Previous Arrow */}
        {photos.length > 1 && (
          <TouchableOpacity
            style={[styles.arrowButton, styles.arrowLeft]}
            onPress={handlePrev}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
          >
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
        )}

        {/* Next Arrow */}
        {photos.length > 1 && (
          <TouchableOpacity
            style={[styles.arrowButton, styles.arrowRight]}
            onPress={handleNext}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Next photo"
          >
            <Ionicons name="chevron-forward" size={20} color="#0F172A" />
          </TouchableOpacity>
        )}

        {/* Counter Badge */}
        {photos.length > 1 && (
          <View style={styles.counterBadge}>
            <Text style={styles.counterBadgeText}>
              {safeIndex + 1} / {photos.length}
            </Text>
          </View>
        )}
      </View>

      {/* Thumbnails Filmstrip Row */}
      {photos.length > 1 && (
        <View
          style={styles.thumbnailsRow}
        >
          {photos.map((photo, idx) => {
            const isSel = idx === safeIndex;
            return (
              <TouchableOpacity
                key={`${photo.uri}-${idx}`}
                style={[
                  styles.thumbBox,
                  {
                    backgroundColor: palette.mutedSurface,
                    borderColor: isSel ? palette.purple : palette.border,
                    borderWidth: isSel ? 2.5 : 1.5,
                  },
                ]}
                onPress={() => {
                  setActiveIndex(idx);
                  setFailed(false);
                  onView(photo, photos);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View ${photo.name}`}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function DirectImcRequestDetailsModal({ request, onClose }: { request: any; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const dark = useThemeStore((state) => state.isDarkMode);
  const palette = getPalette(dark);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [lightboxFailed, setLightboxFailed] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram' | 'website'>('facebook');
  const [previewVersion, setPreviewVersion] = useState<'imc' | 'original'>('imc');
  const [websiteActiveIndex, setWebsiteActiveIndex] = useState(0);
  const modalWidth = Math.min(820, Math.max(0, width - Spacing.xl));
  const columns = width >= 1080;
  const raw = request?.rawPost ?? request ?? {};
  const workflows = raw.approval_workflows ?? request?.approval_workflows;
  const imcWorkflow = Array.isArray(workflows) ? [...workflows].reverse().find((entry: any) => entry.stage === 'imc_qa') : undefined;
  const status = String(request?.rawPost?.status ?? request?.rawStatus ?? request?.status ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  const action = String(imcWorkflow?.action ?? '').toLowerCase();
  const draft = status === 'draft';
  const rejected = status === 'rejected' || action === 'rejected';
  const revision = status === 'returned_for_revision' || action === 'returned_for_revision';
  const published = status === 'published';
  const scheduled = status === 'scheduled';
  const failed = status === 'publish_failed';
  const publishing = status === 'publishing';
  const finalized = !draft && (['approved', 'scheduled', 'publishing', 'published', 'publish_failed'].includes(status)
    || (action === 'approved' && !rejected && !revision));
  const snapshot = raw.submitted_materials ?? request?.submitted_materials;
  const hasSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot);
  const originalCaption = hasSnapshot ? textValue(snapshot.caption_narrative) : finalized ? '' : textValue(raw.caption_narrative ?? request?.caption);
  const currentMedia = raw.media ?? request?.media ?? [];
  const originalPhotos = photosFrom(hasSnapshot ? snapshot.media : finalized ? [] : currentMedia);
  const finalPhotos = photosFrom(currentMedia);
  const finalCaption = textValue(raw.caption_narrative ?? request?.caption);
  const captionChanged = !!hasSnapshot && textValue(snapshot.caption_narrative) !== finalCaption;
  const mediaKeys = (media: any) => Array.isArray(media) ? media.filter(isImageMedia).map((item: any) =>
    `${item.id ?? ''}|${resolveImageUrl(item.url || item.file_url || item.uri || item.file_path) || item.url || item.file_url || item.uri || item.file_path || ''}`
  ).sort() : [];
  const photosChanged = !!hasSnapshot && JSON.stringify(mediaKeys(snapshot.media)) !== JSON.stringify(mediaKeys(currentMedia));
  const showImcUpdates = finalized || captionChanged || photosChanged;
  const updatesDescription = finalized ? 'The preview uses this approved caption and these photos.'
    : rejected ? 'These changes were not approved for publication.'
      : revision ? 'These changes are awaiting your requested revisions.'
        : draft ? 'Saved changes are awaiting submission.'
          : 'Updates in progress · Not yet approved for publication.';
  const noUpdatesDescription = draft ? 'Submit this draft to start IMC review.'
    : rejected ? 'No publication changes were approved for this request.'
      : revision ? 'IMC is waiting for the requested revisions.'
        : 'IMC will add the final caption and images after review.';
  const instructions = textValue(raw.additional_instructions ?? request?.additional_instructions);
  const remarks = textValue(imcWorkflow?.remarks || raw.rejection_reason || request?.rejectionReason);
  const approver = textValue(imcWorkflow?.approver);
  const rawPlatforms = raw.target_platforms ?? request?.targetPlatforms ?? request?.platforms ?? [];
  const platformValues = Array.isArray(rawPlatforms) ? rawPlatforms : typeof rawPlatforms === 'string' ? rawPlatforms.split(',') : [];
  const platformNames: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    facebook: { label: 'Facebook', icon: 'logo-facebook' }, instagram: { label: 'Instagram', icon: 'logo-instagram' },
    website: { label: 'Website', icon: 'globe-outline' }, wordpress: { label: 'Website', icon: 'globe-outline' }, portal: { label: 'Website', icon: 'globe-outline' },
  };
  const platforms = [...new Set(platformValues.map((value: any) => textValue(value).toLowerCase()).filter(Boolean))]
    .map((value) => platformNames[value] || { label: value, icon: 'globe-outline' as const })
    .filter((value, index, values) => values.findIndex((other) => other.label === value.label) === index);
  const submittedAt = formatDate(raw.created_at ?? request?.created_at);
  const rawPublishedAt = raw.published_at ?? request?.published_at ?? raw.publishing_records?.[0]?.published_at ?? request?.publishing_records?.[0]?.published_at ?? (published ? (raw.updated_at ?? request?.updated_at) : null);
  const publishedAt = formatDate(rawPublishedAt);
  const isEditing = action === 'editing';
  const isReviewing = action === 'reviewing';
  const isAwaitingReview = !draft && !rejected && !revision && !finalized && !isEditing && !isReviewing;

  const statusLabel = draft ? 'Draft' : rejected ? 'Rejected' : revision ? 'Revision requested' : published ? 'Published' : scheduled ? 'Scheduled'
    : failed ? 'Publication needs attention' : publishing ? 'Publishing' : finalized ? 'Ready for publication'
      : isEditing ? 'Currently editing by IMC'
        : isReviewing ? 'Under review by IMC'
          : 'Awaiting IMC review';

  const guidance = draft ? 'This request is a draft. Submit it when your materials are ready.'
    : rejected ? 'IMC did not accept this request. Read the review notes below before preparing another request.'
      : revision ? 'Review the IMC feedback and update your request before resubmitting.'
        : published ? 'Your publication has been released. The final caption and images are shown below.'
          : scheduled ? 'IMC has scheduled your publication.'
            : failed ? 'IMC has finalized the content, but publication did not finish. The publishing team needs to check the release.'
              : publishing ? 'Your publication materials are being sent to the selected platforms.'
                : finalized ? 'IMC has reviewed and finalized the content. Publication is the next step.'
                  : isEditing ? 'IMC is actively preparing your graphics and final publication caption.'
                    : isReviewing ? 'IMC has opened and is reviewing your submitted materials.'
                      : 'Your request has been submitted and is in queue for IMC to review.';

  const steps: ProgressStep[] = [
    { label: 'Submitted', detail: draft ? 'Not submitted' : '', complete: !draft, active: draft },
    {
      label: 'IMC review',
      detail: draft ? 'Waiting'
        : rejected ? 'Rejected'
          : revision ? 'Revision requested'
            : finalized ? 'Completed'
              : isEditing ? 'Currently editing'
                : isReviewing ? 'Reviewing'
                  : 'Awaiting review',
      complete: finalized,
      active: !finalized && !draft && (isReviewing || isEditing),
      error: rejected,
    },
    {
      label: 'Publish',
      detail: published ? 'Published' : scheduled ? 'Scheduled' : failed ? 'Needs attention' : 'Waiting',
      complete: published,
      active: finalized && !published,
      error: failed,
    },
  ];

  const getStepIcon = (step: ProgressStep) => {
    if (step.error) return { name: 'close-circle' as const, color: '#DC2626' };
    if (step.complete) return { name: 'checkmark-circle' as const, color: '#059669' };
    return { name: 'time' as const, color: step.active ? palette.purple : '#94A3B8' };
  };

  // Preview photos: when IMC changes/edits photos, show IMC edited photos; otherwise show original
  const previewPhotos = (finalPhotos.length > 0 && (photosChanged || finalized || isEditing))
    ? finalPhotos
    : (originalPhotos.length > 0 ? originalPhotos : finalPhotos);
  // Preview caption: when IMC edits caption, show IMC edited caption; otherwise original
  const previewCaption = finalCaption || originalCaption;

  const openLightbox = (photo: Photo | null, allPhotos?: Photo[], initialIndex?: number) => {
    if (!photo) {
      setLightbox(null);
      return;
    }
    const list = allPhotos && allPhotos.length > 0 ? allPhotos : [photo];
    const idx = typeof initialIndex === 'number' && initialIndex >= 0 ? initialIndex : Math.max(0, list.findIndex((p) => p.uri === photo.uri));
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

  useEffect(() => { setLightbox(null); setPreviewPlatform('facebook'); setPreviewVersion('imc'); setWebsiteActiveIndex(0); }, [request?.id]);
  useEffect(() => { setLightboxFailed(false); }, [currentLightboxPhoto?.uri]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !isDirectImcDetailsRequest(request)) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (lightbox) setLightbox(null); else onClose();
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
  }, [request, lightbox, onClose]);

  if (!isDirectImcDetailsRequest(request)) return null;
  const sectionStyle = [styles.section, { backgroundColor: palette.surface, borderColor: palette.border }];
  const headingStyle = [styles.sectionTitle, { color: palette.text }];
  const labelStyle = [styles.label, { color: palette.muted }];
  const departmentName = textValue(raw.department || raw.requestor?.department || request.department);
  const requestorName = textValue(raw.requestor) || textValue(request.requestor) || textValue(request.requestedBy);

  return <>
    {Platform.OS === 'web' && React.createElement('style', null, `
      #requestor-imc-preview [role="button"]:focus-visible,
      #direct-imc-image-preview [role="button"]:focus-visible {
        outline: 2px solid ${palette.purple} !important;
        outline-offset: 2px;
      }
      #direct-imc-image-preview [role="button"]:focus-visible {
        outline-color: #D8B4FE !important;
      }
    `)}
    <Modal visible transparent animationType="fade" onRequestClose={() => lightbox ? setLightbox(null) : onClose()}>
      <View style={styles.backdrop}>
        <View nativeID="requestor-imc-preview" accessibilityViewIsModal style={[styles.modal, { width: modalWidth, maxHeight: Math.max(0, Math.min(height * 0.9, height - Spacing.xl)), backgroundColor: palette.surface, borderColor: '#4D027D', borderWidth: 2 }]}>
          {/* Header Row: Title on the left, X button on the far right */}
          <View nativeID="direct-imc-details-header" style={[styles.header, { borderColor: palette.border }]}>
            <View style={[styles.headerTop, { justifyContent: 'space-between', alignItems: 'center', width: '100%' }]}>
              <View style={styles.flexible}>
                <Text accessibilityRole="header" style={[styles.title, { color: palette.text, marginTop: 0 }]}>Request Details</Text>
              </View>
              <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close IMC publication request" style={[styles.iconButton, { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.mutedSurface }]}>
                <Ionicons name="close" size={20} color={palette.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { padding: width < 480 ? Spacing.md : Spacing.lg }]}>
            {/* Tracking Progress Stepper */}
            <View nativeID="direct-imc-progress" style={[styles.progressSection, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.progressHeaderRow}>
                <Text accessibilityRole="header" style={headingStyle}>Tracking progress</Text>
              </View>
              <View style={styles.steps}>
                {steps.map((step, index) => {
                  const icon = getStepIcon(step);
                  const isDone = step.complete;
                  return (
                    <React.Fragment key={step.label}>
                      <View style={styles.step}>
                        <Ionicons name={icon.name} size={20} color={icon.color} />
                        <Text style={[styles.smallText, styles.stepLabel, { color: palette.text }]}>{step.label}</Text>
                        {!!step.detail && (
                          <Text style={[styles.metaText, styles.stepDetail, { color: icon.color, fontWeight: 'bold', textTransform: 'uppercase' }]}>
                            {step.detail}
                          </Text>
                        )}
                      </View>
                      {index < steps.length - 1 && (
                        <View style={[styles.stepLine, { backgroundColor: isDone ? '#059669' : palette.border }]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
              {!!guidance && <Text style={[styles.bodyText, { color: palette.muted, marginTop: 4 }]}>{guidance}</Text>}
            </View>

            {/* Revision / Rejection Alert Banner (Only shown if action required or rejected) */}
            {(revision || rejected) && Boolean(remarks) && (() => {
              const alertBg = revision
                ? (dark ? '#271705' : '#FFFBEB')
                : (dark ? '#251214' : '#FEF2F2');
              const alertBorder = revision
                ? (dark ? '#78350F' : '#FDE68A')
                : (dark ? '#7F1D1D' : '#FECACA');
              const accentColor = revision ? '#D97706' : '#DC2626';
              const titleColor = revision
                ? (dark ? '#FDE68A' : '#92400E')
                : (dark ? '#FECACA' : '#991B1B');
              const cardBg = dark ? '#18181B' : '#FFFFFF';
              const cardBorder = revision
                ? (dark ? '#451A03' : '#FEF3C7')
                : (dark ? '#38161A' : '#FEE2E2');
              const labelColor = revision
                ? (dark ? '#F59E0B' : '#B45309')
                : (dark ? '#EF4444' : '#B91C1C');
              const textColor = dark ? '#F1F5F9' : '#1E293B';

              const bannerTitle = revision
                ? (approver ? `Revision requested by ${approver}` : 'Revision Requested')
                : (approver ? `Rejected by ${approver}` : 'Post Rejected');

              return (
                <View style={{
                  marginBottom: 16,
                  backgroundColor: alertBg,
                  borderWidth: 1,
                  borderColor: alertBorder,
                  borderLeftWidth: 4,
                  borderLeftColor: accentColor,
                  borderRadius: 12,
                  padding: 14,
                  gap: 10,
                  ...(Platform.OS === 'web'
                    ? { boxShadow: dark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(220, 38, 38, 0.06)' }
                    : { elevation: 2 }),
                }}>
                  {/* Header Row: Solid circular accent icon + Clean Title (No redundant status badge) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: accentColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons
                        name={revision ? "alert" : "close"}
                        size={16}
                        color="#FFFFFF"
                      />
                    </View>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: titleColor,
                      letterSpacing: -0.2,
                      flex: 1,
                    }}>
                      {bannerTitle}
                    </Text>
                  </View>

                  {/* Remarks Content Box - High Contrast, Legible Modern Surface */}
                  <View style={{
                    backgroundColor: cardBg,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    borderRadius: 8,
                    padding: 12,
                    gap: 4,
                  }}>
                    <Text style={{
                      fontSize: 10.5,
                      fontWeight: '700',
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: labelColor,
                    }}>
                      {revision ? 'Revision Notes' : 'Remarks'}
                    </Text>
                    <Text style={[styles.bodyText, { color: textColor, fontWeight: '500', lineHeight: 20, fontSize: 13.5 }]}>
                      {remarks}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Split Columns */}
            <View style={[styles.columns, { flexDirection: columns ? 'row' : 'column' }]}>
              {/* Left Column: Request Info, Original Photos & Publication Preview */}
              <View style={[styles.leftColumn, { flex: columns ? 1 : undefined }]}>
                {/* 1. Request Information Card */}
                <View style={[styles.infoCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text accessibilityRole="header" style={headingStyle}>Request information</Text>

                  <View style={styles.infoField}>
                    <Text style={labelStyle}>Request title</Text>
                    <Text selectable style={[styles.titleValue, { color: palette.text }]}>{textValue(raw.title ?? request.title)}</Text>
                  </View>

                  <View style={styles.infoGridRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={labelStyle}>Department</Text>
                      <View style={styles.deptBadge}>
                        <Text style={styles.deptBadgeText}>{departmentName || 'Department'}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={labelStyle}>Category</Text>
                      <View style={[styles.directCategoryBadge, { backgroundColor: palette.purpleBadgeBg }]}>
                        <Text style={[styles.directCategoryBadgeText, { color: palette.purpleBadgeText }]}>Direct to IMC</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoGridRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={labelStyle}>Requested by</Text>
                      <Text selectable style={[styles.bodyText, { color: palette.text, fontWeight: FontWeight.semiBold }]}>{requestorName || 'Unknown'}</Text>
                      <Text style={[styles.metaText, { color: palette.muted }]}>Requestor</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={labelStyle}>{draft ? 'Created on' : 'Submitted on'}</Text>
                      <Text selectable style={[styles.bodyText, { color: palette.text }]}>{submittedAt || '—'}</Text>
                    </View>
                  </View>

                  {Boolean(published && publishedAt) && (
                    <View style={styles.infoField}>
                      <Text style={labelStyle}>Published on</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="checkmark-done-circle" size={15} color="#059669" />
                        <Text selectable style={[styles.bodyText, { color: '#059669', fontWeight: FontWeight.semiBold }]}>{publishedAt}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.infoField}>
                    <Text style={labelStyle}>Target platforms</Text>
                    <View style={styles.platformRow}>
                      {platforms.length > 0 ? platforms.map((platform) => {
                        const iconBg = platform.label === 'Facebook' ? '#EFF6FF' : platform.label === 'Instagram' ? '#FDF2F8' : '#ECFDF5';
                        const iconColor = platform.label === 'Facebook' ? '#1877F2' : platform.label === 'Instagram' ? '#E1306C' : '#059669';
                        return (
                          <View key={platform.label} style={[styles.platformBadge, { backgroundColor: iconBg, borderColor: palette.border }]}>
                            <Ionicons name={platform.icon} size={13} color={iconColor} />
                            <Text style={[styles.smallText, { color: iconColor, fontWeight: FontWeight.semiBold }]}>{platform.label}</Text>
                          </View>
                        );
                      }) : <Text style={[styles.bodyText, { color: palette.muted }]}>No platforms recorded.</Text>}
                    </View>
                  </View>

                  {/* Original Caption inside Request Information */}
                  <View nativeID="direct-imc-submitted" style={[styles.infoField, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={labelStyle}>Original caption</Text>
                      <Text style={[styles.metaText, { color: palette.muted }]}>Submitted materials</Text>
                    </View>
                    {originalCaption ? <Caption value={originalCaption} palette={palette} />
                      : <Text style={[styles.bodyText, { color: palette.muted }]}>{finalized && !hasSnapshot ? 'Original caption was not saved for this request.' : 'No caption was submitted.'}</Text>}
                  </View>

                  {/* Additional Instructions */}
                  {!!instructions && (
                    <View style={[styles.infoField, { marginTop: 10 }]}>
                      <Text style={[labelStyle, { color: palette.purple }]}>Additional instructions</Text>
                      <Caption value={instructions} palette={palette} />
                    </View>
                  )}
                </View>

                {/* 2. Original Photos Card (Above Publication Preview!) */}
                <View style={[styles.infoCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Text accessibilityRole="header" style={headingStyle}>Original photos</Text>
                    <View style={[styles.tagBadge, { backgroundColor: palette.mutedSurface, borderColor: palette.border }]}>
                      <Text style={[styles.tagBadgeText, { color: palette.muted }]}>{(!finalized || hasSnapshot) ? `${originalPhotos.length} ${originalPhotos.length === 1 ? 'photo' : 'photos'} attached` : 'Raw uploads'}</Text>
                    </View>
                  </View>
                  <Text style={[styles.metaText, { color: palette.muted, marginBottom: 8 }]}>Original photos attached with your initial submission</Text>
                  <Photos photos={originalPhotos} palette={palette} onView={openLightbox}
                    empty={finalized && !hasSnapshot ? 'Original photos were not saved for this request.' : 'No photos were submitted.'} />
                </View>

                {/* 3. Publication Preview Mockup (at the bottom, below Original Photos) */}
                <View style={styles.previewSection}>
                  <View style={styles.previewHeaderRow}>
                    <Text accessibilityRole="header" style={headingStyle}>Publication preview</Text>
                  </View>

                  {/* Platform Tabs */}
                  <View style={styles.platforms}>
                    {(['facebook', 'instagram', 'website'] as const).map((value) => {
                      const active = previewPlatform === value;
                      const pColor = value === 'facebook' ? '#1877F2' : value === 'instagram' ? '#E1306C' : '#059669';
                      return <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`Preview on ${platformNames[value].label}`}
                        accessibilityState={{ selected: active }} onPress={() => setPreviewPlatform(value)}
                        style={[
                          styles.previewTab,
                          {
                            backgroundColor: active ? (dark ? '#422006' : '#FEF3C7') : palette.mutedSurface,
                            borderColor: active ? (dark ? '#92400E' : '#FDE68A') : palette.border
                          }
                        ]}>
                        <Ionicons name={platformNames[value].icon} size={14} color={active ? pColor : palette.muted} />
                        <Text style={[styles.metaText, { color: active ? '#B45309' : palette.muted, fontWeight: active ? FontWeight.bold : FontWeight.medium }]}>{platformNames[value].label}</Text>
                      </TouchableOpacity>;
                    })}
                  </View>

                  {/* Social Preview Mockup Card */}
                  {previewPlatform === 'website' ? (
                    <View style={[styles.websiteArticleCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                      {/* Website Category Badge & URL */}
                      <View style={styles.websiteBadgeRow}>
                        <View style={[styles.websiteCategoryPill, { backgroundColor: dark ? '#064E3B' : '#ECFDF5' }]}>
                          <Ionicons name="globe-outline" size={12} color="#059669" />
                          <Text style={styles.websiteCategoryText}>Website Article Preview</Text>
                        </View>
                        <Text style={[styles.metaText, { color: palette.muted }]}>jmcfi.edu.ph</Text>
                      </View>

                      {/* Headline Title */}
                      <Text style={[styles.websiteHeadline, { color: palette.text }]}>
                        {textValue(raw.title ?? request.title) || 'Untitled Content Request'}
                      </Text>

                      {/* Byline */}
                      <View style={styles.websiteBylineRow}>
                        <Image source={require('../../assets/images/jmc_logo.png')} style={styles.websiteBylineLogo} resizeMode="contain" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.smallText, { color: palette.text, fontWeight: FontWeight.bold }]}>
                            Jose Maria College Foundation Inc.
                          </Text>
                          <Text style={[styles.metaText, { color: palette.muted }]}>
                            Official Web Portal {captionChanged || photosChanged ? '• Final IMC Version' : '• Original Submission'}
                          </Text>
                        </View>
                      </View>

                      {/* Featured Media / Gallery */}
                      {previewPhotos.length > 0 ? (
                        <View style={styles.websiteMediaWrap}>
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => openLightbox(previewPhotos[websiteActiveIndex] || previewPhotos[0], previewPhotos, websiteActiveIndex)}
                            style={styles.websiteFeaturedImageBox}
                            accessibilityRole="button"
                            accessibilityLabel={`View ${previewPhotos[websiteActiveIndex]?.name || 'featured image'}`}
                          >
                            <Image
                              source={{ uri: (previewPhotos[websiteActiveIndex] || previewPhotos[0]).uri }}
                              style={styles.websiteFeaturedImage}
                              resizeMode="cover"
                            />
                            <View style={styles.websiteFeaturedBadge}>
                              <Ionicons name="globe-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.websiteFeaturedBadgeText}>
                                Website Featured Image {previewPhotos.length > 1 ? `(${websiteActiveIndex + 1} of ${previewPhotos.length})` : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          {previewPhotos.length > 1 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.websiteThumbnailsRow}>
                              {previewPhotos.map((photo, idx) => {
                                const isSelected = idx === websiteActiveIndex;
                                return (
                                  <TouchableOpacity
                                    key={`${photo.uri}-${idx}`}
                                    style={[styles.websiteThumbBox, isSelected && styles.websiteThumbBoxActive]}
                                    onPress={() => setWebsiteActiveIndex(idx)}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Select photo ${idx + 1}`}
                                  >
                                    <Image source={{ uri: photo.uri }} style={styles.websiteThumbImage} resizeMode="cover" />
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          )}
                        </View>
                      ) : (
                        <View style={[styles.previewEmpty, { backgroundColor: palette.mutedSurface }]}>
                          <Ionicons name="image-outline" size={28} color={palette.muted} />
                          <Text style={[styles.smallText, { color: palette.muted }]}>No featured image attached.</Text>
                        </View>
                      )}

                      {/* Article Body */}
                      <View style={styles.websiteArticleBody}>
                        {previewCaption ? (
                          <Caption value={previewCaption} palette={palette} />
                        ) : (
                          <Text style={[styles.bodyText, { color: palette.muted }]}>No article caption provided.</Text>
                        )}
                      </View>

                      {/* Clean Portal Footer */}
                      <View style={[styles.websiteFooterBar, { borderColor: palette.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="link-outline" size={13} color="#059669" />
                          <Text style={[styles.metaText, { color: '#059669', fontWeight: FontWeight.bold }]}>
                            jmcfi.edu.ph/portal/announcements
                          </Text>
                        </View>
                        <View style={[styles.websiteTagPill, { backgroundColor: palette.mutedSurface }]}>
                          <Text style={[styles.websiteTagPillText, { color: palette.muted }]}>Portal Release</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.socialCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                      <View style={styles.socialHeader}>
                        <Image source={require('../../assets/images/jmc_logo.png')} style={styles.socialLogo} resizeMode="contain" />
                        <View style={styles.flexible}>
                          <Text style={[styles.smallText, { color: palette.text, fontWeight: FontWeight.bold }]}>Jose Maria College Foundation Inc.</Text>
                          <Text style={[styles.metaText, { color: palette.muted }]}>
                            {platformNames[previewPlatform].label} preview {captionChanged || photosChanged ? '• Final IMC version' : '• Original submission'}
                          </Text>
                        </View>
                      </View>

                      {previewPlatform !== 'instagram' && (previewCaption ? <Caption value={previewCaption} palette={palette} /> : <Text style={[styles.bodyText, { color: palette.muted }]}>No caption provided.</Text>)}
                      {previewPhotos.length > 0 ? (previewPlatform === 'instagram'
                        ? <InstagramMediaCarousel images={previewPhotos.map((photo) => photo.uri)} onImagePress={(uri) => { const p = previewPhotos.find((photo) => photo.uri === uri); openLightbox(p || null, previewPhotos); }} />
                        : <FacebookMediaGrid images={previewPhotos.map((photo) => photo.uri)} onImagePress={(uri) => { const p = previewPhotos.find((photo) => photo.uri === uri); openLightbox(p || null, previewPhotos); }} containerStyle={{ marginHorizontal: 0 }} />
                      ) : (
                        <View style={[styles.previewEmpty, { backgroundColor: palette.mutedSurface }]}><Ionicons name="image-outline" size={28} color={palette.muted} /><Text style={[styles.smallText, { color: palette.muted }]}>No photos attached.</Text></View>
                      )}
                      {previewPlatform === 'instagram' && (previewCaption ? <Caption value={previewCaption} palette={palette} /> : <Text style={[styles.bodyText, { color: palette.muted }]}>No caption provided.</Text>)}

                      {/* Social Footer Actions (Facebook & Instagram only) */}
                      <View style={[styles.socialFooterActions, { borderTopColor: palette.border }]}>
                        <View style={styles.socialActionBtn}>
                          <Ionicons name="thumbs-up-outline" size={14} color={palette.muted} />
                          <Text style={[styles.metaText, { color: palette.muted }]}>Like</Text>
                        </View>
                        <View style={styles.socialActionBtn}>
                          <Ionicons name="chatbubble-outline" size={14} color={palette.muted} />
                          <Text style={[styles.metaText, { color: palette.muted }]}>Comment</Text>
                        </View>
                        <View style={styles.socialActionBtn}>
                          <Ionicons name="share-social-outline" size={14} color={palette.muted} />
                          <Text style={[styles.metaText, { color: palette.muted }]}>Share</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Right Column: IMC Updates / Edited Version */}
              <View style={[styles.informationColumn, { flex: columns ? 1 : undefined }]}>
                {/* IMC Updates Section - Highlighted What IMC Replaced and Edited */}
                <View nativeID="direct-imc-final" style={[styles.imcUpdatesCard, { backgroundColor: palette.surface, borderColor: showImcUpdates ? palette.purple : palette.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="sparkles" size={16} color={palette.purple} />
                      <Text accessibilityRole="header" style={headingStyle}>IMC updates</Text>
                    </View>
                    {showImcUpdates && (
                      <View style={[styles.tagBadge, { backgroundColor: palette.purpleBadgeBg, borderColor: palette.purple }]}>
                        <Text style={[styles.tagBadgeText, { color: palette.purpleBadgeText }]}>IMC Changes Applied</Text>
                      </View>
                    )}
                  </View>

                  {showImcUpdates ? <>
                    <Text style={[styles.smallText, { color: palette.muted }]}>{updatesDescription}</Text>

                    {/* Clear Caption Edit Comparison */}
                    <View style={[
                      styles.comparisonBlock,
                      captionChanged
                        ? { backgroundColor: dark ? '#2E174425' : '#FAF5FF', borderColor: dark ? '#6B21A8' : '#D8B4FE' }
                        : { backgroundColor: palette.mutedSurface, borderColor: palette.border }
                    ]}>
                      <View style={styles.comparisonHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 140, flexShrink: 1 }}>
                          <Ionicons name={captionChanged ? 'create-outline' : 'checkmark-circle-outline'} size={15} color={captionChanged ? palette.purple : palette.success} />
                          <Text numberOfLines={1} style={[labelStyle, captionChanged && { color: palette.purple }, { flexShrink: 1 }]}>
                            {hasSnapshot ? captionChanged ? 'Caption updated by IMC' : 'Caption as submitted' : 'Final caption'}
                          </Text>
                        </View>
                        {captionChanged && (
                          <View style={[styles.changeStatusPill, { backgroundColor: palette.purpleBadgeBg }]}>
                            <Text style={[styles.changeStatusPillText, { color: palette.purpleBadgeText }]}>Revised Copy</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.captionContentBox, { backgroundColor: dark ? 'rgba(0,0,0,0.25)' : '#FFFFFF', borderColor: dark ? '#3B185F' : '#EDE9FE' }]}>
                        {finalCaption ? <Caption value={finalCaption} palette={palette} /> : <Text style={[styles.bodyText, { color: palette.muted }]}>No final caption recorded.</Text>}
                      </View>
                    </View>

                    {/* Clear Photos Replacement Comparison */}
                    <View style={[
                      styles.comparisonBlock,
                      photosChanged
                        ? { backgroundColor: dark ? '#052E1620' : '#F0FDF4', borderColor: dark ? '#166534' : '#BBF7D0' }
                        : { backgroundColor: palette.mutedSurface, borderColor: palette.border }
                    ]}>
                      <View style={styles.comparisonHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 140, flexShrink: 1 }}>
                          <Ionicons name={photosChanged ? 'images-outline' : 'image-outline'} size={15} color={photosChanged ? palette.success : palette.muted} />
                          <Text numberOfLines={1} style={[labelStyle, photosChanged && { color: palette.success }, { flexShrink: 1 }]}>
                            {hasSnapshot ? photosChanged ? 'Photos replaced by IMC' : 'Photos as submitted' : 'Final photos'} · {finalPhotos.length} {finalPhotos.length === 1 ? 'photo' : 'photos'}
                          </Text>
                        </View>
                        {photosChanged && (
                          <View style={[styles.changeStatusPill, { backgroundColor: palette.successSurface }]}>
                            <Text style={[styles.changeStatusPillText, { color: palette.success }]}>Replaced Artwork</Text>
                          </View>
                        )}
                      </View>
                      <Photos photos={finalPhotos} palette={palette} onView={openLightbox} empty="No final photos attached." />
                    </View>
                  </> : <Text style={[styles.bodyText, { color: palette.muted }]}>{noUpdatesDescription}</Text>}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Modal Footer Actions matching standard request */}
          <View style={[styles.footer, { backgroundColor: dark ? palette.mutedSurface : '#FAFAFA', borderColor: palette.border }]}>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close request details" style={[styles.closeButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.closeButtonText, { color: palette.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Full Screen Lightbox Viewer with Multi-Photo Gallery Navigation */}
    {!!currentLightboxPhoto && (
      <Modal visible transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View nativeID="direct-imc-image-preview" accessibilityViewIsModal style={styles.lightbox}>
          {/* Header Bar */}
          <View style={styles.lightboxHeader}>
            <View style={{ flex: 1, minWidth: 0, marginRight: Spacing.sm }}>
              <Text numberOfLines={1} style={[styles.bodyText, { color: '#FFFFFF', fontWeight: FontWeight.bold }]}>
                {currentLightboxPhoto.name}
              </Text>
              {lightbox && lightbox.photos.length > 1 && (
                <Text style={[styles.metaText, { color: '#CBD5E1', marginTop: 2 }]}>
                  Photo {lightbox.index + 1} of {lightbox.photos.length} · Use ← and → keys to browse
                </Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
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
                style={styles.iconButton}
              >
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Stage with Navigation Arrows */}
          <View style={styles.lightboxStage}>
            {lightboxFailed ? (
              <View style={[styles.imageFallback, { flex: 1 }]}>
                <Ionicons name="image-outline" size={40} color="#FFFFFF" />
                <Text style={[styles.bodyText, { color: '#FFFFFF', textAlign: 'center' }]}>
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
  </>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: Spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(17,24,39,0.5)' },
  modal: { minWidth: 0, borderRadius: 16, borderWidth: 2, borderColor: '#4D027D', overflow: 'hidden', flexShrink: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, flexShrink: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flexible: { flex: 1, minWidth: 0 },
  title: { fontSize: FontSize.md + 2, fontWeight: FontWeight.bold, lineHeight: 24, marginTop: Spacing.xs },
  eyebrowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
  eyebrow: { fontSize: FontSize.xs - 1, fontWeight: FontWeight.bold, letterSpacing: 0.6 },
  directTypePill: { flexDirection: 'row', alignItems: 'center', borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  directTypePillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  headerBadge: { alignSelf: 'flex-start', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, maxWidth: '100%' },
  headerBadgeText: { fontSize: FontSize.xs - 1, fontWeight: FontWeight.semiBold, lineHeight: 16 },
  iconButton: { width: 40, height: 40, flexShrink: 0, justifyContent: 'center', alignItems: 'center', borderRadius: BorderRadius.md },
  scroll: { flexShrink: 1, minHeight: 0 },
  content: { gap: Spacing.lg },

  // Progress Section
  progressSection: { gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, minWidth: 0 },
  progressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  steps: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.xs, marginTop: Spacing.sm },
  step: { flex: 1.2, minWidth: 0, alignItems: 'center', paddingHorizontal: Spacing.xs },
  stepLine: { height: 2, flex: 1, marginTop: 9, marginHorizontal: -4 },
  stepLabel: { fontSize: 11, fontWeight: FontWeight.bold, textAlign: 'center', marginTop: 4 },
  stepDetail: { fontSize: 10, textAlign: 'center', marginTop: 2 },
  revisionAlertCard: { padding: 12, borderWidth: 1, borderRadius: BorderRadius.md, gap: 4 },
  revisionAlertTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Split Columns
  columns: { gap: Spacing.md, minWidth: 0, alignItems: 'flex-start' },
  leftColumn: { minWidth: 0, gap: Spacing.md, alignSelf: 'stretch' },
  informationColumn: { minWidth: 0, gap: Spacing.md, alignSelf: 'stretch' },

  // Publication Preview
  previewSection: { minWidth: 0, gap: Spacing.sm },
  previewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  versionToggleContainer: { flexDirection: 'row', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#CBD5E1', overflow: 'hidden', padding: 2 },
  versionToggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'transparent' },
  versionToggleBtnActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  versionToggleText: { fontSize: 11 },
  platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  previewTab: { minHeight: 38, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, gap: Spacing.xs, flexDirection: 'row', alignItems: 'center' },
  socialCard: { padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.lg, minWidth: 0, gap: Spacing.sm },
  websiteArticleCard: { padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.lg, minWidth: 0, gap: Spacing.sm },
  websiteBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  websiteCategoryPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  websiteCategoryText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  websiteHeadline: { fontSize: FontSize.md + 1, fontWeight: FontWeight.bold, lineHeight: 22 },
  websiteBylineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: 6 },
  websiteBylineLogo: { width: 28, height: 28, borderRadius: 14 },
  websiteMediaWrap: { width: '100%', gap: 8 },
  websiteFeaturedImageBox: { width: '100%', height: 180, borderRadius: 8, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  websiteFeaturedImage: { width: '100%', height: '100%' },
  websiteFeaturedBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(15, 23, 42, 0.75)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, flexDirection: 'row', alignItems: 'center' },
  websiteFeaturedBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  websiteThumbnailsRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  websiteThumbBox: { width: 44, height: 44, borderRadius: 6, overflow: 'hidden', borderWidth: 1.5, borderColor: '#CBD5E1' },
  websiteThumbBoxActive: { borderColor: '#059669', borderWidth: 2 },
  websiteThumbImage: { width: '100%', height: '100%' },
  websiteArticleBody: { paddingTop: 4 },
  websiteFooterBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 6 },
  websiteTagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  websiteTagPillText: { fontSize: 10, fontWeight: '700' },
  socialHeader: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', minWidth: 0 },
  socialLogo: { width: 32, height: 32, flexShrink: 0 },
  previewEmpty: { minHeight: 112, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, gap: Spacing.sm },
  socialFooterActions: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 10, marginTop: 4, justifyContent: 'space-around' },
  socialActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // Section Styles
  section: { padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, minWidth: 0, gap: Spacing.sm, alignSelf: 'stretch' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, lineHeight: 20 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, flexShrink: 0 },
  tagBadgeText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  label: { fontSize: FontSize.xs - 1, fontWeight: FontWeight.bold, lineHeight: 16, textTransform: 'uppercase' },
  bodyText: { fontSize: FontSize.xs + 1, lineHeight: 18, flexShrink: 1 },
  smallText: { fontSize: FontSize.xs + 1, lineHeight: 18 },
  metaText: { fontSize: FontSize.xs, lineHeight: 16 },
  caption: { width: '100%', minWidth: 0 },

  // Comparison Blocks
  comparisonBlock: { padding: 12, borderWidth: 1, borderRadius: BorderRadius.md, gap: 8, marginBottom: 12 },
  comparisonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  changeStatusPill: { paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6, flexShrink: 0 },
  changeStatusPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  captionContentBox: { padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 2 },

  // Request Information Card
  infoCard: { padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, gap: Spacing.sm },
  infoField: { gap: 2, marginBottom: 4 },
  infoGridRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: 4 },
  titleValue: { fontSize: FontSize.sm + 1, fontWeight: FontWeight.bold, lineHeight: 20 },
  deptBadge: { alignSelf: 'flex-start', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  deptBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#B45309' },
  directCategoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  directCategoryBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  platformBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderRadius: BorderRadius.md },

  // IMC Updates Card
  imcUpdatesCard: { padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, gap: Spacing.sm, alignSelf: 'stretch' },

  // Photos Carousel Gallery
  photoSection: { minWidth: 0, width: '100%' },
  carouselPreviewArea: {
    height: 220,
    borderRadius: 8,
    borderWidth: 1,
    position: 'relative',
    marginTop: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 6,
    textAlign: 'center',
  },
  fallbackSub: {
    fontSize: 11,
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
    zIndex: 5,
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
    zIndex: 5,
  },
  counterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  thumbnailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingVertical: 2,
  },
  thumbBox: {
    width: 54,
    height: 54,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  photoGalleryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 8, borderBottomWidth: 1 },
  photoGalleryHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  galleryQuickActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  photoBoxWrapper: { width: 92, gap: 4 },
  photoBoxItem: { width: 92, height: 92, borderRadius: 8, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  photoBoxImage: { width: '100%', height: '100%' },
  photoBoxLoading: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -10 }, { translateY: -10 }] },
  photoBoxFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoBoxExpandBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(15, 23, 42, 0.65)', borderRadius: 4, padding: 3 },
  photoBoxIndexBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(15, 23, 42, 0.75)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  photoBoxIndexText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  photoBoxMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 92 },
  photoBoxName: { fontSize: 10, fontWeight: '500', flex: 1, minWidth: 0, marginRight: 2 },
  photoBoxViewBtn: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 1, paddingHorizontal: 2 },
  photoBoxViewText: { fontSize: 10, fontWeight: '700' },

  // Footer & Lightbox
  footer: { borderTopWidth: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexShrink: 0, alignItems: 'flex-end' },
  closeButton: { minHeight: 40, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: BorderRadius.md },
  closeButtonText: { fontSize: FontSize.xs + 1, fontWeight: FontWeight.semiBold },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', padding: Spacing.md },
  lightboxHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', paddingBottom: Spacing.md, flexShrink: 0 },
  lightboxStage: { flex: 1, width: '100%', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  lightboxArrow: { position: 'absolute', top: '50%', transform: [{ translateY: -22 }], width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  lightboxArrowLeft: { left: 16 },
  lightboxArrowRight: { right: 16 },
  lightboxIndexPill: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  lightboxIndexPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  lightboxFilmstripWrap: { height: 64, marginTop: 10, justifyContent: 'center' },
  lightboxFilmstrip: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, alignItems: 'center' },
  lightboxThumb: { width: 48, height: 48, borderRadius: 6, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.35)' },
  lightboxThumbActive: { borderColor: '#C084FC', borderWidth: 2.5 },
  lightboxThumbImg: { width: '100%', height: '100%' },
  lightboxImage: { width: '100%', flex: 1, minHeight: 0 },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
});
