import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  ScrollView,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import DashboardSkeleton from '../../../components/DashboardSkeleton';
import { PaginationControl } from '../../../components/ui/PaginationControl';
import { Card } from '../../../components/ui/Card';
import { useAuthStore } from '../../../store/auth';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';
import { usePolicyStore } from '../../../store/policy';
import { FormattedText } from '../../../components/ui/FormattedText';
import { PolicyRulesView } from '../../../components/ui/PolicyRulesView';
import { postsApi, dashboardApi, authApi } from '../../../services/api';

export default function VPDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  const { policySections, effectiveDate, lastUpdatedDate, fetchPolicy } = usePolicyStore();

  useEffect(() => {
    fetchPolicy();
  }, []);



  // Tab State: 'dashboard' | 'policy-rules'
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
  const [modalError, setModalError] = useState<string | null>(null);
  
  const [optimisticallyRemovedIds, setOptimisticallyRemovedIds] = useState<string[]>([]);

  // Reject Modal State
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [requestToReject, setRequestToReject] = useState<any | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<any[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<any[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [acctFullName, setAcctFullName] = useState('');
  const [acctCurrentPw, setAcctCurrentPw] = useState('');
  const [acctNewPw, setAcctNewPw] = useState('');
  const [acctConfirmPw, setAcctConfirmPw] = useState('');
  const [savingAcct, setSavingAcct] = useState(false);
  const [savingAcctPw, setSavingAcctPw] = useState(false);

  useEffect(() => { if (user) setAcctFullName(`${user.first_name || ''} ${user.last_name || ''}`.trim()); }, [user]);

  const { data: initDataRes, refetch: refetchInitData, isLoading: isInitLoading } = useQuery({
    queryKey: ['vp-dashboard-data'],
    queryFn: dashboardApi.getInitData,
    refetchInterval: 100,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (initDataRes?.data) {
      const data = initDataRes.data;
      const posts = data.posts?.data || data.posts || [];

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
        category: p.category?.name || 'Category',
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
        thumbnailUrl: p.media && p.media.length > 0 ? p.media[0].url : null,
        status: p.status ? p.status.toUpperCase() : 'UNKNOWN',
        rejectionReason: p.rejection_reason || '',
        rejectedBy,
      }};

      const mapped = posts.map(mapPost);

      let pendingStatuses: string[] = [];
      let approvedStatuses: string[] = [];

      if (user?.department === 'Vice President for Academic Affairs') {
        pendingStatuses = ['PENDING_VICE_PRESIDENT'];
        approvedStatuses = ['PENDING_IMC_QA', 'APPROVED', 'SCHEDULED', 'PUBLISHED'];
      } else if (user?.department === 'Institutional Marketing Communication') {
        pendingStatuses = ['PENDING_IMC_QA'];
        approvedStatuses = ['APPROVED', 'SCHEDULED', 'PUBLISHED'];
      } else {
        pendingStatuses = ['PENDING_OFFICE_HEAD'];
        approvedStatuses = ['PENDING_VICE_PRESIDENT', 'PENDING_IMC_QA', 'APPROVED', 'SCHEDULED', 'PUBLISHED'];
      }

      setRequestsList(mapped.filter((p: any) => pendingStatuses.includes(p.status) && !optimisticallyRemovedIds.includes(p.id)));
      setApprovedRequests(mapped.filter((p: any) => approvedStatuses.includes(p.status)));
      setRejectedRequests(mapped.filter((p: any) => p.status === 'REJECTED' || p.status === 'RETURNED_FOR_REVISION'));

      const statsData = data.stats || {};
      setStats(statsData);

      const depts = data.departments || [];
      setDepartmentOptions(['All Departments', ...depts]);
      setIsInitialLoading(false);
    }
  }, [initDataRes, user?.department, optimisticallyRemovedIds]);

  const loadData = (showLoading = true) => {
    refetchInitData();
  };

  useEffect(() => {
    if (requestsList.length === 0) {
      loadData(true);
    }
  }, [activeTab]);

  const handleUploadPhoto = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const f = e.target.files?.[0]; if (!f) return;
        setUploadingPhoto(true);
        try { const r = await authApi.uploadPhoto(f); setProfilePhotoUrl(r.data.photo_url); } catch { } finally { setUploadingPhoto(false); }
      };
      input.click();
    }
  };
  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    try { await authApi.removePhoto(); setProfilePhotoUrl(null); } catch { } finally { setUploadingPhoto(false); }
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

  const handleApprove = async (req: any) => {
    setModalError(null);
    
    setRequestsList(prev => prev.filter(r => r.id !== req.id));
    setOptimisticallyRemovedIds(prev => [...prev, req.id]);
    setApprovedRequests(prev => [{ ...req, status: 'APPROVED' }, ...prev]);
    setSelectedRequest(null);
    
    setTimeout(() => {
      alert(`Request Approved: "${req.title}"`);
    }, 100);

    try {
      await postsApi.approve(req.id, {});
      loadData(false);
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
    
    setRequestsList(prev => prev.filter(r => r.id !== requestToReject?.id));
    setOptimisticallyRemovedIds(prev => [...prev, requestToReject?.id]);
    if (requestToReject) setRejectedRequests(prev => [{ ...requestToReject, status: 'REJECTED' }, ...prev]);
    setIsRejectModalVisible(false);
    const reqTitle = requestToReject?.title;
    const reqId = requestToReject?.id;
    setRequestToReject(null);
    setSelectedRequest(null);
    
    setTimeout(() => {
      alert(`Request Rejected: "${reqTitle}"\nReason: ${rejectComment}`);
    }, 100);

    try {
      await postsApi.reject(reqId, { reason: rejectComment });
      loadData(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject request.');
      loadData(false);
    }
  };

  const handleRequestRevision = async (req: any) => {
    setRequestsList(prev => prev.filter(r => r.id !== req.id));
    setOptimisticallyRemovedIds(prev => [...prev, req.id]);
    setRejectedRequests(prev => [{ ...req, status: 'RETURNED_FOR_REVISION' }, ...prev]);
    setSelectedRequest(null);
    
    alert(`Revision Requested for: "${req.title}"`);

    try {
      await postsApi.returnRevision(req.id, { reason: 'Revision requested by Vice President' });
      loadData(false);
    } catch (err) {
      alert('Failed to return for revision.');
      loadData(false);
    }
  };

  const getRequestsForTab = () => {
    if (activeTab === 'approved') return approvedRequests;
    if (activeTab === 'rejected') return rejectedRequests;
    return requestsList;
  };

  const filteredRequests = getRequestsForTab().filter((req) => {
    const matchesDept =
      selectedDepartment === 'All Departments' || req.dept === selectedDepartment;
    const matchesSearch =
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

  const isLargeScreen = width > 1024;

  return (
    <DashboardShell
      title="Vice President Dashboard"
      activeTab={activeTab as string}
      onTabChange={setActiveTab}
      backgroundImage={require('../../../assets/images/jmcbg2.jpeg')}
    >
      {/* ── LOADING SKELETON ── */}
      {isInitialLoading && <DashboardSkeleton />}

      {/* ----------------- DASHBOARD / APPROVED / REJECTED TAB ----------------- */}
      {(activeTab === 'dashboard' || activeTab === 'approved' || activeTab === 'rejected') && !isInitialLoading && (
        <View style={styles.dashboardContainer}>
          {/* Header Row with Greeting and Department Filter */}
          {activeTab === 'dashboard' && (
            <View style={styles.dashboardHeaderRow}>
              <View>
                <Text style={styles.greetingTitle}>Good morning, Vice President! 👋</Text>
                <Text style={styles.greetingSubtitle}>
                  Review and approve content requests from departments.
                </Text>
              </View>
            </View>
          )}

          {/* Metric Summary Cards Row */}
          {['dashboard', 'approved', 'rejected'].includes(activeTab) && (
            <View style={styles.metricsGrid}>
              {/* Card 1: For My Approval */}
              <TouchableOpacity style={{ flex: 1, minWidth: 220 }} onPress={() => setActiveTab('dashboard')} activeOpacity={0.7}>
                <Card style={[styles.metricCard, activeTab === 'dashboard' && { borderColor: Colors.primary, borderWidth: 2 }]}>
                  <View style={styles.metricCardHeader}>
                    <View style={[styles.metricIconBg, { backgroundColor: '#F3E8FF' }]}>
                      <Ionicons name="document-text" size={20} color="#7C3AED" />
                    </View>
                  </View>
                  <Text style={styles.metricLabel}>For My Approval</Text>
                  <Text style={styles.metricCount}>{computedStats.pending}</Text>
                  <Text style={styles.metricSubtext}>Requests awaiting your approval</Text>
                </Card>
              </TouchableOpacity>

              {/* Card 2: Approved */}
              <TouchableOpacity style={{ flex: 1, minWidth: 220 }} onPress={() => setActiveTab('approved')} activeOpacity={0.7}>
                <Card style={[styles.metricCard, activeTab === 'approved' && { borderColor: Colors.primary, borderWidth: 2 }]}>
                  <View style={styles.metricCardHeader}>
                    <View style={[styles.metricIconBg, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="checkmark-circle" size={20} color="#D97706" />
                    </View>
                  </View>
                  <Text style={styles.metricLabel}>Approved</Text>
                  <Text style={styles.metricCount}>{computedStats.approved}</Text>
                  <Text style={styles.metricSubtext}>Requests you approved</Text>
                </Card>
              </TouchableOpacity>

              {/* Card 3: Rejected */}
              <TouchableOpacity style={{ flex: 1, minWidth: 220 }} onPress={() => setActiveTab('rejected')} activeOpacity={0.7}>
                <Card style={[styles.metricCard, activeTab === 'rejected' && { borderColor: Colors.primary, borderWidth: 2 }]}>
                  <View style={styles.metricCardHeader}>
                    <View style={[styles.metricIconBg, { backgroundColor: '#FEE2E2' }]}>
                      <Ionicons name="close-circle" size={20} color="#DC2626" />
                    </View>
                  </View>
                  <Text style={styles.metricLabel}>Rejected</Text>
                  <Text style={styles.metricCount}>{computedStats.rejected}</Text>
                  <Text style={styles.metricSubtext}>Requests rejected</Text>
                </Card>
              </TouchableOpacity>

              {/* Card 4: Total Requests */}
              <TouchableOpacity style={{ flex: 1, minWidth: 220 }} onPress={() => setActiveTab('dashboard')} activeOpacity={0.7}>
                <Card style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <View style={[styles.metricIconBg, { backgroundColor: '#DBEAFE' }]}>
                      <Ionicons name="paper-plane" size={20} color="#2563EB" />
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
          <Card style={styles.tableCard}>
            {/* Table Control Header */}
            <View style={styles.tableCardHeaderRow}>
              <Text style={styles.tableTitle}>
                {activeTab === 'dashboard' ? 'Requests Awaiting Your Approval' : activeTab === 'approved' ? 'Approved Requests' : 'Rejected Requests'}
              </Text>

              <View style={styles.tableControlsRight}>
                {/* Search Bar */}
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {/* Department Dropdown Selector */}
                <View style={{ position: 'relative', zIndex: 50 }}>
                  <TouchableOpacity
                    style={[styles.departmentDropdown, { height: 36, paddingVertical: 0 }]}
                    onPress={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                  >
                    <Text style={styles.departmentDropdownText}>{selectedDepartment}</Text>
                    <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {isDeptDropdownOpen && (
                    <ScrollView style={[styles.dropdownMenu, { maxHeight: 300 }]} nestedScrollEnabled>
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

                {/* Date Range Dropdown Selector */}
                <View style={{ position: 'relative', zIndex: 40 }}>
                  <TouchableOpacity
                    style={[styles.departmentDropdown, { height: 36, paddingVertical: 0, minWidth: 140 }]}
                    onPress={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                  >
                    <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.departmentDropdownText}>{dateFilter}</Text>
                    <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {isDateDropdownOpen && (
                    <View style={[styles.dropdownMenu, { minWidth: 200 }]}>
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
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>Start Date (YYYY-MM-DD)</Text>
                          <TextInput style={[styles.searchInput, { marginBottom: 8, height: 32 }]} placeholder="e.g. 2026-08-01" value={customStartDate} onChangeText={setCustomStartDate} />
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>End Date (YYYY-MM-DD)</Text>
                          <TextInput style={[styles.searchInput, { marginBottom: 8, height: 32 }]} placeholder="e.g. 2026-08-31" value={customEndDate} onChangeText={setCustomEndDate} />
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

            {/* Requests Table */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.flexTitle]}>REQUEST TITLE</Text>
                <Text style={[styles.tableHeaderCell, styles.flexDept]}>DEPARTMENT</Text>
                <Text style={[styles.tableHeaderCell, styles.flexUser]}>REQUESTED BY</Text>
                <Text style={[styles.tableHeaderCell, styles.flexDate]}>REQUESTED ON</Text>
                <Text style={[styles.tableHeaderCell, styles.flexPlatforms]}>PLATFORMS</Text>
                <Text style={[styles.tableHeaderCell, styles.flexActions, styles.alignRight]}>ACTIONS</Text>
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
                  <View style={[styles.cellContainer, styles.flexTitle]}>
                    <View style={styles.thumbnailBox}>
                      {req.thumbnailUrl ? (
                        <Image source={{ uri: req.thumbnailUrl }} style={{ width: '100%', height: '100%', borderRadius: 6 }} resizeMode="cover" />
                      ) : (
                        <Ionicons name="image-outline" size={16} color={Colors.textSecondary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitleText}>{req.title}</Text>
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{req.category}</Text>
                      </View>
                    </View>
                  </View>

                  {/* DEPARTMENT */}
                  <View style={[styles.cellContainer, styles.flexDept]}>
                    <Text style={styles.rowDeptText}>{req.dept}</Text>
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
                  <View style={[styles.cellContainer, styles.flexPlatforms, { flexDirection: 'row', gap: 6, justifyContent: 'flex-start' }]}>
                    {req.platforms.includes('facebook') && (
                      <View style={[styles.platformIconCircle, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="logo-facebook" size={13} color="#1877F2" />
                      </View>
                    )}
                    {req.platforms.includes('instagram') && (
                      <View style={[styles.platformIconCircle, { backgroundColor: '#FDF2F8' }]}>
                        <Ionicons name="logo-instagram" size={13} color="#E1306C" />
                      </View>
                    )}
                    {req.platforms.includes('website') && (
                      <View style={[styles.platformIconCircle, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="globe-outline" size={13} color="#059669" />
                      </View>
                    )}
                  </View>

                  {/* ACTIONS */}
                  <View style={[styles.cellContainer, styles.flexActions, styles.rowActionsGroup]}>

                    {activeTab === 'dashboard' ? (
                      <>
                        <TouchableOpacity
                          style={styles.btnApproveRow}
                          onPress={() => handleApprove(req)}
                        >
                          <Ionicons name="checkmark" size={13} color="#16A34A" style={{ marginRight: 3 }} />
                          <Text style={styles.btnApproveRowText}>Approve</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnRejectRow}
                          onPress={() => handleRejectClick(req)}
                        >
                          <Ionicons name="close" size={13} color="#DC2626" style={{ marginRight: 3 }} />
                          <Text style={styles.btnRejectRowText}>Reject</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={{ backgroundColor: activeTab === 'approved' ? '#DCFCE7' : '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                        <Text style={{ color: activeTab === 'approved' ? '#15803D' : '#B91C1C', fontWeight: '600', fontSize: 12, textTransform: 'uppercase' }}>
                          {activeTab === 'approved' ? 'Approved' : 'Rejected'}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
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
      {activeTab === 'policy-rules' && !isInitialLoading && (
        <PolicyRulesView accentColor="#7C3AED" />
      )}

      {/* ----------------- ACCOUNT SETTINGS TAB ----------------- */}
      {activeTab === 'account-settings' && !isInitialLoading && (
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.greetingTitle}>Account Settings</Text>
              <Text style={styles.greetingSubtitle}>
                Manage your institutional profile picture, credentials, and settings.
              </Text>
            </View>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Left settings card */}
            <View style={{ flex: 1.5 }}>
              <Card style={styles.tableCard}>
                <View style={[styles.tableCardHeaderRow, { justifyContent: 'flex-start', gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.background, paddingBottom: 10, marginBottom: 12 }]}>
                  <Ionicons name="person-outline" size={18} color="#7C3AED" />
                  <Text style={styles.tableTitle}>Profile Information</Text>
                </View>

                {/* Profile Picture Upload Section */}
                <View style={styles.profilePicUploadContainer}>
                  <View style={[styles.profilePicLarge, { backgroundColor: '#7C3AED' }]}>
                    {profilePhotoUrl ? (
                      <Image source={{ uri: profilePhotoUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} resizeMode="cover" />
                    ) : (
                      <Text style={styles.profilePicLargeText}>
                        {user?.first_name ? (user.first_name[0] + (user.last_name?.[0] || '')).toUpperCase() : 'VP'}
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
                  <Text style={styles.inputLabel}>DEPARTMENT / ROLE</Text>
                  <TextInput style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]} value={user?.department || ''} editable={false} />
                </View>

                <TouchableOpacity style={{ backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 4, alignItems: 'center' }} onPress={handleSaveDetails} disabled={savingAcct}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{savingAcct ? 'Saving...' : 'Save Details'}</Text>
                </TouchableOpacity>
              </Card>
            </View>

            {/* Right settings card */}
            <View style={{ flex: 1 }}>
              <Card style={styles.tableCard}>
                <Text style={[styles.tableTitle, { marginBottom: 12 }]}>Update Password</Text>

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

      {/* ----------------- CONTENT REQUEST PREVIEW MODAL ----------------- */}
      {selectedRequest && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setSelectedRequest(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalHeaderTitle}>Content Request Preview</Text>
                <TouchableOpacity
                  style={styles.modalCloseIconBtn}
                  onPress={() => {
                    setSelectedRequest(null);
                    setModalError(null);
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
                { (selectedRequest.status === 'REJECTED' || selectedRequest.status === 'RETURNED_FOR_REVISION') && (
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

                        <FormattedText style={styles.socialCaptionText}>{selectedRequest.caption}</FormattedText>

                        {selectedRequest.thumbnailUrl ? (
                          <Image source={{ uri: selectedRequest.thumbnailUrl }} style={{ width: '100%', height: 260, maxHeight: 400, borderRadius: 8, backgroundColor: '#F9FAFB' }} resizeMode="contain" />
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

                        {selectedRequest.thumbnailUrl ? (
                          <Image source={{ uri: selectedRequest.thumbnailUrl }} style={{ width: '100%', height: 320, backgroundColor: '#F9FAFB' }} resizeMode="cover" />
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
                          <FormattedText style={styles.socialCaptionText}>{'<b>Jose Maria College Foundation Inc. </b>' + (selectedRequest.caption || '')}</FormattedText>
                        </View>
                      </View>
                    )}

                    {modalPlatformTab === 'website' && (
                      <View style={[styles.socialMockupCard, { padding: 0, overflow: 'hidden' }]}>
                        {selectedRequest.thumbnailUrl ? (
                          <Image source={{ uri: selectedRequest.thumbnailUrl }} style={{ width: '100%', height: 200, backgroundColor: '#F9FAFB', borderTopLeftRadius: 8, borderTopRightRadius: 8 }} resizeMode="cover" />
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
                  </View>

                  {/* Right Side: Request Details Metadata */}
                  <View style={styles.modalRightColumn}>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Title</Text>
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
                        <Text style={styles.metaVal}>{selectedRequest.category}</Text>
                      </View>
                    </View>

                    <View style={styles.metaRowGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Requested By</Text>
                        <Text style={styles.metaVal}>
                          {selectedRequest.requestedBy} ({selectedRequest.requestedByRole})
                        </Text>
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
                          {selectedRequest.platforms.includes('website') && (
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
                          <Ionicons name="document-attach-outline" size={18} color="#7C3AED" />
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
                  }}
                >
                  <Text style={styles.btnModalCloseText}>Close</Text>
                </TouchableOpacity>

                {activeTab === 'dashboard' && (
                  <>
                    <TouchableOpacity
                      style={styles.btnModalApprove}
                      onPress={() => handleApprove(selectedRequest)}
                    >
                      <Text style={styles.btnModalApproveText}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnModalReject}
                      onPress={() => handleRejectClick(selectedRequest)}
                    >
                      <Text style={styles.btnModalRejectText}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Reject Modal */}
      {isRejectModalVisible && (
        <Modal
          visible={isRejectModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsRejectModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { width: 400, maxWidth: '90%' }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalHeaderTitle}>Reject Request</Text>
                <TouchableOpacity
                  style={styles.modalCloseIconBtn}
                  onPress={() => setIsRejectModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 12 }}>
                  Please provide a reason for rejecting "{requestToReject?.title}".
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: BorderRadius.md,
                    padding: 12,
                    minHeight: 100,
                    textAlignVertical: 'top',
                    fontSize: FontSize.sm,
                    backgroundColor: '#F9FAFB',
                    outlineStyle: 'none',
                  } as any}
                  placeholder="Enter rejection reason or comment here..."
                  multiline
                  value={rejectComment}
                  onChangeText={setRejectComment}
                />
              </View>
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
                >
                  <Text style={styles.btnModalRejectText}>Confirm Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  // Outer Container
  dashboardContainer: {
    gap: Spacing.lg,
  },

  // Header & Greeting
  dashboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  greetingTitle: {
    fontSize: FontSize.xl + 2,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  greetingSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Department Dropdown
  departmentDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
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
  dropdownMenu: {
    position: 'absolute',
    top: 42,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  dropdownItemText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },

  // Metrics Grid (4 Cards)
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: 200,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.background,
  },
  metricCardHeader: {
    marginBottom: 8,
  },
  metricIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textTransform: 'uppercase',
  },
  metricCount: {
    fontSize: FontSize.xxl + 4,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginVertical: 2,
  },
  metricSubtext: {
    fontSize: FontSize.xs - 1,
    color: Colors.textMuted,
  },

  // Main Table Card
  tableCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.background,
  },
  tableCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    zIndex: 100,
  },
  tableTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  tableControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10,
    height: 36,
    width: 200,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
    outlineStyle: 'none',
  } as any,
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    height: 36,
  },
  filterBtnText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },

  // Table Layout
  table: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.sm,
  },
  tableHeaderCell: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },

  // Column Flex Multipliers
  flexTitle: { flex: 2 },
  flexDept: { flex: 2.2 },
  flexUser: { flex: 1.5 },
  flexDate: { flex: 1.2 },
  flexPlatforms: { flex: 1 },
  flexActions: { flex: 1.5 },
  alignRight: { textAlign: 'right' },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
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

  // Row Action Buttons
  rowActionsGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  btnViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnViewRowText: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  btnApproveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnApproveRowText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#15803D',
  },
  btnRejectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnRejectRowText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#B91C1C',
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
    backgroundColor: '#4C1D95',
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
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modalPlatformTabText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  modalPlatformTabTextActive: {
    color: '#1D4ED8',
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
    backgroundColor: '#3B82F6',
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
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deptBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#6D28D9',
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
    backgroundColor: '#EDE9FE',
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

  // Modal Footer (4 Action Buttons)
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
  btnModalRevision: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
  },
  btnModalRevisionText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#B45309',
  },
  btnModalApprove: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#ECFDF5',
  },
  btnModalApproveText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#047857',
  },
  btnModalReject: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  btnModalRejectText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#B91C1C',
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
    backgroundColor: '#F9FAFB',
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
    color: '#4B5563',
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
    color: '#4B5563',
  },

  // Account Settings Styles
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
    backgroundColor: '#7C3AED',
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
  fieldGroup: {
    marginBottom: 16,
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    height: 36,
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
});
