import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { postsApi, departmentsApi, resolveImageUrl } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import {
  optimizeImageForUpload,
  getImageDimensions,
  fitImageForInstagram,
  isImageFile,
} from '../../utils/imageOptimizer';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Modal,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ComplianceResultModal } from '../ui/ComplianceResultModal';
import { PaginationControl } from '../ui/PaginationControl';
import { FacebookMediaGrid } from '../social/FacebookMediaGrid';
import { InstagramMediaCarousel } from '../social/InstagramMediaCarousel';
import { FormattedText } from '../ui/FormattedText';
import { RichTextEditor } from '../ui/RichTextEditor';
import { BorderRadius, FontSize, Spacing } from '../../constants/theme';
import { useThemeStore } from '../../store/theme';

const BRAND_PURPLE = '#4C007C';
const BRAND_GOLD = '#FFC72C';
const GOLD_INK = '#1A1A2E';
const CONTROL_HEIGHT = 44;
const getPalette = (isDarkMode: boolean) => ({
  dark: isDarkMode,
  surface: isDarkMode ? '#16213A' : 'rgba(255, 255, 255, 0.94)',
  elevated: isDarkMode ? '#1E293B' : '#F8FAFC',
  field: isDarkMode ? '#0F172A' : '#FFFFFF',
  text: isDarkMode ? '#F8FAFC' : '#1A1A2E',
  muted: isDarkMode ? '#CBD5E1' : '#64748B',
  border: isDarkMode ? '#334155' : '#E2E8F0',
  purple: isDarkMode ? '#D8B4FE' : BRAND_PURPLE,
  purpleTint: isDarkMode ? '#3B0764' : '#F3E8FF',
});

interface ModernRequestorDashboardProps {
  onSwitchToClassic: () => void;
  onChangeRequestType?: () => void;
  onRequestSubmitted?: (data: any) => void;
  onBackToDashboard?: () => void;
  allRawPosts?: any[];
}

interface AttachedMediaItem {
  uri: string;
  name: string;
  file?: any;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  isInstagramQualified?: boolean;
}

interface RequestCardData {
  id: string;
  code: string;
  title: string;
  status: 'Pending' | 'Approved' | 'Reviewing';
  rawStatus?: string;
  routingType?: string;
  date: string;
  time?: string;
  department: string;
  requestedBy: string;
  mediaCount: number;
  thumbnailUrl: string;
  caption?: string;
  media?: any[];
  rawPost?: any;
  targetPlatforms?: string[];
}

const isDirectImcPost = (p: any): boolean => {
  const rt = String(p?.routing_type || p?.routingType || '').toLowerCase().trim();
  return rt === 'direct_imc';
};

const mapRawPostToCard = (p: any, fallbackUser?: any): RequestCardData => {
  let st: RequestCardData['status'] = 'Pending';
  if (p.status === 'approved' || p.status === 'scheduled' || p.status === 'published') {
    st = 'Approved';
  } else if (p.status === 'pending_imc_qa' || p.status === 'pending_office_head' || p.status === 'pending_vice_president') {
    st = 'Pending';
  } else {
    st = 'Reviewing';
  }

  const checklist = p.imc_branding_checklist || null;
  const effectiveMedia = (checklist?.has_replacement_media && Array.isArray(checklist?.final_media) && checklist.final_media.length > 0)
    ? checklist.final_media
    : (Array.isArray(p.media) ? p.media : []);

  let thumb = '';
  if (Array.isArray(effectiveMedia) && effectiveMedia.length > 0 && effectiveMedia[0]?.url) {
    thumb = resolveImageUrl(effectiveMedia[0].url) || '';
  } else if (p.featured_image) {
    thumb = resolveImageUrl(p.featured_image) || '';
  }

  const codeVal = p.code || (p.slug ? p.slug.split('-').slice(0, 3).join('-').toUpperCase() : `CR-2026-${String(p.id || '').padStart(3, '0')}`);

  return {
    id: String(p.id || Date.now()),
    code: codeVal,
    title: p.title || 'Untitled Request',
    status: st,
    rawStatus: p.status,
    routingType: p.routing_type || p.routingType || 'direct_imc',
    date: p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today',
    time: p.created_at ? new Date(p.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : undefined,
    department: p.requestor?.department || fallbackUser?.department || 'BSIT Department',
    requestedBy: p.requestor?.full_name || fallbackUser?.name || 'Requestor',
    mediaCount: Array.isArray(effectiveMedia) ? effectiveMedia.length : (p.featured_image ? 1 : 0),
    thumbnailUrl: thumb,
    caption: checklist?.refined_caption || p.caption_narrative || '',
    media: effectiveMedia,
    rawPost: p,
    targetPlatforms: Array.isArray(p.target_platforms)
      ? p.target_platforms
      : typeof p.target_platforms === 'string'
      ? [p.target_platforms]
      : ['facebook'],
  };
};

export const ModernRequestorDashboard: React.FC<ModernRequestorDashboardProps> = ({
  onSwitchToClassic,
  onChangeRequestType,
  onRequestSubmitted,
  onBackToDashboard,
  allRawPosts,
}) => {
  const { height } = useWindowDimensions();
  const isDarkMode = useThemeStore((store) => store.isDarkMode);
  const palette = useMemo(() => getPalette(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [contentWidth, setContentWidth] = useState(0);
  const [listWidth, setListWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const isDesktop = contentWidth >= 1040;
  const isCompact = contentWidth < 600;
  const isCompactCard = listWidth < 560;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  // View & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Pending' | 'Approved' | 'Reviewing'>('All');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [selectedPost, setSelectedPost] = useState<RequestCardData | null>(null);

  // Form States (UI Prototype)
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('2026-11-05');
  const [formTime, setFormTime] = useState('09:00 AM');
  const { user } = useAuthStore();
  const [formDepartment, setFormDepartment] = useState(user?.department || 'BSIT Department');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [formCaption, setFormCaption] = useState('');
  const [requests, setRequests] = useState<RequestCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<AttachedMediaItem[]>([]);
  const [targetPlatforms, setTargetPlatforms] = useState<{
    facebook: boolean;
    instagram: boolean;
    website: boolean;
  }>({
    facebook: false,
    instagram: false,
    website: false,
  });
  const [isOptimizingImages, setIsOptimizingImages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  // Social Preview State
  const [formPreviewPlatform, setFormPreviewPlatform] = useState<'facebook' | 'instagram' | 'website'>('facebook');
  const [modalPlatformTab, setModalPlatformTab] = useState<'facebook' | 'instagram' | 'website'>('facebook');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Website Featured Image Selection & Drag-to-Scroll State
  const [featuredMediaIndex, setFeaturedMediaIndex] = useState(0);
  const [modalViewFeaturedIndex, setModalViewFeaturedIndex] = useState(0);

  const featuredScrollRef = useRef<ScrollView>(null);
  const isDraggingFeatured = useRef(false);
  const dragFeaturedStartX = useRef(0);
  const dragFeaturedScrollLeft = useRef(0);
  const dragFeaturedMoved = useRef(false);
  const [canScrollLeftFeatured, setCanScrollLeftFeatured] = useState(false);
  const [canScrollRightFeatured, setCanScrollRightFeatured] = useState(false);

  const checkFeaturedScroll = useCallback(() => {
    if (Platform.OS === 'web' && featuredScrollRef.current) {
      const node = (featuredScrollRef.current as any)?.getScrollableNode?.() || (featuredScrollRef.current as any);
      if (node) {
        setCanScrollLeftFeatured(node.scrollLeft > 4);
        setCanScrollRightFeatured(node.scrollLeft < node.scrollWidth - node.clientWidth - 4);
      }
    }
  }, []);

  const handleFeaturedScrollBy = (offset: number) => {
    if (Platform.OS === 'web' && featuredScrollRef.current) {
      const node = (featuredScrollRef.current as any)?.getScrollableNode?.() || (featuredScrollRef.current as any);
      if (node && typeof node.scrollBy === 'function') {
        node.scrollBy({ left: offset, behavior: reduceMotion ? 'auto' : 'smooth' });
        setTimeout(checkFeaturedScroll, 200);
        return;
      }
    }
    featuredScrollRef.current?.scrollTo({ x: offset > 0 ? 300 : 0, animated: !reduceMotion });
  };

  // Enable mouse cursor drag-to-scroll and mouse wheel scrolling on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || attachedFiles.length === 0) return;

    const cleanupFns: (() => void)[] = [];
    const timer = setTimeout(() => {
      const node = (featuredScrollRef.current as any)?.getScrollableNode?.() || (featuredScrollRef.current as any);
      if (!node || !node.addEventListener) return;

      checkFeaturedScroll();
      node.style.cursor = 'grab';
      node.style.userSelect = 'none';
      if ((node.style as any).WebkitUserSelect !== undefined) {
        (node.style as any).WebkitUserSelect = 'none';
      }

      const onWheel = (e: WheelEvent) => {
        if (e.deltaY !== 0 || e.deltaX !== 0) {
          e.preventDefault();
          e.stopPropagation();
          node.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
          checkFeaturedScroll();
        }
      };

      const onDragStart = (e: DragEvent) => {
        // Prevent native HTML5 image dragging so mouse drag scrolling works smoothly
        e.preventDefault();
      };

      const onMouseDown = (e: MouseEvent) => {
        isDraggingFeatured.current = true;
        dragFeaturedMoved.current = false;
        dragFeaturedStartX.current = e.pageX;
        dragFeaturedScrollLeft.current = node.scrollLeft;
        node.style.cursor = 'grabbing';
        if (typeof document !== 'undefined') {
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDraggingFeatured.current) return;
        const diff = e.pageX - dragFeaturedStartX.current;
        if (Math.abs(diff) > 4) {
          dragFeaturedMoved.current = true;
        }
        node.scrollLeft = dragFeaturedScrollLeft.current - diff;
        checkFeaturedScroll();
      };

      const onMouseUp = () => {
        if (isDraggingFeatured.current) {
          isDraggingFeatured.current = false;
          node.style.cursor = 'grab';
          if (typeof document !== 'undefined') {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
          }
        }
      };

      node.addEventListener('wheel', onWheel, { passive: false });
      node.addEventListener('dragstart', onDragStart);
      node.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mouseleave', onMouseUp);

      cleanupFns.push(() => {
        node.removeEventListener('wheel', onWheel);
        node.removeEventListener('dragstart', onDragStart);
        node.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mouseleave', onMouseUp);
        if (typeof document !== 'undefined') {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanupFns.forEach((fn) => fn());
    };
  }, [attachedFiles.length, checkFeaturedScroll]);

  const createFormImageUris = useMemo(() => {
    return attachedFiles
      .filter((f) => {
        const mime = (f.mimeType || '').toLowerCase();
        const name = (f.name || '').toLowerCase();
        return (
          mime.startsWith('image/') ||
          /\.(jpe?g|png|gif|webp|bmp|avif|heic)$/i.test(name) ||
          f.uri.startsWith('blob:') ||
          f.uri.startsWith('data:')
        );
      })
      .map((f) => f.uri);
  }, [attachedFiles]);

  // Compute active website featured image URI for form preview
  const activeWebsiteImageUri = useMemo(() => {
    if (createFormImageUris.length === 0) return null;
    if (createFormImageUris[featuredMediaIndex]) return createFormImageUris[featuredMediaIndex];
    return createFormImageUris[0];
  }, [createFormImageUris, featuredMediaIndex]);

  // Keep featuredMediaIndex within bounds when attachments change
  useEffect(() => {
    if (attachedFiles.length === 0) {
      setFeaturedMediaIndex(0);
    } else if (featuredMediaIndex >= attachedFiles.length) {
      setFeaturedMediaIndex(attachedFiles.length - 1);
    }
  }, [attachedFiles.length, featuredMediaIndex]);

  const handleRemoveAttachedFile = (idxToRemove: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idxToRemove));
    setFeaturedMediaIndex((prev) => {
      if (prev === idxToRemove) return 0;
      if (prev > idxToRemove) return prev - 1;
      return prev;
    });
  };

  const modalPostImageUris = useMemo(() => {
    if (!selectedPost) return [];
    const rawMedia = selectedPost.media || selectedPost.rawPost?.media;
    if (Array.isArray(rawMedia) && rawMedia.length > 0) {
      const list = rawMedia
        .map((m: any) => resolveImageUrl(m?.url || m?.file_url || m?.file_path || m?.uri) || m?.uri || m?.url)
        .filter((u: any): u is string => typeof u === 'string' && u.trim().length > 0);
      if (list.length > 0) return list;
    }
    return selectedPost.thumbnailUrl ? [selectedPost.thumbnailUrl] : [];
  }, [selectedPost]);

  useEffect(() => {
    if (selectedPost) {
      const rawMedia = selectedPost.media || selectedPost.rawPost?.media;
      if (Array.isArray(rawMedia) && rawMedia.length > 0) {
        const featIdx = rawMedia.findIndex((m: any) => m?.is_featured);
        setModalViewFeaturedIndex(featIdx >= 0 ? featIdx : 0);
      } else {
        setModalViewFeaturedIndex(0);
      }
    }
  }, [selectedPost]);

  // AI Compliance Check States
  const [isComplianceModalVisible, setIsComplianceModalVisible] = useState(false);
  const [complianceScore, setComplianceScore] = useState(0);
  const [complianceStatus, setComplianceStatus] = useState('');
  const [complianceAnalysis, setComplianceAnalysis] = useState('');
  const [complianceChecks, setComplianceChecks] = useState<any>({});
  const [complianceSuggestedCaption, setComplianceSuggestedCaption] = useState<string | null>(null);
  const [isCheckingPolicy, setIsCheckingPolicy] = useState(false);

  const [departmentsList, setDepartmentsList] = useState<string[]>([
    'BSIT Department',
    'College of Nursing',
    'College of Education',
    'Registrar’s Office',
    'Supreme Student Council',
    'Integrated Marketing Communications',
    'Information Technology Office',
  ]);

  useEffect(() => {
    departmentsApi.list().then((res) => {
      const items = res.data?.data || res.data || [];
      if (Array.isArray(items) && items.length > 0) {
        const names = items.map((d: any) => d.display_name || d.name).filter(Boolean);
        if (names.length > 0) {
          setDepartmentsList(names);
          if (!user?.department) {
            setFormDepartment(names[0]);
          }
        }
      }
    }).catch(() => {});
  }, [user?.department]);

  // Sync if allRawPosts passed from parent
  useEffect(() => {
    if (Array.isArray(allRawPosts) && allRawPosts.length > 0) {
      // STRICT FILTER: Only show direct IMC requests in this new dashboard
      const directOnly = allRawPosts.filter(isDirectImcPost).map((p) => mapRawPostToCard(p, user));
      setRequests(directOnly);
      setIsLoading(false);
    }
  }, [allRawPosts, user]);

  const loadRequests = useCallback(async () => {
    try {
      const res = await postsApi.list({ my_requests: true, per_page: 50 });
      const apiPosts = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      if (Array.isArray(apiPosts)) {
        // STRICT FILTER: Only show direct IMC requests in this modern dashboard
        const directOnly = apiPosts.filter(isDirectImcPost).map((p: any) => mapRawPostToCard(p, user));
        setRequests(directOnly);
      }
    } catch (err) {
      console.log('Error loading requests in modern dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // If allRawPosts is passed from parent, parent query already manages background polling.
    // Only poll standalone if allRawPosts is not supplied.
    if (Array.isArray(allRawPosts)) return;

    loadRequests();
    const timer = setInterval(() => {
      loadRequests();
    }, 5000);
    return () => clearInterval(timer);
  }, [allRawPosts, loadRequests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (req.title || '').toLowerCase().includes(q) ||
        (req.code || '').toLowerCase().includes(q) ||
        (req.department || '').toLowerCase().includes(q);
      const matchesFilter = activeFilter === 'All' || req.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [requests, searchQuery, activeFilter]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredRequests.length, itemsPerPage, currentPage]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  const processFiles = async (rawFiles: any[]): Promise<AttachedMediaItem[]> => {
    setIsOptimizingImages(true);
    try {
      const processed = await Promise.all(
        rawFiles.map(async (f) => {
          let width = f.width;
          let height = f.height;
          let ratio = f.aspectRatio;
          let isInstagramQualified = f.isInstagramQualified;
          const fileSize = f.size || f.file?.size || 0;

          try {
            const dims = await getImageDimensions(f);
            width = dims.width || width || 0;
            height = dims.height || height || 0;
            ratio = dims.ratio || ratio || 1;
            isInstagramQualified = dims.isQualified;
          } catch {
            isInstagramQualified = true;
          }

          return {
            ...f,
            size: fileSize,
            width,
            height,
            aspectRatio: ratio,
            isInstagramQualified,
          };
        })
      );
      return processed;
    } finally {
      setIsOptimizingImages(false);
    }
  };

  const handleAutoFitAllForInstagram = async () => {
    if (attachedFiles.length === 0) return;
    setIsOptimizingImages(true);
    try {
      const updated = await Promise.all(
        attachedFiles.map(async (file) => {
          if (file.isInstagramQualified === false) {
            const fitted = await fitImageForInstagram(file, 'auto');
            return {
              ...file,
              ...fitted,
              uri: fitted.uri || file.uri,
              file: fitted.file || file.file,
              name: fitted.name || file.name,
              width: fitted.width || file.width,
              height: fitted.height || file.height,
              aspectRatio: fitted.aspectRatio || 1,
              isInstagramQualified: true,
            };
          }
          return file;
        })
      );
      setAttachedFiles(updated);
    } catch (err) {
      console.warn('Failed to auto-fit photos for Instagram:', err);
    } finally {
      setIsOptimizingImages(false);
    }
  };

  const handleAutoFitSingle = async (idx: number, mode: 'auto' | 'square' | 'portrait' = 'auto') => {
    const file = attachedFiles[idx];
    if (!file) return;
    setIsOptimizingImages(true);
    try {
      const fitted = await fitImageForInstagram(file, mode);
      setAttachedFiles((prev) => {
        const copy = [...prev];
        copy[idx] = {
          ...file,
          ...fitted,
          uri: fitted.uri || file.uri,
          file: fitted.file || file.file,
          name: fitted.name || file.name,
          width: fitted.width || file.width,
          height: fitted.height || file.height,
          aspectRatio: fitted.aspectRatio || 1,
          isInstagramQualified: true,
        };
        return copy;
      });
    } catch (err) {
      console.warn('Failed to auto-fit single photo:', err);
    } finally {
      setIsOptimizingImages(false);
    }
  };

  const filterAllowedImages = (items: AttachedMediaItem[]) => {
    const valid: AttachedMediaItem[] = [];
    let rejectedVideoOrNonImage = false;
    for (const item of items) {
      const mime = String(item.mimeType || '').toLowerCase();
      const name = String(item.name || '').toLowerCase();
      const isVideo = mime.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v)$/i.test(name);
      if (isVideo || (!mime.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(name) && !isImageFile(item))) {
        rejectedVideoOrNonImage = true;
      } else {
        valid.push(item);
      }
    }
    if (rejectedVideoOrNonImage) {
      alert('Video uploads are not allowed. Please select images (JPG, PNG, WebP) only.');
    }
    return valid;
  };

  const handlePickMedia = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const rawItems = filterAllowedImages(res.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name || 'image.jpg',
          file: (asset as any).file,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.size || 0,
        })));
        if (rawItems.length > 0) {
          const processed = await processFiles(rawItems);
          setAttachedFiles((prev) => [...prev, ...processed]);
        }
      }
    } catch {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/jpeg,image/png,image/webp,image/jpg';
        input.onchange = async (e: any) => {
          const files = Array.from(e.target.files || []) as File[];
          if (files.length > 0) {
            const rawItems = filterAllowedImages(files.map((f) => ({
              uri: URL.createObjectURL(f),
              name: f.name,
              file: f,
              mimeType: f.type,
              size: f.size,
            })));
            if (rawItems.length > 0) {
              const processed = await processFiles(rawItems);
              setAttachedFiles((prev) => [...prev, ...processed]);
            }
          }
        };
        input.click();
      }
    }
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      alert('Please enter a content title.');
      return;
    }
    if (!formCaption.replace(/<[^>]*>/g, '').trim()) {
      alert('Please provide a caption/narrative for the content.');
      return;
    }

    setIsSubmitting(true);
    try {
      let res;
      let preferredSchedule: string | undefined = undefined;
      if (formDate) {
        const timePart = formTime ? formTime.trim() : '08:00';
        preferredSchedule = `${formDate} ${timePart}`;
      }

      // Collect target platforms
      const selectedPlatforms: string[] = [];
      if (targetPlatforms.facebook) selectedPlatforms.push('facebook');
      if (targetPlatforms.instagram) selectedPlatforms.push('instagram');
      if (targetPlatforms.website) selectedPlatforms.push('website');

      if (selectedPlatforms.length === 0) {
        alert('Please select at least one target platform before submitting.');
        return;
      }

      if (attachedFiles.length > 0) {
        const formData = new FormData();
        formData.append('title', formTitle.trim());
        formData.append('caption_narrative', formCaption.trim());
        formData.append('routing_type', 'direct_imc');
        for (const p of selectedPlatforms) {
          formData.append('target_platforms[]', p);
        }
        if (formDepartment) {
          formData.append('other_category_name', formDepartment);
        }
        if (preferredSchedule) {
          formData.append('preferred_schedule_at', preferredSchedule);
        }
        formData.append('featured_media_index', String(featuredMediaIndex));

        for (const item of attachedFiles) {
          let fileToUpload: any = item;
          try {
            // Client-side image optimizer: enforces max 1920px Full HD resolution and JPEG size limit
            fileToUpload = await optimizeImageForUpload(fileToUpload);
            // If Instagram is chosen, enforce Instagram 4:5 to 1.91:1 ratio
            if (targetPlatforms.instagram && isImageFile(fileToUpload)) {
              const dims = await getImageDimensions(fileToUpload);
              if (!dims.isQualified) {
                fileToUpload = await fitImageForInstagram(fileToUpload, 'auto');
              }
            }
          } catch (optErr) {
            console.warn('Image optimization error, using original:', optErr);
          }

          if (Platform.OS === 'web') {
            if (fileToUpload instanceof File || fileToUpload instanceof Blob) {
              formData.append('media[]', fileToUpload, item.name || 'upload.jpg');
            } else if (fileToUpload?.file instanceof File || fileToUpload?.file instanceof Blob) {
              formData.append('media[]', fileToUpload.file, fileToUpload.name || item.name || 'upload.jpg');
            } else if (typeof fileToUpload?.uri === 'string' && (fileToUpload.uri.startsWith('blob:') || fileToUpload.uri.startsWith('data:'))) {
              try {
                const fetchRes = await fetch(fileToUpload.uri);
                const blob = await fetchRes.blob();
                const fileObj = new File([blob], fileToUpload.name || item.name || 'upload.jpg', { type: fileToUpload.mimeType || blob.type || 'image/jpeg' });
                formData.append('media[]', fileObj, fileToUpload.name || item.name || 'upload.jpg');
              } catch {
                formData.append('media[]', (fileToUpload.file || fileToUpload) as any);
              }
            } else {
              formData.append('media[]', (fileToUpload.file || fileToUpload) as any);
            }
          } else {
            formData.append('media[]', {
              uri: fileToUpload.uri,
              name: fileToUpload.name || item.name || 'upload.jpg',
              type: fileToUpload.mimeType || 'image/jpeg',
            } as any);
          }
        }
        res = await postsApi.createWithFiles(formData as any);
      } else {
        res = await postsApi.create({
          title: formTitle.trim(),
          caption_narrative: formCaption.trim(),
          routing_type: 'direct_imc',
          target_platforms: selectedPlatforms,
          other_category_name: formDepartment || undefined,
          preferred_schedule_at: preferredSchedule,
        });
      }

      // Optimistic instant addition so the user sees it immediately!
      const newPostData = res?.data?.data || res?.data;
      if (newPostData) {
        const optimisticCard = mapRawPostToCard(newPostData, user);
        setRequests((prev) => [optimisticCard, ...prev.filter((r) => r.id !== optimisticCard.id)]);
      }

      setSubmitFeedback(`Request "${formTitle}" submitted directly to IMC successfully!`);
      setTimeout(() => setSubmitFeedback(null), 4000);

      // Reset fields
      setFormTitle('');
      setFormCaption('');
      setAttachedFiles([]);
      setTargetPlatforms({
        facebook: false,
        instagram: false,
        website: false,
      });
      setFeaturedMediaIndex(0);
      if (!isDesktop) {
        setIsSidePanelOpen(false);
      }

      await loadRequests();

      if (onRequestSubmitted && newPostData) {
        onRequestSubmitted(newPostData);
      }
    } catch (err: any) {
      console.error('Submit direct IMC error:', err);
      alert('Failed to submit request to IMC: ' + (err?.response?.data?.message || err?.message || 'Error occurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckPolicy = async () => {
    const plainText = formCaption.replace(/<[^>]*>/g, '').trim();
    if (!plainText) {
      alert('Please write a caption first before checking policy alignment.');
      return;
    }

    setIsCheckingPolicy(true);
    try {
      const response = await postsApi.aiCheckDraft({
        title: formTitle.trim() || 'Draft Post',
        caption_narrative: formCaption.trim(),
      });
      const data = response?.data?.data;
      if (!data) {
        throw new Error('No response received from AI service.');
      }
      if (data.overall_status === 'error') {
        alert(data.analysis_logic || 'AI analysis could not be completed.');
      } else {
        setComplianceScore(data.compliance_score || 0);
        setComplianceStatus(data.overall_status || 'compliant');
        setComplianceAnalysis(data.analysis_logic || '');
        setComplianceChecks(data.checks || {});
        setComplianceSuggestedCaption(data.suggested_caption || null);
        setIsComplianceModalVisible(true);
      }
    } catch (e: any) {
      alert('Policy Check: ' + (e.response?.data?.message || e.message || 'Service unavailable'));
    } finally {
      setIsCheckingPolicy(false);
    }
  };

  const getStatusBadge = (status: RequestCardData['status']) => {
    switch (status) {
      case 'Pending':
        return (
          <View style={[styles.statusBadge, styles.statusPending]}>
            <Ionicons name="time-outline" size={13} color="#92400E" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#92400E' }]}>Pending</Text>
          </View>
        );
      case 'Approved':
        return (
          <View style={[styles.statusBadge, styles.statusApproved]}>
            <Ionicons name="checkmark-circle-outline" size={13} color="#166534" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#166534' }]}>Approved</Text>
          </View>
        );
      case 'Reviewing':
        return (
          <View style={[styles.statusBadge, styles.statusReviewing]}>
            <Ionicons name="sync-outline" size={13} color="#075985" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#075985' }]}>Reviewing</Text>
          </View>
        );
    }
  };

  return (
    <View nativeID="requestor-imc-workspace" style={styles.container}
      onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      {Platform.OS === 'web' && <style>{`
        #requestor-imc-workspace [role="button"]:focus-visible,
        #requestor-imc-workspace [role="checkbox"]:focus-visible,
        #requestor-imc-workspace input:focus-visible,
        #requestor-imc-workspace [contenteditable="true"]:focus-visible,
        #requestor-imc-preview [role="button"]:focus-visible {
          outline: 3px solid ${isDarkMode ? BRAND_GOLD : BRAND_PURPLE} !important;
          outline-offset: 2px;
        }
        #requestor-imc-workspace [role="button"] { transition: opacity 120ms ease; }
        #requestor-imc-workspace [role="button"]:hover, #requestor-imc-workspace [role="checkbox"]:hover { opacity: .88; }
        #requestor-imc-workspace [role="button"]:disabled { opacity: .55; }
        #requestor-imc-workspace input { min-width: 0; }
        #requestor-imc-workspace [data-testid="requestor-imc-submit"] *,
        #requestor-imc-workspace [data-testid="requestor-imc-submit"] { color: ${GOLD_INK} !important; }
        @media (prefers-reduced-motion: reduce) {
          #requestor-imc-workspace * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
        }
      `}</style>}
      {/* ================= TOP SWITCHER & HEADER BAR ================= */}
      <View style={styles.topControlBanner}>
        <View style={styles.topBannerLeft}>
          <Text style={styles.topBannerTitle}>Create Request to IMC</Text>
        </View>

        <View style={styles.topBannerRight}>
          {onChangeRequestType && (
            <TouchableOpacity
              style={styles.switchDashboardBtn}
              accessibilityRole="button"
              accessibilityLabel="Change request type"
              onPress={onChangeRequestType}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={16} color={palette.purple} />
              <Text style={styles.switchDashboardBtnText}>Change Request Type</Text>
            </TouchableOpacity>
          )}

          {!isSidePanelOpen && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.openDrawerBtn}
              onPress={() => setIsSidePanelOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={16} color="#FFFFFF" />
              <Text style={styles.openDrawerBtnText}>Create Request</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Optional feedback banner */}
      {submitFeedback && (
        <View style={styles.feedbackBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#15803D" />
          <Text style={styles.feedbackBannerText}>{submitFeedback}</Text>
        </View>
      )}

      {/* ================= MAIN SPLIT CONTENT ================= */}
      <View style={[styles.splitLayout, !isDesktop && styles.splitLayoutStacked]}>
        {/* COLUMN: CONTENT REQUESTS LIST (Rendered on Right via row-reverse) */}
        <View
          style={[
            styles.leftSection,
            isDesktop && { flex: 1, width: undefined },
          ]}
          onLayout={(event) => setListWidth(event.nativeEvent.layout.width)}
        >
          {/* Header Row: Title, Search, Filter */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.sectionHeading}>Content Requests</Text>

            <View style={[styles.searchAndFilterGroup, isCompactCard && styles.fullWidth]}>
              {/* Search Bar */}
              <View style={[styles.searchBarContainer, isCompactCard && styles.fullWidth]}>
                <Ionicons name="search-outline" size={16} color={palette.muted} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  accessibilityLabel="Search content requests"
                  placeholder="Search requests..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {Boolean(searchQuery) && (
                  <TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={palette.muted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter Button */}
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  style={styles.filterBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter requests: ${activeFilter}`}
                  accessibilityState={{ expanded: isFilterDropdownOpen }}
                  {...(Platform.OS === 'web' ? { 'aria-expanded': isFilterDropdownOpen } : {})}
                  onPress={() => setIsFilterDropdownOpen((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="filter-outline" size={16} color={palette.muted} style={{ marginRight: 4 }} />
                  <Text style={styles.filterBtnText}>
                    {activeFilter === 'All' ? 'Filter' : activeFilter}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={palette.muted} />
                </TouchableOpacity>

                {isFilterDropdownOpen && (
                  <View style={styles.filterDropdownMenu}>
                    {(['All', 'Pending', 'Approved', 'Reviewing'] as const).map((opt) => (
                      <TouchableOpacity
                        accessibilityRole="button"
                        key={opt}
                        style={[
                          styles.filterDropdownItem,
                          activeFilter === opt && styles.filterDropdownItemActive,
                        ]}
                        onPress={() => {
                          setActiveFilter(opt);
                          setIsFilterDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.filterDropdownText,
                            activeFilter === opt && styles.filterDropdownTextActive,
                          ]}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Cards Stack */}
          <ScrollView
            style={styles.cardsScroll}
            contentContainerStyle={styles.cardsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoading && requests.length === 0 ? (
              <View style={[styles.emptyContainer, { paddingVertical: 48 }]}>
                <ActivityIndicator size="large" color="#6D28D9" />
                <Text style={[styles.emptySubtitle, { marginTop: 12 }]}>Loading requests...</Text>
              </View>
            ) : filteredRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color={palette.muted} />
                <Text style={styles.emptyTitle}>No matching requests found</Text>
                <Text style={styles.emptySubtitle}>Try adjusting your search or filter</Text>
              </View>
            ) : (
              paginatedRequests.map((item) => (
                <View key={item.id} style={[styles.requestCard, isCompactCard && styles.requestCardCompact]}>
                  {/* Left Thumbnail */}
                  {item.thumbnailUrl ? (
                    <Image
                      source={{ uri: item.thumbnailUrl }}
                      style={[styles.cardThumbnail, isCompactCard && styles.cardThumbnailCompact]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.cardThumbnail, styles.cardThumbnailPlaceholder, isCompactCard && styles.cardThumbnailCompact]}>
                      <Ionicons name="image-outline" size={32} color={palette.muted} />
                    </View>
                  )}

                  {/* Right Card Content */}
                  <View style={styles.cardBody}>
                    {/* Top Row: Platforms + Status */}
                    <View style={styles.cardTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {item.targetPlatforms && item.targetPlatforms.length > 0 && (
                          <View style={styles.cardPlatformChipsRow}>
                            {item.targetPlatforms.includes('facebook') && (
                              <View style={[styles.platformChipSmall, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="logo-facebook" size={11} color="#1877F2" />
                              </View>
                            )}
                            {item.targetPlatforms.includes('instagram') && (
                              <View style={[styles.platformChipSmall, { backgroundColor: '#FDF2F8' }]}>
                                <Ionicons name="logo-instagram" size={11} color="#E1306C" />
                              </View>
                            )}
                            {(item.targetPlatforms.includes('website') || item.targetPlatforms.includes('portal') || item.targetPlatforms.includes('wordpress')) && (
                              <View style={[styles.platformChipSmall, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="globe-outline" size={11} color="#059669" />
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      {getStatusBadge(item.status)}
                    </View>

                    {/* Title */}
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    {/* Details Info Row: WHEN & WHO */}
                    <View style={styles.detailsRow}>
                      {/* WHEN Column */}
                      <View style={styles.detailCol}>
                        <View style={styles.detailLabelRow}>
                          <Ionicons name="calendar-outline" size={14} color={palette.muted} style={{ marginRight: 4 }} />
                          <Text style={styles.detailLabel}>WHEN</Text>
                        </View>
                        <Text style={styles.detailValue}>{item.date}</Text>
                        {Boolean(item.time) && (
                          <Text style={styles.detailValueSub}>{item.time}</Text>
                        )}
                      </View>

                      <View style={styles.detailColDivider} />

                      {/* WHO Column */}
                      <View style={[styles.detailCol, { flex: 1.3 }]}>
                        <View style={styles.detailLabelRow}>
                          <Ionicons name="people-outline" size={14} color={palette.muted} style={{ marginRight: 4 }} />
                          <Text style={styles.detailLabel}>WHO</Text>
                        </View>
                        <Text style={styles.detailValue} numberOfLines={1}>{item.department}</Text>
                        <Text style={styles.detailValueSub} numberOfLines={1}>(Requested by: {item.requestedBy})</Text>
                      </View>
                    </View>

                    {/* Footer Row: Media count & View Request Button */}
                    <View style={styles.cardFooterRow}>
                      <View style={styles.mediaCountBadge}>
                        <Ionicons name="image-outline" size={13} color="#6D28D9" style={{ marginRight: 5 }} />
                        <Text style={styles.mediaCountText}>
                          {item.mediaCount} Media Attachment{item.mediaCount > 1 ? 's' : ''}
                        </Text>
                      </View>

                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`View request: ${item.title}`}
                        style={styles.viewRequestBtn}
                        onPress={() => setSelectedPost(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewRequestBtnText}>View Request</Text>
                        <Ionicons name="arrow-forward" size={14} color="#6D28D9" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {filteredRequests.length > 0 && (
            <View style={styles.paginationCard}>
              <PaginationControl
                currentPage={currentPage}
                totalItems={filteredRequests.length}
                itemsPerPage={itemsPerPage}
                pageSizeOptions={[5, 10, 15, 20]}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(val) => {
                  setItemsPerPage(val);
                  setCurrentPage(1);
                }}
                itemName="requests"
              />
            </View>
          )}
        </View>

        {/* COLUMN: CREATE CONTENT REQUEST PANEL (Rendered on Left via row-reverse) */}
        {isSidePanelOpen && (
          <View style={[styles.rightSection, isDesktop && { flex: 1, width: undefined }]}>
            {/* Panel Purple Header */}
            <View style={styles.panelHeaderPurple}>
              <View style={styles.panelHeaderLeft}>
                <Text style={styles.panelHeaderTitle}>Create Content Request</Text>
              </View>

              <TouchableOpacity
                style={styles.panelCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close create content request form"
                onPress={() => setIsSidePanelOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Panel Form Body */}
            <View style={styles.panelFormScrollContent}>
              {/* SECTION: BASIC INFORMATION */}
              <View style={styles.redesignedSectionCard}>
                <View style={styles.redesignedSectionHeader}>
                  <View style={styles.redesignedHeaderIconBox}>
                    <Ionicons name="document-text-outline" size={18} color={palette.muted} />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Basic Information</Text>
                </View>

                <View style={styles.redesignedFieldGroup}>
                  <Text style={styles.redesignedFieldLabel}>
                    REQUEST TITLE <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.redesignedTextInput}
                    accessibilityLabel="Request title, required"
                    placeholder="e.g., Campus Event Announcement"
                    placeholderTextColor="#94A3B8"
                    value={formTitle}
                    onChangeText={setFormTitle}
                  />
                </View>

                <View style={[styles.redesignedFieldGroup, { marginTop: 14 }]}>
                  <Text style={styles.redesignedFieldLabel}>DEPARTMENT</Text>
                  <View style={styles.redesignedReadonlyBox}>
                    <Text style={styles.redesignedReadonlyText} numberOfLines={1}>
                      {user?.department || formDepartment || 'BSIT Department'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* SECTION: CAPTION */}
              <View style={styles.redesignedSectionCard}>
                <View style={styles.redesignedSectionHeader}>
                  <View style={styles.redesignedHeaderIconBox}>
                    <Ionicons name="document-text-outline" size={18} color={palette.muted} />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Caption</Text>
                </View>

                <View style={styles.captionGuideCallout}>
                  <Text style={styles.captionGuideText}>
                    Include the key details: <Text style={styles.captionGuideBold}>Who</Text> is involved,{' '}
                    <Text style={styles.captionGuideBold}>What</Text> is happening,{' '}
                    <Text style={styles.captionGuideBold}>When</Text> it will take place,{' '}
                    <Text style={styles.captionGuideBold}>Where</Text> it will happen, and{' '}
                    <Text style={styles.captionGuideBold}>Why</Text> it is important.
                  </Text>
                  <Text style={[styles.captionGuideText, { marginTop: 8 }]}>
                    <Text style={styles.captionGuideBold}>Example:</Text> The JMCFI Student Council invites all students to a Cybersecurity Awareness Seminar on November 18, 2026, at 9:00 AM in the JMCFI Auditorium to promote safe and responsible technology use.
                  </Text>
                </View>

                <View style={{ marginBottom: 10 }}>
                  <RichTextEditor
                    value={formCaption}
                    onChange={(val: string) => {
                      setFormCaption(val);
                      if (complianceScore > 0) {
                        setComplianceScore(0);
                      }
                    }}
                    placeholder="Write a brief caption describing the activity, event, or announcement..."
                    minHeight={180}
                    hideExtraActions
                  />
                </View>

                <View style={styles.redesignedCaptionFooter}>
                  <Text style={styles.redesignedCharCounter}>
                    {formCaption.replace(/<[^>]*>/g, '').length} / 2200 characters
                  </Text>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[
                      styles.redesignedAiPolicyBtn,
                      isCheckingPolicy && { opacity: 0.7 }
                    ]}
                    onPress={handleCheckPolicy}
                    disabled={isCheckingPolicy}
                    activeOpacity={0.75}
                  >
                    {isCheckingPolicy ? (
                      <ActivityIndicator size="small" color={palette.muted} style={{ marginRight: 6 }} />
                    ) : (
                      <Ionicons name="shield-outline" size={15} color={palette.muted} style={{ marginRight: 6 }} />
                    )}
                    <Text style={styles.redesignedAiPolicyBtnText}>
                      {isCheckingPolicy ? 'AI Analyzing...' : 'AI Check Policy Alignment'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {complianceScore > 0 && (
                  <View style={styles.complianceScoreCard}>
                    <View style={styles.complianceScoreCardLeft}>
                      <View style={[
                        styles.complianceScoreIconBadge,
                        { backgroundColor: complianceStatus === 'compliant' ? '#ECFDF5' : '#FEF3C7' }
                      ]}>
                        <Ionicons
                          name={complianceStatus === 'compliant' ? 'checkmark-circle' : 'alert-circle'}
                          size={16}
                          color={complianceStatus === 'compliant' ? '#059669' : '#D97706'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.complianceScoreCardTitle}>
                          AI Policy Score: {complianceScore}% ({complianceStatus === 'compliant' ? 'Compliant' : 'Review Suggested'})
                        </Text>
                        <Text style={styles.complianceScoreCardSub} numberOfLines={1}>
                          {complianceAnalysis || 'Institutional policy alignment validated.'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.viewAnalysisBtn}
                      onPress={() => setIsComplianceModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.viewAnalysisBtnText}>View Breakdown</Text>
                      <Ionicons name="arrow-forward" size={11} color="#6D28D9" style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* TARGET PLATFORMS & PHOTO RULES */}
              <View style={styles.redesignedSectionCard}>
                <View style={styles.redesignedSectionHeader}>
                  <View style={styles.redesignedHeaderIconBox}>
                    <Ionicons name="share-social-outline" size={18} color={palette.muted} />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Target Platforms & Photo Rules</Text>
                </View>
                <Text style={styles.platformSectionSub}>
                  Select publishing destinations to activate platform-specific photo quality filters & aspect ratio rules.
                </Text>

                <View style={styles.targetPlatformCardsRow}>
                  {/* Facebook */}
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityLabel="Publish to Facebook"
                    accessibilityState={{ checked: targetPlatforms.facebook }}
                    {...(Platform.OS === 'web' ? { 'aria-checked': targetPlatforms.facebook } : {})}
                    style={[
                      styles.targetPlatformCard,
                      targetPlatforms.facebook && styles.targetPlatformCardActiveFb,
                    ]}
                    onPress={() => {
                      setTargetPlatforms((prev) => {
                        const next = { ...prev, facebook: !prev.facebook };
                        if (next.facebook) setFormPreviewPlatform('facebook');
                        return next;
                      });
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.targetPlatformCardTop}>
                      <View style={[styles.targetPlatformIconWrap, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="logo-facebook" size={16} color="#1877F2" />
                      </View>
                      <View style={[
                        styles.targetPlatformCheckbox,
                        targetPlatforms.facebook && styles.targetPlatformCheckboxActiveFb,
                      ]}>
                        {targetPlatforms.facebook && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                      </View>
                    </View>
                    <Text style={styles.targetPlatformTitle}>Facebook</Text>
                    <Text style={styles.targetPlatformDesc}>Auto HD &bull; Max 4MB</Text>
                  </TouchableOpacity>

                  {/* Instagram */}
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityLabel="Publish to Instagram"
                    accessibilityState={{ checked: targetPlatforms.instagram }}
                    {...(Platform.OS === 'web' ? { 'aria-checked': targetPlatforms.instagram } : {})}
                    style={[
                      styles.targetPlatformCard,
                      targetPlatforms.instagram && styles.targetPlatformCardActiveIg,
                    ]}
                    onPress={() => {
                      setTargetPlatforms((prev) => {
                        const next = { ...prev, instagram: !prev.instagram };
                        if (next.instagram) setFormPreviewPlatform('instagram');
                        return next;
                      });
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.targetPlatformCardTop}>
                      <View style={[styles.targetPlatformIconWrap, { backgroundColor: '#FDF2F8' }]}>
                        <Ionicons name="logo-instagram" size={16} color="#E1306C" />
                      </View>
                      <View style={[
                        styles.targetPlatformCheckbox,
                        targetPlatforms.instagram && styles.targetPlatformCheckboxActiveIg,
                      ]}>
                        {targetPlatforms.instagram && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                      </View>
                    </View>
                    <Text style={styles.targetPlatformTitle}>Instagram</Text>
                    <Text style={styles.targetPlatformDesc}>4:5 to 1.91:1 Ratio</Text>
                  </TouchableOpacity>

                  {/* Website */}
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityLabel="Publish to the JMCFI website"
                    accessibilityState={{ checked: targetPlatforms.website }}
                    {...(Platform.OS === 'web' ? { 'aria-checked': targetPlatforms.website } : {})}
                    style={[
                      styles.targetPlatformCard,
                      targetPlatforms.website && styles.targetPlatformCardActiveWeb,
                    ]}
                    onPress={() => {
                      setTargetPlatforms((prev) => {
                        const next = { ...prev, website: !prev.website };
                        if (next.website) setFormPreviewPlatform('website');
                        return next;
                      });
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.targetPlatformCardTop}>
                      <View style={[styles.targetPlatformIconWrap, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="globe-outline" size={16} color="#059669" />
                      </View>
                      <View style={[
                        styles.targetPlatformCheckbox,
                        targetPlatforms.website && styles.targetPlatformCheckboxActiveWeb,
                      ]}>
                        {targetPlatforms.website && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                      </View>
                    </View>
                    <Text style={styles.targetPlatformTitle}>Website</Text>
                    <Text style={styles.targetPlatformDesc}>Featured Cover</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION: MEDIA ATTACHMENT */}
              <View style={styles.formGroup}>
                <Text style={styles.subFieldLabel}>Media Attachment</Text>

                <TouchableOpacity
                  style={styles.dropzoneContainer}
                  accessibilityRole="button"
                  accessibilityLabel="Upload an image"
                  onPress={handlePickMedia}
                  activeOpacity={0.8}
                >
                  <View style={styles.uploadIconBadge}>
                    <Ionicons name="image" size={24} color="#6D28D9" />
                  </View>
                  <Text style={styles.dropzoneTitle}>Upload Image</Text>
                  <Text style={styles.dropzoneSubtitle}>Drag and drop your image here or click to browse (JPG, PNG, WebP)</Text>
                </TouchableOpacity>

                {attachedFiles.length > 0 && (
                  <View style={styles.featuredSelectorContainer}>
                    {/* Platform Photo Rules & Quality Filter Status Banner */}
                    {targetPlatforms.instagram && attachedFiles.some((f) => f.isInstagramQualified === false) ? (
                      <View style={styles.filterAlertBannerWarning}>
                        <View style={styles.filterAlertLeft}>
                          <View style={styles.filterAlertIconCircleIg}>
                            <Ionicons name="logo-instagram" size={15} color="#E1306C" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.filterAlertTitleWarning}>
                              Instagram Photo Ratio Filter Notice
                            </Text>
                            <Text style={styles.filterAlertDescWarning}>
                              Instagram requires photos between 4:5 portrait and 1.91:1 landscape. Photos outside this range will fail on Instagram. Tap Auto-Fit All to pad with white canvas and fix automatically!
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={handleAutoFitAllForInstagram}
                          style={styles.autoFitAllBtn}
                          activeOpacity={0.8}
                          disabled={isOptimizingImages}
                        >
                          {isOptimizingImages ? (
                            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 4 }} />
                          ) : (
                            <Ionicons name="sparkles" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                          )}
                          <Text style={styles.autoFitAllBtnText}>Auto-Fit All (4:5 / 1:1)</Text>
                        </TouchableOpacity>
                      </View>
                    ) : targetPlatforms.instagram && attachedFiles.length > 0 ? (
                      <View style={styles.filterAlertBannerSuccess}>
                        <Ionicons name="checkmark-circle" size={15} color="#059669" />
                        <Text style={styles.filterAlertTextSuccess}>
                          Photo Quality & Size Rules: All photos meet Instagram (4:5 to 1.91:1) and Facebook HD standards (auto-optimized under 4MB).
                        </Text>
                      </View>
                    ) : targetPlatforms.facebook && attachedFiles.length > 0 ? (
                      <View style={styles.filterAlertBannerFb}>
                        <Ionicons name="checkmark-circle" size={15} color="#1877F2" />
                        <Text style={styles.filterAlertTextFb}>
                          Facebook Photo Quality Filter: Photos verified for HD display (auto-optimized under 4MB limit).
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.featuredSelectorHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="globe-outline" size={15} color="#059669" />
                        <Text style={styles.featuredSelectorTitle}>Website Featured Image Choice</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {/* Scroll Arrows */}
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => handleFeaturedScrollBy(-180)}
                          accessibilityLabel="Previous media attachments"
                          style={[styles.scrollArrowBtn, !canScrollLeftFeatured && styles.scrollArrowBtnDisabled]}
                          disabled={!canScrollLeftFeatured}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="chevron-back" size={13} color={canScrollLeftFeatured ? '#059669' : '#94A3B8'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => handleFeaturedScrollBy(180)}
                          accessibilityLabel="Next media attachments"
                          style={[styles.scrollArrowBtn, !canScrollRightFeatured && styles.scrollArrowBtnDisabled]}
                          disabled={!canScrollRightFeatured}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="chevron-forward" size={13} color={canScrollRightFeatured ? '#059669' : '#94A3B8'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => {
                            setAttachedFiles([]);
                            setFeaturedMediaIndex(0);
                          }}
                          style={styles.clearAllBtn}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={11} color="#DC2626" />
                          <Text style={styles.clearAllBtnText}>Clear All</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.featuredSelectorSubtitle}>
                      {attachedFiles.length === 1
                        ? '1 image attached — automatically set as the featured cover for the Website.'
                        : `${attachedFiles.length} images attached — drag with cursor or tap an image to select it as the featured cover for the Website.`}
                    </Text>

                    <ScrollView
                      ref={featuredScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      onScroll={checkFeaturedScroll}
                      scrollEventThrottle={16}
                      contentContainerStyle={styles.featuredThumbnailsScroll}
                      style={[
                        styles.featuredThumbnailsScrollWrapper,
                        Platform.OS === 'web' && ({
                          cursor: 'grab',
                          userSelect: 'none',
                        } as any)
                      ]}
                    >
                      {attachedFiles.map((file, idx) => {
                        const isFeatured = featuredMediaIndex === idx;
                        const isImg = file.mimeType ? file.mimeType.startsWith('image/') : true;
                        const isIgUnqualified = file.isInstagramQualified === false;

                        return (
                          <TouchableOpacity
                            accessibilityRole="button"
                            key={idx}
                            onPress={() => {
                              if (dragFeaturedMoved.current) return;
                              setFeaturedMediaIndex(idx);
                            }}
                            activeOpacity={0.8}
                            style={[
                              styles.featuredThumbCard,
                              isFeatured && styles.featuredThumbCardActive,
                            ]}
                          >
                            {/* Remove button */}
                            <TouchableOpacity
                              accessibilityRole="button"
                              onPress={(e: any) => {
                                e?.stopPropagation?.();
                                handleRemoveAttachedFile(idx);
                              }}
                              style={styles.featuredThumbRemoveBtn}
                              accessibilityLabel={`Remove ${file.name || `image ${idx + 1}`}`}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="close" size={11} color="#FFFFFF" />
                            </TouchableOpacity>

                            {/* Top Badges Row */}
                            <View style={styles.cardBadgesHeaderRow}>
                              {/* Featured Badge */}
                              {isFeatured ? (
                                <View style={styles.featuredActiveBadge}>
                                  <Ionicons name="checkmark-circle" size={10} color="#FFFFFF" />
                                  <Text style={styles.featuredActiveBadgeText}>Website</Text>
                                </View>
                              ) : (
                                <View style={styles.featuredInactiveBadge}>
                                  <Text style={styles.featuredInactiveBadgeText}>Select</Text>
                                </View>
                              )}

                              {/* Instagram Rule Badge / Quick Fix Button */}
                              {targetPlatforms.instagram && (
                                <TouchableOpacity
                                  accessibilityRole="button"
                                  onPress={(e: any) => {
                                    e?.stopPropagation?.();
                                    if (isIgUnqualified) {
                                      handleAutoFitSingle(idx, 'auto');
                                    }
                                  }}
                                  disabled={!isIgUnqualified || isOptimizingImages}
                                  activeOpacity={isIgUnqualified ? 0.7 : 1}
                                  style={[
                                    styles.igThumbBadge,
                                    isIgUnqualified ? styles.igThumbBadgeWarning : styles.igThumbBadgeOk,
                                  ]}
                                >
                                  <Ionicons
                                    name="logo-instagram"
                                    size={8.5}
                                    color={isIgUnqualified ? '#92400E' : '#047857'}
                                  />
                                  <Text style={[
                                    styles.igThumbBadgeText,
                                    isIgUnqualified ? styles.igThumbBadgeTextWarning : styles.igThumbBadgeTextOk,
                                  ]}>
                                    {isIgUnqualified ? 'Fit 4:5' : 'IG OK'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* Thumbnail preview */}
                            <View style={styles.featuredThumbImageWrap}>
                              {file.uri && isImg ? (
                                <Image
                                  source={{ uri: file.uri }}
                                  style={styles.featuredThumbImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Ionicons name="image-outline" size={26} color={palette.muted} />
                              )}
                            </View>

                            <Text numberOfLines={1} style={[
                              styles.featuredThumbName,
                              isFeatured && styles.featuredThumbNameActive
                            ]}>
                              {file.name || `Image #${idx + 1}`}
                            </Text>

                            {/* Resolution & Size info */}
                            <View style={styles.photoRulesMetaRow}>
                              <Text style={styles.photoDimensionsText} numberOfLines={1}>
                                {file.width && file.height
                                  ? `${file.width}×${file.height}`
                                  : (file.aspectRatio ? `${file.aspectRatio}:1` : 'HD')}
                                {file.size ? ` • ${Math.round(file.size / 1024)}KB` : ''}
                              </Text>
                            </View>

                            <Text style={[
                              styles.featuredThumbStatus,
                              isFeatured ? styles.featuredThumbStatusActive : styles.featuredThumbStatusInactive
                            ]}>
                              {isFeatured ? '★ Featured Cover' : 'Tap to Feature'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* LIVE CONTENT PREVIEW: FACEBOOK / INSTAGRAM / WEBSITE */}
              <View style={styles.formGroup}>
                <View style={styles.previewHeaderRow}>
                  <Text style={styles.subFieldLabel}>Content Preview</Text>

                  {/* Platform Selector Tabs */}
                  <View style={styles.platformSelectorRow}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={[
                        styles.platformSelectorTab,
                        formPreviewPlatform === 'facebook' && styles.platformSelectorTabActiveFacebook,
                      ]}
                      onPress={() => setFormPreviewPlatform('facebook')}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="logo-facebook"
                        size={13}
                        color={formPreviewPlatform === 'facebook' ? '#1877F2' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.platformSelectorTabText,
                          formPreviewPlatform === 'facebook' && styles.platformSelectorTabTextActiveFacebook,
                        ]}
                      >
                        Facebook
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      accessibilityRole="button"
                      style={[
                        styles.platformSelectorTab,
                        formPreviewPlatform === 'instagram' && styles.platformSelectorTabActiveInstagram,
                      ]}
                      onPress={() => setFormPreviewPlatform('instagram')}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="logo-instagram"
                        size={13}
                        color={formPreviewPlatform === 'instagram' ? '#E1306C' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.platformSelectorTabText,
                          formPreviewPlatform === 'instagram' && styles.platformSelectorTabTextActiveInstagram,
                        ]}
                      >
                        Instagram
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      accessibilityRole="button"
                      style={[
                        styles.platformSelectorTab,
                        formPreviewPlatform === 'website' && styles.platformSelectorTabActiveWebsite,
                      ]}
                      onPress={() => setFormPreviewPlatform('website')}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="globe-outline"
                        size={13}
                        color={formPreviewPlatform === 'website' ? '#059669' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.platformSelectorTabText,
                          formPreviewPlatform === 'website' && styles.platformSelectorTabTextActiveWebsite,
                        ]}
                      >
                        Website
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Mockup Card */}
                {formPreviewPlatform === 'facebook' && (
                  <View style={styles.facebookMockupCard}>
                    <View style={styles.socialHeader}>
                      <Image
                        source={require('../../assets/images/jmc_logo.png')}
                        style={styles.socialAvatar}
                        resizeMode="contain"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.socialAuthorName}>Jose Maria College Foundation Inc.</Text>
                        <Text style={styles.socialTimeText}>Sponsored &bull; Just now</Text>
                      </View>
                      <Ionicons name="ellipsis-horizontal" size={16} color={palette.muted} />
                    </View>

                    <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                      <Text style={styles.socialCaptionText}>
                        {formCaption ? formCaption.replace(/<[^>]*>/g, '') : 'Upload media to see your content preview here...'}
                      </Text>
                    </View>

                    {createFormImageUris.length > 0 ? (
                      <FacebookMediaGrid
                        images={createFormImageUris}
                        onImagePress={(uri) => setFullScreenImage(uri)}
                      />
                    ) : (
                      <View style={styles.emptyMockMedia}>
                        <Ionicons name="image-outline" size={32} color={palette.muted} />
                        <Text style={styles.emptyMockMediaText}>Upload media to see your content preview here...</Text>
                      </View>
                    )}

                    <View style={styles.socialFooterActions}>
                      <View style={styles.socialActionBtn}>
                        <Ionicons name="thumbs-up-outline" size={14} color={palette.muted} />
                        <Text style={styles.socialActionText}>Like</Text>
                      </View>
                      <View style={styles.socialActionBtn}>
                        <Ionicons name="chatbubble-outline" size={14} color={palette.muted} />
                        <Text style={styles.socialActionText}>Comment</Text>
                      </View>
                      <View style={styles.socialActionBtn}>
                        <Ionicons name="share-social-outline" size={14} color={palette.muted} />
                        <Text style={styles.socialActionText}>Share</Text>
                      </View>
                    </View>
                  </View>
                )}

                {formPreviewPlatform === 'instagram' && (
                  <View style={styles.instagramMockupCard}>
                    <View style={styles.instagramHeader}>
                      <View style={styles.instagramAvatarRing}>
                        <Image
                          source={require('../../assets/images/jmc_logo.png')}
                          style={styles.instagramAvatar}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.instagramAuthorName}>jmc_official</Text>
                        <Text style={styles.instagramLocationText}>Davao City, Philippines</Text>
                      </View>
                      <Ionicons name="ellipsis-horizontal" size={16} color="#262626" />
                    </View>

                    {createFormImageUris.length > 0 ? (
                      <InstagramMediaCarousel
                        images={createFormImageUris}
                        onImagePress={(uri) => setFullScreenImage(uri)}
                      />
                    ) : (
                      <View style={[styles.emptyMockMedia, { aspectRatio: 1 }]}>
                        <Ionicons name="image-outline" size={32} color={palette.muted} />
                        <Text style={styles.emptyMockMediaText}>Upload media to see your content preview here...</Text>
                      </View>
                    )}

                    <View style={{ padding: 12 }}>
                      <View style={styles.instagramActionsRow}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <Ionicons name="heart" size={20} color="#E1306C" />
                          <Ionicons name="chatbubble-outline" size={18} color="#262626" />
                          <Ionicons name="paper-plane-outline" size={18} color="#262626" />
                        </View>
                        <Ionicons name="bookmark-outline" size={18} color="#262626" />
                      </View>
                      <Text style={styles.instagramLikesText}>Liked by jmcfi_official and others</Text>
                      <Text style={styles.instagramCaptionText}>
                        <Text style={{ fontWeight: '700' }}>jmc_official </Text>
                        {formCaption ? formCaption.replace(/<[^>]*>/g, '') : 'Upload media to see your content preview here...'}
                      </Text>
                    </View>
                  </View>
                )}

                {formPreviewPlatform === 'website' && (
                  <View style={styles.websiteMockupCard}>
                    <View style={styles.websiteBadgeRow}>
                      <Ionicons name="globe-outline" size={13} color="#059669" />
                      <Text style={styles.websiteBadgeText}>Website Article Preview</Text>
                    </View>

                    <Text style={styles.websiteTitleText}>
                      {formTitle ? formTitle : 'Content Request Title'}
                    </Text>
                    <Text style={styles.websiteMetaText}>
                      By {user?.full_name || 'JMCFI Requestor'} &bull; News & Announcements &bull; Just now
                    </Text>

                    {activeWebsiteImageUri ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        activeOpacity={0.9}
                        onPress={() => setFullScreenImage(activeWebsiteImageUri)}
                        style={{ marginBottom: 10 }}
                      >
                        <Image
                          source={{ uri: activeWebsiteImageUri }}
                          style={styles.websiteFeaturedImage}
                          resizeMode="cover"
                        />
                        <View style={styles.websiteImageTag}>
                          <Ionicons name="globe-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.websiteImageTagText}>
                            Website Featured Image {createFormImageUris.length > 1 ? `(#${featuredMediaIndex + 1})` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.emptyMockMedia, { height: 120, marginBottom: 10 }]}>
                        <Ionicons name="image-outline" size={28} color={palette.muted} />
                        <Text style={styles.emptyMockMediaText}>Upload media for Website Featured Image...</Text>
                      </View>
                    )}

                    <Text style={styles.websiteBodyText}>
                      {formCaption ? formCaption.replace(/<[^>]*>/g, '') : 'Upload media to see your content preview here...'}
                    </Text>
                  </View>
                )}
              </View>

              {/* BUTTONS: CANCEL & SUBMIT */}
              <View style={[styles.formActionsRow, isCompact && styles.formActionsCompact]}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.cancelBtn, isCompact && styles.formActionCompact]}
                  onPress={() => {
                    setFormTitle('');
                    setFormCaption('');
                    setAttachedFiles([]);
                    setFeaturedMediaIndex(0);
                    if (!isDesktop) setIsSidePanelOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, isCompact && styles.formActionCompact]}
                  accessibilityRole="button"
                  accessibilityLabel={isSubmitting ? 'Submitting request to IMC' : 'Submit request to IMC'}
                  testID="requestor-imc-submit"
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                >
                  <Ionicons name="paper-plane" size={16} color={GOLD_INK} style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>{isSubmitting ? "Submitting to IMC..." : "Submit Request"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ================= VIEW REQUEST PREVIEW MODAL ================= */}
      {selectedPost && (
        <Modal
          visible={Boolean(selectedPost)}
          transparent
          animationType={reduceMotion ? 'none' : 'fade'}
          onRequestClose={() => setSelectedPost(null)}
        >
          <View style={styles.modalOverlay}>
            <View nativeID="requestor-imc-preview" accessibilityViewIsModal style={[styles.modalCard, { maxWidth: 620, maxHeight: Math.max(0, height - Spacing.xl) }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderBadges}>
                  {getStatusBadge(selectedPost.status)}
                </View>
                <TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close request preview" onPress={() => setSelectedPost(null)}>
                  <Ionicons name="close" size={24} color={palette.muted} />
                </TouchableOpacity>
              </View>

              {/* Platform Selector Tabs: Facebook / Instagram / Website */}
              <View style={styles.modalPlatformTabs}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.modalPlatformTab,
                    modalPlatformTab === 'facebook' && styles.modalPlatformTabActiveFacebook,
                  ]}
                  onPress={() => setModalPlatformTab('facebook')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="logo-facebook"
                    size={14}
                    color={modalPlatformTab === 'facebook' ? '#1877F2' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.modalPlatformTabText,
                      modalPlatformTab === 'facebook' && styles.modalPlatformTabTextActiveFacebook,
                    ]}
                  >
                    Facebook
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.modalPlatformTab,
                    modalPlatformTab === 'instagram' && styles.modalPlatformTabActiveInstagram,
                  ]}
                  onPress={() => setModalPlatformTab('instagram')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="logo-instagram"
                    size={14}
                    color={modalPlatformTab === 'instagram' ? '#E1306C' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.modalPlatformTabText,
                      modalPlatformTab === 'instagram' && styles.modalPlatformTabTextActiveInstagram,
                    ]}
                  >
                    Instagram
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.modalPlatformTab,
                    modalPlatformTab === 'website' && styles.modalPlatformTabActiveWebsite,
                  ]}
                  onPress={() => setModalPlatformTab('website')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="globe-outline"
                    size={14}
                    color={modalPlatformTab === 'website' ? '#059669' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.modalPlatformTabText,
                      modalPlatformTab === 'website' && styles.modalPlatformTabTextActiveWebsite,
                    ]}
                  >
                    Website
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} showsVerticalScrollIndicator>
                {/* Social Media Mockup Preview */}
                {modalPlatformTab === 'facebook' && (
                  <View style={[styles.facebookMockupCard, { marginBottom: 14 }]}>
                    <View style={styles.socialHeader}>
                      <Image
                        source={require('../../assets/images/jmc_logo.png')}
                        style={styles.socialAvatar}
                        resizeMode="contain"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.socialAuthorName}>Jose Maria College Foundation Inc.</Text>
                        <Text style={styles.socialTimeText}>Sponsored &bull; Public</Text>
                      </View>
                      <Ionicons name="ellipsis-horizontal" size={16} color={palette.muted} />
                    </View>

                    <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                      <FormattedText style={styles.socialCaptionText}>
                        {selectedPost.caption || 'No caption provided.'}
                      </FormattedText>
                    </View>

                    {modalPostImageUris.length > 0 ? (
                      <FacebookMediaGrid
                        images={modalPostImageUris}
                        onImagePress={(uri) => setFullScreenImage(uri)}
                      />
                    ) : (
                      <View style={styles.emptyMockMedia}>
                        <Ionicons name="image-outline" size={32} color={palette.muted} />
                        <Text style={styles.emptyMockMediaText}>No media attached</Text>
                      </View>
                    )}

                    <View style={styles.socialFooterActions}>
                      <View style={styles.socialActionBtn}>
                        <Ionicons name="thumbs-up-outline" size={14} color={palette.muted} />
                        <Text style={styles.socialActionText}>Like</Text>
                      </View>
                      <View style={styles.socialActionBtn}>
                        <Ionicons name="chatbubble-outline" size={14} color={palette.muted} />
                        <Text style={styles.socialActionText}>Comment</Text>
                      </View>
                      <View style={styles.socialActionBtn}>
                        <Ionicons name="share-social-outline" size={14} color={palette.muted} />
                        <Text style={styles.socialActionText}>Share</Text>
                      </View>
                    </View>
                  </View>
                )}

                {modalPlatformTab === 'instagram' && (
                  <View style={[styles.instagramMockupCard, { marginBottom: 14 }]}>
                    <View style={styles.instagramHeader}>
                      <View style={styles.instagramAvatarRing}>
                        <Image
                          source={require('../../assets/images/jmc_logo.png')}
                          style={styles.instagramAvatar}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.instagramAuthorName}>jmc_official</Text>
                        <Text style={styles.instagramLocationText}>Davao City, Philippines</Text>
                      </View>
                      <Ionicons name="ellipsis-horizontal" size={16} color="#262626" />
                    </View>

                    {modalPostImageUris.length > 0 ? (
                      <InstagramMediaCarousel
                        images={modalPostImageUris}
                        onImagePress={(uri) => setFullScreenImage(uri)}
                      />
                    ) : (
                      <View style={[styles.emptyMockMedia, { aspectRatio: 1 }]}>
                        <Ionicons name="image-outline" size={32} color={palette.muted} />
                        <Text style={styles.emptyMockMediaText}>No media attached</Text>
                      </View>
                    )}

                    <View style={{ padding: 12 }}>
                      <View style={styles.instagramActionsRow}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <Ionicons name="heart" size={20} color="#E1306C" />
                          <Ionicons name="chatbubble-outline" size={18} color="#262626" />
                          <Ionicons name="paper-plane-outline" size={18} color="#262626" />
                        </View>
                        <Ionicons name="bookmark-outline" size={18} color="#262626" />
                      </View>
                      <Text style={styles.instagramLikesText}>Liked by jmcfi_official and others</Text>
                      <FormattedText style={styles.instagramCaptionText}>
                        {'<b>jmc_official </b>' + (selectedPost.caption || '')}
                      </FormattedText>
                    </View>
                  </View>
                )}

                {modalPlatformTab === 'website' && (
                  <View style={[styles.websiteMockupCard, { marginBottom: 14 }]}>
                    <View style={styles.websiteBadgeRow}>
                      <Ionicons name="globe-outline" size={13} color="#059669" />
                      <Text style={styles.websiteBadgeText}>Website Article Preview</Text>
                    </View>

                    <Text style={styles.websiteTitleText}>{selectedPost.title}</Text>
                    <Text style={styles.websiteMetaText}>
                      By {selectedPost.requestedBy} &bull; News & Announcements &bull; {selectedPost.date}
                    </Text>

                    {modalPostImageUris.length > 0 ? (
                      <View style={{ marginBottom: 10 }}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          activeOpacity={0.9}
                          onPress={() => setFullScreenImage(modalPostImageUris[modalViewFeaturedIndex] || modalPostImageUris[0])}
                        >
                          <Image
                            source={{ uri: modalPostImageUris[modalViewFeaturedIndex] || modalPostImageUris[0] }}
                            style={styles.websiteFeaturedImage}
                            resizeMode="cover"
                          />
                          <View style={styles.websiteImageTag}>
                            <Ionicons name="globe-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.websiteImageTagText}>
                              Website Featured Image {modalPostImageUris.length > 1 ? `(#${modalViewFeaturedIndex + 1})` : ''}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {modalPostImageUris.length > 1 && (
                          <View style={{ marginTop: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6 }}>
                              Website Featured Image (Tap to preview):
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                              {modalPostImageUris.map((uri, idx) => {
                                const isSel = modalViewFeaturedIndex === idx;
                                return (
                                  <TouchableOpacity
                                    accessibilityRole="button"
                                    key={idx}
                                    onPress={() => setModalViewFeaturedIndex(idx)}
                                    activeOpacity={0.8}
                                    style={{
                                      width: 68,
                                      height: 52,
                                      borderRadius: 6,
                                      borderWidth: isSel ? 2 : 1,
                                      borderColor: isSel ? '#059669' : '#CBD5E1',
                                      overflow: 'hidden',
                                      position: 'relative',
                                    }}
                                  >
                                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    {isSel && (
                                      <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#059669', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 }}>
                                        <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFF' }}>Cover</Text>
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={[styles.emptyMockMedia, { height: 120, marginBottom: 10 }]}>
                        <Ionicons name="image-outline" size={28} color={palette.muted} />
                        <Text style={styles.emptyMockMediaText}>No media attached for website preview</Text>
                      </View>
                    )}

                    <FormattedText style={styles.websiteBodyText}>
                      {selectedPost.caption || 'No caption provided.'}
                    </FormattedText>
                  </View>
                )}

                <Text style={styles.modalTitle}>{selectedPost.title}</Text>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Date & Time:</Text>
                  <Text style={styles.modalInfoValue}>
                    {selectedPost.date} {selectedPost.time || ''}
                  </Text>
                </View>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Department:</Text>
                  <Text style={styles.modalInfoValue}>{selectedPost.department}</Text>
                </View>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Requested By:</Text>
                  <Text style={styles.modalInfoValue}>{selectedPost.requestedBy}</Text>
                </View>

                {/* APPROVAL TRACKING: Request -> IMC -> Publish */}
                <View style={styles.modalTrackingCard}>
                  <Text style={styles.modalTrackingTitle}>Approval Tracking</Text>
                  {(() => {
                    const isImcApproved = selectedPost.status === 'Approved' || selectedPost.rawStatus === 'approved' || selectedPost.rawStatus === 'published' || selectedPost.rawStatus === 'scheduled';
                    const isImcRejected = selectedPost.rawStatus === 'rejected' || selectedPost.rawStatus === 'returned_for_revision';
                    const isPublished = selectedPost.rawStatus === 'published';
                    const isScheduled = selectedPost.rawStatus === 'scheduled';

                    return (
                      <View style={styles.modalTrackingStepper}>
                        {/* Step 1: Request */}
                        <View style={styles.modalTrackingStep}>
                          <View style={[styles.modalStepBadge, styles.modalStepBadgeCompleted]}>
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          </View>
                          <Text style={styles.modalStepName}>Request</Text>
                          <Text style={[styles.modalStepStatus, { color: '#16A34A' }]}>Submitted</Text>
                        </View>

                        <View style={[styles.modalStepConnector, isImcApproved || !isImcRejected ? styles.modalStepConnectorActive : null]} />

                        {/* Step 2: IMC */}
                        <View style={styles.modalTrackingStep}>
                          <View style={[
                            styles.modalStepBadge,
                            isImcApproved
                              ? styles.modalStepBadgeCompleted
                              : (isImcRejected ? styles.modalStepBadgeRejected : styles.modalStepBadgeActive)
                          ]}>
                            <Ionicons
                              name={isImcApproved ? "checkmark" : (isImcRejected ? "close" : "time")}
                              size={14}
                              color="#FFFFFF"
                            />
                          </View>
                          <Text style={styles.modalStepName}>IMC</Text>
                          <Text style={[
                            styles.modalStepStatus,
                            {
                              color: isImcApproved
                                ? '#16A34A'
                                : (isImcRejected ? '#DC2626' : '#D97706')
                            }
                          ]}>
                            {isImcApproved ? 'Approved' : (selectedPost.rawStatus === 'returned_for_revision' ? 'Revision' : (selectedPost.rawStatus === 'rejected' ? 'Rejected' : 'Reviewing'))}
                          </Text>
                        </View>

                        <View style={[styles.modalStepConnector, isPublished || isScheduled ? styles.modalStepConnectorActive : null]} />

                        {/* Step 3: Publish */}
                        <View style={styles.modalTrackingStep}>
                          <View style={[
                            styles.modalStepBadge,
                            isPublished
                              ? styles.modalStepBadgeCompleted
                              : (isScheduled ? styles.modalStepBadgeActive : styles.modalStepBadgeUpcoming)
                          ]}>
                            <Ionicons
                              name={isPublished ? "checkmark" : (isScheduled ? "calendar" : "globe-outline")}
                              size={14}
                              color={isPublished || isScheduled ? "#FFFFFF" : "#94A3B8"}
                            />
                          </View>
                          <Text style={styles.modalStepName}>Publish</Text>
                          <Text style={[
                            styles.modalStepStatus,
                            {
                              color: isPublished
                                ? '#16A34A'
                                : (isScheduled ? '#6D28D9' : '#94A3B8')
                            }
                          ]}>
                            {isPublished ? 'Published' : (isScheduled ? 'Scheduled' : 'Waiting')}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>

                {(() => {
                  const checklist = selectedPost.rawPost?.imc_branding_checklist;
                  const originalCaption = checklist?.original_caption;
                  const refinedCaption = checklist?.refined_caption;
                  const isRefined = Boolean(originalCaption && refinedCaption && originalCaption.trim() !== refinedCaption.trim());
                  const displayCaption = refinedCaption || selectedPost.caption;

                  if (!displayCaption && !originalCaption) return null;

                  return (
                    <View style={{ marginTop: 12, gap: 10 }}>
                      {Boolean(displayCaption) && (
                        <View>
                          <Text style={[styles.modalInfoLabel, { marginBottom: 4 }]}>
                            {isRefined ? 'Final / Refined Caption:' : 'Caption:'}
                          </Text>
                          <Text style={styles.modalCaptionText}>{displayCaption}</Text>
                        </View>
                      )}
                      {isRefined && (
                        <View style={{ padding: 10, borderRadius: 8, backgroundColor: palette.elevated, borderWidth: 1, borderColor: palette.border }}>
                          <Text style={[styles.modalInfoLabel, { marginBottom: 4 }]}>Original Submitted Caption:</Text>
                          <Text style={[styles.modalCaptionText, { color: palette.muted }]}>{originalCaption}</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
              </ScrollView>

              <TouchableOpacity
                accessibilityRole="button"
                style={styles.modalCloseBtn}
                onPress={() => setSelectedPost(null)}
              >
                <Text style={styles.modalCloseBtnText}>Close Preview</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ================= COMPLIANCE RESULT MODAL ================= */}
      <ComplianceResultModal
        visible={isComplianceModalVisible}
        onClose={() => setIsComplianceModalVisible(false)}
        score={complianceScore}
        status={complianceStatus}
        analysisLogic={complianceAnalysis}
        checks={complianceChecks}
        suggestedCaption={complianceSuggestedCaption}
        onApplySuggestedCaption={(newCaption) => {
          setFormCaption(newCaption);
          setIsComplianceModalVisible(false);
        }}
      />

      {/* Lightbox Modal for Full Screen Image Preview */}
      {Boolean(fullScreenImage) && (
        <Modal
          visible={Boolean(fullScreenImage)}
          transparent
          animationType={reduceMotion ? 'none' : 'fade'}
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View style={styles.lightboxOverlay}>
            <TouchableOpacity
              style={styles.lightboxCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Close full screen image preview"
              onPress={() => setFullScreenImage(null)}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: fullScreenImage! }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );
};

const createStyles = (palette: ReturnType<typeof getPalette>) => StyleSheet.create({
  container: {
    padding: Spacing.md,
    width: '100%',
    minWidth: 0,
    flex: 1,
    backgroundColor: 'transparent',
  },

  fullWidth: { width: '100%' },
  iconButton: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md },
  requestCardCompact: { flexDirection: 'column' },
  cardThumbnailCompact: { width: '100%', height: 144, marginRight: 0 },
  formActionsCompact: { flexDirection: 'column', alignItems: 'stretch' },
  formActionCompact: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  modalHeaderBadges: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  modalBody: { flexShrink: 1, minHeight: 0 },
  modalBodyContent: { paddingBottom: Spacing.sm },

  /* Top Control Banner */
  topControlBanner: {
    gap: Spacing.md,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    backgroundColor: palette.surface,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }
      : { elevation: 2 }),
  },
  topBannerLeft: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'column',
  },
  modernTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.purpleTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 4,
    gap: 4,
  },
  modernTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.purple,
  },
  topBannerTitle: {
    flexShrink: 1,
    lineHeight: 24,
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: palette.text,
  },
  topBannerRight: {
    flexShrink: 1,
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backDashboardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  switchDashboardBtn: {
    flexShrink: 1,
    minWidth: 0,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.purpleTint,
    borderWidth: 1,
    borderColor: palette.dark ? '#6B21A8' : '#D8B4FE',
  },
  switchDashboardBtnText: {
    flexShrink: 1,
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: palette.purple,
  },
  openDrawerBtn: {
    flexShrink: 1,
    minWidth: 0,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND_PURPLE,
  },
  openDrawerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  feedbackBannerText: {
    lineHeight: 20,
    flexShrink: 1,
    color: '#15803D',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Split Layout - Form on the left, Content Requests list on the right */
  splitLayout: {
    gap: Spacing.md,
    minWidth: 0,
    flexDirection: 'row-reverse',
    flex: 1,
    width: '100%',
    alignItems: 'stretch',
  },
  splitLayoutStacked: {
    flexDirection: 'column-reverse',
  },

  /* LEFT SECTION */
  leftSection: {
    minWidth: 0,
    backgroundColor: 'transparent',
    flex: 1,
    width: '100%',
  },
  listHeaderRow: {
    marginBottom: Spacing.md,
    gap: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    width: '100%',
  },
  sectionHeading: {
    flexShrink: 1,
    lineHeight: 24,
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -0.3,
  },
  searchAndFilterGroup: {
    flexShrink: 1,
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBarContainer: {
    flexShrink: 1,
    width: 232,
    paddingVertical: 0,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.field,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
  },
  searchInput: {
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    height: CONTROL_HEIGHT - 2,
    minWidth: 0,
    flex: 1,
    color: palette.text,
    padding: 0,
    outlineWidth: 0,
  },
  filterBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.field,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  filterDropdownMenu: {
    top: CONTROL_HEIGHT + Spacing.sm,
    position: 'absolute',
    right: 0,
    backgroundColor: palette.field,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 4,
    width: 130,
    zIndex: 99,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }
      : { elevation: 4 }),
  },
  filterDropdownItem: {
    justifyContent: 'center',
    minHeight: CONTROL_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterDropdownItemActive: {
    backgroundColor: palette.purpleTint,
  },
  filterDropdownText: {
    fontSize: 13,
    color: palette.text,
  },
  filterDropdownTextActive: {
    color: palette.purple,
    fontWeight: '700',
  },

  /* Cards List */
  cardsScroll: {
    minWidth: 0,
    flex: 1,
    width: '100%',
  },
  cardsScrollContent: {
    paddingBottom: 24,
    gap: 14,
    width: '100%',
  },
  paginationCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    marginTop: 10,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        }
      : {}),
  },
  requestCard: {
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    padding: Spacing.md,
    minWidth: 0,
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    width: '100%',
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        }
      : { elevation: 1 }),
  },
  cardThumbnail: {
    flexShrink: 0,
    marginRight: 0,
    width: 110,
    height: 110,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  cardThumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardBody: {
    gap: Spacing.sm,
    minWidth: 0,
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  codeBadge: {
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    maxWidth: '100%',
    backgroundColor: palette.purpleTint,
    paddingHorizontal: 8,
  },
  codeBadgeText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: palette.purple,
    letterSpacing: 0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusApproved: {
    backgroundColor: '#DCFCE7',
  },
  statusReviewing: {
    backgroundColor: '#E0F2FE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    lineHeight: 20,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 8,
  },
  detailsRow: {
    padding: Spacing.sm,
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.elevated,
    borderRadius: 8,
    marginBottom: 8,
  },
  detailCol: {
    flexBasis: 88,
    minWidth: 0,
    flex: 1,
  },
  detailColDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  detailLabel: {
    lineHeight: 16,
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: 0.5,
  },
  detailValue: {
    flexShrink: 1,
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: palette.text,
  },
  detailValueSub: {
    flexShrink: 1,
    lineHeight: 16,
    fontSize: FontSize.xs,
    color: palette.muted,
  },

  cardFooterRow: {
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaCountBadge: {
    paddingVertical: Spacing.xs,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.purpleTint,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  mediaCountText: {
    lineHeight: 16,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: palette.purple,
  },
  viewRequestBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6D28D9',
    backgroundColor: palette.field,
  },
  viewRequestBtnText: {
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: palette.purple,
  },

  /* RIGHT SECTION: CREATE REQUEST PANEL */
  rightSection: {
    borderRadius: BorderRadius.lg,
    minWidth: 0,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    alignSelf: 'stretch',
    width: '100%',
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        }
      : { elevation: 3 }),
  },
  panelHeaderPurple: {
    gap: Spacing.sm,
    minHeight: 64,
    paddingVertical: Spacing.sm,
    backgroundColor: BRAND_PURPLE, // JMCFI Deep Purple
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  panelHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelPlusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHeaderTitle: {
    flexShrink: 1,
    lineHeight: 20,
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  panelCloseBtn: {
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    height: CONTROL_HEIGHT,
    width: CONTROL_HEIGHT,
    padding: 2,
  },

  panelFormScroll: {
    flex: 1,
  },
  panelFormScrollContent: {
    gap: Spacing.lg,
    padding: Spacing.md,
    minWidth: 0,
    flex: 1,
  },

  redesignedSectionCard: {
    paddingBottom: 0,
    minWidth: 0,
    backgroundColor: 'transparent',
  },
  redesignedSectionHeader: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  redesignedHeaderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: palette.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redesignedSectionTitle: {
    flexShrink: 1,
    lineHeight: 24,
    fontSize: FontSize.md,
    fontWeight: '800',
    color: palette.text,
  },
  redesignedFieldGroup: {
    gap: Spacing.sm,
    minWidth: 0,
  },
  redesignedFieldLabel: {
    lineHeight: 16,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: palette.muted,
    letterSpacing: 0.5,
  },
  redesignedTextInput: {
    fontSize: FontSize.sm,
    minWidth: 0,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    backgroundColor: palette.field,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.text,
    outlineWidth: 0,
  },
  redesignedReadonlyBox: {
    minWidth: 0,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
  },
  redesignedReadonlyText: {
    lineHeight: 20,
    fontSize: FontSize.sm,
    color: palette.text,
  },
  captionGuideCallout: {
    marginBottom: Spacing.md,
    borderLeftWidth: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: palette.elevated,
    borderLeftColor: BRAND_PURPLE,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  captionGuideText: {
    lineHeight: 20,
    fontSize: FontSize.sm,
    color: palette.text,
  },
  captionGuideBold: {
    fontWeight: '700',
    color: palette.text,
  },
  redesignedCaptionFooter: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  redesignedCharCounter: {
    lineHeight: 16,
    fontSize: FontSize.xs,
    color: palette.muted,
  },
  redesignedAiPolicyBtn: {
    flexShrink: 1,
    maxWidth: '100%',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  redesignedAiPolicyBtnText: {
    flexShrink: 1,
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },

  formGroup: {
    gap: Spacing.sm,
    minWidth: 0,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
  },
  subFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    marginTop: 4,
  },
  contentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  formTextInput: {
    backgroundColor: palette.field,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: palette.text,
    outlineWidth: 0,
  },
  whenRow: {
    flexDirection: 'row',
  },
  formInputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.field,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  innerTextInput: {
    flex: 1,
    fontSize: 13,
    color: palette.text,
    padding: 0,
    outlineWidth: 0,
  },
  dropdownSelectedText: {
    flex: 1,
    fontSize: 13,
    color: palette.text,
  },
  dropdownPickerBox: {
    backgroundColor: palette.field,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownPickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  dropdownPickerItemText: {
    fontSize: 13,
    color: palette.text,
  },

  captionTextArea: {
    backgroundColor: palette.field,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: palette.text,
    minHeight: 76,
    outlineWidth: 0,
  },
  captionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  characterCounter: {
    fontSize: 11,
    color: palette.muted,
  },
  aiCheckPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.purpleTint,
    borderWidth: 1,
    borderColor: palette.dark ? '#6B21A8' : '#D8B4FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  aiCheckPolicyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.purple,
  },
  inlineScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineScoreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  complianceScoreCard: {
    padding: Spacing.sm,
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.purpleTint,
    borderWidth: 1,
    borderColor: palette.dark ? '#6B21A8' : '#D8B4FE',
    borderRadius: 8,
    marginTop: 8,
  },
  complianceScoreCardLeft: {
    gap: Spacing.sm,
    flexBasis: 180,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  complianceScoreIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  complianceScoreCardTitle: {
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  complianceScoreCardSub: {
    lineHeight: 16,
    fontSize: FontSize.xs,
    color: palette.muted,
    marginTop: 1,
  },
  viewAnalysisBtn: {
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: palette.field,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.dark ? '#6B21A8' : '#D8B4FE',
  },
  viewAnalysisBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.purple,
  },
  modalAiCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.purpleTint,
    borderWidth: 1,
    borderColor: palette.dark ? '#6B21A8' : '#D8B4FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalAiCheckBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.purple,
  },

  dropzoneContainer: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.dark ? '#6B21A8' : '#D8B4FE',
    backgroundColor: palette.purpleTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: palette.purpleTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dropzoneTitle: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  dropzoneSubtitle: {
    textAlign: 'center',
    lineHeight: 16,
    fontSize: FontSize.xs,
    color: palette.muted,
    marginTop: 2,
  },

  attachedFilesList: {
    marginTop: 6,
    gap: 4,
  },
  attachedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.purpleTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
  },
  attachedFileName: {
    flex: 1,
    fontSize: 12,
    color: palette.purple,
  },

  formActionsRow: {
    marginTop: Spacing.sm,
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelBtn: {
    flexBasis: 88,
    minWidth: 0,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flex: 1,
    backgroundColor: palette.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  submitBtn: {
    backgroundColor: BRAND_GOLD,
    flexBasis: 160,
    minWidth: 0,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    textAlign: 'center',
    flexShrink: 1,
    color: GOLD_INK,
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  /* Empty state */
  emptyContainer: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
    lineHeight: 24,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: palette.text,
    marginTop: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: FontSize.sm,
    color: palette.muted,
    marginTop: 2,
  },

  /* Preview Modal */
  modalOverlay: {
    padding: Spacing.md,
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    flexShrink: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minWidth: 0,
    backgroundColor: palette.field,
    width: '100%',
    maxWidth: 520,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)' }
      : { elevation: 5 }),
  },
  modalHeader: {
    gap: Spacing.sm,
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 10,
  },
  modalInfoRow: {
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    marginBottom: 6,
  },
  modalInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    width: 90,
  },
  modalInfoValue: {
    lineHeight: 20,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    color: palette.text,
    flex: 1,
    fontWeight: '600',
  },
  modalCaptionText: {
    fontSize: 13,
    color: palette.text,
    lineHeight: 18,
    marginTop: 2,
    backgroundColor: palette.elevated,
    padding: 8,
    borderRadius: 6,
  },
  modalCloseBtn: {
    flexShrink: 0,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    backgroundColor: BRAND_PURPLE,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalTrackingCard: {
    marginVertical: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: palette.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalTrackingTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  modalTrackingStepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalTrackingStep: {
    alignItems: 'center',
    flex: 1,
  },
  modalStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  modalStepBadgeCompleted: {
    backgroundColor: '#16A34A',
  },
  modalStepBadgeActive: {
    backgroundColor: '#D97706',
  },
  modalStepBadgeRejected: {
    backgroundColor: '#DC2626',
  },
  modalStepBadgeUpcoming: {
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalStepConnector: {
    height: 2,
    backgroundColor: '#E2E8F0',
    flex: 1,
    marginTop: 13,
    marginHorizontal: -6,
  },
  modalStepConnectorActive: {
    backgroundColor: '#16A34A',
  },
  modalStepName: {
    lineHeight: 16,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 2,
    textAlign: 'center',
  },
  modalStepStatus: {
    lineHeight: 16,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  /* Social Mockup Tabs & Cards */
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  platformSelectorRow: {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    flexShrink: 1,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformSelectorTab: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  platformSelectorTabActiveFacebook: {
    backgroundColor: palette.dark ? '#172554' : '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  platformSelectorTabActiveInstagram: {
    backgroundColor: palette.dark ? '#500724' : '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  platformSelectorTabActiveWebsite: {
    backgroundColor: palette.dark ? '#052E2B' : '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  platformSelectorTabText: {
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: palette.muted,
  },
  platformSelectorTabTextActiveFacebook: {
    color: palette.dark ? '#93C5FD' : '#1D4ED8',
    fontWeight: '700',
  },
  platformSelectorTabTextActiveInstagram: {
    color: palette.dark ? '#F9A8D4' : '#BE185D',
    fontWeight: '700',
  },
  platformSelectorTabTextActiveWebsite: {
    color: palette.dark ? '#6EE7B7' : '#047857',
    fontWeight: '700',
  },

  modalPlatformTabs: {
    flexShrink: 0,
    marginBottom: Spacing.sm,
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalPlatformTab: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalPlatformTabActiveFacebook: {
    backgroundColor: palette.dark ? '#172554' : '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  modalPlatformTabActiveInstagram: {
    backgroundColor: palette.dark ? '#500724' : '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  modalPlatformTabActiveWebsite: {
    backgroundColor: palette.dark ? '#052E2B' : '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  modalPlatformTabText: {
    flexShrink: 1,
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: palette.muted,
  },
  modalPlatformTabTextActiveFacebook: {
    color: palette.dark ? '#93C5FD' : '#1D4ED8',
    fontWeight: '700',
  },
  modalPlatformTabTextActiveInstagram: {
    color: palette.dark ? '#F9A8D4' : '#BE185D',
    fontWeight: '700',
  },
  modalPlatformTabTextActiveWebsite: {
    color: palette.dark ? '#6EE7B7' : '#047857',
    fontWeight: '700',
  },

  facebookMockupCard: {
    backgroundColor: palette.field,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }
      : { elevation: 2 }),
  },
  instagramMockupCard: {
    backgroundColor: palette.field,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }
      : { elevation: 2 }),
  },
  websiteMockupCard: {
    backgroundColor: palette.field,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }
      : { elevation: 2 }),
  },
  socialHeader: {
    padding: Spacing.sm,
    gap: Spacing.sm,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.elevated,
  },
  socialAuthorName: {
    lineHeight: 20,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  socialTimeText: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 1,
  },
  socialCaptionText: {
    fontSize: 12.5,
    color: palette.text,
    lineHeight: 18,
  },
  socialFooterActions: {
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.elevated,
  },
  socialActionBtn: {
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialActionText: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  emptyMockMedia: {
    height: 160,
    backgroundColor: palette.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
  emptyMockMediaText: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 8,
    textAlign: 'center',
  },
  instagramHeader: {
    padding: Spacing.sm,
    gap: Spacing.sm,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  instagramAvatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E1306C',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instagramAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  instagramAuthorName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#262626',
  },
  instagramLocationText: {
    fontSize: 10.5,
    color: '#8E8E8E',
  },
  instagramActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  instagramLikesText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#262626',
    marginBottom: 4,
  },
  instagramCaptionText: {
    fontSize: 12,
    color: '#262626',
    lineHeight: 17,
  },
  websiteBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.dark ? '#052E2B' : '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  websiteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.dark ? '#6EE7B7' : '#059669',
  },
  websiteTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  websiteMetaText: {
    fontSize: 11,
    color: palette.muted,
    marginBottom: 10,
  },
  websiteFeaturedImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: palette.elevated,
  },
  websiteImageTag: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(5, 150, 105, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  websiteImageTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  websiteBodyText: {
    fontSize: 12.5,
    color: palette.text,
    lineHeight: 18,
  },

  /* Website Featured Selector in Create Form */
  featuredSelectorContainer: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    minWidth: 0,
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
    marginTop: 10,
  },
  featuredSelectorHeader: {
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  featuredSelectorTitle: {
    lineHeight: 20,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  clearAllBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
  },
  clearAllBtnText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  scrollArrowBtn: {
    height: CONTROL_HEIGHT,
    width: CONTROL_HEIGHT,
    borderRadius: 6,
    backgroundColor: palette.dark ? '#052E2B' : '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArrowBtnDisabled: {
    backgroundColor: palette.elevated,
    borderColor: palette.border,
    opacity: 0.5,
  },
  featuredThumbnailsScrollWrapper: {
    width: '100%',
  },
  featuredSelectorSubtitle: {
    fontSize: 11,
    color: palette.muted,
    marginBottom: 10,
  },
  featuredThumbnailsScroll: {
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  featuredThumbCard: {
    width: 126,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.field,
    padding: 6,
    alignItems: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }
      : { elevation: 1 }),
  },
  featuredThumbCardActive: {
    borderColor: '#059669',
    backgroundColor: palette.dark ? '#052E2B' : '#ECFDF5',
  },
  featuredThumbRemoveBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    zIndex: 20,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadgesHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 4,
    gap: 4,
  },
  featuredActiveBadge: {
    backgroundColor: '#059669',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  featuredActiveBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featuredInactiveBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: palette.border,
  },
  featuredInactiveBadgeText: {
    fontSize: 8,
    fontWeight: '600',
    color: palette.muted,
  },
  igThumbBadge: {
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
  },
  igThumbBadgeOk: {
    backgroundColor: palette.dark ? '#052E2B' : '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  igThumbBadgeWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  igThumbBadgeText: {
    fontSize: 8,
    fontWeight: '700',
  },
  igThumbBadgeTextOk: {
    color: palette.dark ? '#6EE7B7' : '#047857',
  },
  igThumbBadgeTextWarning: {
    color: palette.dark ? '#FDE68A' : '#92400E',
  },
  photoRulesMetaRow: {
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  photoDimensionsText: {
    fontSize: 8.5,
    color: palette.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  featuredThumbImageWrap: {
    width: '100%',
    height: 64,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: palette.elevated,
    marginTop: 2,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? {
          pointerEvents: 'none',
          userSelect: 'none',
        }
      : {}),
  },
  featuredThumbImage: {
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? {
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserDrag: 'none',
        }
      : {}),
  },
  featuredThumbName: {
    fontSize: 10.5,
    color: palette.text,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
    ...(Platform.OS === 'web'
      ? {
          userSelect: 'none',
        }
      : {}),
  },
  featuredThumbNameActive: {
    color: palette.dark ? '#6EE7B7' : '#065F46',
    fontWeight: '700',
  },
  featuredThumbStatus: {
    fontSize: 9.5,
    marginTop: 2,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? {
          userSelect: 'none',
        }
      : {}),
  },
  featuredThumbStatusActive: {
    color: palette.dark ? '#6EE7B7' : '#059669',
    fontWeight: '700',
  },
  featuredThumbStatusInactive: {
    color: palette.muted,
    fontWeight: '500',
  },

  /* Platform Chips in Content Request Cards */
  cardPlatformChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  platformChipSmall: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Target Platforms & Rules Form Step */
  platformSectionSub: {
    lineHeight: 20,
    fontSize: FontSize.sm,
    color: palette.muted,
    marginBottom: 8,
  },
  targetPlatformCardsRow: {
    marginTop: Spacing.xs,
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
  },
  targetPlatformCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 0,
    backgroundColor: palette.field,
    borderWidth: 1.5,
    borderColor: palette.border,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.15s ease' } : {}),
  },
  targetPlatformCardActiveFb: {
    borderColor: '#1877F2',
    backgroundColor: palette.dark ? '#172554' : '#F0F7FF',
  },
  targetPlatformCardActiveIg: {
    borderColor: '#E1306C',
    backgroundColor: palette.dark ? '#500724' : '#FDF2F8',
  },
  targetPlatformCardActiveWeb: {
    borderColor: '#059669',
    backgroundColor: palette.dark ? '#052E2B' : '#ECFDF5',
  },
  targetPlatformCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  targetPlatformIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetPlatformCheckbox: {
    width: 17,
    height: 17,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.field,
  },
  targetPlatformCheckboxActiveFb: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  targetPlatformCheckboxActiveIg: {
    backgroundColor: '#E1306C',
    borderColor: '#E1306C',
  },
  targetPlatformCheckboxActiveWeb: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  targetPlatformTitle: {
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  targetPlatformDesc: {
    lineHeight: 16,
    fontSize: FontSize.xs,
    color: palette.muted,
    marginTop: 2,
  },

  /* Photo Quality & Size Rules Status Banners */
  filterAlertBannerWarning: {
    backgroundColor: palette.dark ? '#422006' : '#FEF3C7',
    padding: Spacing.sm,
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterAlertLeft: {
    flexBasis: 180,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  filterAlertIconCircleIg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.dark ? '#500724' : '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterAlertTitleWarning: {
    lineHeight: 20,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: palette.dark ? '#FDE68A' : '#92400E',
  },
  filterAlertDescWarning: {
    lineHeight: 16,
    fontSize: FontSize.xs,
    color: palette.dark ? '#FDE68A' : '#B45309',
    marginTop: 2,
  },
  autoFitAllBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E1306C',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  autoFitAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterAlertBannerSuccess: {
    backgroundColor: palette.dark ? '#052E2B' : '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterAlertTextSuccess: {
    lineHeight: 16,
    minWidth: 0,
    fontSize: 11,
    color: palette.dark ? '#6EE7B7' : '#065F46',
    fontWeight: '600',
    flex: 1,
  },
  filterAlertBannerFb: {
    backgroundColor: palette.dark ? '#172554' : '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterAlertTextFb: {
    lineHeight: 16,
    minWidth: 0,
    fontSize: 11,
    color: palette.dark ? '#93C5FD' : '#1E40AF',
    fontWeight: '600',
    flex: 1,
  },

  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lightboxCloseBtn: {
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: CONTROL_HEIGHT,
    minWidth: CONTROL_HEIGHT,
    position: 'absolute',
    top: 24,
    right: 24,
    padding: 10,
    zIndex: 99,
  },
  lightboxImage: {
    width: '100%',
    height: '85%',
  },
});

export default ModernRequestorDashboard;

