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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ComplianceResultModal } from '../ui/ComplianceResultModal';
import { PaginationControl } from '../ui/PaginationControl';
import { FacebookMediaGrid } from '../social/FacebookMediaGrid';
import { InstagramMediaCarousel } from '../social/InstagramMediaCarousel';
import { FormattedText } from '../ui/FormattedText';
import { RichTextEditor } from '../ui/RichTextEditor';

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
    routingType: p.routing_type || p.routingType || 'direct_imc',
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
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

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
  const [modalPreviewCarouselIndex, setModalPreviewCarouselIndex] = useState(0);

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
        node.scrollBy({ left: offset, behavior: 'smooth' });
        setTimeout(checkFeaturedScroll, 200);
        return;
      }
    }
    featuredScrollRef.current?.scrollTo({ x: offset > 0 ? 300 : 0, animated: true });
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
      setModalPreviewCarouselIndex(0);
      const platforms = (selectedPost.targetPlatforms || []).map((p) => String(p).toLowerCase());
      if (platforms.includes('facebook')) {
        setModalPlatformTab('facebook');
      } else if (platforms.includes('instagram')) {
        setModalPlatformTab('instagram');
      } else if (platforms.includes('website')) {
        setModalPlatformTab('website');
      } else {
        setModalPlatformTab('facebook');
      }
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
            <Ionicons name="time-outline" size={13} color="#D97706" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#D97706' }]}>Pending</Text>
          </View>
        );
      case 'Approved':
        return (
          <View style={[styles.statusBadge, styles.statusApproved]}>
            <Ionicons name="checkmark-circle-outline" size={13} color="#16A34A" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#16A34A' }]}>Approved</Text>
          </View>
        );
      case 'Reviewing':
        return (
          <View style={[styles.statusBadge, styles.statusReviewing]}>
            <Ionicons name="sync-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#0284C7' }]}>Reviewing</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* ================= TOP SWITCHER & HEADER BAR ================= */}
      <View style={styles.topControlBanner}>
        <View style={styles.topBannerLeft}>
          <Text style={styles.topBannerTitle}>Create Request to IMC</Text>
        </View>

        <View style={styles.topBannerRight}>
          {onChangeRequestType && (
            <TouchableOpacity
              style={styles.switchDashboardBtn}
              onPress={onChangeRequestType}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={15} color="#581C87" />
              <Text style={[styles.switchDashboardBtnText, { color: '#581C87' }]}>Change Request Type</Text>
            </TouchableOpacity>
          )}

          {!isSidePanelOpen && (
            <TouchableOpacity
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
            { flex: 1, width: '100%' },
            isDesktop && isSidePanelOpen && { flex: 1 },
          ]}
        >
          {/* Header Row: Title, Search, Filter */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.sectionHeading}>Content Requests</Text>

            <View style={styles.searchAndFilterGroup}>
              {/* Search Bar */}
              <View style={styles.searchBarContainer}>
                <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search requests..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {Boolean(searchQuery) && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter Button */}
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  style={styles.filterBtn}
                  onPress={() => setIsFilterDropdownOpen((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="filter-outline" size={16} color="#374151" style={{ marginRight: 4 }} />
                  <Text style={styles.filterBtnText}>
                    {activeFilter === 'All' ? 'Filter' : activeFilter}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#374151" />
                </TouchableOpacity>

                {isFilterDropdownOpen && (
                  <View style={styles.filterDropdownMenu}>
                    {(['All', 'Pending', 'Approved', 'Reviewing'] as const).map((opt) => (
                      <TouchableOpacity
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
                <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No matching requests found</Text>
                <Text style={styles.emptySubtitle}>Try adjusting your search or filter</Text>
              </View>
            ) : (
              paginatedRequests.map((item) => (
                <View key={item.id} style={styles.requestCard}>
                  {/* Left Thumbnail */}
                  {item.thumbnailUrl ? (
                    <Image
                      source={{ uri: item.thumbnailUrl }}
                      style={styles.cardThumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.cardThumbnail, styles.cardThumbnailPlaceholder]}>
                      <Ionicons name="image-outline" size={32} color="#94A3B8" />
                    </View>
                  )}

                  {/* Right Card Content */}
                  <View style={styles.cardBody}>
                    {/* Top Row: Code Tag + Platforms + Status */}
                    <View style={styles.cardTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeText}>{item.code}</Text>
                        </View>
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
                          <Ionicons name="calendar-outline" size={14} color="#4B5563" style={{ marginRight: 4 }} />
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
                          <Ionicons name="people-outline" size={14} color="#4B5563" style={{ marginRight: 4 }} />
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
          <View style={[styles.rightSection, isDesktop && { flex: 1 }]}>
            {/* Panel Purple Header */}
            <View style={styles.panelHeaderPurple}>
              <View style={styles.panelHeaderLeft}>
                <Text style={styles.panelHeaderTitle}>Create Content Request</Text>
              </View>

              <TouchableOpacity
                style={styles.panelCloseBtn}
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
                    <Ionicons name="document-text-outline" size={18} color="#334155" />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Basic Information</Text>
                </View>

                <View style={styles.redesignedFieldGroup}>
                  <Text style={styles.redesignedFieldLabel}>
                    REQUEST TITLE <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.redesignedTextInput}
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
                    <Ionicons name="document-text-outline" size={18} color="#334155" />
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
                    style={[
                      styles.redesignedAiPolicyBtn,
                      isCheckingPolicy && { opacity: 0.7 }
                    ]}
                    onPress={handleCheckPolicy}
                    disabled={isCheckingPolicy}
                    activeOpacity={0.75}
                  >
                    {isCheckingPolicy ? (
                      <ActivityIndicator size="small" color="#334155" style={{ marginRight: 6 }} />
                    ) : (
                      <Ionicons name="shield-outline" size={15} color="#334155" style={{ marginRight: 6 }} />
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
                    <Ionicons name="share-social-outline" size={18} color="#334155" />
                  </View>
                  <Text style={styles.redesignedSectionTitle}>Target Platforms & Photo Rules</Text>
                </View>
                <Text style={styles.platformSectionSub}>
                  Select publishing destinations to activate platform-specific photo quality filters & aspect ratio rules.
                </Text>

                <View style={styles.targetPlatformCardsRow}>
                  {/* Facebook */}
                  <TouchableOpacity
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
                  onPress={handlePickMedia}
                  activeOpacity={0.8}
                >
                  <View style={styles.uploadIconBadge}>
                    <Ionicons name="image" size={24} color="#6D28D9" />
                  </View>
                  <Text style={styles.dropzoneTitle}>Upload Image or Video</Text>
                  <Text style={styles.dropzoneSubtitle}>Drag and drop your file here or click to browse</Text>
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
                          onPress={() => handleFeaturedScrollBy(-180)}
                          style={[styles.scrollArrowBtn, !canScrollLeftFeatured && styles.scrollArrowBtnDisabled]}
                          disabled={!canScrollLeftFeatured}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="chevron-back" size={13} color={canScrollLeftFeatured ? '#059669' : '#94A3B8'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleFeaturedScrollBy(180)}
                          style={[styles.scrollArrowBtn, !canScrollRightFeatured && styles.scrollArrowBtnDisabled]}
                          disabled={!canScrollRightFeatured}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="chevron-forward" size={13} color={canScrollRightFeatured ? '#059669' : '#94A3B8'} />
                        </TouchableOpacity>
                        <TouchableOpacity
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
                              onPress={(e: any) => {
                                e?.stopPropagation?.();
                                handleRemoveAttachedFile(idx);
                              }}
                              style={styles.featuredThumbRemoveBtn}
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
                                <Ionicons name="image-outline" size={26} color="#94A3B8" />
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
                      <Ionicons name="ellipsis-horizontal" size={16} color="#64748B" />
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
                        <Ionicons name="image-outline" size={32} color="#94A3B8" />
                        <Text style={styles.emptyMockMediaText}>Upload media to see your content preview here...</Text>
                      </View>
                    )}

                    <View style={styles.socialFooterActions}>
                      <View style={styles.socialActionBtn}>
                        <Ionicons name="thumbs-up-outline" size={14} color="#64748B" />
                        <Text style={styles.socialActionText}>Like</Text>
                      </View>
                      <View style={styles.socialActionBtn}>
                        <Ionicons name="chatbubble-outline" size={14} color="#64748B" />
                        <Text style={styles.socialActionText}>Comment</Text>
                      </View>
                      <View style={styles.socialActionBtn}>
                        <Ionicons name="share-social-outline" size={14} color="#64748B" />
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
                        <Ionicons name="image-outline" size={32} color="#94A3B8" />
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
                        <Ionicons name="image-outline" size={28} color="#94A3B8" />
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
              <View style={styles.formActionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
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
                  style={styles.submitBtn}
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                >
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>{isSubmitting ? "Submitting to IMC..." : "Submit Request"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ================= VIEW REQUEST PREVIEW MODAL ================= */}
      {selectedPost && (() => {
        const isApprovedOrPublished =
          selectedPost.status === 'Approved' ||
          selectedPost.rawStatus === 'approved' ||
          selectedPost.rawStatus === 'published' ||
          selectedPost.rawStatus === 'scheduled';
        const isRejected =
          selectedPost.rawStatus === 'rejected' ||
          selectedPost.rawStatus === 'returned_for_revision';
        const statusLabel = isApprovedOrPublished
          ? 'Published'
          : isRejected
          ? 'Rejected'
          : 'Pending';
        const badgeBg = isApprovedOrPublished
          ? '#DCFCE7'
          : isRejected
          ? '#FEE2E2'
          : '#FEF3C7';
        const badgeText = isApprovedOrPublished
          ? '#166534'
          : isRejected
          ? '#991B1B'
          : '#92400E';

        const platformsList =
          Array.isArray(selectedPost.targetPlatforms) && selectedPost.targetPlatforms.length > 0
            ? selectedPost.targetPlatforms
            : ['facebook'];

        const checklist =
          selectedPost.rawPost?.imc_branding_checklist ||
          (selectedPost as any).imc_branding_checklist ||
          null;
        const originalCaptionText =
          checklist?.original_caption || selectedPost.caption || 'No caption provided.';
        const refinedCaptionText =
          checklist?.refined_caption || selectedPost.caption || 'No caption provided.';

        const rawOriginalMedia =
          Array.isArray(checklist?.original_media) && checklist.original_media.length > 0
            ? checklist.original_media
            : selectedPost.media || selectedPost.rawPost?.media || [];
        const originalImageUris = Array.isArray(rawOriginalMedia) && rawOriginalMedia.length > 0
          ? rawOriginalMedia
              .map((m: any) => resolveImageUrl(m?.url || m?.file_url || m?.file_path || m?.uri) || m?.uri || m?.url)
              .filter((u: any): u is string => typeof u === 'string' && u.trim().length > 0)
          : modalPostImageUris;

        const hasReplacementFinalMedia =
          Boolean(checklist?.has_replacement_media) ||
          (Array.isArray(checklist?.final_media) && checklist.final_media.length > 0);
        const rawFinalMedia =
          Array.isArray(checklist?.final_media) && checklist.final_media.length > 0
            ? checklist.final_media
            : checklist?.has_replacement_media
            ? (selectedPost.media || selectedPost.rawPost?.media || [])
            : [];
        const finalReplacementImageUris = Array.isArray(rawFinalMedia)
          ? rawFinalMedia
              .map((m: any) => resolveImageUrl(m?.url || m?.file_url || m?.file_path || m?.uri) || m?.uri || m?.url)
              .filter((u: any): u is string => typeof u === 'string' && u.trim().length > 0)
          : [];
        const activePreviewImageUris =
          isApprovedOrPublished && finalReplacementImageUris.length > 0
            ? finalReplacementImageUris
            : originalImageUris;

        const additionalInstructions =
          selectedPost.rawPost?.additional_instructions ||
          selectedPost.rawPost?.remarks ||
          (selectedPost.rawPost?.preferred_schedule_at
            ? `Preferred publication schedule: ${selectedPost.rawPost.preferred_schedule_at}`
            : 'Please use the attached poster and retain the official college branding.');

        const safeCarouselIdx =
          activePreviewImageUris.length > 0
            ? Math.min(modalPreviewCarouselIndex, activePreviewImageUris.length - 1)
            : 0;

        return (
          <Modal
            visible={Boolean(selectedPost)}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedPost(null)}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalCard,
                  {
                    maxWidth: 1080,
                    maxHeight: '92%',
                    padding: 0,
                    overflow: 'hidden',
                  },
                ]}
              >
                {/* Modal Header */}
                <View
                  style={{
                    paddingHorizontal: 28,
                    paddingVertical: 18,
                    borderBottomWidth: 1,
                    borderBottomColor: '#E2E8F0',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <Text style={{ fontSize: 19, fontWeight: '800', color: '#0F172A' }}>
                      Request Details
                    </Text>
                    <Text style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                      Direct IMC publication request · {selectedPost.date}
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: badgeBg,
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: badgeText }}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                {/* Scrollable Body */}
                <ScrollView
                  style={{ flexShrink: 1, backgroundColor: '#F8FAFC' }}
                  contentContainerStyle={{ padding: 24 }}
                  showsVerticalScrollIndicator={true}
                >
                  {/* TRACKING Card */}
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      borderRadius: 14,
                      padding: 20,
                      marginBottom: 20,
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '700',
                        color: '#64748B',
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                        marginBottom: 16,
                      }}
                    >
                      TRACKING
                    </Text>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        maxWidth: 640,
                        alignSelf: 'center',
                        width: '100%',
                      }}
                    >
                      {/* Step 1: Submitted */}
                      <View style={{ alignItems: 'center', width: 100 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: '#DCFCE7',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <View
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 15,
                              backgroundColor: '#10B981',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          </View>
                        </View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: '#0F172A',
                            marginTop: 8,
                            textAlign: 'center',
                          }}
                        >
                          Submitted
                        </Text>
                      </View>

                      {/* Connector 1 */}
                      <View
                        style={{
                          flex: 1,
                          height: 2,
                          backgroundColor: isApprovedOrPublished ? '#10B981' : '#E2E8F0',
                          marginTop: 20,
                          marginHorizontal: -12,
                        }}
                      />

                      {/* Step 2: IMC Review */}
                      <View style={{ alignItems: 'center', width: 110 }}>
                        {isApprovedOrPublished ? (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: '#DCFCE7',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <View
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: '#10B981',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            </View>
                          </View>
                        ) : isRejected ? (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: '#FEE2E2',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <View
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: '#EF4444',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="close" size={16} color="#FFFFFF" />
                            </View>
                          </View>
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: '#FEF9C3',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <View
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                borderWidth: 1.5,
                                borderColor: '#D97706',
                                backgroundColor: '#FFFBEB',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="time-outline" size={16} color="#D97706" />
                            </View>
                          </View>
                        )}
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: '#0F172A',
                            marginTop: 8,
                            textAlign: 'center',
                          }}
                        >
                          IMC Review
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: isApprovedOrPublished
                              ? '#10B981'
                              : isRejected
                              ? '#EF4444'
                              : '#B45309',
                            marginTop: 2,
                            textAlign: 'center',
                          }}
                        >
                          {isApprovedOrPublished ? 'Approved' : isRejected ? 'Rejected' : 'Pending'}
                        </Text>
                      </View>

                      {/* Connector 2 */}
                      <View
                        style={{
                          flex: 1,
                          height: 2,
                          backgroundColor: isApprovedOrPublished ? '#10B981' : '#E2E8F0',
                          marginTop: 20,
                          marginHorizontal: -12,
                        }}
                      />

                      {/* Step 3: Published */}
                      <View style={{ alignItems: 'center', width: 100 }}>
                        {isApprovedOrPublished ? (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: '#DCFCE7',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <View
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: '#10B981',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            </View>
                          </View>
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: '#F1F5F9',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <View
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                borderWidth: 1.5,
                                borderColor: '#94A3B8',
                                backgroundColor: '#F8FAFC',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="time-outline" size={16} color="#64748B" />
                            </View>
                          </View>
                        )}
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: '#0F172A',
                            marginTop: 8,
                            textAlign: 'center',
                          }}
                        >
                          Published
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: isApprovedOrPublished ? '#10B981' : '#64748B',
                            marginTop: 2,
                            textAlign: 'center',
                          }}
                        >
                          {isApprovedOrPublished ? 'Published' : 'Waiting'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Two-Column Main Grid */}
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      gap: 20,
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Left Column Card: Submitted Materials & Live Preview */}
                    <View
                      style={{
                        flex: 1,
                        width: '100%',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        borderRadius: 14,
                        padding: 20,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15.5,
                          fontWeight: '800',
                          color: '#0F172A',
                          marginBottom: 14,
                        }}
                      >
                        Submitted Materials
                      </Text>

                      {/* Target Platforms */}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#334155',
                          marginBottom: 8,
                        }}
                      >
                        Target Platforms
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginBottom: 16,
                        }}
                      >
                        {platformsList.map((plat, idx) => {
                          const pKey = String(plat).toLowerCase();
                          const label =
                            pKey === 'facebook'
                              ? 'Facebook'
                              : pKey === 'instagram'
                              ? 'Instagram'
                              : pKey === 'website'
                              ? 'Website'
                              : plat;
                          const iconName =
                            pKey === 'facebook'
                              ? 'logo-facebook'
                              : pKey === 'instagram'
                              ? 'logo-instagram'
                              : 'globe-outline';
                          const iconColor =
                            pKey === 'facebook'
                              ? '#4C1D95'
                              : pKey === 'instagram'
                              ? '#9D174D'
                              : '#4C1D95';

                          return (
                            <View
                              key={`${pKey}-${idx}`}
                              style={{
                                backgroundColor: '#F5F3FF',
                                borderWidth: 1,
                                borderColor: '#DDD6FE',
                                borderRadius: 999,
                                paddingHorizontal: 12,
                                paddingVertical: 5,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Ionicons name={iconName as any} size={13} color={iconColor} />
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '700',
                                  color: '#1E1B4B',
                                }}
                              >
                                {label}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Original Caption */}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#334155',
                          marginBottom: 6,
                        }}
                      >
                        Original Caption
                      </Text>
                      <View
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 10,
                          padding: 14,
                          marginBottom: 16,
                        }}
                      >
                        <FormattedText style={{ fontSize: 13, color: '#334155', lineHeight: 19 }}>
                          {originalCaptionText}
                        </FormattedText>
                      </View>

                      {/* Additional Instructions */}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#334155',
                          marginBottom: 6,
                        }}
                      >
                        Additional Instructions
                      </Text>
                      <View
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 10,
                          padding: 14,
                          marginBottom: 16,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: '#334155', lineHeight: 19 }}>
                          {additionalInstructions}
                        </Text>
                      </View>

                      {/* Uploaded Photos · N */}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#334155',
                          marginBottom: 8,
                        }}
                      >
                        Uploaded Photos · {originalImageUris.length}
                      </Text>
                      {originalImageUris.length > 0 ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 12,
                            marginBottom: 20,
                          }}
                        >
                          {originalImageUris.map((uri, idx) => {
                            const mediaObj = rawOriginalMedia?.[idx];
                            const fileName =
                              mediaObj?.original_filename ||
                              mediaObj?.original_name ||
                              mediaObj?.file_name ||
                              uri.split('/').pop()?.split('?')[0] ||
                              `photo-${String(idx + 1).padStart(2, '0')}.jpg`;
                            return (
                              <TouchableOpacity
                                key={idx}
                                activeOpacity={0.85}
                                onPress={() => setFullScreenImage(uri)}
                                style={{
                                  width: '48%',
                                  flexGrow: 1,
                                  borderWidth: 1,
                                  borderColor: '#E2E8F0',
                                  borderRadius: 10,
                                  overflow: 'hidden',
                                  backgroundColor: '#FFFFFF',
                                }}
                              >
                                <Image
                                  source={{ uri }}
                                  style={{ width: '100%', height: 135, backgroundColor: '#F1F5F9' }}
                                  resizeMode="cover"
                                />
                                <View
                                  style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 10,
                                    alignItems: 'center',
                                    borderTopWidth: 1,
                                    borderTopColor: '#F1F5F9',
                                  }}
                                >
                                  <Text
                                    numberOfLines={1}
                                    ellipsizeMode="middle"
                                    style={{ fontSize: 11.5, color: '#64748B', fontWeight: '500' }}
                                  >
                                    {fileName}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : (
                        <View
                          style={{
                            backgroundColor: '#F8FAFC',
                            borderWidth: 1,
                            borderStyle: 'dashed',
                            borderColor: '#CBD5E1',
                            borderRadius: 10,
                            padding: 14,
                            marginBottom: 20,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 12.5, color: '#94A3B8' }}>
                            No photos uploaded with this request.
                          </Text>
                        </View>
                      )}

                      {/* Horizontal Divider */}
                      <View
                        style={{
                          height: 1,
                          backgroundColor: '#E2E8F0',
                          marginVertical: 16,
                        }}
                      />

                      {/* Live Preview */}
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '800',
                          color: '#0F172A',
                          marginBottom: 12,
                        }}
                      >
                        Live Preview
                      </Text>

                      {/* Platform Pill Tabs */}
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginBottom: 14,
                        }}
                      >
                        {(
                          [
                            { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', iconColor: '#1877F2' },
                            { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', iconColor: '#E1306C' },
                            { key: 'website', label: 'Website', icon: 'globe-outline', iconColor: '#64748B' },
                          ] as const
                        ).map((tab) => {
                          const isActive = modalPlatformTab === tab.key;
                          return (
                            <TouchableOpacity
                              key={tab.key}
                              activeOpacity={0.75}
                              onPress={() => setModalPlatformTab(tab.key)}
                              style={{
                                borderRadius: 999,
                                paddingHorizontal: 14,
                                paddingVertical: 7,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                backgroundColor: isActive ? '#FEF3C7' : '#F8FAFC',
                                borderWidth: 1,
                                borderColor: isActive ? '#FDE68A' : '#E2E8F0',
                              }}
                            >
                              <Ionicons
                                name={tab.icon as any}
                                size={14}
                                color={
                                  isActive
                                    ? tab.key === 'facebook'
                                      ? '#1877F2'
                                      : tab.key === 'instagram'
                                      ? '#E1306C'
                                      : '#0F172A'
                                    : tab.iconColor
                                }
                              />
                              <Text
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: '700',
                                  color: isActive ? '#78350F' : '#475569',
                                }}
                              >
                                {tab.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Social Preview Card */}
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 12,
                          backgroundColor: '#FFFFFF',
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 14,
                            gap: 10,
                          }}
                        >
                          <Image
                            source={require('../../assets/images/jmc_logo_sm.png')}
                            style={{ width: 36, height: 36, borderRadius: 18 }}
                            resizeMode="contain"
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A' }}>
                              Jose Maria College Foundation Inc.
                            </Text>
                            <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                              {modalPlatformTab === 'instagram'
                                ? 'jmc_official · Official Department Post'
                                : modalPlatformTab === 'website'
                                ? `${selectedPost.title} · Official Website Post`
                                : 'Official Department Post · Public'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                          <FormattedText style={{ fontSize: 13, color: '#334155', lineHeight: 19 }}>
                            {isApprovedOrPublished ? refinedCaptionText : originalCaptionText}
                          </FormattedText>
                        </View>

                        {activePreviewImageUris.length > 0 ? (
                          <View
                            style={{
                              position: 'relative',
                              width: '100%',
                              height: 240,
                              backgroundColor: '#F1F5F9',
                            }}
                          >
                            <TouchableOpacity
                              activeOpacity={0.92}
                              onPress={() => setFullScreenImage(activePreviewImageUris[safeCarouselIdx])}
                              style={{ width: '100%', height: '100%' }}
                            >
                              <Image
                                source={{ uri: activePreviewImageUris[safeCarouselIdx] }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>

                            <View
                              style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 999,
                              }}
                            >
                              <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' }}>
                                {safeCarouselIdx + 1} / {activePreviewImageUris.length}
                              </Text>
                            </View>

                            {activePreviewImageUris.length > 1 && (
                              <>
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={() =>
                                    setModalPreviewCarouselIndex((prev) =>
                                      prev <= 0 ? activePreviewImageUris.length - 1 : prev - 1
                                    )
                                  }
                                  style={{
                                    position: 'absolute',
                                    bottom: 12,
                                    left: 12,
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    ...(Platform.OS === 'web'
                                      ? { boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }
                                      : { elevation: 3 }),
                                  }}
                                >
                                  <Ionicons name="chevron-back" size={16} color="#0F172A" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={() =>
                                    setModalPreviewCarouselIndex((prev) =>
                                      prev >= activePreviewImageUris.length - 1 ? 0 : prev + 1
                                    )
                                  }
                                  style={{
                                    position: 'absolute',
                                    bottom: 12,
                                    right: 12,
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    ...(Platform.OS === 'web'
                                      ? { boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }
                                      : { elevation: 3 }),
                                  }}
                                >
                                  <Ionicons name="chevron-forward" size={16} color="#0F172A" />
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        ) : (
                          <View
                            style={{
                              height: 140,
                              backgroundColor: '#F8FAFC',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderTopWidth: 1,
                              borderTopColor: '#E2E8F0',
                            }}
                          >
                            <Ionicons name="image-outline" size={28} color="#94A3B8" />
                            <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                              No media attached
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Right Column Card: Request Information & Final Publication Content */}
                    <View
                      style={{
                        flex: 1,
                        width: '100%',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        borderRadius: 14,
                        padding: 20,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15.5,
                          fontWeight: '800',
                          color: '#0F172A',
                          marginBottom: 14,
                        }}
                      >
                        Request Information
                      </Text>

                      {/* 2x2 Info Grid */}
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 12,
                          marginBottom: 20,
                        }}
                      >
                        {[
                          { label: 'REQUEST TITLE', value: selectedPost.title },
                          { label: 'DEPARTMENT', value: selectedPost.department },
                          { label: 'REQUESTED BY', value: selectedPost.requestedBy },
                          { label: 'REQUESTED ON', value: selectedPost.date },
                        ].map((info, i) => (
                          <View
                            key={i}
                            style={{
                              width: '48%',
                              flexGrow: 1,
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              borderRadius: 10,
                              padding: 12,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10.5,
                                fontWeight: '700',
                                color: '#64748B',
                                marginBottom: 4,
                              }}
                            >
                              {info.label}
                            </Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                              {info.value}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Horizontal Divider */}
                      <View
                        style={{
                          height: 1,
                          backgroundColor: '#E2E8F0',
                          marginBottom: 18,
                        }}
                      />

                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: '800',
                          color: '#0F172A',
                          marginBottom: 14,
                        }}
                      >
                        Final Publication Content
                      </Text>

                      {/* Refined Caption */}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#334155',
                          marginBottom: 6,
                        }}
                      >
                        Refined Caption
                      </Text>
                      <View
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 10,
                          padding: 14,
                          marginBottom: 16,
                        }}
                      >
                        {isApprovedOrPublished ? (
                          <FormattedText style={{ fontSize: 13, color: '#1E293B', lineHeight: 19 }}>
                            {refinedCaptionText}
                          </FormattedText>
                        ) : (
                          <Text style={{ fontSize: 13, fontStyle: 'italic', color: '#94A3B8' }}>
                            Awaiting IMC caption refinement.
                          </Text>
                        )}
                      </View>

                      {/* Final Images */}
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 6,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                          Final Images
                        </Text>
                        <Text style={{ fontSize: 11.5, color: '#94A3B8' }}>
                          {isApprovedOrPublished ? 'Published images' : 'Awaiting final images'}
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          borderColor: '#CBD5E1',
                          borderRadius: 10,
                          padding: 14,
                        }}
                      >
                        {isApprovedOrPublished && hasReplacementFinalMedia && finalReplacementImageUris.length > 0 ? (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {finalReplacementImageUris.map((uri, idx) => (
                              <TouchableOpacity
                                key={idx}
                                activeOpacity={0.85}
                                onPress={() => setFullScreenImage(uri)}
                                style={{
                                  width: 84,
                                  height: 64,
                                  borderRadius: 8,
                                  overflow: 'hidden',
                                  borderWidth: 1,
                                  borderColor: '#E2E8F0',
                                }}
                              >
                                <Image
                                  source={{ uri }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : isApprovedOrPublished && originalImageUris.length > 0 ? (
                          <View style={{ gap: 8 }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                              {originalImageUris.map((uri, idx) => (
                                <TouchableOpacity
                                  key={idx}
                                  activeOpacity={0.85}
                                  onPress={() => setFullScreenImage(uri)}
                                  style={{
                                    width: 84,
                                    height: 64,
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                  }}
                                >
                                  <Image
                                    source={{ uri }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                  />
                                </TouchableOpacity>
                              ))}
                            </View>
                            <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                              Published using original submitted photos.
                            </Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 12.5, color: '#64748B', lineHeight: 18 }}>
                            No replacement images uploaded. The original photos remain available to IMC.
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {/* Sticky Modal Footer */}
                <View
                  style={{
                    paddingHorizontal: 28,
                    paddingVertical: 14,
                    borderTopWidth: 1,
                    borderTopColor: '#E2E8F0',
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSelectedPost(null)}
                    style={{
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                      backgroundColor: '#FFFFFF',
                      paddingHorizontal: 22,
                      paddingVertical: 9,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

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
          animationType="fade"
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View style={styles.lightboxOverlay}>
            <TouchableOpacity
              style={styles.lightboxCloseBtn}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 16,
  },

  /* Top Control Banner */
  topControlBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }
      : { elevation: 2 }),
  },
  topBannerLeft: {
    flexDirection: 'column',
  },
  modernTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
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
    color: '#6D28D9',
  },
  topBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  topBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backDashboardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  switchDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  switchDashboardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  openDrawerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#581C87',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
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
    color: '#15803D',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Split Layout - Form on the left, Content Requests list on the right */
  splitLayout: {
    flexDirection: 'row-reverse',
    gap: 18,
    flex: 1,
    width: '100%',
    alignItems: 'stretch',
  },
  splitLayoutStacked: {
    flexDirection: 'column-reverse',
  },

  /* LEFT SECTION */
  leftSection: {
    backgroundColor: 'transparent',
    flex: 1,
    width: '100%',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
    width: '100%',
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E1B4B',
    letterSpacing: -0.3,
  },
  searchAndFilterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    width: 220,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
    padding: 0,
    outlineWidth: 0,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 4,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  filterDropdownMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 4,
    width: 130,
    zIndex: 99,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }
      : { elevation: 4 }),
  },
  filterDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterDropdownItemActive: {
    backgroundColor: '#F3E8FF',
  },
  filterDropdownText: {
    fontSize: 13,
    color: '#374151',
  },
  filterDropdownTextActive: {
    color: '#6D28D9',
    fontWeight: '700',
  },

  /* Cards List */
  cardsScroll: {
    flex: 1,
    width: '100%',
  },
  cardsScrollContent: {
    paddingBottom: 24,
    gap: 14,
    width: '100%',
  },
  paginationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
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
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    padding: 14,
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
    width: 110,
    height: 110,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    marginRight: 14,
  },
  cardThumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  codeBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 8,
    lineHeight: 20,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    gap: 10,
  },
  detailCol: {
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
    fontSize: 10,
    fontWeight: '800',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  detailValueSub: {
    fontSize: 11,
    color: '#6B7280',
  },

  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mediaCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6D28D9',
  },
  viewRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6D28D9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
  },
  viewRequestBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6D28D9',
  },

  /* RIGHT SECTION: CREATE REQUEST PANEL */
  rightSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
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
    backgroundColor: '#581C87', // JMCFI Deep Purple
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  panelHeaderLeft: {
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
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  panelCloseBtn: {
    padding: 2,
  },

  panelFormScroll: {
    flex: 1,
  },
  panelFormScrollContent: {
    padding: 16,
    gap: 18,
    flex: 1,
  },

  redesignedSectionCard: {
    backgroundColor: 'transparent',
    paddingBottom: 6,
  },
  redesignedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 14,
  },
  redesignedHeaderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redesignedSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  redesignedFieldGroup: {
    gap: 6,
  },
  redesignedFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  redesignedTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0F172A',
    outlineWidth: 0,
  },
  redesignedReadonlyBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  redesignedReadonlyText: {
    fontSize: 13.5,
    color: '#334155',
  },
  captionGuideCallout: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3.5,
    borderLeftColor: '#581C87',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  captionGuideText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 19,
  },
  captionGuideBold: {
    fontWeight: '700',
    color: '#1E293B',
  },
  redesignedCaptionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    flexWrap: 'wrap',
    gap: 8,
  },
  redesignedCharCounter: {
    fontSize: 12,
    color: '#64748B',
  },
  redesignedAiPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  redesignedAiPolicyBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },

  formGroup: {
    gap: 6,
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
    color: '#1E1B4B',
  },
  subFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  contentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  formTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#1F2937',
    outlineWidth: 0,
  },
  whenRow: {
    flexDirection: 'row',
  },
  formInputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  innerTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
    padding: 0,
    outlineWidth: 0,
  },
  dropdownSelectedText: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
  },
  dropdownPickerBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownPickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownPickerItemText: {
    fontSize: 13,
    color: '#374151',
  },

  captionTextArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1F2937',
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
    color: '#6B7280',
  },
  aiCheckPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  aiCheckPolicyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6D28D9',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  complianceScoreCardLeft: {
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
    fontSize: 12,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  complianceScoreCardSub: {
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 1,
  },
  viewAnalysisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  viewAnalysisBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },
  modalAiCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalAiCheckBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },

  dropzoneContainer: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dropzoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  dropzoneSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  attachedFilesList: {
    marginTop: 6,
    gap: 4,
  },
  attachedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
  },
  attachedFileName: {
    flex: 1,
    fontSize: 12,
    color: '#4C1D95',
  },

  formActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 1.6,
    flexDirection: 'row',
    backgroundColor: '#581C87',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Empty state */
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  /* Preview Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 520,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)' }
      : { elevation: 5 }),
  },
  modalHeader: {
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
    color: '#1E1B4B',
    marginBottom: 10,
  },
  modalInfoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  modalInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    width: 90,
  },
  modalInfoValue: {
    fontSize: 12,
    color: '#1F2937',
    flex: 1,
    fontWeight: '600',
  },
  modalCaptionText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginTop: 2,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  modalCloseBtn: {
    backgroundColor: '#581C87',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalTrackingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginVertical: 14,
  },
  modalTrackingTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
    textAlign: 'center',
  },
  modalStepStatus: {
    fontSize: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  platformSelectorTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  platformSelectorTabActiveFacebook: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  platformSelectorTabActiveInstagram: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  platformSelectorTabActiveWebsite: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  platformSelectorTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  platformSelectorTabTextActiveFacebook: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  platformSelectorTabTextActiveInstagram: {
    color: '#BE185D',
    fontWeight: '700',
  },
  platformSelectorTabTextActiveWebsite: {
    color: '#047857',
    fontWeight: '700',
  },

  modalPlatformTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalPlatformTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalPlatformTabActiveFacebook: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  modalPlatformTabActiveInstagram: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  modalPlatformTabActiveWebsite: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  modalPlatformTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  modalPlatformTabTextActiveFacebook: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  modalPlatformTabTextActiveInstagram: {
    color: '#BE185D',
    fontWeight: '700',
  },
  modalPlatformTabTextActiveWebsite: {
    color: '#047857',
    fontWeight: '700',
  },

  facebookMockupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }
      : { elevation: 2 }),
  },
  instagramMockupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }
      : { elevation: 2 }),
  },
  websiteMockupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }
      : { elevation: 2 }),
  },
  socialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  socialAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  socialAuthorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  socialTimeText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  socialCaptionText: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
  socialFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  socialActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialActionText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyMockMedia: {
    height: 160,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
  },
  emptyMockMediaText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  instagramHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  websiteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  websiteTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
    lineHeight: 22,
  },
  websiteMetaText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  websiteFeaturedImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
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
    color: '#334155',
    lineHeight: 18,
  },

  /* Website Featured Selector in Create Form */
  featuredSelectorContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 10,
  },
  featuredSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  featuredSelectorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  clearAllBtnText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  scrollArrowBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArrowBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.5,
  },
  featuredThumbnailsScrollWrapper: {
    width: '100%',
  },
  featuredSelectorSubtitle: {
    fontSize: 11,
    color: '#64748B',
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
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#ECFDF5',
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
    borderColor: '#CBD5E1',
  },
  featuredInactiveBadgeText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#64748B',
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
    backgroundColor: '#ECFDF5',
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
    color: '#047857',
  },
  igThumbBadgeTextWarning: {
    color: '#92400E',
  },
  photoRulesMetaRow: {
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  photoDimensionsText: {
    fontSize: 8.5,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  featuredThumbImageWrap: {
    width: '100%',
    height: 64,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
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
    color: '#334155',
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
    color: '#065F46',
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
    color: '#059669',
    fontWeight: '700',
  },
  featuredThumbStatusInactive: {
    color: '#94A3B8',
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
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 16,
  },
  targetPlatformCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  targetPlatformCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.15s ease' } : {}),
  },
  targetPlatformCardActiveFb: {
    borderColor: '#1877F2',
    backgroundColor: '#F0F7FF',
  },
  targetPlatformCardActiveIg: {
    borderColor: '#E1306C',
    backgroundColor: '#FDF2F8',
  },
  targetPlatformCardActiveWeb: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
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
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
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
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  targetPlatformDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },

  /* Photo Quality & Size Rules Status Banners */
  filterAlertBannerWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  filterAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  filterAlertIconCircleIg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterAlertTitleWarning: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  filterAlertDescWarning: {
    fontSize: 10.5,
    color: '#B45309',
    lineHeight: 14,
    marginTop: 2,
  },
  autoFitAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E1306C',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 7,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  autoFitAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterAlertBannerSuccess: {
    backgroundColor: '#ECFDF5',
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
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },
  filterAlertBannerFb: {
    backgroundColor: '#EFF6FF',
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
    fontSize: 11,
    color: '#1E40AF',
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

