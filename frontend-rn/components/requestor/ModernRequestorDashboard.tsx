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
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ComplianceResultModal } from '../ui/ComplianceResultModal';
import { PaginationControl } from '../ui/PaginationControl';
import { FacebookMediaGrid } from '../social/FacebookMediaGrid';
import { InstagramMediaCarousel } from '../social/InstagramMediaCarousel';
import { FormattedText } from '../ui/FormattedText';
import { RichTextEditor } from '../ui/RichTextEditor';
import { DirectImcRequestDetailsModal } from './DirectImcRequestDetailsModal';
import { BorderRadius, FontSize, Spacing } from '../../constants/theme';
import { useThemeStore } from '../../store/theme';

const BRAND_PURPLE = '#4C007C';
const BRAND_GOLD = '#FFC72C';
const GOLD_INK = '#1A1A2E';
const CONTROL_HEIGHT = 44;
const FORM_BODY_SIZE = 14;
const FORM_LABEL_SIZE = 12;
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
  status: 'Pending' | 'Reviewing' | 'Editing' | 'Published' | 'Rejected';
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
  const workflows = p.approval_workflows || p.approvalWorkflows || [];
  const latestWf = Array.isArray(workflows) && workflows.length > 0 ? workflows[workflows.length - 1] : null;
  const wfAction = String(latestWf?.action || '').toLowerCase();
  const rawStatus = String(p.status || '').toLowerCase();

  if (rawStatus === 'published' || rawStatus === 'scheduled' || rawStatus === 'approved' || wfAction === 'approved') {
    st = 'Published';
  } else if (rawStatus === 'rejected') {
    st = 'Rejected';
  } else if (wfAction === 'editing' || rawStatus === 'editing') {
    st = 'Editing';
  } else if (wfAction === 'reviewing' || rawStatus === 'reviewing') {
    st = 'Reviewing';
  } else if (rawStatus === 'pending_imc_qa' || rawStatus === 'pending_office_head' || rawStatus === 'pending_vice_president' || rawStatus === 'pending') {
    st = 'Pending';
  } else {
    st = 'Reviewing';
  }

  let thumb = '';
  if (Array.isArray(p.media) && p.media.length > 0 && p.media[0]?.url) {
    thumb = resolveImageUrl(p.media[0].url) || '';
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
    routingType: p.routing_type ?? p.routingType ?? 'standard',
    date: p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today',
    time: p.created_at ? new Date(p.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : undefined,
    department: p.requestor?.department || fallbackUser?.department || 'BSIT Department',
    requestedBy: p.requestor?.full_name || fallbackUser?.name || 'Requestor',
    mediaCount: Array.isArray(p.media) ? p.media.length : (p.featured_image ? 1 : 0),
    thumbnailUrl: thumb,
    caption: p.caption_narrative || '',
    media: Array.isArray(p.media) ? p.media : [],
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
  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setContentWidth((prev) => (Math.abs(prev - next) >= 4 ? next : prev));
  }, []);
  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setListWidth((prev) => (Math.abs(prev - next) >= 4 ? next : prev));
  }, []);
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
  const [activeFilter, setActiveFilter] = useState<'All' | 'Pending' | 'Reviewing' | 'Editing' | 'Published' | 'Rejected'>('All');
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
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [focusedField, setFocusedField] = useState<'title' | 'caption' | null>(null);
  const titleInputRef = useRef<TextInput>(null);
  const captionText = formCaption.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim();
  const selectedPlatformCount = Object.values(targetPlatforms).filter(Boolean).length;
  const formReady = Boolean(formTitle.trim() && captionText && selectedPlatformCount);
  const fieldErrors = {
    title: submitAttempted && !formTitle.trim() ? 'Add a request title.' : '',
    caption: submitAttempted && !captionText ? 'Write a caption for this request.' : '',
    platforms: submitAttempted && !selectedPlatformCount ? 'Choose at least one publishing destination.' : '',
  };
  const validationSummary = Object.values(fieldErrors).filter(Boolean).join(' ');

  // The shared web editor owns its contenteditable element; label it without changing its API.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const editor = document.getElementById('imc-request-caption')?.querySelector('[contenteditable="true"]');
    if (!editor) return;
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-label', 'Caption, required');
    editor.setAttribute('aria-multiline', 'true');
    editor.setAttribute('aria-required', 'true');
    editor.setAttribute('aria-invalid', String(Boolean(fieldErrors.caption)));
    if (fieldErrors.caption) editor.setAttribute('aria-describedby', 'imc-caption-error');
    else editor.removeAttribute('aria-describedby');
  }, [fieldErrors.caption, isSidePanelOpen]);

  const focusInvalidField = (field: 'title' | 'caption' | 'platforms') => {
    if (Platform.OS !== 'web') {
      if (field === 'title') titleInputRef.current?.focus();
      return;
    }
    if (typeof document === 'undefined') return;
    const holder = document.getElementById(`imc-request-${field}`);
    const target = field === 'title' ? holder : holder?.querySelector<HTMLElement>(
      field === 'caption' ? '[contenteditable="true"]' : '[role="checkbox"]',
    );
    target?.focus();
    target?.scrollIntoView({ block: 'center', behavior: 'auto' });
  };

  // Social Preview State
  const [formPreviewPlatform, setFormPreviewPlatform] = useState<'facebook' | 'instagram' | 'website'>('facebook');
  const [modalPlatformTab, setModalPlatformTab] = useState<'facebook' | 'instagram' | 'website'>('facebook');

  // Close filter dropdown on outside click or Escape key
  useEffect(() => {
    if (!isFilterDropdownOpen || Platform.OS !== 'web' || typeof document === 'undefined') return;
    let timer: any;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('#filter-dropdown-container')) {
        return;
      }
      setIsFilterDropdownOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFilterDropdownOpen(false);
      }
    };
    // Delay slightly to prevent the toggle click itself from immediately triggering close
    timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterDropdownOpen]);
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

  const currentOpenPostIdRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (selectedPost?.id && currentOpenPostIdRef.current !== selectedPost.id) {
      const postId = selectedPost.id;
      currentOpenPostIdRef.current = postId;
      postsApi.get(Number(postId)).then((res) => {
        if (cancelled) return;
        const fresh = res?.data?.data || res?.data;
        if (fresh?.id) {
          setSelectedPost((prev) => (prev && prev.id === postId ? mapRawPostToCard(fresh, user) : prev));
        }
      }).catch(() => { });
    } else if (!selectedPost) {
      currentOpenPostIdRef.current = null;
    }
    return () => {
      cancelled = true;
    };
  }, [selectedPost?.id, user]);

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
    }).catch(() => { });
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

  // Pagination Drag-to-Scroll State
  const paginationScrollRef = useRef<ScrollView>(null);
  const isDraggingPagination = useRef(false);
  const dragPaginationStartX = useRef(0);
  const dragPaginationScrollLeft = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || filteredRequests.length === 0) return;
    const cleanupFns: (() => void)[] = [];
    const timer = setTimeout(() => {
      const node = (paginationScrollRef.current as any)?.getScrollableNode?.() || (paginationScrollRef.current as any);
      if (!node || !node.addEventListener) return;

      node.style.cursor = 'grab';

      const onMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, select, option, a, input')) return;
        isDraggingPagination.current = true;
        dragPaginationStartX.current = e.pageX;
        dragPaginationScrollLeft.current = node.scrollLeft;
        node.style.cursor = 'grabbing';
        if (typeof document !== 'undefined') {
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDraggingPagination.current) return;
        const diff = e.pageX - dragPaginationStartX.current;
        node.scrollLeft = dragPaginationScrollLeft.current - diff;
      };

      const onMouseUp = () => {
        if (isDraggingPagination.current) {
          isDraggingPagination.current = false;
          node.style.cursor = 'grab';
          if (typeof document !== 'undefined') {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
          }
        }
      };

      node.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mouseleave', onMouseUp);

      cleanupFns.push(() => {
        node.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mouseleave', onMouseUp);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanupFns.forEach((fn) => fn());
    };
  }, [filteredRequests.length, currentPage]);

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

  const handlePickMedia = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const rawItems = res.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name || 'image.jpg',
          file: (asset as any).file,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.size || 0,
        }));
        const processed = await processFiles(rawItems);
        setAttachedFiles((prev) => [...prev, ...processed]);
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
            const rawItems = files.map((f) => ({
              uri: URL.createObjectURL(f),
              name: f.name,
              file: f,
              mimeType: f.type,
              size: f.size,
            }));
            const processed = await processFiles(rawItems);
            setAttachedFiles((prev) => [...prev, ...processed]);
          }
        };
        input.click();
      }
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setSubmitAttempted(true);
    const selectedPlatforms = Object.keys(targetPlatforms).filter(
      (platform) => targetPlatforms[platform as keyof typeof targetPlatforms],
    );
    if (!formReady) {
      focusInvalidField(!formTitle.trim() ? 'title' : !captionText ? 'caption' : 'platforms');
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

      if (attachedFiles.length > 0) {
        const formData = new FormData();
        formData.append('title', formTitle.trim());
        formData.append('caption_narrative', formCaption.trim());
        formData.append('routing_type', 'direct_imc');
        for (const p of selectedPlatforms) {
          formData.append('target_platforms[]', p);
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
      setSubmitAttempted(false);
      setFormPreviewPlatform('facebook');
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
            <Ionicons name="time-outline" size={12} color={palette.dark ? '#FCD34D' : '#92400E'} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: palette.dark ? '#FCD34D' : '#92400E' }]}>Pending</Text>
          </View>
        );
      case 'Published':
        return (
          <View style={[styles.statusBadge, styles.statusPublished]}>
            <Ionicons name="checkmark-circle-outline" size={12} color={palette.dark ? '#86EFAC' : '#166534'} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: palette.dark ? '#86EFAC' : '#166534' }]}>Published</Text>
          </View>
        );
      case 'Reviewing':
        return (
          <View style={[styles.statusBadge, styles.statusReviewing]}>
            <Ionicons name="sync-outline" size={12} color={palette.dark ? '#7DD3FC' : '#075985'} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: palette.dark ? '#7DD3FC' : '#075985' }]}>Reviewing</Text>
          </View>
        );
      case 'Editing':
        return (
          <View style={[styles.statusBadge, styles.statusEditing]}>
            <Ionicons name="create-outline" size={12} color={palette.dark ? '#C084FC' : '#7C3AED'} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: palette.dark ? '#C084FC' : '#7C3AED' }]}>Editing</Text>
          </View>
        );
      case 'Rejected':
        return (
          <View style={[styles.statusBadge, styles.statusRejected]}>
            <Ionicons name="close-circle-outline" size={12} color={palette.dark ? '#FCA5A5' : '#991B1B'} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: palette.dark ? '#FCA5A5' : '#991B1B' }]}>Rejected</Text>
          </View>
        );
    }
  };

  return (
    <View nativeID="requestor-imc-workspace" style={styles.container}
      onLayout={handleContentLayout}>
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
        #requestor-workspace #requestor-imc-workspace input:focus,
        #requestor-workspace #requestor-imc-workspace input:focus-visible { outline: none !important; box-shadow: none !important; border-color: ${palette.purple} !important; }
        #requestor-workspace #requestor-imc-workspace input[aria-invalid="true"] { border-color: ${isDarkMode ? '#FCA5A5' : '#B91C1C'} !important; }
        #requestor-imc-workspace [data-testid="requestor-imc-submit"] *,
        #requestor-imc-workspace [data-testid="requestor-imc-submit"] { color: ${GOLD_INK} !important; }
        @media (prefers-reduced-motion: reduce) {
          #requestor-imc-workspace * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
        }
      `}</style>}
      {/* ================= TOP SWITCHER & HEADER BAR ================= */}
      <View style={styles.topControlBanner}>
        <View style={styles.topBannerLeft}>
          <View style={styles.topBannerHeaderRow}>
            <Text style={styles.topBannerTitle}>Create Request to IMC</Text>
          </View>
          <Text style={styles.topBannerSubtitle}>
            Submit and track publication-ready requests directly handled by Integrated Marketing Communications
          </Text>
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
              <Ionicons name="arrow-back" size={15} color={palette.dark ? '#C4B5FD' : '#7C3AED'} />
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
            isFilterDropdownOpen && { zIndex: 999999 },
          ]}
          onLayout={handleListLayout}
        >
          {/* Header Row: Title, Search, Filter */}
          <View style={[styles.listHeaderRow, isFilterDropdownOpen && { zIndex: 999999 }]}>
            <Text style={styles.sectionHeading}>Content Requests</Text>

            <View style={[styles.searchAndFilterGroup, isCompactCard && styles.fullWidth, isFilterDropdownOpen && { zIndex: 999999 }]}>
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
              <View
                nativeID="filter-dropdown-container"
                {...(Platform.OS === 'web' ? { id: 'filter-dropdown-container' } : {})}
                style={{ position: 'relative', zIndex: isFilterDropdownOpen ? 999999 : 50 }}
              >
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
                  <Ionicons name={isFilterDropdownOpen ? "chevron-up" : "chevron-down"} size={14} color={palette.muted} />
                </TouchableOpacity>

                {isFilterDropdownOpen && (
                  <View style={styles.filterDropdownMenu}>
                    {(['All', 'Reviewing', 'Editing', 'Published', 'Rejected'] as const).map((opt) => (
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
                        {activeFilter === opt && (
                          <Ionicons name="checkmark" size={14} color={palette.purple} />
                        )}
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
                      <View style={styles.thumbnailPlaceholderIconCircle}>
                        <Ionicons name="images-outline" size={22} color={palette.dark ? '#A78BFA' : '#7C3AED'} />
                      </View>
                      <Text style={styles.thumbnailPlaceholderText}>No image</Text>
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
                              <View style={[styles.platformChipSmall, { backgroundColor: palette.dark ? '#1E3A8A' : '#EFF6FF' }]}>
                                <Ionicons name="logo-facebook" size={12} color="#1877F2" />
                              </View>
                            )}
                            {item.targetPlatforms.includes('instagram') && (
                              <View style={[styles.platformChipSmall, { backgroundColor: palette.dark ? '#500724' : '#FDF2F8' }]}>
                                <Ionicons name="logo-instagram" size={12} color="#E1306C" />
                              </View>
                            )}
                            {(item.targetPlatforms.includes('website') || item.targetPlatforms.includes('portal') || item.targetPlatforms.includes('wordpress')) && (
                              <View style={[styles.platformChipSmall, { backgroundColor: palette.dark ? '#064E3B' : '#ECFDF5' }]}>
                                <Ionicons name="globe-outline" size={12} color="#059669" />
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

                    {/* Details Info Row: SUBMITTED ON & DEPARTMENT */}
                    <View style={styles.detailsRow}>
                      {/* Submitted On Column */}
                      <View style={styles.detailCol}>
                        <View style={styles.detailLabelRow}>
                          <Ionicons name="calendar-outline" size={13} color={palette.dark ? '#A78BFA' : '#7C3AED'} style={{ marginRight: 4 }} />
                          <Text style={styles.detailLabel}>SUBMITTED ON</Text>
                        </View>
                        <Text style={styles.detailValue}>{item.date}</Text>
                        {Boolean(item.time) && (
                          <Text style={styles.detailValueSub}>{item.time}</Text>
                        )}
                      </View>

                      <View style={styles.detailColDivider} />

                      {/* Department Column */}
                      <View style={[styles.detailCol, { flex: 1.3 }]}>
                        <View style={styles.detailLabelRow}>
                          <Ionicons name="business-outline" size={13} color={palette.dark ? '#A78BFA' : '#7C3AED'} style={{ marginRight: 4 }} />
                          <Text style={styles.detailLabel}>DEPARTMENT</Text>
                        </View>
                        <Text style={styles.detailValue} numberOfLines={1}>{item.department}</Text>
                        <Text style={styles.detailValueSub} numberOfLines={1}>Requested by: {item.requestedBy}</Text>
                      </View>
                    </View>

                    {/* Footer Row: Media count & View Request Button */}
                    <View style={styles.cardFooterRow}>
                      <View style={styles.mediaCountBadge}>
                        <Ionicons name="images-outline" size={13} color={palette.dark ? '#C4B5FD' : '#7C3AED'} style={{ marginRight: 5 }} />
                        <Text style={styles.mediaCountText}>
                          {item.mediaCount} Media Attachment{item.mediaCount > 1 ? 's' : ''}
                        </Text>
                      </View>

                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`View request: ${item.title}`}
                        style={styles.viewRequestBtn}
                        onPress={() => setSelectedPost(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="eye-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.viewRequestBtnText}>View Request</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}

            {filteredRequests.length > 0 && (
              <View style={styles.paginationCard}>
                <ScrollView
                  ref={paginationScrollRef}
                  horizontal={!isCompactCard}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.paginationScrollInner}
                >
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
                    noWrap={!isCompactCard}
                    style={{ borderTopWidth: 0, width: '100%' }}
                  />
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </View>

        {/* COLUMN: CREATE CONTENT REQUEST PANEL (Rendered on Left via row-reverse) */}
        {isSidePanelOpen && (
          <View style={[styles.rightSection, isDesktop && { flex: 1, width: undefined }]}>
            {/* Panel Purple Header */}
            <View style={styles.panelHeaderPurple}>
              <View style={styles.panelHeaderLeft}>
                <View style={styles.panelPlusCircle}>
                  <Ionicons name="create-outline" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.panelHeaderTitle}>Create Content Request</Text>
              </View>

              <TouchableOpacity
                style={styles.panelCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close create content request form"
                onPress={() => setIsSidePanelOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Panel Form Body */}
            <View style={styles.panelFormScrollContent}>
              {validationSummary ? (
                <Text accessibilityRole="alert" style={styles.fieldErrorText}>
                  Check the highlighted fields before submitting.
                </Text>
              ) : null}
              {/* SECTION: BASIC INFORMATION */}
              <View style={styles.redesignedSectionCard}>
                <View style={styles.redesignedSectionHeader}>
                  <View style={styles.redesignedHeaderIconBox}>
                    <Ionicons name="document-text-outline" size={16} color={palette.dark ? '#A78BFA' : '#7C3AED'} />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Basic Information</Text>
                </View>

                <View style={styles.redesignedFieldGroup}>
                  <Text style={styles.redesignedFieldLabel}>
                    Request title <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <TextInput
                    ref={titleInputRef}
                    nativeID="imc-request-title"
                    style={[styles.redesignedTextInput, focusedField === 'title' && styles.fieldFocused, fieldErrors.title && styles.fieldInvalid]}
                    accessibilityLabel="Request title, required"
                    {...(Platform.OS === 'web' ? {
                      'aria-required': true,
                      'aria-invalid': Boolean(fieldErrors.title),
                      'aria-describedby': fieldErrors.title ? 'imc-title-error' : undefined,
                    } : {})}
                    onFocus={() => setFocusedField('title')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g., Campus Event Announcement"
                    placeholderTextColor="#94A3B8"
                    value={formTitle}
                    onChangeText={setFormTitle}
                  />
                  {fieldErrors.title ? <Text nativeID="imc-title-error" style={styles.fieldErrorText}>{fieldErrors.title}</Text> : null}
                </View>

                <View style={[styles.redesignedFieldGroup, { marginTop: Spacing.md }]}>
                  <Text style={styles.redesignedFieldLabel}>Department</Text>
                  <View style={styles.redesignedReadonlyBox}>
                    <Text style={styles.redesignedReadonlyText}>
                      {user?.department || formDepartment || 'BSIT Department'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* SECTION: CAPTION */}
              <View style={styles.redesignedSectionCard}>
                <View style={styles.redesignedSectionHeader}>
                  <View style={styles.redesignedHeaderIconBox}>
                    <Ionicons name="chatbox-ellipses-outline" size={16} color={palette.dark ? '#A78BFA' : '#7C3AED'} />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Caption <Text style={styles.fieldErrorText}>*</Text></Text>
                </View>

                <View style={styles.captionGuideCallout}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                    <Ionicons name="information-circle-outline" size={15} color={palette.dark ? '#A78BFA' : '#7C3AED'} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.captionGuideText}>
                        Include who is involved, what is happening, when and where it takes place, and why it matters.
                      </Text>
                      <Text style={[styles.captionGuideText, { marginTop: 4, fontStyle: 'italic' }]}>
                        Example: The JMCFI Student Council invites all students to [event] on [date and time] at [venue] to [purpose].
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  nativeID="imc-request-caption"
                  style={[styles.captionEditorShell, focusedField === 'caption' && styles.fieldFocused, fieldErrors.caption && styles.fieldInvalid]}
                  {...(Platform.OS === 'web' ? {
                    onFocus: () => setFocusedField('caption'),
                    onBlur: () => setFocusedField(null),
                  } : {})}
                >
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
                {fieldErrors.caption ? <Text nativeID="imc-caption-error" style={styles.fieldErrorText}>{fieldErrors.caption}</Text> : null}

                <View style={styles.redesignedCaptionFooter}>
                  <Text style={styles.redesignedCharCounter}>
                    {formCaption.replace(/<[^>]*>/g, '').length} / 2200 characters
                  </Text>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={isCheckingPolicy ? 'Checking policy alignment' : 'Check policy alignment with AI'}
                    accessibilityState={{ disabled: isCheckingPolicy, busy: isCheckingPolicy }}
                    {...(Platform.OS === 'web' ? { 'aria-busy': isCheckingPolicy } : {})}
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
                      <Ionicons name="shield-checkmark-outline" size={18} color={palette.purple} style={{ marginRight: 6 }} />
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
                    <Ionicons name="share-social-outline" size={16} color={palette.dark ? '#A78BFA' : '#7C3AED'} />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Target Platforms <Text style={styles.fieldErrorText}>*</Text></Text>
                </View>
                <Text style={styles.platformSectionSub}>
                  Choose where to publish. Photo requirements apply to your selected platforms.
                </Text>

                <View nativeID="imc-request-platforms" style={styles.targetPlatformCardsRow}>
                  {/* Facebook */}
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityLabel="Publish to Facebook"
                    accessibilityState={{ checked: targetPlatforms.facebook }}
                    {...(Platform.OS === 'web' ? { 'aria-checked': targetPlatforms.facebook, 'aria-invalid': Boolean(fieldErrors.platforms), 'aria-describedby': fieldErrors.platforms ? 'imc-platforms-error' : undefined } : {})}
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
                    <Text style={styles.targetPlatformStatus}>{targetPlatforms.facebook ? 'Selected' : 'Not selected'}</Text>
                  </TouchableOpacity>

                  {/* Instagram */}
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityLabel="Publish to Instagram"
                    accessibilityState={{ checked: targetPlatforms.instagram }}
                    {...(Platform.OS === 'web' ? { 'aria-checked': targetPlatforms.instagram, 'aria-invalid': Boolean(fieldErrors.platforms), 'aria-describedby': fieldErrors.platforms ? 'imc-platforms-error' : undefined } : {})}
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
                    <Text style={styles.targetPlatformStatus}>{targetPlatforms.instagram ? 'Selected' : 'Not selected'}</Text>
                  </TouchableOpacity>

                  {/* Website */}
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityLabel="Publish to the JMCFI website"
                    accessibilityState={{ checked: targetPlatforms.website }}
                    {...(Platform.OS === 'web' ? { 'aria-checked': targetPlatforms.website, 'aria-invalid': Boolean(fieldErrors.platforms), 'aria-describedby': fieldErrors.platforms ? 'imc-platforms-error' : undefined } : {})}
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
                    <Text style={styles.targetPlatformStatus}>{targetPlatforms.website ? 'Selected' : 'Not selected'}</Text>
                  </TouchableOpacity>
                </View>
                {fieldErrors.platforms ? <Text nativeID="imc-platforms-error" style={styles.fieldErrorText}>{fieldErrors.platforms}</Text> : null}
              </View>

              {/* SECTION: MEDIA ATTACHMENT */}
              <View style={styles.redesignedSectionCard}>
                <View style={styles.redesignedSectionHeader}>
                  <View style={styles.redesignedHeaderIconBox}>
                    <Ionicons name="images-outline" size={16} color={palette.dark ? '#A78BFA' : '#7C3AED'} />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Media Attachment</Text>
                </View>

                <TouchableOpacity
                  style={styles.dropzoneContainer}
                  accessibilityRole="button"
                  accessibilityLabel="Browse JPEG, PNG, or WebP images"
                  onPress={handlePickMedia}
                  activeOpacity={0.8}
                >
                  <View style={styles.uploadIconBadge}>
                    <Ionicons name="image-outline" size={20} color={palette.dark ? '#C4B5FD' : '#7C3AED'} />
                  </View>
                  <Text style={styles.dropzoneTitle}>Browse images</Text>
                  <Text style={styles.dropzoneSubtitle}>JPEG, PNG or WebP · Select one or more images</Text>
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
              <View style={styles.redesignedSectionCard}>
                <View style={styles.redesignedSectionHeader}>
                  <View style={styles.redesignedHeaderIconBox}>
                    <Ionicons name="eye-outline" size={16} color={palette.dark ? '#A78BFA' : '#7C3AED'} />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Content Preview</Text>
                </View>
                <View nativeID="imc-content-preview" style={styles.formGroup}>
                  <View style={styles.previewHeaderRow}>

                    {/* Platform Selector Tabs */}
                    <View style={styles.platformSelectorRow}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ selected: formPreviewPlatform === 'facebook' }}
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
                        accessibilityState={{ selected: formPreviewPlatform === 'instagram' }}
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
                        accessibilityState={{ selected: formPreviewPlatform === 'website' }}
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

                  <>
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
                            {formCaption ? formCaption.replace(/<[^>]*>/g, '') : ''}
                          </Text>
                        </View>

                        {createFormImageUris.length > 0 ? (
                          <FacebookMediaGrid
                            images={createFormImageUris}
                            onImagePress={(uri) => setFullScreenImage(uri)}
                          />
                        ) : (
                          <View style={[styles.emptyMockMedia, styles.formEmptyMedia]}>
                            <Ionicons name="image-outline" size={32} color={palette.muted} />
                            <Text style={styles.emptyMockMediaText}>No image attached</Text>
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
                          <View style={[styles.emptyMockMedia, styles.formEmptyMedia]}>
                            <Ionicons name="image-outline" size={32} color={palette.muted} />
                            <Text style={styles.emptyMockMediaText}>No image attached</Text>
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
                            {formCaption ? formCaption.replace(/<[^>]*>/g, '') : ''}
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
                            <Text style={styles.emptyMockMediaText}>No featured image selected</Text>
                          </View>
                        )}

                        <Text style={styles.websiteBodyText}>
                          {formCaption ? formCaption.replace(/<[^>]*>/g, '') : ''}
                        </Text>
                      </View>
                    )}
                  </>
                </View>
              </View>

              {/* BUTTONS: CANCEL & SUBMIT */}
              <View style={styles.readinessFooter}>
                <Text style={styles.readinessTitle}>
                  {isSubmitting ? 'Submitting your request to IMC…' : formReady ? 'Ready for IMC review' : 'Add a title, caption, and publishing destination'}
                </Text>
                <Text style={styles.readinessDetail}>
                  {selectedPlatformCount} {selectedPlatformCount === 1 ? 'platform' : 'platforms'} selected · {createFormImageUris.length} {createFormImageUris.length === 1 ? 'image' : 'images'} attached · Images are optional
                </Text>
              </View>
              <View style={[styles.formActionsRow, isCompact && styles.formActionsCompact]}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.cancelBtn, isCompact && styles.formActionCompact]}
                  onPress={() => {
                    setSubmitAttempted(false);
                    setFormPreviewPlatform('facebook');
                    setFormTitle('');
                    setFormCaption('');
                    setTargetPlatforms({ facebook: false, instagram: false, website: false });
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
                  accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                  disabled={isSubmitting}
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

      {/* Direct IMC details use the same layout as the overview. */}
      {selectedPost && (
        <DirectImcRequestDetailsModal request={selectedPost} onClose={() => setSelectedPost(null)} />
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
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
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
        boxShadow: palette.dark ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 4px 20px rgba(0, 0, 0, 0.04)',
      }
      : { elevation: 2 }),
  },
  topBannerLeft: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'column',
  },
  topBannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBannerIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.dark ? '#2E1065' : '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBannerSubtitle: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 3,
    lineHeight: 16,
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
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.dark ? '#2E1065' : '#FAF5FF',
    borderWidth: 1,
    borderColor: palette.dark ? '#6B21A8' : '#D8B4FE',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 120ms ease' } : {}),
  },
  switchDashboardBtnText: {
    flexShrink: 1,
    lineHeight: 18,
    fontSize: 12.5,
    fontWeight: '700',
    color: palette.dark ? '#C4B5FD' : '#7C3AED',
  },
  openDrawerBtn: {
    flexShrink: 1,
    minWidth: 0,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND_PURPLE,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  openDrawerBtnText: {
    fontSize: 12.5,
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
    position: 'relative',
  },
  listHeaderRow: {
    position: 'relative',
    marginBottom: Spacing.md,
    gap: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    width: '100%',
    zIndex: 50,
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
    position: 'relative',
    flexShrink: 1,
    minWidth: 0,
    gap: Spacing.sm,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
  },
  searchBarContainer: {
    flexShrink: 1,
    width: 232,
    paddingVertical: 0,
    paddingHorizontal: Spacing.sm,
    minHeight: 38,
    height: 38,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.field,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
  },
  searchInput: {
    fontSize: FontSize.sm,
    height: 36,
    minWidth: 0,
    flex: 1,
    color: palette.text,
    padding: 0,
    outlineWidth: 0,
  },
  filterBtn: {
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    minHeight: 38,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.field,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 5,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  filterBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: palette.text,
  },
  filterDropdownMenu: {
    top: 44,
    position: 'absolute',
    right: 0,
    backgroundColor: palette.dark ? '#1E293B' : '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 4,
    width: 148,
    zIndex: 999999,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: palette.dark ? '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)' : '0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }
      : { elevation: 20 }),
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  filterDropdownItemActive: {
    backgroundColor: palette.purpleTint,
  },
  filterDropdownText: {
    fontSize: 12.5,
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
    zIndex: 1,
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
    marginTop: 6,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
      }
      : {}),
  },
  paginationScrollInner: {
    minWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestCard: {
    borderRadius: 14,
    gap: Spacing.md,
    padding: 16,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    width: '100%',
    ...(Platform.OS === 'web'
      ? {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: palette.dark ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 4px 16px rgba(0, 0, 0, 0.04)',
      }
      : { elevation: 1 }),
  },
  cardThumbnail: {
    flexShrink: 0,
    marginRight: 0,
    width: 104,
    height: 104,
    borderRadius: 12,
    backgroundColor: palette.dark ? '#1E293B' : '#F8FAFC',
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  cardThumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
  },
  thumbnailPlaceholderIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.dark ? '#2E1065' : '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  thumbnailPlaceholderText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: palette.muted,
    letterSpacing: 0.1,
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
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: palette.dark ? '#451A03' : '#FEF3C7',
    borderWidth: 1,
    borderColor: palette.dark ? '#78350F' : '#FDE68A',
  },
  statusPublished: {
    backgroundColor: palette.dark ? '#064E3B' : '#DCFCE7',
    borderWidth: 1,
    borderColor: palette.dark ? '#047857' : '#BBF7D0',
  },
  statusReviewing: {
    backgroundColor: palette.dark ? '#0C4A6E' : '#E0F2FE',
    borderWidth: 1,
    borderColor: palette.dark ? '#0369A1' : '#BAE6FD',
  },
  statusEditing: {
    backgroundColor: palette.dark ? '#3B0764' : '#F3E8FF',
    borderWidth: 1,
    borderColor: palette.dark ? '#7C3AED' : '#C084FC',
  },
  statusRejected: {
    backgroundColor: palette.dark ? '#450A0A' : '#FEE2E2',
    borderWidth: 1,
    borderColor: palette.dark ? '#7F1D1D' : '#FECACA',
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
    marginBottom: 6,
  },
  detailsRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 0,
    gap: Spacing.md,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: palette.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
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
    backgroundColor: palette.border,
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  detailLabel: {
    lineHeight: 16,
    fontSize: 10.5,
    fontWeight: '800',
    color: palette.dark ? '#A78BFA' : '#7C3AED',
    letterSpacing: 0.6,
  },
  detailValue: {
    flexShrink: 1,
    lineHeight: 18,
    fontSize: 12.5,
    fontWeight: '700',
    color: palette.text,
  },
  detailValueSub: {
    flexShrink: 1,
    lineHeight: 16,
    fontSize: 11,
    color: palette.muted,
    marginTop: 2,
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
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.dark ? '#2E1065' : '#FAF5FF',
    borderWidth: 1,
    borderColor: palette.dark ? '#581C87' : '#E9D5FF',
    borderRadius: 999,
  },
  mediaCountText: {
    lineHeight: 16,
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.dark ? '#C4B5FD' : '#7C3AED',
  },
  viewRequestBtn: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(124, 58, 237, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        transition: 'all 120ms ease',
      } as any)
      : {}),
  },
  viewRequestBtnText: {
    lineHeight: 18,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
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
    minHeight: 56,
    paddingVertical: 10,
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
    gap: 10,
  },
  panelPlusCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHeaderTitle: {
    flexShrink: 1,
    lineHeight: 22,
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  panelCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 120ms ease' } : {}),
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
    padding: 16,
    minWidth: 0,
    backgroundColor: palette.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 14,
  },
  redesignedSectionHeader: {
    marginBottom: 12,
    paddingBottom: 10,
    gap: Spacing.sm,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  redesignedHeaderIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: palette.dark ? '#2E1065' : '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redesignedSectionTitle: {
    flexShrink: 1,
    lineHeight: 22,
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  redesignedFieldGroup: {
    gap: Spacing.sm,
    minWidth: 0,
  },
  redesignedFieldLabel: {
    lineHeight: 20,
    fontSize: FORM_LABEL_SIZE,
    fontWeight: '700',
    color: palette.muted,
  },
  redesignedTextInput: {
    fontSize: FORM_BODY_SIZE,
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
  fieldFocused: {
    borderColor: palette.purple,
    ...(Platform.OS === 'web' ? { outlineWidth: 2, outlineStyle: 'solid', outlineColor: palette.purple, outlineOffset: 2 } : {}),
  },
  fieldInvalid: { borderColor: palette.dark ? '#FCA5A5' : '#B91C1C' },
  fieldErrorText: {
    color: palette.dark ? '#FCA5A5' : '#B91C1C',
    fontSize: FORM_LABEL_SIZE,
    lineHeight: 20,
    flexShrink: 1,
  },
  captionEditorShell: {
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: BorderRadius.md,
  },
  readinessFooter: {
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    minWidth: 0,
  },
  readinessTitle: { color: palette.text, fontSize: FORM_BODY_SIZE, lineHeight: 20, fontWeight: '600' },
  readinessDetail: { color: palette.muted, fontSize: FORM_LABEL_SIZE, lineHeight: 20 },
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
    fontSize: FORM_BODY_SIZE,
    color: palette.text,
  },
  captionGuideCallout: {
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: palette.elevated,
    borderRadius: BorderRadius.md,
  },
  captionGuideText: {
    lineHeight: 20,
    fontSize: FORM_BODY_SIZE,
    color: palette.muted,
  },
  captionExampleToggle: {
    minHeight: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
  },
  captionExampleToggleText: {
    fontSize: FORM_LABEL_SIZE,
    fontWeight: '600',
    color: palette.purple,
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
    fontSize: FORM_LABEL_SIZE,
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
    fontSize: FORM_BODY_SIZE,
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
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconBadge: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: palette.purpleTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  dropzoneTitle: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: FORM_BODY_SIZE,
    fontWeight: '700',
    color: palette.text,
  },
  dropzoneSubtitle: {
    textAlign: 'center',
    lineHeight: 16,
    fontSize: FORM_LABEL_SIZE,
    color: palette.muted,
    marginTop: Spacing.xs,
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
    flexBasis: 90,
    minWidth: 0,
    borderRadius: 999,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 40,
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: palette.elevated,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  cancelBtnText: {
    fontSize: FORM_BODY_SIZE,
    fontWeight: '700',
    color: palette.muted,
  },
  submitBtn: {
    backgroundColor: BRAND_GOLD,
    flexBasis: 160,
    minWidth: 0,
    borderRadius: 999,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 40,
    flexGrow: 1.6,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        transition: 'all 120ms ease',
      } as any)
      : {}),
  },
  submitBtnText: {
    textAlign: 'center',
    flexShrink: 1,
    color: GOLD_INK,
    lineHeight: 20,
    fontSize: FORM_BODY_SIZE,
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
  formPreviewEmpty: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.elevated,
    alignItems: 'center',
  },
  formEmptyMedia: { height: 96 },
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
    flexBasis: 120,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
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
    fontSize: FORM_BODY_SIZE,
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
    gap: 6,
  },
  platformChipSmall: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Target Platforms & Rules Form Step */
  platformSectionSub: {
    lineHeight: 20,
    fontSize: FORM_BODY_SIZE,
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
    flexBasis: 144,
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
    fontSize: FORM_BODY_SIZE,
    fontWeight: '700',
    color: palette.text,
  },
  targetPlatformDesc: {
    lineHeight: 16,
    fontSize: FORM_LABEL_SIZE,
    color: palette.muted,
    marginTop: 2,
  },
  targetPlatformStatus: {
    marginTop: Spacing.sm,
    fontSize: FORM_LABEL_SIZE,
    lineHeight: 16,
    fontWeight: '600',
    color: palette.text,
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

