import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  ScrollView,
  Modal,
  Platform,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ComplianceResultModal } from '../../../components/ui/ComplianceResultModal';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import { useAuthStore, getAvatarColors } from '../../../store/auth';
import { Card } from '../../../components/ui/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';
import { usePolicyStore } from '../../../store/policy';
import { FormattedText } from '../../../components/ui/FormattedText';
import { Toast } from '../../../components/ui/Toast';
import { PolicyRulesView } from '../../../components/ui/PolicyRulesView';
import { postsApi, authApi, dashboardApi, categoriesApi } from '../../../services/api';
import { useQuery } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/DashboardSkeleton';
import { PaginationControl } from '../../../components/ui/PaginationControl';

export default function RequestorDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  const { policySections, effectiveDate, lastUpdatedDate, fetchPolicy } = usePolicyStore();

  useEffect(() => {
    fetchPolicy();
  }, []);

  // Tab State: 'dashboard' | 'post-requests' | 'approval-queue' | 'analytics' | 'policy-rules'
  const params = useLocalSearchParams();
  const [activeTab, _setActiveTab] = useState(params.tab || 'dashboard');

  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      _setActiveTab(params.tab as string);
    }
  }, [params.tab]);

  const setActiveTab = (tab: string) => {
    _setActiveTab(tab);
    router.setParams({ tab });
  };

  // Form State (New Request)
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [otherCategoryName, setOtherCategoryName] = useState('');
  const [apiCategories, setApiCategories] = useState<{ id: number; name: string }[]>([]);
  const [department, setDepartment] = useState(user?.department || 'ICT');

  useEffect(() => {
    if (user?.department) {
      setDepartment(user.department);
    }
  }, [user]);
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState({
    facebook: false,
    instagram: false,
    portal: false,
  });
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [supportingDocs, setSupportingDocs] = useState<any[]>([]);

  // Dropdown States
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

  // Preview States
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Dashboard Page State
  const [dashboardPage, setDashboardPage] = useState(1);
  const [dashboardPerPage, setDashboardPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [dateFilter, setDateFilter] = useState<'All Time' | 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Range'>('All Time');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [rejectedSearchQuery, setRejectedSearchQuery] = useState('');
  const [rejectedDateFilter, setRejectedDateFilter] = useState<'All Time' | 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Range'>('All Time');
  const [isRejectedDateDropdownOpen, setIsRejectedDateDropdownOpen] = useState(false);
  const [customRejectedStartDate, setCustomRejectedStartDate] = useState('');
  const [customRejectedEndDate, setCustomRejectedEndDate] = useState('');

  // Active Post for Dialog/Comments Modal
  const [selectedQueuePost, setSelectedQueuePost] = useState<any | null>(null);
  const [modalPlatformTab, setModalPlatformTab] = useState('facebook');
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Policy Search State
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Drafts State
  const [drafts, setDrafts] = useState<any[]>([]);

  // Rejected Posts State
  const [rejectedPosts, setRejectedPosts] = useState<any[]>([]);

  // Avatar colors for the profile section
  const avatarColors = getAvatarColors(user?.name ?? 'Esther Howard');

  // Profile photo
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [acctFullName, setAcctFullName] = useState('');
  const [acctCurrentPw, setAcctCurrentPw] = useState('');
  const [acctNewPw, setAcctNewPw] = useState('');
  const [acctConfirmPw, setAcctConfirmPw] = useState('');
  const [savingAcct, setSavingAcct] = useState(false);
  const [savingAcctPw, setSavingAcctPw] = useState(false);

  useEffect(() => {
    if (user) {
      setAcctFullName(`${user.first_name || ''} ${user.last_name || ''}`.trim());
      if (user.photo_url) setProfilePhotoUrl(user.photo_url);
    }
    // Fetch latest user details on mount to ensure photo_url is up to date
    authApi.getUser().then(res => {
      const photo = res.data?.user?.photo_url || res.data?.photo_url;
      if (photo) setProfilePhotoUrl(photo);
    }).catch(() => { });
  }, [user]);

  const handleUploadPhoto = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0]; if (!file) return;
        setUploadingPhoto(true);
        try { const res = await authApi.uploadPhoto(file); setProfilePhotoUrl(res.data.photo_url); } catch (e: any) { alert('Upload failed.'); }
        finally { setUploadingPhoto(false); }
      };
      input.click();
    }
  };

  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    try { await authApi.removePhoto(); setProfilePhotoUrl(null); } catch (e: any) { alert('Remove failed.'); }
    finally { setUploadingPhoto(false); }
  };

  const handleSaveDetails = async () => {
    const parts = acctFullName.trim().split(' ');
    const first_name = parts[0] || ''; const last_name = parts.slice(1).join(' ') || '';
    setSavingAcct(true);
    try {
      await authApi.updateProfile({ first_name, last_name });
      if (user) {
        await useAuthStore.getState().setUser({ ...user, first_name, last_name, name: `${first_name} ${last_name}` });
      }
      alert('Profile updated!');
    } catch (e: any) { alert('Failed.'); }
    finally { setSavingAcct(false); }
  };

  const handleChangePw = async () => {
    if (!acctCurrentPw || !acctNewPw) { alert('Fill all fields.'); return; }
    if (acctNewPw.length < 8) { alert('At least 8 characters.'); return; }
    if (acctNewPw !== acctConfirmPw) { alert('Passwords do not match.'); return; }
    setSavingAcctPw(true);
    try { await authApi.changePassword(acctCurrentPw, acctNewPw, acctConfirmPw); alert('Password changed!'); setAcctCurrentPw(''); setAcctNewPw(''); setAcctConfirmPw(''); }
    catch (e: any) { alert('Failed: ' + (e.response?.data?.message || e.message)); }
    finally { setSavingAcctPw(false); }
  };

  // Helpers for Drafts and Rejected
  const parsePlatforms = (raw: any): { facebook: boolean; instagram: boolean; portal: boolean } => {
    let arr: string[] = [];
    if (Array.isArray(raw)) {
      arr = raw;
    } else if (typeof raw === 'string' && raw.length > 0) {
      arr = raw.split(',').map(s => s.trim());
    }
    return {
      facebook: arr.includes('facebook'),
      instagram: arr.includes('instagram'),
      portal: arr.includes('portal'),
    };
  };

  // Handlers for Drafts and Rejected
  const handleEditDraft = (draft: any) => {
    setEditingPostId(draft.id);
    setPostTitle(draft.title || '');
    const matchedCat = apiCategories.find(c => c.name === draft.category);
    if (matchedCat) {
      setCategory(matchedCat.name);
      setCategoryId(matchedCat.id);
      if (matchedCat.name === 'Others') {
        setOtherCategoryName(draft.other_category_name || '');
      } else {
        setOtherCategoryName('');
      }
    }
    setCaption(draft.caption_narrative || draft.caption || '');
    setPlatforms(parsePlatforms(draft.platforms));
    if (draft.publishDate) setPublishDate(draft.publishDate);
    setActiveTab('request');
    alert(`Draft "${draft.title}" loaded into request form. You can now edit and submit!`);
  };

  const handleDeleteDraft = (id: string) => {
    setDraftToDelete(id);
  };

  const executeDeleteDraft = async () => {
    if (!draftToDelete) return;
    const idToDelete = draftToDelete;
    setDraftToDelete(null); // close modal immediately
    try {
      await postsApi.delete(Number(idToDelete));
    } catch (err: any) {
      // If the record doesn't exist (404), treat as already deleted and continue
      if (err?.response?.status !== 404) {
        alert('Failed to delete draft: ' + (err?.response?.data?.message || err.message));
        return;
      }
    }
    // Remove from UI list regardless of outcome
    setDrafts(prev => prev.filter(d => d.id !== idToDelete));
    loadPosts();
    alert('Draft deleted successfully.');
  };

  const handleCreateNewFromRejected = (post: any) => {
    setPostTitle(post.title ? `${post.title} (Revised)` : '');
    const matchedCat = apiCategories.find(c => c.name === post.category);
    if (matchedCat) {
      setCategory(matchedCat.name);
      setCategoryId(matchedCat.id);
      if (matchedCat.name === 'Others') {
        setOtherCategoryName(post.other_category_name || '');
      } else {
        setOtherCategoryName('');
      }
    }
    setCaption(post.caption_narrative || post.caption || '');
    setPlatforms(parsePlatforms(post.platforms));
    setActiveTab('request');
    alert(`Created new request form pre-filled with data from "${post.title}". Please revise according to approver comments.`);
  };

  // Fetch categories from API on mount
  useEffect(() => {
    categoriesApi.list().then((res: any) => {
      const cats = res.data?.data || [];
      setApiCategories(cats);
      if (cats.length > 0 && !categoryId) {
        setCategory(cats[0].name);
        setCategoryId(cats[0].id);
      }
    }).catch(() => {
      // fallback to static options if API fails
      const fallback = [
        { id: 1, name: 'Announcement' },
        { id: 2, name: 'News' },
        { id: 3, name: 'Event' },
        { id: 4, name: 'Advisory' },
        { id: 5, name: 'Blog' },
      ];
      setApiCategories(fallback);
      setCategory(fallback[0].name);
      setCategoryId(fallback[0].id);
    });
  }, []);

  // Categories & Departments options
  const categoryOptions = apiCategories.length > 0 ? apiCategories.map(c => c.name) : ['Announcement', 'News', 'Event', 'Advisory', 'Blog'];

  const departmentOptions = [
    'College of Computing Studies',
    'Registrar\'s Office',
    'Student Affairs',
    'Finance Department',
  ];

  // Posts State
  const [mockRequests, setMockRequests] = useState<any[]>([]);
  const [newRequestType, setNewRequestType] = useState('News & Updates');

  const filteredRequests = useMemo(() => {
    return mockRequests
      .filter(req => (req.title && req.title.toLowerCase().includes(searchQuery.toLowerCase())) || (req.category && req.category.toLowerCase().includes(searchQuery.toLowerCase())))
      .filter(req => {
        let statusMatch = true;
        if (statusFilter !== 'All') {
          const st = req.status || '';
          if (statusFilter === 'PENDING') statusMatch = st.includes('PENDING');
          else if (statusFilter === 'APPROVED') statusMatch = (st === 'APPROVED' || st === 'PUBLISHED' || st === 'SCHEDULED');
          else statusMatch = (st === statusFilter);
        }
        if (!statusMatch) return false;

        let matchesDate = true;
        if (dateFilter !== 'All Time') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const postDate = new Date(req.created_at || Date.now());
          postDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - postDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

          if (dateFilter === 'Today') {
            matchesDate = diffDays === 0;
          } else if (dateFilter === 'Yesterday') {
            matchesDate = diffDays === 1;
          } else if (dateFilter === 'Last 7 Days') {
            matchesDate = diffDays >= 0 && diffDays <= 7;
          } else if (dateFilter === 'Last 30 Days') {
            matchesDate = diffDays >= 0 && diffDays <= 30;
          } else if (dateFilter === 'Custom Range') {
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const raw = new Date(req.created_at || Date.now());
              matchesDate = raw >= start && raw <= new Date(end.getTime() + 86400000);
            }
          }
        }
        return matchesDate;
      })
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [mockRequests, searchQuery, statusFilter, sortOrder, dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    setDashboardPage(1);
  }, [searchQuery, statusFilter, sortOrder, dateFilter, customStartDate, customEndDate]);

  const paginatedRequests = useMemo(() => {
    return filteredRequests.slice((dashboardPage - 1) * dashboardPerPage, dashboardPage * dashboardPerPage);
  }, [filteredRequests, dashboardPage, dashboardPerPage]);

  const filteredRejectedPosts = useMemo(() => {
    return rejectedPosts
      .filter(req => (req.title && req.title.toLowerCase().includes(rejectedSearchQuery.toLowerCase())) || (req.category && req.category.toLowerCase().includes(rejectedSearchQuery.toLowerCase())))
      .filter(req => {
        let matchesDate = true;
        if (rejectedDateFilter !== 'All Time') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const postDate = new Date(req.created_at || Date.now());
          postDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - postDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

          if (rejectedDateFilter === 'Today') {
            matchesDate = diffDays === 0;
          } else if (rejectedDateFilter === 'Yesterday') {
            matchesDate = diffDays === 1;
          } else if (rejectedDateFilter === 'Last 7 Days') {
            matchesDate = diffDays >= 0 && diffDays <= 7;
          } else if (rejectedDateFilter === 'Last 30 Days') {
            matchesDate = diffDays >= 0 && diffDays <= 30;
          } else if (rejectedDateFilter === 'Custom Range') {
            const start = new Date(customRejectedStartDate);
            const end = new Date(customRejectedEndDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const raw = new Date(req.created_at || Date.now());
              matchesDate = raw >= start && raw <= new Date(end.getTime() + 86400000);
            }
          }
        }
        return matchesDate;
      })
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
  }, [rejectedPosts, rejectedSearchQuery, rejectedDateFilter, customRejectedStartDate, customRejectedEndDate]);

  const [mockQueuePosts, setMockQueuePosts] = useState<any[]>([]);

  const { data: postsDataRes, isLoading: isInitLoading, refetch: refetchPosts } = useQuery({
    queryKey: ['requestor-posts'],
    queryFn: () => postsApi.list({ per_page: 1000 }),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (postsDataRes?.data?.data) {
      const posts = postsDataRes.data.data;
      const mapPost = (p: any) => {
        let rejectedBy = '';
        if ((p.status === 'rejected' || p.status === 'returned_for_revision') && p.approval_workflows && Array.isArray(p.approval_workflows)) {
          const rejectionLog = p.approval_workflows.find((w: any) => w.action === 'rejected' || w.action === 'returned_for_revision');
          if (rejectionLog && rejectionLog.approver) {
            let approverTitle = 'Approver';
            if (rejectionLog.stage === 'office_head') approverTitle = 'Department Head';
            if (rejectionLog.stage === 'vice_president') approverTitle = 'Vice President';
            if (rejectionLog.stage === 'imc_qa') approverTitle = 'QA / Branding Checker';

            rejectedBy = `${approverTitle}, ${rejectionLog.approver.full_name}`;
          }
        }

        return {
          ...p,
          id: p.id.toString(),
          title: p.title || 'Untitled',
          caption: p.caption_narrative || '',
          platforms: Array.isArray(p.target_platforms) ? p.target_platforms : (p.target_platforms || []),
          category: p.category?.name || 'Category',
          department: p.requestor?.department || 'Department',
          date: new Date(p.created_at).toLocaleDateString(),
          time: new Date(p.created_at).toLocaleTimeString(),
          dateSaved: new Date(p.created_at).toLocaleDateString(),
          rawStatus: p.status, // Add rawStatus for reliable filtering
          status: p.status_label ? p.status_label.toUpperCase() : (p.status ? p.status.toUpperCase() : 'UNKNOWN'),
          statusLabel: p.status_label || p.status,
          statusColor: p.status === 'published' || p.status === 'approved' ? '#15803D' : (p.status === 'rejected' || p.status === 'returned_for_revision' ? '#B91C1C' : '#B45309'),
          statusBg: p.status === 'published' || p.status === 'approved' ? '#DCFCE7' : (p.status === 'rejected' || p.status === 'returned_for_revision' ? '#FEE2E2' : '#FEF3C7'),
          badgeColor: p.status === 'published' || p.status === 'approved' ? '#15803D' : (p.status === 'rejected' || p.status === 'returned_for_revision' ? '#B91C1C' : '#B45309'),
          badgeBg: p.status === 'published' || p.status === 'approved' ? '#DCFCE7' : (p.status === 'rejected' || p.status === 'returned_for_revision' ? '#FEE2E2' : '#FEF3C7'),
          thumbnailUrl: p.media && p.media.length > 0 ? p.media[0].url : null,
          thumbnailIcon: 'document-text-outline' as const,
          thumbnailBg: '#E0F2FE',
          actionIcon1: 'eye-outline' as const,
          actionIcon2: 'pencil-outline' as const,
          rejectedDate: p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '',
          rejectionReason: p.rejection_reason || 'No reason provided.',
          nextAction: 'Pending review.',
          steps: [
            { label: 'Submitted', state: 'completed' },
            { label: 'Dept Head', state: ['pending_office_head'].includes(p.status) ? 'active' : 'completed' },
            { label: 'Vice President', state: p.status === 'pending_vice_president' ? 'active' : 'upcoming' },
            { label: 'IMC QA', state: ['pending_imc_qa'].includes(p.status) ? 'active' : 'upcoming' },
            { label: 'Publisher', state: ['approved', 'scheduled', 'published'].includes(p.status) ? 'active' : 'upcoming' },
          ],
          comments: [],
          rejectedBy,
        };
      };

      const mapped = posts.map(mapPost);
      setMockRequests(mapped.filter((p: any) => p.rawStatus !== 'draft' && p.rawStatus !== 'rejected' && p.rawStatus !== 'returned_for_revision'));
      setMockQueuePosts(mapped.filter((p: any) => p.rawStatus !== 'draft' && p.rawStatus !== 'rejected' && p.rawStatus !== 'returned_for_revision'));
      setDrafts(mapped.filter((p: any) => p.rawStatus === 'draft'));
      setRejectedPosts(mapped.filter((p: any) => p.rawStatus === 'rejected' || p.rawStatus === 'returned_for_revision'));
    }
  }, [postsDataRes]);

  const loadPosts = (showLoading = true) => {
    refetchPosts();
  };

  const isInitialLoading = isInitLoading;

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleSaveDraft = async () => {
    if (!postTitle || !caption) {
      alert('Please enter a post title and caption before saving.');
      return;
    }
    try {
      const selectedPlatforms = Object.keys(platforms).filter(k => (platforms as any)[k]);
      const payload: any = {
        title: postTitle,
        caption_narrative: caption,
        category_id: categoryId,
        other_category_name: category === 'Others' ? otherCategoryName : null,
        target_platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
        is_draft: true,
      };

      if (publishDate) {
        const timePart = publishTime || '08:00';
        const [d, m, y] = publishDate.split('/');
        payload.preferred_schedule_at = `${y}-${m}-${d} ${timePart}:00`;
      }

      if (mediaFiles.length > 0 || supportingDocs.length > 0) {
        const formData = new FormData();
        formData.append('title', payload.title);
        formData.append('caption_narrative', payload.caption_narrative);
        if (payload.category_id) formData.append('category_id', String(payload.category_id));
        if (payload.other_category_name) formData.append('other_category_name', payload.other_category_name);
        if (payload.target_platforms) {
          payload.target_platforms.forEach((p: string) => {
            formData.append('target_platforms[]', p);
          });
        }
        formData.append('is_draft', '1');
        if (payload.preferred_schedule_at) {
          formData.append('preferred_schedule_at', payload.preferred_schedule_at);
        }

        mediaFiles.forEach((file: any, idx: number) => {
          if (Platform.OS === 'web' && file.file) {
            formData.append('media[]', file.file);
          } else {
            formData.append('media[]', {
              uri: file.uri,
              name: file.name,
              type: file.mimeType || 'image/jpeg',
            } as any);
          }
        });

        supportingDocs.forEach((file: any, idx: number) => {
          if (Platform.OS === 'web' && file.file) {
            formData.append('supporting_docs[]', file.file);
          } else {
            formData.append('supporting_docs[]', {
              uri: file.uri,
              name: file.name,
              type: file.mimeType || 'application/pdf',
            } as any);
          }
        });

        if (editingPostId) {
          await postsApi.updateWithFiles(Number(editingPostId), formData as any);
          alert('Draft updated successfully!');
        } else {
          await postsApi.createWithFiles(formData as any);
          alert('Content request saved as draft!');
        }
      } else {
        if (editingPostId) {
          await postsApi.update(Number(editingPostId), payload);
          alert('Draft updated successfully!');
        } else {
          await postsApi.create(payload);
          alert('Content request saved as draft!');
        }
      }

      setEditingPostId(null);
      loadPosts();
      setActiveTab('dashboard');
    } catch (err: any) {
      alert('Failed to save draft: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleSubmitRequest = async () => {
    if (!postTitle || !caption) {
      alert('Please enter a post title and caption before submitting.');
      return;
    }

    const selectedPlatforms = Object.keys(platforms).filter(k => (platforms as any)[k]);
    if (selectedPlatforms.length === 0) {
      alert('Please select at least one target platform before submitting.');
      return;
    }

    if (mediaFiles.length === 0 && supportingDocs.length === 0) {
      alert('Please attach at least one media or asset file before submitting.');
      return;
    }

    try {
      const payload: any = {
        title: postTitle,
        caption_narrative: caption,
        category_id: categoryId,
        other_category_name: category === 'Others' ? otherCategoryName : null,
        target_platforms: selectedPlatforms,
        is_draft: false,
      };

      if (publishDate) {
        const timePart = publishTime || '08:00';
        const [d, m, y] = publishDate.split('/');
        payload.preferred_schedule_at = `${y}-${m}-${d} ${timePart}:00`;
      }

      let res;
      if (mediaFiles.length > 0 || supportingDocs.length > 0) {
        const formData = new FormData();
        formData.append('title', payload.title);
        formData.append('caption_narrative', payload.caption_narrative);
        if (payload.category_id) formData.append('category_id', String(payload.category_id));
        if (payload.other_category_name) formData.append('other_category_name', payload.other_category_name);
        payload.target_platforms.forEach((p: string) => {
          formData.append('target_platforms[]', p);
        });
        formData.append('is_draft', '0');
        if (payload.preferred_schedule_at) {
          formData.append('preferred_schedule_at', payload.preferred_schedule_at);
        }

        mediaFiles.forEach((file: any, idx: number) => {
          if (Platform.OS === 'web' && file.file) {
            formData.append('media[]', file.file);
          } else {
            formData.append('media[]', {
              uri: file.uri,
              name: file.name,
              type: file.mimeType || 'image/jpeg',
            } as any);
          }
        });

        supportingDocs.forEach((file: any, idx: number) => {
          if (Platform.OS === 'web' && file.file) {
            formData.append('supporting_docs[]', file.file);
          } else {
            formData.append('supporting_docs[]', {
              uri: file.uri,
              name: file.name,
              type: file.mimeType || 'application/pdf',
            } as any);
          }
        });

        if (editingPostId) {
          res = await postsApi.updateWithFiles(Number(editingPostId), formData);
        } else {
          res = await postsApi.createWithFiles(formData);
        }
      } else {
        if (editingPostId) {
          res = await postsApi.update(Number(editingPostId), payload);
        } else {
          res = await postsApi.create(payload);
        }
      }

      if (editingPostId) {
        await postsApi.submit(Number(editingPostId));
      }

      // Optimistically add to queue so it shows instantly
      const submittedPost = { ...res.data.data, status: 'PENDING_OFFICE_HEAD' };
      setMockQueuePosts((prev: any) => [submittedPost, ...prev.filter((p: any) => p.id !== submittedPost.id)]);

      showToast('✅ Content request submitted successfully!');
      setEditingPostId(null);
      setPostTitle('');
      setCaption('');
      setPublishDate('');
      setPublishTime('');
      setPlatforms({ facebook: false, instagram: false, portal: false });
      setMediaFiles([]);
      setSupportingDocs([]);

      // Reload silently in background
      loadPosts(false);
      setActiveTab('dashboard');
    } catch (err: any) {
      showToast('Failed to submit request: ' + (err?.response?.data?.message || err.message), 'error');
    }
  };

  const [isComplianceModalVisible, setIsComplianceModalVisible] = useState(false);
  const [complianceScore, setComplianceScore] = useState(0);
  const [complianceStatus, setComplianceStatus] = useState('');
  const [complianceAnalysis, setComplianceAnalysis] = useState('');

  const [isCheckingPolicy, setIsCheckingPolicy] = useState(false);

  const handleCheckPolicy = async () => {
    if (!caption) {
      alert('Please write a caption first.');
      return;
    }

    setIsCheckingPolicy(true);
    try {
      const response = await postsApi.aiCheckDraft({ title: postTitle, caption_narrative: caption });
      const data = response.data.data;
      if (data.overall_status === 'error') {
        alert('AI Analysis failed: ' + data.analysis_logic);
      } else {
        setComplianceScore(data.compliance_score);
        setComplianceStatus(data.overall_status);
        setComplianceAnalysis(data.analysis_logic);
        setIsComplianceModalVisible(true);
      }
    } catch (e: any) {
      alert('Failed to check policy alignment: ' + (e.response?.data?.message || e.message));
    } finally {
      setIsCheckingPolicy(false);
    }
  };

  const togglePlatform = (key: 'facebook' | 'instagram' | 'portal') => {
    setPlatforms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isLargeScreen = width > 1024;
  const isTablet = width > 768;

  // Render a single stepper step
  const renderStep = (step: any, index: number, isLast: boolean) => {
    let circleStyle = styles.stepCircleUpcoming;
    let lineStyle = styles.stepLineUpcoming;
    let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';
    let iconColor = Colors.textMuted;

    if (step.state === 'completed') {
      circleStyle = styles.stepCircleCompleted;
      lineStyle = styles.stepLineCompleted;
      iconName = 'checkmark';
      iconColor = Colors.surface;
    } else if (step.state === 'active') {
      circleStyle = styles.stepCircleActive;
      iconName = 'hourglass-outline';
      iconColor = Colors.surface;
    } else if (step.state === 'revision') {
      circleStyle = styles.stepCircleRevision;
      iconName = 'alert-circle-outline';
      iconColor = Colors.surface;
    }

    return (
      <React.Fragment key={index}>
        <View style={styles.stepWrapper}>
          <View style={[styles.stepCircleBase, circleStyle]}>
            <Ionicons name={iconName} size={11} color={iconColor} />
          </View>
          <Text style={styles.stepLabel}>{step.label}</Text>
        </View>
        {!isLast && <View style={[styles.stepLineBase, lineStyle]} />}
      </React.Fragment>
    );
  };

  const getMockSteps = (status: string) => {
    const s = status ? status.toLowerCase() : '';

    if (s === 'approved' || s === 'published' || s === 'scheduled') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Dept Head', state: 'completed' },
        { label: 'Vice Pres', state: 'completed' },
        { label: 'IMC QA', state: 'completed' },
        { label: 'Publisher', state: s === 'approved' ? 'active' : 'completed' },
      ];
    } else if (s === 'pending_office_head') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Dept Head', state: 'active' },
        { label: 'Vice Pres', state: 'upcoming' },
        { label: 'IMC QA', state: 'upcoming' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s === 'pending_vice_president') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Dept Head', state: 'completed' },
        { label: 'Vice Pres', state: 'active' },
        { label: 'IMC QA', state: 'upcoming' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s === 'pending_imc_qa') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Dept Head', state: 'completed' },
        { label: 'Vice Pres', state: 'completed' },
        { label: 'IMC QA', state: 'active' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s === 'returned_for_revision') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Revision', state: 'revision' },
        { label: 'Vice Pres', state: 'upcoming' },
        { label: 'IMC QA', state: 'upcoming' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s === 'draft') {
      return [
        { label: 'Draft', state: 'active' },
        { label: 'Dept Head', state: 'upcoming' },
        { label: 'Vice Pres', state: 'upcoming' },
        { label: 'IMC QA', state: 'upcoming' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s.includes('pending')) {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Review', state: 'active' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    }

    return [];
  };

  return (
    <DashboardShell
      title="Content Approval System"
      activeTab={activeTab as string}
      onTabChange={setActiveTab}
      backgroundImage={require('../../../assets/images/jmcbg2.jpeg')}
    >
      <Toast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
      {/* ── LOADING SKELETON ── */}
      {isInitialLoading && <DashboardSkeleton />}

      {/* ----------------- REQUESTOR DASHBOARD TAB ----------------- */}
      {activeTab === 'dashboard' && !isInitialLoading && (
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Welcome, Requestor</Text>
              <Text style={styles.welcomeSubtitle}>
                Here is an overview of your department's content activity for this semester.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.createRequestBtnGold}
              onPress={() => setActiveTab('post-requests')}
            >
              <Ionicons name="add" size={18} color={Colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.createRequestBtnGoldText}>Create New Request</Text>
            </TouchableOpacity>
          </View>

          {/* Metrics Row */}


          {/* Recent Post Requests Table */}
          <Card style={styles.tableCard}>
            <View style={styles.tableHeaderArea}>
              <Text style={styles.tableCardTitle}>Recent Post Requests</Text>
              <View style={styles.tableHeaderActions}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, width: 200, borderWidth: 1, borderColor: Colors.border }}>
                  <Ionicons name="search" size={16} color={Colors.textSecondary} />
                  <TextInput
                    style={{ flex: 1, marginLeft: 8, fontSize: 14, color: Colors.textPrimary, ...((Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as any) }}
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {activeTab === 'dashboard' ? (
                  <View style={{ position: 'relative', zIndex: 40, marginRight: 8 }}>
                    <TouchableOpacity
                      style={[styles.departmentDropdown, { height: 36, paddingVertical: 0 }]}
                      onPress={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                    >
                      <Text style={styles.departmentDropdownText}>
                        {statusFilter === 'All' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).toLowerCase()}
                      </Text>
                      <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    {isStatusDropdownOpen && (
                      <View style={[styles.dropdownMenu, { minWidth: 140, right: 0, top: 40 }]}>
                        {[{ label: 'All Status', value: 'All' }, { label: 'Pending', value: 'PENDING' }, { label: 'Approved', value: 'APPROVED' }].map((opt: any) => (
                          <TouchableOpacity
                            key={opt.value}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setStatusFilter(opt.value);
                              setIsStatusDropdownOpen(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, statusFilter === opt.value && { fontWeight: 'bold', color: Colors.primary }]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}

                <View style={{ position: 'relative', zIndex: 40 }}>
                  <TouchableOpacity
                    style={[styles.departmentDropdown, { height: 36, paddingVertical: 0 }]}
                    onPress={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                  >
                    <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.departmentDropdownText}>{dateFilter}</Text>
                    <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {isDateDropdownOpen && (
                    <View style={[styles.dropdownMenu, { minWidth: 200, right: 0, top: 40 }]}>
                      {['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range'].map((opt: any) => (
                        <TouchableOpacity
                          key={opt}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setDateFilter(opt);
                            if (opt !== 'Custom Range') setIsDateDropdownOpen(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, dateFilter === opt && { fontWeight: 'bold', color: Colors.primary }]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}

                      {dateFilter === 'Custom Range' && (
                        <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>Start Date</Text>
                          <input type="date" style={{ height: 32, fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb', paddingLeft: 8, paddingRight: 8, outline: 'none', backgroundColor: '#fff', width: '100%', marginBottom: 8 }} value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>End Date</Text>
                          <input type="date" style={{ height: 32, fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb', paddingLeft: 8, paddingRight: 8, outline: 'none', backgroundColor: '#fff', width: '100%', marginBottom: 8 }} value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                          <TouchableOpacity
                            style={{ backgroundColor: Colors.primary, padding: 6, borderRadius: 4, alignItems: 'center' }}
                            onPress={() => setIsDateDropdownOpen(false)}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Apply</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Table */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.cellFlex2]}>Request Title</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Category</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Platform</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Date Submitted</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Status</Text>
              </View>

              {paginatedRequests.map((req) => (
                <TouchableOpacity key={req.id} style={styles.tableRow} onPress={() => setSelectedQueuePost(req)}>
                  <View style={[styles.cellFlex2, styles.titleCellContainer]}>
                    <View style={[styles.thumbnailPlaceholder, { backgroundColor: req.thumbnailBg }]}>
                      {req.thumbnailUrl ? (
                        <Image
                          source={{ uri: req.thumbnailUrl }}
                          style={{ width: '100%', height: '100%', borderRadius: 4 }}
                          resizeMode="cover"
                          onError={() => { }}
                        />
                      ) : (
                        <Ionicons name={req.thumbnailIcon} size={16} color={Colors.textSecondary} />
                      )}
                    </View>
                    <View>
                      <Text style={styles.postTitleText}>{req.title}</Text>
                    </View>
                  </View>
                  <Text style={[styles.tableCellText, styles.cellFlex1]}>{req.other_category_name || req.category}</Text>
                  <View style={[styles.cellFlex1, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    {(Array.isArray(req.platforms) ? req.platforms : String(req.platforms || '').split(',')).map((p: any, idx: number) => {
                      const platform = p.trim().toLowerCase();
                      if (platform === 'facebook') return <Ionicons key={idx} name="logo-facebook" size={16} color="#1877F2" />;
                      if (platform === 'instagram') return <Ionicons key={idx} name="logo-instagram" size={16} color="#E1306C" />;
                      if (platform === 'twitter' || platform === 'x') return <Ionicons key={idx} name="logo-twitter" size={16} color="#1DA1F2" />;
                      if (platform === 'linkedin') return <Ionicons key={idx} name="logo-linkedin" size={16} color="#0077B5" />;
                      if (platform === 'tiktok') return <Ionicons key={idx} name="logo-tiktok" size={16} color="#000000" />;
                      if (platform === 'youtube') return <Ionicons key={idx} name="logo-youtube" size={16} color="#FF0000" />;
                      if (platform === 'website' || platform === 'web') return <Ionicons key={idx} name="globe-outline" size={16} color="#3B82F6" />;
                      return <Text key={idx} style={styles.postPlatformsText}>{p}</Text>;
                    })}
                  </View>
                  <Text style={[styles.tableCellText, styles.cellFlex1]}>{req.date}</Text>
                  <View style={[styles.cellFlex1, { flexDirection: 'row' }]}>
                    <View style={[styles.statusBadge, { backgroundColor: req.statusBg }]}>
                      <Text style={[styles.statusBadgeText, { color: req.statusColor }]}>
                        {req.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <PaginationControl
              currentPage={dashboardPage}
              totalItems={filteredRequests.length}
              itemsPerPage={dashboardPerPage}
              onPageChange={setDashboardPage}
              onItemsPerPageChange={setDashboardPerPage}
              itemName="requests"
            />
          </Card>
        </View>
      )}

      {/* ----------------- CREATE NEW REQUEST TAB ----------------- */}
      {(activeTab === 'post-requests' || activeTab === 'request') && !isInitialLoading && (
        <View style={styles.formContainer}>
          <View style={styles.topActionRow}>
            <View style={styles.breadcrumbColumn}>
              <Text style={styles.breadcrumbText}>
                POST REQUESTS <Text style={{ color: Colors.textMuted }}>&gt;</Text> NEW REQUEST
              </Text>
              <Text style={styles.mainPageTitle}>Create New Content Request</Text>
              <Text style={styles.mainPageSubtitle}>
                Submit your content for review by the departmental approval committee.
              </Text>
            </View>
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity style={styles.draftButton} onPress={handleSaveDraft}>
                <Ionicons name="save-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.draftButtonText}>Save as Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitRequest}>
                <Ionicons name="paper-plane-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.submitButtonText}>Submit Request</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Layout Split */}
          <View style={{ gap: Spacing.lg }}>
            {/* ROW 1 */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout, { position: 'relative', zIndex: (isCategoryDropdownOpen || isDeptDropdownOpen) ? 100 : 2 }]}>
              <View style={[styles.leftColumn, { position: 'relative', zIndex: (isCategoryDropdownOpen || isDeptDropdownOpen) ? 100 : 2 }]}>
                {/* Basic Information Card */}
                <Card style={[styles.formCard, { flex: 1 }, (isCategoryDropdownOpen || isDeptDropdownOpen) ? { zIndex: 100, position: 'relative' } : {}] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="information-circle" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Basic Information</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>POST TITLE</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g., Enrollment Announcement 2024"
                      value={postTitle}
                      onChangeText={setPostTitle}
                    />
                  </View>

                  <View style={[styles.inlineFieldsRow, isTablet ? styles.rowLayout : styles.columnLayout]}>
                    <View style={[styles.fieldGroup, { flex: 1, position: 'relative', zIndex: isCategoryDropdownOpen ? 60 : 1 }]}>
                      <Text style={styles.inputLabel}>CATEGORY</Text>
                      <View style={[styles.dropdownSelector, { paddingRight: 8, flexDirection: 'row', alignItems: 'center' }]}>
                        {category === 'Others' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={styles.dropdownSelectorText}>Others: </Text>
                            <TextInput
                              style={[{ flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0, height: 20 }, { outlineStyle: 'none' } as any]}
                              placeholder="Type category here..."
                              value={otherCategoryName}
                              onChangeText={setOtherCategoryName}
                              autoFocus
                            />
                          </View>
                        ) : (
                          <Text style={[styles.dropdownSelectorText, { flex: 1 }]}>{category}</Text>
                        )}
                        <TouchableOpacity
                          onPress={() => {
                            setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                            setIsDeptDropdownOpen(false);
                          }}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="chevron-down-outline" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      </View>

                      {isCategoryDropdownOpen && (
                        <View style={styles.dropdownMenu}>
                          {apiCategories.map((cat, idx) => (
                            <TouchableOpacity
                              key={cat.id}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setCategory(cat.name);
                                setCategoryId(cat.id);
                                if (cat.name !== 'Others') setOtherCategoryName('');
                                setIsCategoryDropdownOpen(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{cat.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>DEPARTMENT</Text>
                      <View style={styles.dropdownSelector}>
                        <Text style={styles.dropdownSelectorText}>{department}</Text>
                      </View>
                    </View>
                  </View>
                </Card>
              </View>

              <View style={styles.rightColumn}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="share-social" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Target Platforms</Text>
                  </View>

                  <View style={styles.platformsList}>
                    <TouchableOpacity style={styles.platformRow} onPress={() => togglePlatform('facebook')}>
                      <View style={styles.platformLeft}>
                        <View style={[styles.platformIconBg, { backgroundColor: '#EFF6FF' }]}>
                          <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                        </View>
                        <Text style={styles.platformNameText}>Facebook</Text>
                      </View>
                      <View style={[styles.checkboxOutline, platforms.facebook && styles.checkboxChecked]}>
                        {platforms.facebook && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.platformRow} onPress={() => togglePlatform('instagram')}>
                      <View style={styles.platformLeft}>
                        <View style={[styles.platformIconBg, { backgroundColor: '#FDF2F8' }]}>
                          <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                        </View>
                        <Text style={styles.platformNameText}>Instagram</Text>
                      </View>
                      <View style={[styles.checkboxOutline, platforms.instagram && styles.checkboxChecked]}>
                        {platforms.instagram && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.platformRow} onPress={() => togglePlatform('portal')}>
                      <View style={styles.platformLeft}>
                        <View style={[styles.platformIconBg, { backgroundColor: '#ECFDF5' }]}>
                          <Ionicons name="globe-outline" size={18} color="#059669" />
                        </View>
                        <Text style={styles.platformNameText}>Website Portal</Text>
                      </View>
                      <View style={[styles.checkboxOutline, platforms.portal && styles.checkboxChecked]}>
                        {platforms.portal && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            </View>

            {/* ROW 2 */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout, { position: 'relative', zIndex: (isCategoryDropdownOpen || isDeptDropdownOpen) ? -1 : 1 }]}>
              <View style={[styles.leftColumn, { position: 'relative', zIndex: (isCategoryDropdownOpen || isDeptDropdownOpen) ? -1 : 1 }]}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="document-text" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Content & Caption</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>CAPTION TEXT</Text>
                    <View style={{ marginBottom: 8 }}>
                      <RichTextEditor
                        value={caption}
                        onChange={(val: string) => {
                          if (val.length <= 5000) setCaption(val); // HTML strings can be much longer
                        }}
                        placeholder="Write your post caption here. Ensure it follows the university's brand voice and tonal guidelines..."
                        minHeight={250}
                      />
                    </View>
                    <View style={styles.textAreaFooter}>
                      <Text style={styles.characterCounter}>
                        {caption.length} / 2200 characters
                      </Text>
                      <TouchableOpacity style={[styles.checkPolicyBtn, isCheckingPolicy && { opacity: 0.7 }]} onPress={handleCheckPolicy} disabled={isCheckingPolicy}>
                        <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textPrimary} style={{ marginRight: 4 }} />
                        <Text style={styles.checkPolicyBtnText}>{isCheckingPolicy ? 'Checking...' : 'Check Policy Alignment'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              </View>

              <View style={styles.rightColumn}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="calendar" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Scheduling (Optional)</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>PUBLICATION DATE</Text>
                    <View style={styles.inputIconWrapper}>
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          value={publishDate ? publishDate.split('/').reverse().join('-') : ''}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            if (val) {
                              const [y, m, d] = val.split('-');
                              setPublishDate(`${d}/${m}/${y}`);
                            } else {
                              setPublishDate('');
                            }
                          }}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            color: Colors.textPrimary,
                            padding: '12px 40px 12px 16px',
                            background: 'transparent',
                            width: '100%',
                            cursor: 'pointer',
                          }}
                        />
                      ) : (
                        <TextInput
                          style={styles.textInputWithIcon}
                          placeholder="dd/mm/yyyy"
                          value={publishDate}
                          onChangeText={setPublishDate}
                        />
                      )}
                      <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} style={styles.inputFieldIcon} />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>PUBLICATION TIME (Optional)</Text>
                    <View style={styles.inputIconWrapper}>
                      {Platform.OS === 'web' ? (
                        <input
                          type="time"
                          value={publishTime}
                          onChange={(e: any) => setPublishTime(e.target.value)}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            color: Colors.textPrimary,
                            padding: '12px 40px 12px 16px',
                            background: 'transparent',
                            width: '100%',
                            cursor: 'pointer',
                          }}
                        />
                      ) : (
                        <TextInput
                          style={styles.textInputWithIcon}
                          placeholder="HH:MM (24hr)"
                          value={publishTime}
                          onChangeText={setPublishTime}
                        />
                      )}
                      <Ionicons name="time-outline" size={16} color={Colors.textSecondary} style={styles.inputFieldIcon} />
                    </View>
                  </View>
                  <View style={styles.scheduleInfoBox}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.textPrimary} style={{ marginTop: 2 }} />
                    <Text style={styles.scheduleInfoText}>
                      Posts must be submitted at least 48 hours before the preferred publication date for administrative review.
                    </Text>
                  </View>
                </Card>
              </View>
            </View>

            {/* ROW 3 */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              <View style={styles.leftColumn}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="images" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Media & Assets</Text>
                  </View>

                  <View style={[styles.uploadGridRow, isTablet ? styles.rowLayout : styles.columnLayout]}>
                    <TouchableOpacity style={styles.uploadZone} onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({
                          type: ['image/*', 'video/*'],
                          multiple: true,
                          copyToCacheDirectory: true,
                        });
                        if (!result.canceled && result.assets) {
                          setMediaFiles(result.assets);
                        }
                      } catch (e) {
                        if (Platform.OS === 'web') {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.multiple = true;
                          input.accept = 'image/*,video/*';
                          input.onchange = (ev: any) => {
                            const files = Array.from(ev.target.files || []).map((f: any) => ({
                              uri: URL.createObjectURL(f),
                              name: f.name,
                              mimeType: f.type,
                              size: f.size,
                              file: f,
                            }));
                            setMediaFiles(files);
                          };
                          input.click();
                        }
                      }
                    }}>
                      <View style={styles.uploadZoneCircle}>
                        <Ionicons name="cloud-upload-outline" size={24} color={Colors.textSecondary} />
                      </View>
                      <Text style={styles.uploadZoneTitle}>Upload Main Media</Text>
                      <Text style={styles.uploadZoneSubtitle}>
                        {mediaFiles.length > 0
                          ? mediaFiles.map((f: any) => f.name).join(', ')
                          : 'Images (JPG, PNG) or Videos (MP4) up to 50MB'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.uploadZone} onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({
                          type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
                          multiple: true,
                          copyToCacheDirectory: true,
                        });
                        if (!result.canceled && result.assets) {
                          setSupportingDocs(result.assets);
                        }
                      } catch (e) {
                        if (Platform.OS === 'web') {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.multiple = true;
                          input.accept = '.pdf,.doc,.docx,.txt';
                          input.onchange = (ev: any) => {
                            const files = Array.from(ev.target.files || []).map((f: any) => ({
                              uri: URL.createObjectURL(f),
                              name: f.name,
                              mimeType: f.type,
                              size: f.size,
                              file: f,
                            }));
                            setSupportingDocs(files);
                          };
                          input.click();
                        }
                      }
                    }}>
                      <View style={styles.uploadZoneCircle}>
                        <Ionicons name="attach-outline" size={22} color={Colors.textSecondary} />
                      </View>
                      <Text style={styles.uploadZoneTitle}>Supporting Docs</Text>
                      <Text style={styles.uploadZoneSubtitle}>
                        {supportingDocs.length > 0
                          ? supportingDocs.map((f: any) => f.name).join(', ')
                          : 'PDFs, briefs, or reference materials'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>

              <View style={styles.rightColumn}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <TouchableOpacity
                      style={[styles.headerIconWrapper, { backgroundColor: Colors.primary }]}
                      onPress={() => setIsPreviewModalOpen(true)}
                    >
                      <Ionicons name="eye" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.cardTitle}>Live Preview</Text>
                  </View>

                  <View style={styles.previewModeRow}>
                    <TouchableOpacity
                      style={[styles.previewToggleBtn, previewMode === 'mobile' && styles.previewToggleBtnActive]}
                      onPress={() => setPreviewMode('mobile')}
                    >
                      <Text style={[styles.previewToggleText, previewMode === 'mobile' && styles.previewToggleTextActive]}>
                        Mobile
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.previewToggleBtn, previewMode === 'desktop' && styles.previewToggleBtnActive]}
                      onPress={() => setPreviewMode('desktop')}
                    >
                      <Text style={[styles.previewToggleText, previewMode === 'desktop' && styles.previewToggleTextActive]}>
                        Desktop
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.previewMockupFrame, previewMode === 'mobile' ? { maxWidth: 360, alignSelf: 'center', width: '100%' } : { width: '100%' }]}>
                    <View style={styles.mockPostHeader}>
                      <View style={[styles.mockPostAvatarCircle, { backgroundColor: Colors.surface, overflow: 'hidden' }]}>
                        <Image source={require('../../../assets/images/jmc_logo.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mockPostAuthorName}>Jose Maria College Foundation Inc.</Text>
                        <Text style={styles.mockPostMetaSubtext}>Sponsored &bull; Just now</Text>
                      </View>
                      <Ionicons name="ellipsis-horizontal" size={16} color={Colors.textSecondary} />
                    </View>

                    <View style={styles.mockPostContentArea}>
                      <FormattedText style={styles.mockPostCaptionText}>
                        {caption ? caption : 'Upload media to see your content preview here...'}
                      </FormattedText>
                    </View>

                    {mediaFiles && mediaFiles.length > 0 ? (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImage(mediaFiles[0].uri)} style={{ marginHorizontal: 12, marginBottom: 12, aspectRatio: 4 / 3, backgroundColor: '#f3f4f6', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }}>
                        <Image source={{ uri: mediaFiles[0].uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.mockPostMediaPlaceholder}>
                        <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
                        <Text style={styles.mockPostMediaPlaceholderText}>
                          Upload media to see your content preview here...
                        </Text>
                      </View>
                    )}

                    <View style={styles.mockPostActionsRow}>
                      <View style={styles.mockActionGroup}>
                        <Ionicons name="heart-outline" size={18} color={Colors.textSecondary} />
                      </View>
                      <View style={styles.mockActionGroup}>
                        <Ionicons name="chatbubble-outline" size={17} color={Colors.textSecondary} />
                      </View>
                      <View style={styles.mockActionGroup}>
                        <Ionicons name="share-social-outline" size={18} color={Colors.textSecondary} />
                      </View>
                    </View>
                  </View>
                </Card>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ----------------- APPROVAL QUEUE TAB ----------------- */}
      {activeTab === 'approval-queue' && !isInitialLoading && (
        <View style={styles.dashboardContainer}>
          <View style={styles.titleSection}>
            <Text style={styles.welcomeTitle}>Content Approval Tracking Queue</Text>
            <Text style={styles.welcomeSubtitle}>
              Track the live status and approval steps of your submitted content requests across institutional channels.
            </Text>
          </View>

          {/* Stepper Cards */}
          {mockQueuePosts.map((post) => (
            <Card key={post.id} style={styles.queueCard}>
              {/* Stepper Card Header */}
              <View style={styles.queueCardHeader}>
                <View style={styles.queueCardTitleCol}>
                  <Text style={styles.queuePostTitle}>{post.title}</Text>
                  <Text style={styles.queuePostMeta}>Submitted: {post.date}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: post.badgeBg }]}>
                  <Text style={[styles.statusBadgeText, { color: post.badgeColor }]}>
                    {post.statusLabel}
                  </Text>
                </View>
              </View>

              {/* Stepper Visualization */}
              <View style={styles.stepperContainer}>
                {post.steps.map((step: any, index: number) =>
                  renderStep(step, index, index === post.steps.length - 1)
                )}
              </View>

              {/* Stepper Footer / Action Notes */}
              <View style={styles.queueCardFooter}>
                <View style={styles.actionNoteContainer}>
                  <Ionicons name="arrow-forward-circle-outline" size={16} color={Colors.textPrimary} />
                  <Text style={styles.actionNoteText}>
                    <Text style={{ fontWeight: 'bold' }}>Next Action: </Text>
                    {post.nextAction}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.queueCardActions}>
                  <TouchableOpacity
                    style={styles.queueActionBtn}
                    onPress={() => alert(`Reviewing details for: ${post.title}`)}
                  >
                    <Ionicons name="eye-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={styles.queueActionBtnText}>Preview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.queueActionBtn}
                    onPress={() => setSelectedQueuePost(post)}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={styles.queueActionBtnText}>Review Comments ({post.comments.length})</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* ----------------- ACCOUNT SETTINGS TAB ----------------- */}
      {activeTab === 'account-settings' && !isInitialLoading && (
        <View style={styles.formContainer}>
          <View style={styles.topActionRow}>
            <View style={styles.breadcrumbColumn}>
              <Text style={styles.breadcrumbText}>
                SETTINGS <Text style={{ color: Colors.textMuted }}>&gt;</Text> ACCOUNT SETTINGS
              </Text>
              <Text style={styles.mainPageTitle}>Account Settings</Text>
              <Text style={styles.mainPageSubtitle}>
                Manage your institutional profile picture, credentials, and settings.
              </Text>
            </View>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Left settings card */}
            <View style={styles.leftColumn}>
              <Card style={styles.formCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.headerIconWrapper}>
                    <Ionicons name="person" size={18} color={Colors.textPrimary} />
                  </View>
                  <Text style={styles.cardTitle}>Profile Information</Text>
                </View>

                {/* Profile Picture Upload Section */}
                <View style={styles.profilePicUploadContainer}>
                  <View style={[styles.profilePicLarge, { backgroundColor: avatarColors.bg }]}>
                    {profilePhotoUrl ? (
                      <Image source={{ uri: profilePhotoUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} resizeMode="cover" />
                    ) : (
                      <Text style={[styles.profilePicLargeText, { color: avatarColors.text }]}>
                        {user?.first_name ? (user.first_name[0] + (user.last_name?.[0] || '')).toUpperCase() : 'MA'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.profilePicActionCol}>
                    <Text style={styles.profilePicTitle}>Profile Picture</Text>
                    <Text style={styles.profilePicSubtitle}>PNG or JPG formats supported. Max 2MB file size.</Text>
                    <View style={styles.profilePicButtonsRow}>
                      <TouchableOpacity style={styles.profilePicUploadBtn} onPress={handleUploadPhoto} disabled={uploadingPhoto}>
                        <Text style={styles.profilePicUploadBtnText}>{uploadingPhoto ? 'Uploading...' : 'Upload New Photo'}</Text>
                      </TouchableOpacity>
                      {profilePhotoUrl && (
                        <TouchableOpacity style={styles.profilePicRemoveBtn} onPress={handleRemovePhoto} disabled={uploadingPhoto}>
                          <Text style={styles.profilePicRemoveBtnText}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>FULL NAME</Text>
                  <TextInput style={styles.textInput} value={acctFullName} onChangeText={setAcctFullName} />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]} value={user?.email ?? ''} editable={false} />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT</Text>
                  <TextInput style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]} value={user?.department || ''} editable={false} />
                </View>

                <TouchableOpacity style={{ backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 4, alignItems: 'center', marginTop: 12 }} onPress={handleSaveDetails} disabled={savingAcct}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{savingAcct ? 'Saving...' : 'Save Details'}</Text>
                </TouchableOpacity>
              </Card>
            </View>

            {/* Right settings card */}
            <View style={styles.rightColumn}>
              <Card style={styles.configCard}>
                <Text style={styles.configCardTitle}>Update Password</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>CURRENT PASSWORD</Text>
                  <TextInput style={styles.textInput} secureTextEntry value={acctCurrentPw} onChangeText={setAcctCurrentPw} placeholder="Enter current password" />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                  <TextInput style={styles.textInput} secureTextEntry value={acctNewPw} onChangeText={setAcctNewPw} placeholder="Enter new password" />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                  <TextInput style={styles.textInput} secureTextEntry value={acctConfirmPw} onChangeText={setAcctConfirmPw} placeholder="Confirm new password" />
                </View>

                <TouchableOpacity style={{ backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 4, alignItems: 'center', marginTop: 12 }} onPress={handleChangePw} disabled={savingAcctPw}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{savingAcctPw ? 'Changing...' : 'Change Password'}</Text>
                </TouchableOpacity>
              </Card>
            </View>
          </View>
        </View>
      )}

      {/* ----------------- POLICY & RULES TAB ----------------- */}
      {activeTab === 'policy-rules' && !isInitialLoading && (
        <PolicyRulesView accentColor="#0B2545" />
      )}

      {/* ----------------- DRAFTS TAB ----------------- */}
      {(activeTab === 'draft' || activeTab === 'drafts') && !isInitialLoading && (
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Draft Post Requests</Text>
              <Text style={styles.welcomeSubtitle}>
                Manage your saved post request drafts. You can edit, update, or submit them for approval.
              </Text>
            </View>
          </View>

          {drafts.length === 0 ? (
            <Card style={styles.formCard}>
              <View style={{ alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm }}>
                <Ionicons name="create-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.cardTitle}>No Saved Drafts</Text>
                <Text style={styles.welcomeSubtitle}>You don't have any saved drafts right now.</Text>
                <TouchableOpacity
                  style={[styles.createRequestBtnGold, { marginTop: Spacing.sm }]}
                  onPress={() => setActiveTab('request')}
                >
                  <Text style={styles.createRequestBtnGoldText}>Start a New Request</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : (
            <Card style={styles.tableCard}>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.cellFlex2]}>Request Title</Text>
                  <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Category</Text>
                  <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Date Saved</Text>
                  <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Status</Text>
                  <Text style={[styles.tableHeaderCell, styles.cellFlex1, styles.alignRight]}>Actions</Text>
                </View>

                {drafts.map((draft) => (
                  <TouchableOpacity key={draft.id} style={styles.tableRow} onPress={() => handleEditDraft(draft)}>
                    <View style={[styles.cellFlex2, styles.titleCellContainer]}>
                      <View style={[styles.thumbnailPlaceholder, { backgroundColor: draft.thumbnailBg || '#F1F5F9' }]}>
                        {draft.thumbnailUrl ? (
                          <Image
                            source={{ uri: draft.thumbnailUrl }}
                            style={{ width: '100%', height: '100%', borderRadius: 4 }}
                            resizeMode="cover"
                            onError={() => { }}
                          />
                        ) : (
                          <Ionicons name={draft.thumbnailIcon || "document-text-outline"} size={16} color={Colors.textSecondary} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.postTitleText}>{draft.title}</Text>
                        <Text numberOfLines={1} style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 4 }}>
                          {draft.caption ? draft.caption : 'No caption provided'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.tableCellText, styles.cellFlex1]}>{draft.category}</Text>
                    <Text style={[styles.tableCellText, styles.cellFlex1]}>{draft.dateSaved}</Text>
                    <View style={[styles.cellFlex1, { flexDirection: 'row' }]}>
                      <View style={[styles.statusBadge, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#475569' }]}>DRAFT</Text>
                      </View>
                    </View>
                    <View style={[styles.cellFlex1, styles.actionsCell, { gap: 8, justifyContent: 'flex-end' }]}>
                      <TouchableOpacity onPress={() => handleEditDraft(draft)} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#FFC72C', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="create-outline" size={14} color="#1A1A2E" />
                        <Text style={{ color: '#1A1A2E', fontSize: 11, fontWeight: 'bold' }}>Edit & Submit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDeleteDraft(draft.id); }} style={{ padding: 6, backgroundColor: '#FEF2F2', borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5' }}>
                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          )}
        </View>
      )}

      {/* ----------------- REJECTED TAB ----------------- */}
      {(activeTab === 'rejected' || activeTab === 'rejected-requests') && !isInitialLoading && (
        <View style={styles.dashboardContainer}>
          <Card style={styles.tableCard}>
            <View style={styles.tableHeaderArea}>
              <Text style={styles.tableCardTitle}>Rejected Requests</Text>

              <View style={styles.tableHeaderActions}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, width: 220, borderWidth: 1, borderColor: Colors.border }}>
                  <Ionicons name="search" size={16} color={Colors.textSecondary} />
                  <TextInput
                    style={{ flex: 1, marginLeft: 8, fontSize: 13, color: Colors.textPrimary, ...((Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as any) }}
                    placeholder="Search requests..."
                    value={rejectedSearchQuery}
                    onChangeText={setRejectedSearchQuery}
                  />
                </View>

                <View style={{ position: 'relative', zIndex: 40 }}>
                  <TouchableOpacity
                    style={[styles.departmentDropdown, { height: 36, paddingVertical: 0 }]}
                    onPress={() => setIsRejectedDateDropdownOpen(!isRejectedDateDropdownOpen)}
                  >
                    <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.departmentDropdownText}>{rejectedDateFilter}</Text>
                    <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {isRejectedDateDropdownOpen && (
                    <View style={[styles.dropdownMenu, { minWidth: 200, right: 0, top: 40 }]}>
                      {['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range'].map((opt: any) => (
                        <TouchableOpacity
                          key={opt}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setRejectedDateFilter(opt);
                            if (opt !== 'Custom Range') setIsRejectedDateDropdownOpen(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, rejectedDateFilter === opt && { fontWeight: 'bold', color: Colors.primary }]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}

                      {rejectedDateFilter === 'Custom Range' && (
                        <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>Start Date</Text>
                          <input type="date" style={{ height: 32, fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb', paddingLeft: 8, paddingRight: 8, outline: 'none', backgroundColor: '#fff', width: '100%', marginBottom: 8 }} value={customRejectedStartDate} onChange={(e) => setCustomRejectedStartDate(e.target.value)} />
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>End Date</Text>
                          <input type="date" style={{ height: 32, fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb', paddingLeft: 8, paddingRight: 8, outline: 'none', backgroundColor: '#fff', width: '100%', marginBottom: 8 }} value={customRejectedEndDate} onChange={(e) => setCustomRejectedEndDate(e.target.value)} />
                          <TouchableOpacity
                            style={{ backgroundColor: Colors.primary, padding: 6, borderRadius: 4, alignItems: 'center' }}
                            onPress={() => setIsRejectedDateDropdownOpen(false)}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Apply</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {filteredRejectedPosts.length === 0 ? (
              <Card style={styles.formCard}>
                <View style={{ alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm }}>
                  <Ionicons name="checkmark-circle-outline" size={48} color="#16A34A" />
                  <Text style={styles.cardTitle}>No Rejected Requests</Text>
                  <Text style={styles.welcomeSubtitle}>All of your submitted requests have passed or are currently in review.</Text>
                </View>
              </Card>
            ) : (
              <>
                <View style={styles.table}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, styles.flexTitle]}>REQUEST TITLE</Text>
                    <Text style={[styles.tableHeaderCell, styles.flexUser]}>REQUESTED BY</Text>
                    <Text style={[styles.tableHeaderCell, styles.flexDate]}>REQUESTED ON</Text>
                    <Text style={[styles.tableHeaderCell, styles.flexPlatforms]}>PLATFORMS</Text>
                    <Text style={[styles.tableHeaderCell, styles.flexActions, styles.alignRight]}>ACTIONS</Text>
                  </View>
                  {filteredRejectedPosts.map((post) => (
                    <TouchableOpacity
                      key={post.id}
                      style={styles.tableRow}
                      activeOpacity={0.7}
                      onPress={() => setSelectedQueuePost(post)}
                    >
                      {/* REQUEST TITLE + CATEGORY TAG */}
                      <View style={[styles.cellContainer, styles.flexTitle]}>
                        <View style={styles.thumbnailBox}>
                          {post.thumbnailUrl ? (
                            <Image source={{ uri: post.thumbnailUrl }} style={{ width: '100%', height: '100%', borderRadius: 6 }} resizeMode="cover" />
                          ) : (
                            <Ionicons name="image-outline" size={16} color={Colors.textSecondary} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitleText}>{post.title}</Text>
                          <View style={styles.categoryPill}>
                            <Text style={styles.categoryPillText}>{post.other_category_name || post.category}</Text>
                          </View>
                        </View>
                      </View>

                      {/* REQUESTED BY */}
                      <View style={[styles.cellContainer, styles.flexUser]}>
                        <Text style={styles.rowUserName}>{user?.full_name}</Text>
                        <Text style={styles.rowUserRole}>Requestor</Text>
                      </View>

                      {/* REQUESTED ON */}
                      <View style={[styles.cellContainer, styles.flexDate]}>
                        <Text style={styles.rowDateText}>{post.date}</Text>
                        <Text style={styles.rowTimeText}>{post.time}</Text>
                      </View>

                      {/* PLATFORMS */}
                      <View style={[styles.cellContainer, styles.flexPlatforms, { flexDirection: 'row', gap: 6, justifyContent: 'flex-start' }]}>
                        {(post.platforms || []).includes('facebook') && (
                          <View style={[styles.platformIconCircle, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="logo-facebook" size={13} color="#1877F2" />
                          </View>
                        )}
                        {(post.platforms || []).includes('instagram') && (
                          <View style={[styles.platformIconCircle, { backgroundColor: '#FDF2F8' }]}>
                            <Ionicons name="logo-instagram" size={13} color="#E1306C" />
                          </View>
                        )}
                        {(post.platforms || []).includes('website') && (
                          <View style={[styles.platformIconCircle, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="globe-outline" size={13} color="#059669" />
                          </View>
                        )}
                      </View>

                      {/* ACTIONS */}
                      <View style={[styles.cellContainer, styles.flexActions, styles.rowActionsGroup, { justifyContent: 'flex-end' }]}>
                        <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#B91C1C' }}>REJECTED</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                <PaginationControl
                  currentPage={1}
                  totalItems={rejectedPosts.length}
                  itemsPerPage={10}
                  onPageChange={() => { }}
                />
              </>
            )}
          </Card>
        </View>
      )}

      {/* Other Placeholder tabs */}
      {activeTab !== 'dashboard' && activeTab !== 'request' && activeTab !== 'post-requests' && activeTab !== 'approval-queue' && activeTab !== 'account-settings' && activeTab !== 'analytics' && activeTab !== 'policy-rules' && activeTab !== 'draft' && activeTab !== 'drafts' && activeTab !== 'rejected' && activeTab !== 'rejected-requests' && !isInitialLoading && (
        <Card style={styles.formCard}>
          <Text style={styles.cardTitle}>{(activeTab as string).replace(/-/g, ' ').toUpperCase()}</Text>
          <Text style={styles.mainPageSubtitle}>This section is currently under development.</Text>
        </Card>
      )}

      {/* Review Comments Modal */}
      {selectedQueuePost && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setSelectedQueuePost(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalHeaderTitle}>Request Details</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.statusBadge, { backgroundColor: selectedQueuePost.statusBg || Colors.border }]}>
                    <Text style={[styles.statusBadgeText, { color: selectedQueuePost.statusColor || Colors.textPrimary }]}>
                      {selectedQueuePost.status}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Modal Body Split */}
              <ScrollView style={styles.modalBodyScroll} contentContainerStyle={styles.modalBodyContent}>
                {(selectedQueuePost.rawStatus === 'rejected' || selectedQueuePost.rawStatus === 'returned_for_revision') && (
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' }}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#EF4444', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Rejected by: {selectedQueuePost.rejectedBy}</Text>
                      <Text style={{ fontSize: 15, color: '#EF4444', fontWeight: '500' }}>
                        {selectedQueuePost.rejectionReason || 'No reason provided.'}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={{ marginBottom: 16 }}>
                  <View style={{ backgroundColor: Colors.surface, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.textPrimary }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 12 }}>Approval Tracking</Text>
                    {(() => {
                      const workflows = selectedQueuePost.approval_workflows || [];
                      const getStageStatus = (stageName: string) => {
                        const entry = workflows.find((w: any) => w.stage === stageName);
                        if (entry) {
                          if (entry.action === 'approved') return 'Approved';
                          if (entry.action === 'rejected' || entry.action === 'returned_for_revision') return 'Rejected';
                        }
                        return 'Pending';
                      };

                      let submitted = 'Approved'; // Always approved since it exists
                      let deptHead = getStageStatus('office_head');
                      let vpaa = getStageStatus('vice_president');
                      let imc = getStageStatus('imc_qa');

                      if (deptHead === 'Rejected') { vpaa = 'Waiting'; imc = 'Waiting'; }
                      if (vpaa === 'Rejected') { imc = 'Waiting'; }
                      if (imc === 'Approved') { imc = 'Published'; }

                      const getIcon = (state: string) => {
                        if (state === 'Rejected') return { name: 'close-circle', color: '#DC2626' };
                        if (state === 'Approved' || state === 'Published') return { name: 'checkmark-circle', color: '#059669' };
                        return { name: 'time', color: Colors.textMuted };
                      };
                      const getColor = (state: string) => {
                        if (state === 'Rejected') return '#DC2626';
                        if (state === 'Approved' || state === 'Published') return '#059669';
                        return Colors.textMuted;
                      };
                      const getLineColor = (state: string) => {
                        if (state === 'Approved' || state === 'Published') return '#059669';
                        if (state === 'Rejected') return '#DC2626';
                        return Colors.border;
                      };

                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4 }}>

                          {selectedQueuePost.rawStatus !== 'rejected' && selectedQueuePost.rawStatus !== 'returned_for_revision' && (
                            <>
                              <View style={{ alignItems: 'center', flex: 1.2 }}>
                                <Ionicons name={getIcon(submitted).name as any} color={getIcon(submitted).color} size={22} />
                                <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary, marginTop: 6, height: 28 }}>Submitted</Text>
                              </View>

                              <View style={{ height: 2, backgroundColor: getLineColor(submitted), flex: 1, marginTop: 11, marginHorizontal: -4 }} />
                            </>
                          )}

                          <View style={{ alignItems: 'center', flex: 1.2 }}>
                            <Ionicons name={getIcon(deptHead).name as any} color={getIcon(deptHead).color} size={22} />
                            <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary, marginTop: 6, height: 28 }}>Dept Head</Text>
                            <Text style={{ fontSize: 10, color: getColor(deptHead), fontWeight: 'bold', textTransform: 'uppercase' }}>{deptHead}</Text>
                          </View>

                          <View style={{ height: 2, backgroundColor: getLineColor(deptHead), flex: 1, marginTop: 11, marginHorizontal: -4 }} />

                          <View style={{ alignItems: 'center', flex: 1.2 }}>
                            <Ionicons name={getIcon(vpaa).name as any} color={getIcon(vpaa).color} size={22} />
                            <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary, marginTop: 6, height: 28 }}>VPAA</Text>
                            <Text style={{ fontSize: 10, color: getColor(vpaa), fontWeight: 'bold', textTransform: 'uppercase' }}>{vpaa}</Text>
                          </View>

                          <View style={{ height: 2, backgroundColor: getLineColor(vpaa), flex: 1, marginTop: 11, marginHorizontal: -4 }} />

                          <View style={{ alignItems: 'center', flex: 1.2 }}>
                            <Ionicons name={getIcon(imc).name as any} color={getIcon(imc).color} size={22} />
                            <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary, marginTop: 6, height: 28 }}>IMC / QA</Text>
                            <Text style={{ fontSize: 10, color: getColor(imc), fontWeight: 'bold', textTransform: 'uppercase' }}>{imc}</Text>
                          </View>

                        </View>
                      );
                    })()}
                  </View>
                </View>

                <View style={[styles.modalSplitRow, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
                  {/* Left Side: Social Media Mockup Preview */}
                  <View style={styles.modalLeftColumn}>
                    {/* Platform Selector Tabs */}
                    <View style={styles.modalPlatformTabs}>
                      <TouchableOpacity
                        style={[
                          styles.modalPlatformTab,
                          modalPlatformTab === 'facebook' && styles.modalPlatformTabActive,
                        ]}
                        onPress={() => setModalPlatformTab('facebook')}
                      >
                        <Ionicons name="logo-facebook" size={14} color={modalPlatformTab === 'facebook' ? '#1877F2' : Colors.textSecondary} />
                        <Text style={[styles.modalPlatformTabText, modalPlatformTab === 'facebook' && styles.modalPlatformTabTextActive]}>
                          Facebook
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.modalPlatformTab,
                          modalPlatformTab === 'instagram' && styles.modalPlatformTabActive,
                        ]}
                        onPress={() => setModalPlatformTab('instagram')}
                      >
                        <Ionicons name="logo-instagram" size={14} color={modalPlatformTab === 'instagram' ? '#E1306C' : Colors.textSecondary} />
                        <Text style={[styles.modalPlatformTabText, modalPlatformTab === 'instagram' && styles.modalPlatformTabTextActive]}>
                          Instagram
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.modalPlatformTab,
                          modalPlatformTab === 'website' && styles.modalPlatformTabActive,
                        ]}
                        onPress={() => setModalPlatformTab('website')}
                      >
                        <Ionicons name="globe-outline" size={14} color={modalPlatformTab === 'website' ? '#059669' : Colors.textSecondary} />
                        <Text style={[styles.modalPlatformTabText, modalPlatformTab === 'website' && styles.modalPlatformTabTextActive]}>
                          Website
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Interactive Mockup Container */}
                    {modalPlatformTab === 'facebook' && (
                      <View style={styles.socialMockupCard}>
                        <View style={styles.socialHeader}>
                          <Image source={require('../../../assets/images/jmc_logo.png')} style={[styles.socialAvatar, { backgroundColor: Colors.surface }]} resizeMode="contain" />
                          <View>
                            <Text style={styles.socialAuthorName}>Jose Maria College Foundation Inc.</Text>
                            <Text style={styles.socialTimeText}>Official Department Post &bull; Public</Text>
                          </View>
                        </View>

                        <FormattedText style={styles.socialCaptionText}>{selectedQueuePost.caption}</FormattedText>

                        {selectedQueuePost.thumbnailUrl ? (
                          <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImage(selectedQueuePost.thumbnailUrl)}>
                            <Image source={{ uri: selectedQueuePost.thumbnailUrl }} style={{ width: '100%', height: 260, maxHeight: 400, borderRadius: 8, backgroundColor: '#F9FAFB' }} resizeMode="contain" />
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.socialMediaBanner}>
                            <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.7)" style={{ marginBottom: 8 }} />
                            <Text style={styles.socialMediaBannerText}>{selectedQueuePost.previewBanner}</Text>
                          </View>
                        )}

                        <View style={styles.socialFooterActions}>
                          <View style={styles.socialActionBtn}>
                            <Ionicons name="thumbs-up-outline" size={14} color={Colors.textSecondary} />
                            <Text style={styles.socialActionText}>Like</Text>
                          </View>
                          <View style={styles.socialActionBtn}>
                            <Ionicons name="chatbubble-outline" size={14} color={Colors.textSecondary} />
                            <Text style={styles.socialActionText}>Comment</Text>
                          </View>
                          <View style={styles.socialActionBtn}>
                            <Ionicons name="share-social-outline" size={14} color={Colors.textSecondary} />
                            <Text style={styles.socialActionText}>Share</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {modalPlatformTab === 'instagram' && (
                      <View style={styles.socialMockupCard}>
                        <View style={styles.socialHeader}>
                          <Image source={require('../../../assets/images/jmc_logo.png')} style={[styles.socialAvatar, { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 2, borderColor: '#E1306C', width: 34, height: 34 }]} resizeMode="contain" />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.socialAuthorName, { fontWeight: 'bold' }]}>Jose Maria College Foundation Inc.</Text>
                          </View>
                          <Ionicons name="ellipsis-horizontal" size={16} color={Colors.textSecondary} />
                        </View>

                        {selectedQueuePost.thumbnailUrl ? (
                          <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImage(selectedQueuePost.thumbnailUrl)}>
                            <Image source={{ uri: selectedQueuePost.thumbnailUrl }} style={{ width: '100%', height: 320, backgroundColor: '#F9FAFB' }} resizeMode="cover" />
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.socialMediaBanner, { height: 320, borderRadius: 0 }]}>
                            <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.7)" style={{ marginBottom: 8 }} />
                            <Text style={styles.socialMediaBannerText}>{selectedQueuePost.previewBanner}</Text>
                          </View>
                        )}

                        <View style={{ padding: 12 }}>
                          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                            <Ionicons name="heart-outline" size={22} color={Colors.textPrimary} />
                            <Ionicons name="chatbubble-outline" size={20} color={Colors.textPrimary} style={{ transform: [{ scaleX: -1 }] }} />
                            <Ionicons name="paper-plane-outline" size={20} color={Colors.textPrimary} />
                          </View>
                          <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: Colors.textPrimary }}>1,234 likes</Text>
                          <FormattedText style={styles.socialCaptionText}>{'<b>jmcfi_cite </b>' + (selectedQueuePost.caption || '')}</FormattedText>
                        </View>
                      </View>
                    )}

                    {modalPlatformTab === 'website' && (
                      <View style={[styles.socialMockupCard, { padding: 0, overflow: 'hidden' }]}>
                        {selectedQueuePost.thumbnailUrl ? (
                          <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImage(selectedQueuePost.thumbnailUrl)}>
                            <Image source={{ uri: selectedQueuePost.thumbnailUrl }} style={{ width: '100%', height: 200, backgroundColor: '#F9FAFB', borderTopLeftRadius: 8, borderTopRightRadius: 8 }} resizeMode="cover" />
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.socialMediaBanner, { height: 200, borderTopLeftRadius: 8, borderTopRightRadius: 8 }]}>
                            <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.7)" style={{ marginBottom: 8 }} />
                            <Text style={styles.socialMediaBannerText}>{selectedQueuePost.previewBanner}</Text>
                          </View>
                        )}
                        <View style={{ padding: 16 }}>
                          <Text style={{ color: '#059669', fontSize: 11, fontWeight: 'bold', marginBottom: 6, textTransform: 'uppercase' }}>News & Updates</Text>
                          <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 12, lineHeight: 28 }}>{selectedQueuePost.title}</Text>
                          <Text style={{ color: Colors.textSecondary, fontSize: 13, marginBottom: 16 }}>Published on {selectedQueuePost.date}</Text>
                          <FormattedText style={[styles.socialCaptionText, { fontSize: 14 }]}>{selectedQueuePost.caption}</FormattedText>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Right Side: Request Details Metadata */}
                  <View style={styles.modalRightColumn}>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Request Title</Text>
                      <Text style={styles.metaTitleVal}>{selectedQueuePost.title}</Text>
                    </View>

                    <View style={styles.metaRowGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Department</Text>
                        <View style={styles.deptBadge}>
                          <Text style={styles.deptBadgeText}>{selectedQueuePost.department}</Text>
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Category</Text>
                        <Text style={styles.metaVal}>{selectedQueuePost.category}</Text>
                      </View>
                    </View>

                    <View style={styles.metaRowGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Requested By</Text>
                        <Text style={styles.metaVal}>{user?.full_name}</Text>
                        <Text style={styles.rowUserRole}>Requestor</Text>
                      </View>
                    </View>

                    <View style={styles.metaRowGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Requested On</Text>
                        <Text style={styles.metaVal}>
                          {selectedQueuePost.date} {selectedQueuePost.time}
                        </Text>
                      </View>
                    </View>



                    <View style={styles.metaRowGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Target Platforms</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                          {(selectedQueuePost.platforms || []).includes('facebook') && (
                            <View style={[styles.platformIconCircle, { backgroundColor: '#EFF6FF' }]}>
                              <Ionicons name="logo-facebook" size={14} color="#1877F2" />
                            </View>
                          )}
                          {(selectedQueuePost.platforms || []).includes('instagram') && (
                            <View style={[styles.platformIconCircle, { backgroundColor: '#FDF2F8' }]}>
                              <Ionicons name="logo-instagram" size={14} color="#E1306C" />
                            </View>
                          )}
                          {(selectedQueuePost.platforms || []).includes('website') && (
                            <View style={[styles.platformIconCircle, { backgroundColor: '#ECFDF5' }]}>
                              <Ionicons name="globe-outline" size={14} color="#059669" />
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.metaDivider} />

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Caption / Main Text</Text>
                      <FormattedText style={styles.metaCaptionBox}>{selectedQueuePost.caption}</FormattedText>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Modal Footer Actions */}
              <View style={styles.modalFooterRow}>
                <TouchableOpacity
                  style={styles.btnModalClose}
                  onPress={() => setSelectedQueuePost(null)}
                >
                  <Text style={styles.btnModalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Approval Flow Progress Modal for Recent Requests Row Click */}
      {selectedRow && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setSelectedRow(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Approval Flow Progress</Text>
                <TouchableOpacity onPress={() => setSelectedRow(null)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalPostTitle}>{selectedRow.title}</Text>
                <Text style={styles.modalPostMeta}>Status: {selectedRow.status}</Text>
                <View style={styles.modalDivider} />

                <View style={[styles.stepperContainer, { paddingVertical: 12 }]}>
                  {(() => {
                    const workflows = selectedRow.approval_workflows || [];
                    const getStageStatus = (stageName: string) => {
                      const entry = workflows.find((w: any) => w.stage === stageName);
                      if (entry) {
                        if (entry.action === 'approved') return 'Approved';
                        if (entry.action === 'rejected' || entry.action === 'returned_for_revision') return 'Rejected';
                      }
                      return 'Pending';
                    };

                    let submitted = 'Approved'; // Always approved if it's in the list
                    let deptHead = getStageStatus('office_head');
                    let vpaa = getStageStatus('vice_president');
                    let imc = getStageStatus('imc_qa');

                    if (deptHead === 'Rejected') { vpaa = 'Waiting'; imc = 'Waiting'; }
                    if (vpaa === 'Rejected') { imc = 'Waiting'; }

                    const getIcon = (state: string) => {
                      if (state === 'Rejected') return { name: 'close-circle', color: '#DC2626' };
                      if (state === 'Approved') return { name: 'checkmark-circle', color: '#059669' };
                      return { name: 'time', color: Colors.textMuted };
                    };
                    const getColor = (state: string) => {
                      if (state === 'Rejected') return '#DC2626';
                      if (state === 'Approved') return '#059669';
                      return Colors.textMuted;
                    };
                    const getLineColor = (state: string) => {
                      if (state === 'Approved') return '#059669';
                      if (state === 'Rejected') return '#DC2626';
                      return Colors.border;
                    };

                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 16 }}>

                        {/* Step 0: Submitted */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <Ionicons name={getIcon(submitted).name as any} color={getIcon(submitted).color} size={22} />
                          <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary, marginTop: 6, height: 28 }}>Submitted</Text>
                          <Text style={{ fontSize: 10, color: getColor(submitted), fontWeight: 'bold', textTransform: 'uppercase' }}>{submitted}</Text>
                        </View>

                        <View style={{ height: 2, backgroundColor: getLineColor(submitted), flex: 1, marginTop: 11, marginHorizontal: -4 }} />

                        {/* Step 1: Dept Head */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <Ionicons name={getIcon(deptHead).name as any} color={getIcon(deptHead).color} size={22} />
                          <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary, marginTop: 6, height: 28 }}>Dept Head</Text>
                          <Text style={{ fontSize: 10, color: getColor(deptHead), fontWeight: 'bold', textTransform: 'uppercase' }}>{deptHead}</Text>
                        </View>

                        <View style={{ height: 2, backgroundColor: getLineColor(deptHead), flex: 1, marginTop: 11, marginHorizontal: -4 }} />

                        {/* Step 2: VPAA */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <Ionicons name={getIcon(vpaa).name as any} color={getIcon(vpaa).color} size={22} />
                          <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary, marginTop: 6, height: 28 }}>VPAA</Text>
                          <Text style={{ fontSize: 10, color: getColor(vpaa), fontWeight: 'bold', textTransform: 'uppercase' }}>{vpaa}</Text>
                        </View>

                        <View style={{ height: 2, backgroundColor: getLineColor(vpaa), flex: 1, marginTop: 11, marginHorizontal: -4 }} />

                        {/* Step 3: IMC/QA */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <Ionicons name={getIcon(imc).name as any} color={getIcon(imc).color} size={22} />
                          <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary, marginTop: 6, height: 28 }}>IMC / QA</Text>
                          <Text style={{ fontSize: 10, color: getColor(imc), fontWeight: 'bold', textTransform: 'uppercase' }}>{imc}</Text>
                        </View>

                      </View>
                    );
                  })()}
                </View>

                <View style={styles.modalDivider} />

                <Text style={styles.detailsHeader}>Request Details</Text>

                <View style={styles.detailsSection}>
                  <Text style={styles.detailsLabel}>Caption / Narrative</Text>
                  <FormattedText style={styles.detailsText}>{selectedRow.caption_narrative || 'No caption provided.'}</FormattedText>
                </View>

                {selectedRow.target_platforms && selectedRow.target_platforms.length > 0 && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>Target Platforms</Text>
                    <View style={styles.platformsContainer}>
                      {selectedRow.target_platforms.map((plat: string) => (
                        <View key={plat} style={styles.platformBadge}>
                          <Text style={styles.platformBadgeText}>{plat}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {selectedRow.media && selectedRow.media.length > 0 && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>Media Attachments</Text>
                    <View style={styles.mediaGallery}>
                      {selectedRow.media.map((m: any, idx: number) => (
                        m.type === 'image' || m.type === 'video' ? (
                          <TouchableOpacity key={idx} onPress={() => setFullScreenImage(m.url)}>
                            <Image source={{ uri: m.url }} style={styles.mediaThumbnail} resizeMode="cover" />
                          </TouchableOpacity>
                        ) : (
                          <View key={idx} style={styles.mediaDocPlaceholder}>
                            <Ionicons name="document-text-outline" size={24} color={Colors.textSecondary} />
                            <Text style={styles.mediaDocText} numberOfLines={1}>{m.original_filename || 'Document'}</Text>
                          </View>
                        )
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedRow(null)}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Live Preview Floating Window */}
      {isPreviewModalOpen && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setIsPreviewModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: previewMode === 'mobile' ? 400 : 800, padding: 0, backgroundColor: 'transparent', shadowColor: 'transparent', elevation: 0 }]}>

              <View style={[styles.previewMockupFrame, { alignSelf: 'center', width: '100%', backgroundColor: Colors.surface, maxHeight: '90%' }]}>
                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                  <View style={styles.mockPostHeader}>
                    <View style={[styles.mockPostAvatarCircle, { backgroundColor: Colors.surface, overflow: 'hidden' }]}>
                      <Image source={require('../../../assets/images/jmc_logo.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mockPostAuthorName}>Jose Maria College Foundation Inc.</Text>
                      <Text style={styles.mockPostMetaSubtext}>Sponsored &bull; Just now</Text>
                    </View>
                    <TouchableOpacity onPress={() => setIsPreviewModalOpen(false)}>
                      <Ionicons name="close" size={24} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.mockPostContentArea}>
                    <FormattedText style={styles.mockPostCaptionText}>
                      {caption ? caption : 'Upload media to see your content preview here...'}
                    </FormattedText>
                  </View>

                  {mediaFiles && mediaFiles.length > 0 ? (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImage(mediaFiles[0].uri)} style={{ marginHorizontal: 12, marginBottom: 12, aspectRatio: 4 / 3, backgroundColor: '#f3f4f6', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }}>
                      <Image source={{ uri: mediaFiles[0].uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.mockPostMediaPlaceholder}>
                      <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
                      <Text style={styles.mockPostMediaPlaceholderText}>
                        Upload media to see your content preview here...
                      </Text>
                    </View>
                  )}

                  <View style={styles.mockPostActionsRow}>
                    <View style={styles.mockActionGroup}>
                      <Ionicons name="heart-outline" size={18} color={Colors.textSecondary} />
                    </View>
                    <View style={styles.mockActionGroup}>
                      <Ionicons name="chatbubble-outline" size={17} color={Colors.textSecondary} />
                    </View>
                    <View style={styles.mockActionGroup}>
                      <Ionicons name="arrow-redo-outline" size={18} color={Colors.textSecondary} />
                    </View>
                  </View>
                </ScrollView>
              </View>

            </View>
          </View>
        </Modal>
      )}
      {/* ── DELETE DRAFT CONFIRMATION MODAL ── */}
      <Modal
        visible={!!draftToDelete}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDraftToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Draft</Text>
              <TouchableOpacity onPress={() => setDraftToDelete(null)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: Spacing.lg }}>
              <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md }}>
                  <Ionicons name="trash-outline" size={32} color="#DC2626" />
                </View>
                <Text style={{ fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
                  Are you sure you want to delete this draft?
                </Text>
                <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' }}>
                  This action cannot be undone. The draft will be permanently removed from your saved requests.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface }}
                  onPress={() => setDraftToDelete(null)}
                >
                  <Text style={{ fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.textPrimary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 6, backgroundColor: '#DC2626', alignItems: 'center' }}
                  onPress={executeDeleteDraft}
                >
                  <Text style={{ fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.surface }}>Yes, Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Modal */}
      {fullScreenImage && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 40, right: 30, zIndex: 10, padding: 10 }}
              onPress={() => setFullScreenImage(null)}
            >
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: fullScreenImage }}
              style={{ width: '90%', height: '90%' }}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
      <ComplianceResultModal
        visible={isComplianceModalVisible}
        onClose={() => setIsComplianceModalVisible(false)}
        score={complianceScore}
        status={complianceStatus}
        analysisLogic={complianceAnalysis}
      />

    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  // Dashboard Styles
  dashboardContainer: {
    gap: Spacing.lg,
  },
  dashboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  welcomeTitle: {
    fontSize: FontSize.xxl - 2,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  welcomeSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  createRequestBtnGold: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC72C',
    borderRadius: 4,
    paddingHorizontal: 16,
    height: 38,
  },
  createRequestBtnGoldText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderRadius: 6,
    gap: 4,
    shadowColor: 'transparent',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 20,
  },
  metricBadgeTextBlue: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#2563EB',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  metricLabel: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  tableCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  tableCardTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  tableHeaderArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 50,
  },
  tableHeaderActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  departmentDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  departmentDropdownText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    backgroundColor: Colors.background,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  tableHeaderActionBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderCell: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  tableCellText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },

  // Column Flex Multipliers
  flexTitle: { flex: 2 },
  flexDept: { flex: 2.2 },
  flexUser: { flex: 1.5 },
  flexDate: { flex: 1.2 },
  flexPlatforms: { flex: 1 },
  flexActions: { flex: 1.5 },

  cellContainer: {
    justifyContent: 'center',
  },
  thumbnailBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rowTitleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: FontWeight.medium,
    color: '#4B5563',
  },
  rowDeptText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#4B5563',
  },
  rowUserName: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  rowUserRole: {
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
  },
  rowDateText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  rowTimeText: {
    fontSize: FontSize.xs - 1,
    color: Colors.textMuted,
  },
  platformIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowActionsGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },

  cellFlex2: {
    flex: 2,
  },
  cellFlex1: {
    flex: 1,
  },
  alignRight: {
    textAlign: 'right',
  },
  titleCellContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  thumbnailPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postTitleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  postPlatformsText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  actionsCell: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tableFooterText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  paginationRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  pageIndexBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  pageIndexBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pageIndexBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  pageIndexBtnTextActive: {
    color: Colors.surface,
    fontWeight: 'bold',
  },

  // Form Container Styles
  formContainer: {
    gap: Spacing.md,
  },
  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
  },
  breadcrumbColumn: {
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  mainPageTitle: {
    fontSize: FontSize.xxl - 2,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  mainPageSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  draftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 16,
    height: 38,
    backgroundColor: Colors.surface,
  },
  draftButtonText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 16,
    height: 38,
    backgroundColor: '#FFC72C', // Changed to Gold
  },
  submitButtonText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary, // Changed to dark text for contrast on gold
    fontWeight: FontWeight.bold,
  },
  splitLayout: {
    gap: Spacing.lg,
  },
  rowLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  columnLayout: {
    flexDirection: 'column',
  },
  leftColumn: {
    flex: 1.5,
    gap: Spacing.lg,
  },
  rightColumn: {
    flex: 1,
    gap: Spacing.lg,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  configCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
    paddingBottom: Spacing.sm,
  },
  headerIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  fieldGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  textInput: {
    height: 38,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    backgroundColor: Colors.surface,
  },
  inlineFieldsRow: {
    gap: Spacing.md,
  },
  dropdownSelector: {
    height: 38,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  dropdownSelectorText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    padding: 12,
    fontSize: FontSize.sm,
    backgroundColor: Colors.surface,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  textAreaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  characterCounter: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  checkPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 4,
  },
  checkPolicyBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  uploadGridRow: {
    gap: Spacing.md,
  },
  uploadZone: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    gap: 8,
    minHeight: 120,
  },
  uploadZoneCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadZoneTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  uploadZoneSubtitle: {
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  configCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  platformsList: {
    gap: Spacing.sm,
  },
  platformRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  platformLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  platformIconBg: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformNameText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  checkboxOutline: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  inputIconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  textInputWithIcon: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingLeft: 12,
    paddingRight: 36,
    fontSize: FontSize.sm,
    backgroundColor: Colors.surface,
  },
  inputFieldIcon: {
    position: 'absolute',
    right: 12,
  },
  scheduleInfoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.surfaceSecondary,
    padding: Spacing.md,
    borderRadius: 6,
    marginTop: Spacing.xs,
    alignItems: 'flex-start',
  },
  scheduleInfoText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 16,
  },
  previewModeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  previewToggleBtn: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  previewToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  previewToggleText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  previewToggleTextActive: {
    color: Colors.surface,
    fontWeight: 'bold',
  },
  previewMockupFrame: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.sm,
  },
  mockPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  mockPostAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockPostAuthorName: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  mockPostMetaSubtext: {
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
  },
  mockPostContentArea: {
    padding: 12,
  },
  mockPostCaptionText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  mockPostMediaPlaceholder: {
    height: 180,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.md,
  },
  mockPostMediaPlaceholderText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  mockPostActionsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
    marginTop: 12,
  },
  mockActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Approval Queue Tab Styles
  queueCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  queueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  queueCardTitleCol: {
    gap: 4,
  },
  queuePostTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  queuePostMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    width: '100%',
    paddingHorizontal: 10,
  },
  stepWrapper: {
    alignItems: 'center',
    gap: 6,
    width: 60,
  },
  stepCircleBase: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepCircleCompleted: {
    backgroundColor: '#16A34A',
  },
  stepCircleActive: {
    backgroundColor: '#D97706',
  },
  stepCircleRevision: {
    backgroundColor: '#DC2626',
  },
  stepCircleUpcoming: {
    backgroundColor: Colors.border,
  },
  stepLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  stepLineBase: {
    flex: 1,
    height: 2,
    marginHorizontal: -15,
    alignSelf: 'center',
    zIndex: 1,
  },
  stepLineCompleted: {
    backgroundColor: '#16A34A',
  },
  stepLineUpcoming: {
    backgroundColor: Colors.border,
  },
  queueCardFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.background,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 260,
  },
  actionNoteText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  queueCardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  queueActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 28,
    backgroundColor: Colors.surface,
  },
  queueActionBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },

  // Old Modal styles
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalBody: {
    maxHeight: 300,
  },
  modalPostTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  modalPostMeta: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  detailsHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  detailsSection: {
    marginBottom: Spacing.sm,
    backgroundColor: '#F9FAFB',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailsLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  detailsText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  platformsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  platformBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  platformBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  mediaGallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaThumbnail: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mediaDocPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  mediaDocText: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  commentItem: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthor: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  commentContent: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    paddingLeft: 26,
  },
  noCommentsText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    alignItems: 'flex-end',
  },
  modalCloseBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    height: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: Colors.surface,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  profilePicUploadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
    marginBottom: 12,
  },
  profilePicLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePicLargeText: {
    color: Colors.surface,
    fontSize: 20,
    fontWeight: FontWeight.bold,
  },
  profilePicActionCol: {
    flex: 1,
    gap: 4,
  },
  profilePicTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  profilePicSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  profilePicButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  profilePicUploadBtn: {
    backgroundColor: '#FFC72C',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicUploadBtnText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  profilePicRemoveBtn: {
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicRemoveBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 220,
    marginTop: 20,
    paddingRight: 10,
    alignItems: 'stretch',
  },
  chartYAxis: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: 30,
    paddingBottom: 22,
    paddingRight: 6,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  chartAxisLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: FontWeight.bold,
  },
  chartPlotArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingLeft: 10,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  chartBarBackground: {
    width: 32,
    height: '100%',
    backgroundColor: Colors.background,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  chartBarTooltip: {
    color: Colors.surface,
    fontSize: 8,
    fontWeight: 'bold',
  },
  analyticsPlatformCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 12,
    gap: 10,
    backgroundColor: Colors.surface,
    marginBottom: 10,
  },
  platformProgressSubtext: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  progressBarWrapper: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  analyticsFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
  },
  // Policy Dashboard Styles
  policySidebar: {
    width: 220,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.md,
    gap: Spacing.xs,
    alignSelf: 'flex-start',
  },
  policySidebarTitle: {
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  policySidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    gap: 8,
  },
  policySidebarLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  policyDetailCol: {
    flex: 1,
    gap: Spacing.lg,
  },
  policySectionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  policyBulletsList: {
    gap: 12,
  },
  policyBulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  policyBulletTextCol: {
    flex: 1,
  },
  policyBulletTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  policyBulletDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  policyCardBodyText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,

  },
  policyFlowTimeline: {
    marginTop: 6,
    gap: 0,
  },
  policyFlowItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 64,
  },
  policyFlowLeft: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  policyFlowDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  policyFlowDotText: {
    color: Colors.surface,
    fontSize: 9,
    fontWeight: 'bold',
  },
  policyFlowLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    zIndex: 1,
    marginVertical: 2,
  },
  policyFlowContent: {
    flex: 1,
    paddingBottom: 16,
  },
  policyFlowTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  policyFlowDesc: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  policyContactText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semiBold,
    fontStyle: 'italic',
  },
  policyEmptyState: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  titleSection: {
    marginBottom: Spacing.xl,
  },
  bulletPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Modal Overlay & Container
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '90%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  modalHeaderTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalCloseIconBtn: {
    padding: 4,
  },
  modalBodyScroll: {
    maxHeight: 520,
  },
  modalBodyContent: {
    padding: Spacing.lg,
  },

  // (Duplicated Layout Splits removed)

  modalSplitRow: {
    gap: Spacing.xl,
  },
  modalLeftColumn: {
    flex: 1.2,
  },
  modalRightColumn: {
    flex: 1,
    gap: 10,
  },

  // Social Media Mockup
  modalPlatformTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  modalPlatformTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  modalPlatformTabActive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  modalPlatformTabText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  modalPlatformTabTextActive: {
    color: '#B45309',
    fontWeight: FontWeight.bold,
  },

  socialMockupCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  socialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  socialAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialAuthorName: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  socialTimeText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  socialCaptionText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: 12,
  },
  socialMediaBanner: {
    width: '100%',
    maxHeight: 400,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  socialMediaBannerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.surface,
    textAlign: 'center',
    letterSpacing: 1,
  },
  socialFooterActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.background,
    paddingTop: 8,
    justifyContent: 'space-around',
  },
  socialActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialActionText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // Right Details Column
  metaRow: {
    marginBottom: 6,
  },
  metaRowGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaTitleVal: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  metaVal: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
  },
  deptBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deptBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#B45309',
  },
  metaDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  metaCaptionBox: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 18,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.background,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    padding: 10,
    marginTop: 4,
  },
  attachmentThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentName: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#1E293B',
  },
  attachmentSize: {
    fontSize: 10,
    color: '#64748B',
  },

  // Modal Footer
  modalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
    backgroundColor: '#FAFAFA',
  },
  btnModalClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: Colors.surface,
  },
  btnModalCloseText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
});
