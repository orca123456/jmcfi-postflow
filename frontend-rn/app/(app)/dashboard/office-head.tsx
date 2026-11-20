import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import { PaginationControl } from '../../../components/ui/PaginationControl';
import { signalPostflowReady } from '../../../utils/postflowReady';
import { Card } from '../../../components/ui/Card';
import { dashboardStyles, dashboardUi, DashboardUiPolish, useDashboardLayout } from '../../../components/ui/dashboardDesign';
import { FormattedText } from '../../../components/ui/FormattedText';
import { useAuthStore } from '../../../store/auth';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';
import { usePolicyStore } from '../../../store/policy';
import { PolicyRulesView } from '../../../components/ui/PolicyRulesView';
import { postsApi, dashboardApi, authApi, resolveImageUrl } from '../../../services/api';
import { ProfilePictureCropperModal } from '../../../components/ui/ProfilePictureCropperModal';
import { FacebookMediaGrid, getImageUrisFromMedia } from '../../../components/social/FacebookMediaGrid';
import { InstagramMediaCarousel } from '../../../components/social/InstagramMediaCarousel';
import { ApprovalSuccessModal } from '../../../components/ui/ApprovalSuccessModal';
import { RejectSuccessModal } from '../../../components/ui/RejectSuccessModal';
import { DepartmentCell } from '../../../utils/departmentFormatter';

export default function OfficeHeadDashboard() {
  const router = useRouter();
  const { width, onLayout, isNarrow, isCompact, isWide } = useDashboardLayout();
  const { user } = useAuthStore();

  const { policySections, effectiveDate, lastUpdatedDate, fetchPolicy } = usePolicyStore();

  useEffect(() => {
    fetchPolicy();
  }, []);



  // Tab State: 'dashboard' | 'approved' | 'rejected' | 'policy-rules'
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState((params.tab === 'total' ? 'dashboard' : params.tab) || 'dashboard');

  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab === 'total' ? 'dashboard' : params.tab as string);
    }
  }, [params.tab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.setParams({ tab });
  };

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');

  const [postsPage, setPostsPage] = useState(1);
  const [postsPerPage, setPostsPerPage] = useState(10);
  const [departmentOptions, setDepartmentOptions] = useState(['All Departments']);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

  useEffect(() => {
    setPostsPage(1);
  }, [searchQuery, selectedDepartment, activeTab]);

  const [dateFilter, setDateFilter] = useState<'All Time' | 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Range'>('All Time');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Policy Search State
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Modal / Selected Request Preview State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [modalPlatformTab, setModalPlatformTab] = useState<'facebook' | 'instagram' | 'website'>('facebook');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [approvalSuccessPost, setApprovalSuccessPost] = useState<any | null>(null);
  const [rejectSuccessPost, setRejectSuccessPost] = useState<any | null>(null);

  const [optimisticallyRemovedIds, setOptimisticallyRemovedIds] = useState<string[]>([]);

  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [requestToReject, setRequestToReject] = useState<any | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<any[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });

  const { data: initDataRes, refetch: refetchInitData, isLoading: isInitLoading } = useQuery({
    queryKey: ['oh-dashboard-data'],
    queryFn: dashboardApi.getInitData,
    staleTime: 5000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const isInitialLoading = isInitLoading;


  // Signal the HTML loading shell to fade out into real content
  useEffect(() => {
    signalPostflowReady();
  }, []);

  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropperModalVisible, setCropperModalVisible] = useState(false);
  const [cropImageUri, setCropImageUri] = useState<string | null>(null);
  const [acctFullName, setAcctFullName] = useState('');
  const [acctCurrentPw, setAcctCurrentPw] = useState('');
  const [acctNewPw, setAcctNewPw] = useState('');
  const [acctConfirmPw, setAcctConfirmPw] = useState('');
  const [savingAcct, setSavingAcct] = useState(false);

  useEffect(() => {
    if (user) {
      setAcctFullName(`${user.first_name || ''} ${user.last_name || ''}`.trim());
      setProfilePhotoUrl(resolveImageUrl(user.photo_url));
    }
  }, [user?.id, user?.photo_url]);

  const handleUploadPhoto = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setCropImageUri(event.target.result as string);
            setCropperModalVisible(true);
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  };

  const handleSaveCroppedPhoto = async (croppedFile: File, previewUrl: string) => {
    setProfilePhotoUrl(previewUrl);
    setUploadingPhoto(true);
    try {
      const res = await authApi.uploadPhoto(croppedFile);
      const updatedUser = res.data?.user;
      const rawPhotoUrl = res.data?.photo_url || updatedUser?.photo_url || null;
      const nextPhotoUrl = resolveImageUrl(rawPhotoUrl) || previewUrl;
      setProfilePhotoUrl(nextPhotoUrl);
      if (user) {
        await useAuthStore.getState().setUser({
          ...user,
          ...(updatedUser || {}),
          role: updatedUser?.roles && updatedUser.roles.length > 0 ? updatedUser.roles[0] : (updatedUser?.role || user.role),
          photo_url: rawPhotoUrl || nextPhotoUrl || undefined,
        });
      }
    } catch {
      alert('Upload failed.');
    } finally {
      setUploadingPhoto(false);
    }
  };
  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    try {
      await authApi.removePhoto();
      setProfilePhotoUrl(null);
      if (user) {
        await useAuthStore.getState().setUser({ ...user, photo_url: undefined });
      }
    } catch {
      alert('Remove failed.');
    } finally {
      setUploadingPhoto(false);
    }
  };
  const handleSaveProfile = async () => {
    if (!acctFullName) { alert('Full name required.'); return; }
    const parts = acctFullName.split(' ');
    const first_name = parts[0];
    const last_name = parts.slice(1).join(' ');
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
    setSavingAcct(true);
    try { await authApi.changePassword(acctCurrentPw, acctNewPw, acctConfirmPw); alert('Password changed!'); setAcctCurrentPw(''); setAcctNewPw(''); setAcctConfirmPw(''); }
    catch { } finally { setSavingAcct(false); }
  };

  useEffect(() => {
    if (requestsList.length === 0) {
      loadData(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (initDataRes?.data) {
      const data = initDataRes.data;
      if (data.posts) {
        let posts = data.posts;
        if (posts && !Array.isArray(posts) && posts.data) {
          posts = posts.data;
        }

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
            category: (p.other_category_name && ['other', 'others'].includes(String(p.category?.name || p.category || '').toLowerCase()))
              ? p.other_category_name
              : (p.other_category_name || p.category?.name || (typeof p.category === 'string' ? p.category : 'Category')),
            other_category_name: p.other_category_name || null,
            preferred_schedule_at: p.preferred_schedule_at || null,
            dept: p.requestor?.department || 'Department',
            requestedBy: p.requestor?.full_name || 'Unknown',
            requestedByRole: 'Requestor',
            date: new Date(p.created_at).toLocaleDateString(),
            time: new Date(p.created_at).toLocaleTimeString(),
            rawDate: new Date(p.created_at),
            platforms: p.target_platforms || [],
            caption: p.caption_narrative || '',
            previewBanner: (p.title || '').toUpperCase(),
            attachment: p.media && p.media.length > 0 ? p.media[0].original_filename : 'No Attachment',
            attachmentSize: p.media && p.media.length > 0 ? p.media[0].size + 'B' : '',
            thumbnailUrl: Array.isArray(p.media) && p.media.length > 0
              ? (() => {
                const getUrl = (m: any) => m?.url || m?.file_url || m?.file_path || null;
                const featured = p.media.find((m: any) => m?.is_featured && getUrl(m));
                if (featured) return getUrl(featured);
                const imageMedia = p.media.find((m: any) => (m?.type === 'image' || String(m?.mime_type || '').startsWith('image/')) && getUrl(m));
                if (imageMedia) return getUrl(imageMedia);
                return getUrl(p.media[0]);
              })()
              : null,
            status: p.status ? p.status.toUpperCase() : 'UNKNOWN',
            rejectionReason: p.rejection_reason || '',
            rejectedBy,
          };
        };

        const mapped = posts.map(mapPost);

        let pendingStatuses: string[] = [];
        let approvedStatuses: string[] = [];

        const rawRole = ((user as any)?.roles && (user as any).roles[0]) || user?.role;
        const department = (user?.department || '').toLowerCase();
        const isVicePresident = rawRole === 'vice_president' || department.includes('vice president');
        const isImcQa = rawRole === 'imc_qa_checker' ||
          department.includes('integrated marketing') ||
          department.includes('institutional marketing') ||
          department.includes('marketing communication') ||
          department.includes('imc');

        if (isVicePresident) {
          pendingStatuses = ['PENDING_VICE_PRESIDENT'];
          approvedStatuses = ['PENDING_IMC_QA', 'APPROVED', 'SCHEDULED', 'PUBLISHED'];
        } else if (isImcQa) {
          pendingStatuses = ['PENDING_IMC_QA'];
          approvedStatuses = ['APPROVED', 'SCHEDULED', 'PUBLISHED'];
        } else {
          pendingStatuses = ['PENDING_OFFICE_HEAD'];
          approvedStatuses = ['PENDING_VICE_PRESIDENT', 'PENDING_IMC_QA', 'APPROVED', 'SCHEDULED', 'PUBLISHED'];
        }

        const isDirectImc = (p: any) =>
          String(p.routing_type || p.rawPost?.routing_type || '').toLowerCase() === 'direct_imc' ||
          String(p.category?.name || p.category || '').toLowerCase() === 'direct to imc' ||
          String(p.other_category_name || '').toLowerCase() === 'direct to imc';

        // Requests submitted Direct to IMC are exclusively for IMC and must never show in Department Head approver dashboard
        const filteredMapped = mapped.filter((p: any) => !isDirectImc(p));

        const pending = filteredMapped.filter((p: any) => pendingStatuses.includes(p.status) && !optimisticallyRemovedIds.includes(p.id));
        setRequestsList(pending);
        setApprovedRequests(filteredMapped.filter((p: any) => approvedStatuses.includes(p.status)));
        setRejectedRequests(filteredMapped.filter((p: any) => p.status === 'REJECTED' || p.status === 'RETURNED_FOR_REVISION'));
      }

      const statsData = data.stats || {};
      setStats(statsData);

      const depts = data.departments || [];
      setDepartmentOptions(['All Departments', ...depts]);
    }
  }, [initDataRes, user?.department, optimisticallyRemovedIds]);

  const handleOpenPostById = useCallback((postId: string | number) => {
    const postIdStr = String(postId);
    const allPosts = [...requestsList, ...approvedRequests, ...rejectedRequests];
    const match = allPosts.find((r: any) => String(r.id) === postIdStr);
    if (match) {
      setSelectedRequest(match);
      router.setParams({ postId: postIdStr });
    } else {
      postsApi.get(Number(postIdStr)).then((res: any) => {
        const raw = res?.data?.data || res?.data;
        if (raw) {
          const isDirect =
            String(raw.routing_type || raw.rawPost?.routing_type || '').toLowerCase() === 'direct_imc' ||
            String(raw.category?.name || raw.category || '').toLowerCase() === 'direct to imc' ||
            String(raw.other_category_name || '').toLowerCase() === 'direct to imc';
          if (isDirect) {
            alert('This post was submitted Direct to IMC and is handled exclusively by IMC.');
            return;
          }
          let rejectedBy = '';
          if ((raw.status === 'rejected' || raw.status === 'returned_for_revision') && raw.approval_workflows && Array.isArray(raw.approval_workflows)) {
            const rejectionLog = raw.approval_workflows.find((w: any) => w.action === 'rejected' || w.action === 'returned_for_revision');
            if (rejectionLog && rejectionLog.approver) {
              rejectedBy = `${rejectionLog.approver.full_name}`;
            }
          }
          setSelectedRequest({
            ...raw,
            id: raw.id.toString(),
            title: raw.title || 'Untitled',
            category: (raw.other_category_name && ['other', 'others'].includes(String(raw.category?.name || raw.category || '').toLowerCase()))
              ? raw.other_category_name
              : (raw.other_category_name || raw.category?.name || (typeof raw.category === 'string' ? raw.category : 'Category')),
            other_category_name: raw.other_category_name || null,
            preferred_schedule_at: raw.preferred_schedule_at || null,
            dept: raw.requestor?.department || 'Department',
            requestedBy: raw.requestor?.full_name || 'Unknown',
            requestedByRole: 'Requestor',
            date: new Date(raw.created_at).toLocaleDateString(),
            time: new Date(raw.created_at).toLocaleTimeString(),
            rawDate: new Date(raw.created_at),
            platforms: raw.target_platforms || [],
            caption: raw.caption_narrative || '',
            previewBanner: (raw.title || '').toUpperCase(),
            attachment: raw.media && raw.media.length > 0 ? raw.media[0].original_filename : 'No Attachment',
            attachmentSize: raw.media && raw.media.length > 0 ? raw.media[0].size + 'B' : '',
            thumbnailUrl: Array.isArray(raw.media) && raw.media.length > 0 ? (raw.media[0].url || raw.media[0].file_url || raw.media[0].file_path || null) : null,
            status: raw.status ? raw.status.toUpperCase() : 'UNKNOWN',
            rejectionReason: raw.rejection_reason || '',
            rejectedBy,
          });
          router.setParams({ postId: postIdStr });
        }
      }).catch(() => { });
    }
  }, [requestsList, approvedRequests, rejectedRequests]);

  useEffect(() => {
    if (params.postId && !selectedRequest) {
      handleOpenPostById(params.postId as string);
    }
  }, [params.postId, requestsList.length, approvedRequests.length, rejectedRequests.length]);

  const loadData = (showLoading = true) => {
    refetchInitData();
  };


  const handleApprove = async (req: any) => {
    setModalError(null);
    const reqId = req.id;
    const reqTitle = req.title;

    // Instant optimistic UI update (0ms delay)
    setRequestsList(prev => prev.filter(r => r.id !== reqId));
    setOptimisticallyRemovedIds(prev => [...prev, reqId]);
    setApprovedRequests(prev => [{ ...req, status: 'APPROVED' }, ...prev]);
    setSelectedRequest(null);

    try {
      await postsApi.approve(reqId, {});
      loadData(false);
      setApprovalSuccessPost(req);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve request.');
      loadData(false);
    }
  };

  const handleRejectClick = (req: any) => {
    setRequestToReject(req);
    setRejectComment('');
    setIsRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectComment.trim()) {
      alert('Please provide a reason for rejecting the request.');
      return;
    }
    setModalError(null);

    const reqTitle = requestToReject?.title;
    const reqId = requestToReject?.id;
    const reason = rejectComment;
    const rejectedReq = requestToReject;

    // Instant optimistic UI update
    setRequestsList(prev => prev.filter(r => r.id !== reqId));
    setOptimisticallyRemovedIds(prev => [...prev, reqId]);
    if (rejectedReq) setRejectedRequests(prev => [{ ...rejectedReq, status: 'REJECTED' }, ...prev]);
    setIsRejectModalVisible(false);
    setRequestToReject(null);
    setSelectedRequest(null);

    try {
      await postsApi.reject(reqId, { reason });
      loadData(false);
      setRejectSuccessPost({ title: reqTitle, role: 'office_head' });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject request.');
      loadData(false);
    }
  };

  const getRequestsForTab = () => {
    if (activeTab === 'approved') return approvedRequests;
    if (activeTab === 'rejected') return rejectedRequests;
    if (activeTab === 'all') return [...requestsList, ...approvedRequests, ...rejectedRequests];
    return requestsList;
  };

  const filteredRequests = getRequestsForTab().filter((req) => {
    const matchesDept =
      selectedDepartment === 'All Departments' || req.dept === selectedDepartment;
    const matchesSearch =
      searchQuery === '' ||
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.requestedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.category.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (dateFilter !== 'All Time') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const postDate = new Date(req.rawDate);
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
          matchesDate = req.rawDate >= start && req.rawDate <= new Date(end.getTime() + 86400000);
        }
      }
    }

    return matchesDept && matchesSearch && matchesDate;
  });

  const paginatedRequests = filteredRequests.slice((postsPage - 1) * postsPerPage, postsPage * postsPerPage);

  const computedStats = React.useMemo(() => ({
    pending: requestsList.length,
    approved: approvedRequests.length,
    rejected: rejectedRequests.length,
    total: requestsList.length + approvedRequests.length + rejectedRequests.length
  }), [requestsList, approvedRequests, rejectedRequests]);

  const isLargeScreen = isWide;
  const isTablet = !isCompact;
  const viewerRawRole = ((user as any)?.roles && (user as any).roles[0]) || user?.role;
  const viewerDepartment = (user?.department || '').toLowerCase();
  const viewerIsVicePresident = viewerRawRole === 'vice_president' || viewerDepartment.includes('vice president');
  const viewerIsImcQa = viewerRawRole === 'imc_qa_checker' ||
    viewerDepartment.includes('integrated marketing') ||
    viewerDepartment.includes('institutional marketing') ||
    viewerDepartment.includes('marketing communication') ||
    viewerDepartment.includes('imc');

  let userPosition = 'Department Head';
  if (viewerIsVicePresident) {
    userPosition = 'Vice President';
  } else if (viewerIsImcQa) {
    userPosition = 'QA / Branding Checker';
  } else if (user?.position && user.position.toLowerCase() !== 'requestor' && user.position.toLowerCase() !== 'approver') {
    userPosition = user.position;
  }

  const greetingUserName = user?.name || user?.full_name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '') || userPosition;

  const isPendingStatus = (status: string) => {
    if (viewerIsVicePresident) return status === 'PENDING_VICE_PRESIDENT';
    if (viewerIsImcQa) return status === 'PENDING_IMC_QA';
    return status === 'PENDING_OFFICE_HEAD';
  };

  const isApprovedStatus = (status: string) => {
    return ['PENDING_VICE_PRESIDENT', 'PENDING_IMC_QA', 'APPROVED', 'SCHEDULED', 'PUBLISHED'].includes(status) && !isPendingStatus(status);
  };

  const renderActionBadge = (req: any) => {
    if (activeTab === 'dashboard' || (activeTab === 'all' && isPendingStatus(req.status))) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'nowrap' }}>
          <TouchableOpacity
            style={styles.btnApproveRow}
            accessibilityRole="button"
            accessibilityLabel={`Approve ${req.title}`}
            onPress={() => handleApprove(req)}
            activeOpacity={0.82}
          >
            <Ionicons name="checkmark-sharp" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.btnApproveRowText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnRejectRow}
            accessibilityRole="button"
            accessibilityLabel={`Reject ${req.title}`}
            onPress={() => handleRejectClick(req)}
            activeOpacity={0.82}
          >
            <Ionicons name="close-sharp" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.btnRejectRowText}>Reject</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (req.status === 'REJECTED' || activeTab === 'rejected') {
      return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={styles.badgePillRejected}>
            <Ionicons name="close-sharp" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.badgePillText}>Rejected</Text>
          </View>
        </View>
      );
    }

    if (req.status === 'RETURNED_FOR_REVISION') {
      return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={styles.badgePillRevision}>
            <Ionicons name="reload-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.badgePillText}>Revision</Text>
          </View>
        </View>
      );
    }

    if (isApprovedStatus(req.status) || activeTab === 'approved') {
      return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={styles.badgePillApproved}>
            <Ionicons name="checkmark-sharp" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.badgePillText}>Approved</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={styles.badgePillPending}>
          <Ionicons name="time-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.badgePillText}>
            {req.status ? req.status.replace(/_/g, ' ') : 'Pending'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <DashboardShell
      title={`Content Reviewer Console — ${userPosition}`}
      activeTab={activeTab as string}
      onTabChange={handleTabChange}
      assignedProgram={(user as any)?.assigned_program || (user as any)?.program_head?.program_name}
      backgroundImage={require('../../../assets/images/jmcbg2.jpeg')}
      userPhotoUrl={profilePhotoUrl}
      onOpenPost={handleOpenPostById}
    >
      <View nativeID="office-head-workspace" onLayout={onLayout} style={styles.workspace}>
        <DashboardUiPolish rootId="office-head-workspace" />
        {/* ----------------- DASHBOARD / APPROVED / REJECTED TAB ----------------- */}
        {(activeTab === 'dashboard' || activeTab === 'approved' || activeTab === 'rejected' || activeTab === 'all') && (
          <View style={styles.dashboardContainer}>
            {/* Header Row with Greeting */}
            {activeTab === 'dashboard' && (
              <View style={[styles.dashboardHeaderRow, !isTablet && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={styles.headerCopy}>
                  <Text accessibilityRole="header" style={[styles.greetingTitle, isNarrow && styles.pageTitleMobile]}>Welcome, {greetingUserName}! 👋</Text>
                  <Text style={styles.greetingSubtitle}>
                    Overview of departmental content submissions, approvals, and quality clearance queues.
                  </Text>
                </View>
              </View>
            )}

            {/* Metric Summary Cards Row (2x2 on Mobile, 4x1 on Tablet/Desktop) */}
            {['dashboard', 'approved', 'rejected', 'all'].includes(activeTab) && (
              <View style={styles.metricsGrid}>
                {/* Card 1: Pending Sign-off */}
                <TouchableOpacity
                  style={[styles.metricCardWrapper, isNarrow ? styles.metricCardNarrow : isCompact ? styles.metricCardCompact : styles.metricCardWide]}
                  onPress={() => handleTabChange('dashboard')}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.metricCard, activeTab === 'dashboard' && { borderColor: dashboardUi.purple }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBg, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="document-text" size={20} color="#D97706" />
                      </View>
                    </View>
                    <Text style={styles.metricLabel}>Pending Sign-off</Text>
                    <Text style={styles.metricCount}>{computedStats.pending}</Text>
                    <Text style={styles.metricSubtext}>Requests awaiting your approval</Text>
                  </Card>
                </TouchableOpacity>

                {/* Card 2: Approved */}
                <TouchableOpacity
                  style={[styles.metricCardWrapper, isNarrow ? styles.metricCardNarrow : isCompact ? styles.metricCardCompact : styles.metricCardWide]}
                  onPress={() => handleTabChange('approved')}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.metricCard, activeTab === 'approved' && { borderColor: dashboardUi.purple }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBg, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark-circle" size={20} color="#047857" />
                      </View>
                    </View>
                    <Text style={styles.metricLabel}>Approved</Text>
                    <Text style={styles.metricCount}>{computedStats.approved}</Text>
                    <Text style={styles.metricSubtext}>Departmental requests approved</Text>
                  </Card>
                </TouchableOpacity>

                {/* Card 3: Rejected */}
                <TouchableOpacity
                  style={[styles.metricCardWrapper, isNarrow ? styles.metricCardNarrow : isCompact ? styles.metricCardCompact : styles.metricCardWide]}
                  onPress={() => handleTabChange('rejected')}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.metricCard, activeTab === 'rejected' && { borderColor: dashboardUi.purple }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBg, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name="close-circle" size={20} color="#B91C1C" />
                      </View>
                    </View>
                    <Text style={styles.metricLabel}>Rejected</Text>
                    <Text style={styles.metricCount}>{computedStats.rejected}</Text>
                    <Text style={styles.metricSubtext}>Requests rejected</Text>
                  </Card>
                </TouchableOpacity>

                {/* Card 4: Total Requests */}
                <TouchableOpacity
                  style={[styles.metricCardWrapper, isNarrow ? styles.metricCardNarrow : isCompact ? styles.metricCardCompact : styles.metricCardWide]}
                  onPress={() => handleTabChange('all')}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.metricCard, activeTab === 'all' && { borderColor: dashboardUi.purple }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBg, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="arrow-forward-circle" size={20} color="#1E40AF" />
                      </View>
                    </View>
                    <Text style={styles.metricLabel}>Total Requests</Text>
                    <Text style={styles.metricCount}>{computedStats.total}</Text>
                    <Text style={styles.metricSubtext}>All requests</Text>
                  </Card>
                </TouchableOpacity>
              </View>
            )}

            {/* Main Content Card: Requests List */}
            <Card style={[styles.tableCard, isNarrow && { padding: Spacing.md }]}>
              {/* Table Control Header */}
              <View style={[styles.tableCardHeaderRow, !isTablet && { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
                <Text accessibilityRole="header" style={styles.tableTitle}>
                  {activeTab === 'dashboard'
                    ? 'Pending Departmental Requests'
                    : activeTab === 'approved'
                      ? 'Approved Requests'
                      : activeTab === 'rejected'
                        ? 'Rejected Requests'
                        : 'All Departmental Submissions'}
                </Text>

                <View style={[styles.tableControlsRight, { width: isCompact ? '100%' : undefined, alignItems: isCompact ? 'stretch' : 'center', zIndex: 100 }]}>
                  {/* Filters Row: Date Filter + Department Filter */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, zIndex: 100, minWidth: 0, width: isCompact ? '100%' : undefined }}>
                    {/* Date Range Dropdown Selector */}
                    <View style={{ position: 'relative', zIndex: isDateDropdownOpen ? 60 : 40, flex: isTablet ? undefined : 1 }}>
                      <TouchableOpacity
                        style={[styles.departmentDropdown, { minHeight: dashboardUi.controlHeight, paddingVertical: Spacing.sm, minWidth: 120, justifyContent: 'space-between' }]}
                        onPress={() => {
                          setIsDateDropdownOpen(!isDateDropdownOpen);
                          setIsDeptDropdownOpen(false);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                          <Text style={styles.departmentDropdownText}>{dateFilter}</Text>
                        </View>
                        <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                      </TouchableOpacity>

                      {isDateDropdownOpen && (
                        <View style={[styles.dropdownMenu, { left: 0, right: 'auto', minWidth: 200 }]}>
                          {['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range'].map((opt: any) => (
                            <TouchableOpacity
                              key={opt}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setDateFilter(opt);
                                if (opt !== 'Custom Range') setIsDateDropdownOpen(false);
                              }}
                            >
                              <Text style={[styles.dropdownItemText, dateFilter === opt && { fontWeight: 'bold', color: dashboardUi.purple }]}>{opt}</Text>
                            </TouchableOpacity>
                          ))}

                          {dateFilter === 'Custom Range' && (
                            <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
                              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>Start Date</Text>
                              <input aria-label="Start Date" type="date" style={{ height: dashboardUi.controlHeight, fontSize: 13, borderRadius: 6, border: `1px solid ${Colors.border}`, paddingLeft: 8, paddingRight: 8, outline: 'none', backgroundColor: Colors.surface, color: Colors.textPrimary, width: '100%', marginBottom: 8 }} value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>End Date</Text>
                              <input aria-label="End Date" type="date" style={{ height: dashboardUi.controlHeight, fontSize: 13, borderRadius: 6, border: `1px solid ${Colors.border}`, paddingLeft: 8, paddingRight: 8, outline: 'none', backgroundColor: Colors.surface, color: Colors.textPrimary, width: '100%', marginBottom: 8 }} value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                              <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => setIsDateDropdownOpen(false)}
                              >
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Apply</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Department Dropdown - Only show for VP and IMC who can see multiple departments */}
                    {(viewerIsVicePresident || viewerIsImcQa) && (
                      <View style={{ position: 'relative', zIndex: isDeptDropdownOpen ? 60 : 50, flex: isTablet ? undefined : 1 }}>
                        <TouchableOpacity
                          style={[styles.departmentDropdown, { minHeight: dashboardUi.controlHeight, paddingVertical: Spacing.sm, justifyContent: 'space-between' }]}
                          onPress={() => {
                            setIsDeptDropdownOpen(!isDeptDropdownOpen);
                            setIsDateDropdownOpen(false);
                          }}
                        >
                          <Text style={styles.departmentDropdownText} numberOfLines={1}>{selectedDepartment}</Text>
                          <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        {isDeptDropdownOpen && (
                          <ScrollView style={[styles.dropdownMenu, { right: 0, left: 'auto', minWidth: 200, maxHeight: 300 }]} nestedScrollEnabled>
                            {departmentOptions.map((deptOption) => (
                              <TouchableOpacity
                                key={deptOption}
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setSelectedDepartment(deptOption);
                                  setIsDeptDropdownOpen(false);
                                }}
                              >
                                <Text style={styles.dropdownItemText}>{deptOption}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Search Bar */}
                  <View {...(Platform.OS === 'web' ? { dataSet: { dashboardField: 'true' } } as any : {})} style={[styles.searchBox, { width: isCompact ? '100%' : 232 }]}>
                    <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                    <TextInput
                      style={styles.searchInput}
                      accessibilityLabel="Search requests"
                      placeholder="Search requests..."
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>
                </View>
              </View>

              {/* Requests Table */}
              <ScrollView horizontal showsHorizontalScrollIndicator style={{ width: '100%', minWidth: 0 }} contentContainerStyle={{ minWidth: '100%' }}>
                <View style={[styles.table, { minWidth: dashboardUi.tableMinWidth }]}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, styles.flexTitle]}>Request title</Text>
                    <Text style={[styles.tableHeaderCell, styles.flexDept]}>Department</Text>
                    <Text style={[styles.tableHeaderCell, styles.flexUser]}>Requested by</Text>
                    <Text style={[styles.tableHeaderCell, styles.flexDate]}>Date</Text>
                    <Text style={[styles.tableHeaderCell, styles.flexPlatforms]}>Platform</Text>
                    <View style={[styles.flexActions, { alignItems: 'center', justifyContent: 'center', paddingRight: 0 }]}>
                      <Text style={[styles.tableHeaderCell, { paddingRight: 0, textAlign: 'center' }]}>Actions</Text>
                    </View>
                  </View>

                  {paginatedRequests.map((req) => (
                    <TouchableOpacity
                      key={req.id}
                      style={styles.tableRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedRequest(req);
                        setModalPlatformTab('facebook');
                      }}
                    >
                      {/* REQUEST TITLE + CATEGORY TAG */}
                      <View style={[styles.cellContainer, styles.flexTitle, { flexDirection: 'row', alignItems: 'center' }]}>
                        <View style={styles.thumbnailBox}>
                          {req.thumbnailUrl ? (
                            <Image source={{ uri: req.thumbnailUrl }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" />
                          ) : (
                            <Ionicons name="document-text-outline" size={20} color={Colors.textSecondary} />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitleText} numberOfLines={2}>{req.title}</Text>
                          <View style={styles.categoryPill}>
                            <Text style={styles.categoryPillText}>{req.category}</Text>
                          </View>
                        </View>
                      </View>

                      {/* DEPARTMENT */}
                      <View style={[styles.cellContainer, styles.flexDept]}>
                        <DepartmentCell department={req.dept} />
                      </View>

                      {/* REQUESTED BY */}
                      <View style={[styles.cellContainer, styles.flexUser]}>
                        <Text style={styles.rowUserName}>{req.requestedBy}</Text>
                        <Text style={styles.rowUserRole}>{req.requestedByRole}</Text>
                      </View>

                      {/* REQUESTED ON */}
                      <View style={[styles.cellContainer, styles.flexDate]}>
                        <Text style={styles.rowDateText}>{req.date}</Text>
                        <Text style={styles.rowTimeText}>{req.time}</Text>
                      </View>

                      {/* PLATFORMS */}
                      <View style={[styles.cellContainer, styles.flexPlatforms, { gap: 4, justifyContent: 'center' }]}>
                        {req.platforms.includes('facebook') && (
                          <View style={styles.platformRowItem}>
                            <Ionicons name="logo-facebook" size={14} color="#1877F2" />
                            <Text style={styles.platformRowLabel}>Facebook</Text>
                          </View>
                        )}
                        {req.platforms.includes('instagram') && (
                          <View style={styles.platformRowItem}>
                            <Ionicons name="logo-instagram" size={14} color="#E1306C" />
                            <Text style={styles.platformRowLabel}>Instagram</Text>
                          </View>
                        )}
                        {(req.platforms.includes('website') || req.platforms.includes('portal') || req.platforms.includes('wordpress')) && (
                          <View style={styles.platformRowItem}>
                            <Ionicons name="globe-outline" size={14} color="#059669" />
                            <Text style={styles.platformRowLabel}>Website</Text>
                          </View>
                        )}
                        {!req.platforms?.length && (
                          <Text style={{ fontSize: 13, color: '#94A3B8' }}>—</Text>
                        )}
                      </View>

                      {/* ACTIONS */}
                      <View style={[styles.flexActions, { alignItems: 'center', justifyContent: 'center', paddingRight: 0 }]}>
                        {renderActionBadge(req)}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View {...(Platform.OS === 'web' ? { dataSet: { dashboardPagination: 'true' } } as any : {})} style={{ minWidth: 0, width: '100%' }}>
                <PaginationControl
                  currentPage={postsPage}
                  totalItems={filteredRequests.length}
                  itemsPerPage={postsPerPage}
                  onPageChange={setPostsPage}
                  onItemsPerPageChange={setPostsPerPage}
                  itemName="requests"
                />
              </View>
            </Card>
          </View>
        )}

        {/* ----------------- POLICY RULES TAB ----------------- */}
        {activeTab === 'policy-rules' && (
          <PolicyRulesView accentColor={dashboardUi.purple} />
        )}

        {/* ----------------- ACCOUNT SETTINGS TAB ----------------- */}
        {activeTab === 'account-settings' && (
          <View style={styles.dashboardContainer}>
            <View style={styles.dashboardHeaderRow}>
              <View style={styles.headerCopy}>
                <Text style={[styles.greetingTitle, isNarrow && styles.pageTitleMobile]}>Account Settings</Text>
                <Text style={styles.greetingSubtitle}>
                  Manage your institutional profile picture, credentials, and settings.
                </Text>
              </View>
            </View>

            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              {/* Left settings card */}
              <View style={{ flex: 1.5, minWidth: 0 }}>
                <Card style={styles.tableCard}>
                  <View style={[styles.tableCardHeaderRow, { justifyContent: 'flex-start', gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.background, paddingBottom: 10, marginBottom: 12 }]}>
                    <Ionicons name="person-outline" size={18} color="#D97706" />
                    <Text style={styles.tableTitle}>Profile Information</Text>
                  </View>

                  {/* Profile Picture Upload Section */}
                  <View style={styles.profilePicUploadContainer}>
                    <View style={[styles.profilePicLarge, { backgroundColor: '#D97706', overflow: 'hidden' }]}>
                      {profilePhotoUrl ? (
                        <Image source={{ uri: resolveImageUrl(profilePhotoUrl) || profilePhotoUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} resizeMode="cover" />
                      ) : (
                        <Text style={styles.profilePicLargeText}>
                          {user?.first_name ? (user.first_name[0] + (user.last_name?.[0] || '')).toUpperCase() : 'OH'}
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
                    <TextInput accessibilityLabel="Full name" style={styles.textInput} value={acctFullName} onChangeText={setAcctFullName} />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                    <TextInput style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]} accessibilityLabel="Email address" value={user?.email ?? ''} editable={false} />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>DEPARTMENT / ROLE</Text>
                    <TextInput style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]} accessibilityLabel="Department or role" value={user?.department || ''} editable={false} />
                  </View>

                  <TouchableOpacity style={styles.primaryButton} onPress={handleSaveProfile} disabled={savingAcct}>
                    <Text style={styles.primaryButtonText}>{savingAcct ? 'Saving...' : 'Save Details'}</Text>
                  </TouchableOpacity>
                </Card>
              </View>

              {/* Right settings card */}
              <View style={{ flex: 1 }}>
                <Card style={styles.tableCard}>
                  <Text style={[styles.tableTitle, { marginBottom: 12 }]}>Update Password</Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>CURRENT PASSWORD</Text>
                    <TextInput style={styles.textInput} accessibilityLabel="Current password" secureTextEntry value={acctCurrentPw} onChangeText={setAcctCurrentPw} placeholder="Enter current password" />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                    <TextInput style={styles.textInput} accessibilityLabel="New password" secureTextEntry value={acctNewPw} onChangeText={setAcctNewPw} placeholder="Enter new password" />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                    <TextInput style={styles.textInput} accessibilityLabel="Confirm password" secureTextEntry value={acctConfirmPw} onChangeText={setAcctConfirmPw} placeholder="Confirm new password" />
                  </View>

                  <TouchableOpacity style={[styles.primaryButton, { marginTop: Spacing.md }]} onPress={handleChangePw} disabled={savingAcct}>
                    <Text style={styles.primaryButtonText}>{savingAcct ? 'Changing...' : 'Change Password'}</Text>
                  </TouchableOpacity>
                </Card>
              </View>
            </View>

            <ProfilePictureCropperModal
              visible={cropperModalVisible}
              imageUri={cropImageUri}
              onClose={() => {
                setCropperModalVisible(false);
                setCropImageUri(null);
              }}
              onSave={handleSaveCroppedPhoto}
            />
          </View>
        )}

        {/* ----------------- CONTENT REQUEST PREVIEW MODAL ----------------- */}
        {selectedRequest && (
          <Modal
            animationType="fade"
            transparent={true}
            visible={true}
            onRequestClose={() => {
              setSelectedRequest(null);
              router.setParams({ postId: '' });
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                {/* Modal Header */}
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalHeaderTitle}>Departmental Content Request Review</Text>
                  <TouchableOpacity
                    style={styles.modalCloseIconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Close dialog"
                    onPress={() => {
                      setSelectedRequest(null);
                      setModalError(null);
                      router.setParams({ postId: '' });
                    }}
                  >
                    <Ionicons name="close" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Error Banner */}
                {modalError && (
                  <View style={{ backgroundColor: '#FEE2E2', padding: 12, marginHorizontal: 24, marginTop: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="warning" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#B91C1C', fontSize: 14, fontWeight: '500', flex: 1 }}>{modalError}</Text>
                    <TouchableOpacity onPress={() => setModalError(null)}>
                      <Ionicons name="close" size={16} color="#B91C1C" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Modal Body Split */}
                <ScrollView style={styles.modalBodyScroll} contentContainerStyle={styles.modalBodyContent}>
                  {(selectedRequest.status === 'REJECTED' || selectedRequest.status === 'RETURNED_FOR_REVISION') && (
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#EF4444', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Rejected by: {selectedRequest.rejectedBy}</Text>
                        <Text style={{ fontSize: 15, color: '#EF4444', fontWeight: '500' }}>
                          {selectedRequest.rejectionReason || 'No reason provided.'}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={{ marginBottom: 16 }}>
                    <View style={{ backgroundColor: Colors.surface, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.textPrimary }}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 12 }}>Approval Tracking</Text>
                      {(() => {
                        const workflows = selectedRequest.approval_workflows || [];
                        const getStageStatus = (stageName: string) => {
                          const entry = workflows.find((w: any) => w.stage === stageName);
                          if (entry) {
                            if (entry.action === 'approved') return 'Approved';
                            if (entry.action === 'rejected' || entry.action === 'returned_for_revision') return 'Rejected';
                          }
                          return 'Pending';
                        };

                        let deptHead = getStageStatus('office_head');
                        let vpaa = getStageStatus('vice_president');
                        let imc = getStageStatus('imc_qa');

                        const isScheduled = selectedRequest.rawStatus === 'scheduled' ||
                          selectedRequest.status === 'SCHEDULED' ||
                          (Boolean(selectedRequest.preferred_schedule_at) &&
                            new Date(selectedRequest.preferred_schedule_at).getTime() > Date.now() &&
                            selectedRequest.status !== 'PUBLISHED');

                        if (deptHead === 'Rejected') { vpaa = 'Waiting'; imc = 'Waiting'; }
                        if (vpaa === 'Rejected') { imc = 'Waiting'; }
                        if (imc === 'Approved') {
                          imc = isScheduled ? 'Scheduled' : 'Published';
                        }

                        const getIcon = (state: string) => {
                          if (state === 'Rejected') return { name: 'close-circle', color: '#DC2626' };
                          if (state === 'Approved' || state === 'Published' || state === 'Scheduled') return { name: 'checkmark-circle', color: '#059669' };
                          return { name: 'time', color: Colors.textMuted };
                        };
                        const getColor = (state: string) => {
                          if (state === 'Rejected') return '#DC2626';
                          if (state === 'Approved' || state === 'Published' || state === 'Scheduled') return '#059669';
                          return Colors.textMuted;
                        };
                        const getLineColor = (state: string) => {
                          if (state === 'Approved' || state === 'Published' || state === 'Scheduled') return '#059669';
                          if (state === 'Rejected') return '#DC2626';
                          return Colors.border;
                        };

                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4 }}>

                            <View style={{ alignItems: 'center', flex: 1.2 }}>
                              <Ionicons name={getIcon(deptHead).name as any} color={getIcon(deptHead).color} size={22} />
                              <View style={{ minHeight: 38, justifyContent: 'center', alignItems: 'center', marginTop: 6, paddingHorizontal: 2 }}>
                                <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary }}>Dept Head</Text>
                              </View>
                              <Text style={{ fontSize: 10, color: getColor(deptHead), fontWeight: 'bold', textTransform: 'uppercase', marginTop: 4 }}>{deptHead}</Text>
                            </View>

                            <View style={{ height: 2, backgroundColor: getLineColor(deptHead), flex: 1, marginTop: 11, marginHorizontal: -4 }} />

                            <View style={{ alignItems: 'center', flex: 1.2 }}>
                              <Ionicons name={getIcon(vpaa).name as any} color={getIcon(vpaa).color} size={22} />
                              <View style={{ minHeight: 38, justifyContent: 'center', alignItems: 'center', marginTop: 6, paddingHorizontal: 2 }}>
                                <Text style={{ fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary }}>VPAA</Text>
                              </View>
                              <Text style={{ fontSize: 10, color: getColor(vpaa), fontWeight: 'bold', textTransform: 'uppercase', marginTop: 4 }}>{vpaa}</Text>
                            </View>

                            <View style={{ height: 2, backgroundColor: getLineColor(vpaa), flex: 1, marginTop: 11, marginHorizontal: -4 }} />

                            <View style={{ alignItems: 'center', flex: 1.2 }}>
                              <Ionicons name={getIcon(imc).name as any} color={getIcon(imc).color} size={22} />
                              <View style={{ minHeight: 38, justifyContent: 'center', alignItems: 'center', marginTop: 6, paddingHorizontal: 2 }}>
                                <Text style={{ fontSize: 10, textAlign: 'center', fontWeight: 'bold', color: Colors.textPrimary, lineHeight: 12 }}>Integrated Marketing Communications</Text>
                              </View>
                              <Text style={{ fontSize: 10, color: getColor(imc), fontWeight: 'bold', textTransform: 'uppercase', marginTop: 4 }}>{imc}</Text>
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
                      {(() => {
                        const rawList = selectedRequest?.media || selectedRequest?.rawPost?.media || [];
                        const validList = getImageUrisFromMedia(Array.isArray(rawList) ? rawList : []);
                        const requestMediaImages = validList.length > 0
                          ? validList
                          : (selectedRequest?.thumbnailUrl ? [resolveImageUrl(selectedRequest.thumbnailUrl) || selectedRequest.thumbnailUrl] : []);

                        return (
                          <>
                            {modalPlatformTab === 'facebook' && (
                              <View style={styles.socialMockupCard}>
                                <View style={styles.socialHeader}>
                                  <Image source={require('../../../assets/images/jmc_logo.png')} style={[styles.socialAvatar, { backgroundColor: Colors.surface }]} resizeMode="contain" />
                                  <View>
                                    <Text style={styles.socialAuthorName}>Jose Maria College Foundation Inc.</Text>
                                    <Text style={styles.socialTimeText}>Official Department Post &bull; Public</Text>
                                  </View>
                                </View>

                                <FormattedText style={styles.socialCaptionText}>{selectedRequest.caption}</FormattedText>

                                {requestMediaImages.length > 0 ? (
                                  <FacebookMediaGrid
                                    images={requestMediaImages}
                                    onImagePress={(uri) => setFullScreenImage(uri)}
                                  />
                                ) : (
                                  <View style={styles.socialMediaBanner}>
                                    <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.7)" style={{ marginBottom: 8 }} />
                                    <Text style={styles.socialMediaBannerText}>{selectedRequest.previewBanner}</Text>
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

                                {requestMediaImages.length > 0 ? (
                                  <InstagramMediaCarousel
                                    images={requestMediaImages}
                                    onImagePress={(uri) => setFullScreenImage(uri)}
                                  />
                                ) : (
                                  <View style={[styles.socialMediaBanner, { height: 320, borderRadius: 0 }]}>
                                    <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.7)" style={{ marginBottom: 8 }} />
                                    <Text style={styles.socialMediaBannerText}>{selectedRequest.previewBanner}</Text>
                                  </View>
                                )}

                                <View style={{ padding: 12 }}>
                                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                                    <Ionicons name="heart-outline" size={22} color={Colors.textPrimary} />
                                    <Ionicons name="chatbubble-outline" size={20} color={Colors.textPrimary} style={{ transform: [{ scaleX: -1 }] }} />
                                    <Ionicons name="paper-plane-outline" size={20} color={Colors.textPrimary} />
                                  </View>
                                  <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: Colors.textPrimary }}>1,234 likes</Text>
                                  <FormattedText style={styles.socialCaptionText}>{'<b>jmcfi_cite </b>' + (selectedRequest.caption || '')}</FormattedText>
                                </View>
                              </View>
                            )}

                            {modalPlatformTab === 'website' && (
                              <View style={[styles.socialMockupCard, { padding: 0, overflow: 'hidden' }]}>
                                {requestMediaImages.length > 0 ? (
                                  <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImage(requestMediaImages[0])}>
                                    <Image source={{ uri: requestMediaImages[0] }} style={{ width: '100%', height: 200, backgroundColor: Colors.background, borderTopLeftRadius: 8, borderTopRightRadius: 8 }} resizeMode="cover" />
                                  </TouchableOpacity>
                                ) : (
                                  <View style={[styles.socialMediaBanner, { height: 200, borderTopLeftRadius: 8, borderTopRightRadius: 8 }]}>
                                    <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.7)" style={{ marginBottom: 8 }} />
                                    <Text style={styles.socialMediaBannerText}>{selectedRequest.previewBanner}</Text>
                                  </View>
                                )}
                                <View style={{ padding: 16 }}>
                                  <Text style={{ color: '#059669', fontSize: 11, fontWeight: 'bold', marginBottom: 6, textTransform: 'uppercase' }}>News & Updates</Text>
                                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 12, lineHeight: 28 }}>{selectedRequest.title}</Text>
                                  <Text style={{ color: Colors.textSecondary, fontSize: 13, marginBottom: 16 }}>Published on {selectedRequest.date}</Text>
                                  <FormattedText style={[styles.socialCaptionText, { fontSize: 14 }]}>{selectedRequest.caption}</FormattedText>
                                </View>
                              </View>
                            )}
                          </>
                        );
                      })()}
                    </View>

                    {/* Right Side: Request Details Metadata */}
                    <View style={styles.modalRightColumn}>

                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Request Title</Text>
                        <Text style={styles.metaTitleVal}>{selectedRequest.title}</Text>
                      </View>

                      <View style={styles.metaRowGrid}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.metaLabel}>Department</Text>
                          <View style={styles.deptBadge}>
                            <Text style={styles.deptBadgeText}>{selectedRequest.dept}</Text>
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.metaLabel}>Category</Text>
                          <Text style={styles.metaVal}>{selectedRequest.other_category_name || selectedRequest.category}</Text>
                        </View>
                      </View>

                      <View style={styles.metaRowGrid}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.metaLabel}>Requested By</Text>
                          <Text style={styles.metaVal}>{selectedRequest.requestedBy}</Text>
                          <Text style={styles.rowUserRole}>{selectedRequest.requestedByRole}</Text>
                        </View>
                      </View>

                      <View style={styles.metaRowGrid}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.metaLabel}>Requested On</Text>
                          <Text style={styles.metaVal}>
                            {selectedRequest.date} {selectedRequest.time}
                          </Text>
                        </View>
                      </View>

                      {selectedRequest.preferred_schedule_at && String(selectedRequest.routing_type || selectedRequest.rawPost?.routing_type || '').toLowerCase() !== 'direct_imc' && selectedRequest.category !== 'Direct to IMC' ? (
                        <View style={styles.metaRowGrid}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.metaLabel}>Requested to Publish On</Text>
                            <Text style={styles.metaVal}>
                              {(() => {
                                try {
                                  const d = new Date(selectedRequest.preferred_schedule_at);
                                  if (isNaN(d.getTime())) return selectedRequest.preferred_schedule_at;
                                  const datePart = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                                  let hours = d.getHours();
                                  const ampm = hours >= 12 ? 'PM' : 'AM';
                                  hours = hours % 12;
                                  hours = hours ? hours : 12;
                                  const minutes = d.getMinutes().toString().padStart(2, '0');
                                  return `${datePart} • ${hours}:${minutes} ${ampm}`;
                                } catch {
                                  return selectedRequest.preferred_schedule_at;
                                }
                              })()}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {(selectedRequest.status === 'published' || selectedRequest.published_at) && (
                        <View style={styles.metaRowGrid}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.metaLabel}>Published On</Text>
                            <Text style={[styles.metaVal, { color: '#059669', fontWeight: '600' }]}>
                              {(() => {
                                try {
                                  const rawDate = selectedRequest.published_at || selectedRequest.updated_at;
                                  const d = new Date(rawDate);
                                  if (isNaN(d.getTime())) return String(rawDate);
                                  const datePart = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                                  let hours = d.getHours();
                                  const ampm = hours >= 12 ? 'PM' : 'AM';
                                  hours = hours % 12;
                                  hours = hours ? hours : 12;
                                  const minutes = d.getMinutes().toString().padStart(2, '0');
                                  return `${datePart} • ${hours}:${minutes} ${ampm}`;
                                } catch {
                                  return 'Published';
                                }
                              })()}
                            </Text>
                          </View>
                        </View>
                      )}

                      <View style={styles.metaRowGrid}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.metaLabel}>Target Platforms</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            {selectedRequest.platforms.includes('facebook') && (
                              <View style={[styles.platformIconCircle, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="logo-facebook" size={14} color="#1877F2" />
                              </View>
                            )}
                            {selectedRequest.platforms.includes('instagram') && (
                              <View style={[styles.platformIconCircle, { backgroundColor: '#FDF2F8' }]}>
                                <Ionicons name="logo-instagram" size={14} color="#E1306C" />
                              </View>
                            )}
                            {(selectedRequest.platforms.includes('website') || selectedRequest.platforms.includes('portal') || selectedRequest.platforms.includes('wordpress')) && (
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
                        <FormattedText style={styles.metaCaptionBox}>{selectedRequest.caption}</FormattedText>
                      </View>

                      {/* Attachments Section */}
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Attachments (1)</Text>
                        <View style={styles.attachmentCard}>
                          <View style={styles.attachmentThumb}>
                            <Ionicons name="document-attach-outline" size={18} color="#D97706" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.attachmentName}>{selectedRequest.attachment}</Text>
                            <Text style={styles.attachmentSize}>{selectedRequest.attachmentSize}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {/* Modal Footer Actions */}
                <View style={styles.modalFooterRow}>
                  <TouchableOpacity
                    style={styles.btnModalClose}
                    onPress={() => {
                      setSelectedRequest(null);
                      setModalError(null);
                      router.setParams({ postId: '' });
                    }}
                  >
                    <Text style={styles.btnModalCloseText}>Close</Text>
                  </TouchableOpacity>

                  {activeTab === 'dashboard' && (
                    <>
                      <TouchableOpacity
                        style={styles.btnModalApprove}
                        onPress={() => handleApprove(selectedRequest)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="checkmark-sharp" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.btnModalApproveText}>Approve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnModalReject}
                        onPress={() => handleRejectClick(selectedRequest)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="close-sharp" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.btnModalRejectText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Reject Floating Comment Window */}
        {isRejectModalVisible && (
          <Modal
            visible={isRejectModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsRejectModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContainer, { maxWidth: 480 }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalHeaderTitle}>Reject Request</Text>
                  <TouchableOpacity
                    style={styles.modalCloseIconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Close dialog"
                    onPress={() => setIsRejectModalVisible(false)}
                  >
                    <Ionicons name="close" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={styles.modalBodyContent} style={styles.modalBodyScroll}>
                  <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 12 }}>
                    Please provide remarks for rejecting "{requestToReject?.title}".
                  </Text>
                  <TextInput
                    style={[styles.textInput, { minHeight: 100, textAlignVertical: 'top' }]}
                    accessibilityLabel="Remarks for rejection"
                    placeholder="Enter remarks for rejection..."
                    multiline
                    value={rejectComment}
                    onChangeText={setRejectComment}
                  />
                </ScrollView>
                <View style={styles.modalFooterRow}>
                  <TouchableOpacity
                    style={styles.btnModalClose}
                    onPress={() => setIsRejectModalVisible(false)}
                  >
                    <Text style={styles.btnModalCloseText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnModalReject}
                    onPress={confirmReject}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close-sharp" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.btnModalRejectText}>Confirm Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

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

        {/* Approval Success Popup Modal */}
        <ApprovalSuccessModal
          visible={Boolean(approvalSuccessPost)}
          role="office_head"
          postTitle={approvalSuccessPost?.title || 'Request'}
          onClose={() => setApprovalSuccessPost(null)}
        />

        {/* Rejection Popup Modal */}
        <RejectSuccessModal
          visible={Boolean(rejectSuccessPost)}
          role="office_head"
          postTitle={rejectSuccessPost?.title || 'Request'}
          onClose={() => setRejectSuccessPost(null)}
        />
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  ...dashboardStyles,
  // Outer Container
  dashboardContainer: { ...dashboardStyles.workspace },

  // Header & Greeting
  dashboardHeaderRow: { ...dashboardStyles.pageHeader },
  greetingTitle: { ...dashboardStyles.pageTitle },
  greetingSubtitle: { ...dashboardStyles.subtitle },

  // Department Dropdown
  departmentDropdown: { ...dashboardStyles.control },
  departmentDropdownText: { ...dashboardStyles.controlText },
  dropdownMenu: {
    position: 'absolute',
    top: dashboardUi.controlHeight + Spacing.xs,
    right: 0,
    minWidth: 240,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: dashboardUi.controlHeight,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  dropdownItemText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },

  // Metrics Grid (4 Cards)
  metricsGrid: { ...dashboardStyles.metrics, width: '100%' },
  metricCardWrapper: {
    minWidth: 0,
    marginBottom: Spacing.sm,
    ...(Platform.OS === 'web' ? ({ boxSizing: 'border-box' } as any) : {}),
  },
  metricCardWide: {
    flex: 1,
    minWidth: 0,
  },
  metricCardCompact: {
    width: '48%',
    flexGrow: 1,
  },
  metricCardNarrow: {
    width: '100%',
  },
  metricCard: { ...dashboardStyles.metricCard },
  metricCardHeader: {
    marginBottom: 4,
  },
  metricIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: { ...dashboardStyles.metricLabel },
  metricCount: { ...dashboardStyles.metricValue },
  metricSubtext: { ...dashboardStyles.metricHint },

  // Main Table Card
  tableCard: { ...dashboardStyles.panel },
  tableCardHeaderRow: { ...dashboardStyles.panelHeader },
  tableTitle: { ...dashboardStyles.panelTitle },
  tableControlsRight: { ...dashboardStyles.toolbar },
  searchBox: { ...dashboardStyles.search },
  searchInput: { ...dashboardStyles.searchInput },
  filterBtn: { ...dashboardStyles.control },
  filterBtnText: { ...dashboardStyles.controlText },

  // Table Layout
  table: {
    width: '100%',
  },
  tableHeaderRow: { ...dashboardStyles.tableHeader },
  tableHeaderCell: { ...dashboardStyles.columnHeading, paddingRight: Spacing.md },

  // Column Flex Multipliers & Min-Widths to Prevent Overlap
  flexTitle: { flex: 2.2, minWidth: 200 },
  flexDept: { flex: 2.5, minWidth: 190 },
  flexUser: { flex: 1.8, minWidth: 140 },
  flexDate: { flex: 1.2, minWidth: 120 },
  flexPlatforms: { flex: 1, minWidth: 90 },
  flexActions: { flex: 1.5, minWidth: 175 },
  alignRight: { textAlign: 'right' },
  alignCenter: { textAlign: 'center' },

  tableRow: { ...dashboardStyles.tableRow },
  cellContainer: {
    justifyContent: 'center',
    paddingRight: 16,
  },
  thumbnailBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  rowTitleText: { ...dashboardStyles.cellText, fontSize: 14, lineHeight: 20, fontWeight: FontWeight.semiBold },
  categoryPill: { ...dashboardStyles.statusPill, backgroundColor: Colors.background, marginTop: Spacing.xs },
  categoryPillText: { ...dashboardStyles.statusText, color: Colors.textSecondary },
  rowDeptText: { ...dashboardStyles.cellText },
  rowUserName: { ...dashboardStyles.cellText, fontWeight: FontWeight.medium },
  rowUserRole: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  rowDateText: { ...dashboardStyles.cellText },
  rowTimeText: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    color: Colors.textMuted,
  },
  platformRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  platformRowLabel: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '400',
    color: '#475569',
  },
  platformIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Row Action Buttons
  rowActionsGroup: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  btnViewRow: {
    minHeight: 30,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  btnViewRowText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  btnApproveRow: {
    height: 24,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4D007D',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
    shadowColor: '#4D007D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        boxShadow: '0 2px 5px rgba(77, 0, 125, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
      } as any)
      : {}),
  },
  btnApproveRowText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  btnRejectRow: {
    height: 24,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D91E28',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
    shadowColor: '#D91E28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        boxShadow: '0 2px 5px rgba(217, 30, 40, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
      } as any)
      : {}),
  },
  btnRejectRowText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // 3D Status Badges (matching action pills)
  badgePillApproved: {
    height: 24,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
        boxShadow: '0 2px 5px rgba(5, 150, 105, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
      } as any)
      : {}),
  },
  badgePillRejected: {
    height: 24,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D91E28',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
    shadowColor: '#D91E28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
        boxShadow: '0 2px 5px rgba(217, 30, 40, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
      } as any)
      : {}),
  },
  badgePillRevision: {
    height: 24,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
        boxShadow: '0 2px 5px rgba(217, 119, 6, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
      } as any)
      : {}),
  },
  badgePillPending: {
    height: 24,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#475569',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
        boxShadow: '0 2px 5px rgba(71, 85, 105, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
      } as any)
      : {}),
  },
  badgePillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Table Footer
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  tableFooterText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnActive: {
    backgroundColor: '#D97706',
  },
  pageBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  pageBtnTextActive: {
    color: Colors.surface,
    fontWeight: FontWeight.bold,
  },
  pageCountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  pageCountSelectorText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },

  // Modal Overlay & Container
  modalOverlay: { ...dashboardStyles.modalBackdrop },
  modalContainer: { ...dashboardStyles.modalCard },
  modalHeaderRow: { ...dashboardStyles.modalHeader },
  modalHeaderTitle: { ...dashboardStyles.modalTitle },
  modalCloseIconBtn: { ...dashboardStyles.secondaryButton, minHeight: 34, width: 34, height: 34, paddingHorizontal: 0, paddingVertical: 0 },
  modalBodyScroll: { flexShrink: 1, minHeight: 0 },
  modalBodyContent: { ...dashboardStyles.modalBody },

  // Layout Splits
  splitLayout: {
    gap: Spacing.lg,
  },
  rowLayout: {
    flexDirection: 'row',
  },
  columnLayout: {
    flexDirection: 'column',
  },

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
  modalPlatformTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  modalPlatformTab: {
    minHeight: dashboardUi.controlHeight,
    justifyContent: 'center',
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
    backgroundColor: Colors.background,
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
  metaRowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
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
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.background,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background,
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
  modalFooterRow: { ...dashboardStyles.modalFooter },
  btnModalClose: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        transition: 'all 120ms ease',
      } as any)
      : {}),
  },
  btnModalCloseText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#374151',
  },
  btnModalRevision: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
  },
  btnModalRevisionText: {
    fontSize: FontSize.xs + 1,
    lineHeight: 18,
    fontWeight: FontWeight.bold,
    color: '#B45309',
  },
  btnModalApprove: {
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#4D007D',
    shadowColor: '#4D007D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        boxShadow: '0 3px 8px rgba(77, 0, 125, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
      } as any)
      : {}),
  },
  btnModalApproveText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnModalReject: {
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#D91E28',
    shadowColor: '#D91E28',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        boxShadow: '0 3px 8px rgba(217, 34, 42, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
      } as any)
      : {}),
  },
  btnModalRejectText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Policy Styles
  policySidebar: {
    width: 220,
    gap: 6,
  },
  policySidebarTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  policySidebarItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  policySidebarItemText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
  },
  policyContentArea: {
    flex: 1,
    gap: Spacing.md,
  },
  policyCard: {
    padding: Spacing.lg,
  },
  policyCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  policyContentText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bulletTitle: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  bulletDesc: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
  },

  // Account Settings Styles
  profilePicUploadContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.md },
  profilePicLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D97706',
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
  profilePicButtonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  profilePicUploadBtn: { ...dashboardStyles.primaryButton },
  profilePicUploadBtnText: { ...dashboardStyles.primaryButtonText },
  profilePicRemoveBtn: { ...dashboardStyles.secondaryButton },
  profilePicRemoveBtnText: { ...dashboardStyles.secondaryButtonText, color: Colors.error },
  fieldGroup: {
    marginBottom: 16,
    gap: 6,
  },
  inputLabel: { ...dashboardStyles.label },
  textInput: { ...dashboardStyles.input },
});
