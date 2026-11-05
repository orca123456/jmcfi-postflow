import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { postsApi, departmentsApi, resolveImageUrl } from '../../services/api';
import { useAuthStore } from '../../store/auth';
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

interface ModernRequestorDashboardProps {
  onSwitchToClassic: () => void;
  onRequestSubmitted?: (data: any) => void;
  onBackToDashboard?: () => void;
  allRawPosts?: any[];
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
  };
};

export const ModernRequestorDashboard: React.FC<ModernRequestorDashboardProps> = ({
  onSwitchToClassic,
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
  const [attachedFiles, setAttachedFiles] = useState<{ uri: string; name: string; file?: any; mimeType?: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

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

  const handlePickMedia = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newItems = res.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name || 'image.jpg',
          file: (asset as any).file,
          mimeType: asset.mimeType || 'image/jpeg',
        }));
        setAttachedFiles((prev) => [...prev, ...newItems]);
      }
    } catch {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/jpeg,image/png,image/webp,image/jpg';
        input.onchange = (e: any) => {
          const files = Array.from(e.target.files || []) as File[];
          if (files.length > 0) {
            const newItems = files.map((f) => ({
              uri: URL.createObjectURL(f),
              name: f.name,
              file: f,
              mimeType: f.type,
            }));
            setAttachedFiles((prev) => [...prev, ...newItems]);
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
    if (!formCaption.trim()) {
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

      if (attachedFiles.length > 0) {
        const formData = new FormData();
        formData.append('title', formTitle.trim());
        formData.append('caption_narrative', formCaption.trim());
        formData.append('routing_type', 'direct_imc');
        formData.append('target_platforms[]', 'facebook');
        if (formDepartment) {
          formData.append('other_category_name', formDepartment);
        }
        if (preferredSchedule) {
          formData.append('preferred_schedule_at', preferredSchedule);
        }

        for (const item of attachedFiles) {
          if (Platform.OS === 'web') {
            if (item.file instanceof File || item.file instanceof Blob) {
              formData.append('media[]', item.file, item.name || 'upload.jpg');
            } else if (typeof item.uri === 'string' && (item.uri.startsWith('blob:') || item.uri.startsWith('data:'))) {
              try {
                const fetchRes = await fetch(item.uri);
                const blob = await fetchRes.blob();
                const fileObj = new File([blob], item.name || 'upload.jpg', { type: item.mimeType || blob.type || 'image/jpeg' });
                formData.append('media[]', fileObj, item.name || 'upload.jpg');
              } catch {
                formData.append('media[]', (item.file || item) as any);
              }
            } else {
              formData.append('media[]', (item.file || item) as any);
            }
          } else {
            formData.append('media[]', {
              uri: item.uri,
              name: item.name || 'upload.jpg',
              type: item.mimeType || 'image/jpeg',
            } as any);
          }
        }
        res = await postsApi.createWithFiles(formData as any);
      } else {
        res = await postsApi.create({
          title: formTitle.trim(),
          caption_narrative: formCaption.trim(),
          routing_type: 'direct_imc',
          target_platforms: ['facebook'],
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

  const handleCheckExistingPostPolicy = async (post: RequestCardData) => {
    if (!post.caption) return;
    setIsCheckingPolicy(true);
    try {
      const response = await postsApi.aiCheckDraft({
        title: post.title,
        caption_narrative: post.caption,
      });
      const data = response?.data?.data;
      if (data) {
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
          {/* Button to choose between current dashboard and this new dashboard */}
          <TouchableOpacity
            style={styles.switchDashboardBtn}
            onPress={onSwitchToClassic}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal" size={16} color="#4F46E5" />
            <Text style={styles.switchDashboardBtnText}>Switch to Standard Form</Text>
          </TouchableOpacity>

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
        {/* LEFT COLUMN: CONTENT REQUESTS LIST */}
        <View
          style={[
            styles.leftSection,
            { flex: 1, width: '100%' },
            isDesktop && isSidePanelOpen && { flex: 1.3 },
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
              filteredRequests.map((item) => (
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
                    {/* Top Row: Code Tag + Status */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{item.code}</Text>
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
        </View>

        {/* RIGHT COLUMN: CREATE CONTENT REQUEST PANEL */}
        {isSidePanelOpen && (
          <View style={[styles.rightSection, isDesktop && { flex: 1 }]}>
            {/* Panel Purple Header */}
            <View style={styles.panelHeaderPurple}>
              <View style={styles.panelHeaderLeft}>
                <View style={styles.panelPlusCircle}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                </View>
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
            <ScrollView
              style={styles.panelFormScroll}
              contentContainerStyle={styles.panelFormScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* STEP 1: WHAT */}
              <View style={styles.formGroup}>
                <View style={styles.stepHeaderRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </View>
                  <Text style={styles.stepTitle}>What</Text>
                </View>

                <TextInput
                  style={styles.formTextInput}
                  placeholder="Enter request title..."
                  placeholderTextColor="#9CA3AF"
                  value={formTitle}
                  onChangeText={setFormTitle}
                />
              </View>

              {/* STEP 2: WHEN */}
              <View style={styles.formGroup}>
                <View style={styles.stepHeaderRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>2</Text>
                  </View>
                  <Text style={styles.stepTitle}>When</Text>
                </View>

                <View style={styles.whenRow}>
                  <View style={[styles.formInputWithIcon, { flex: 1, marginRight: 8 }]}>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.innerTextInput}
                      placeholder="Select Date"
                      placeholderTextColor="#9CA3AF"
                      value={formDate}
                      onChangeText={setFormDate}
                    />
                  </View>

                  <View style={[styles.formInputWithIcon, { flex: 1 }]}>
                    <Ionicons name="time-outline" size={16} color="#6B7280" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.innerTextInput}
                      placeholder="Select Time"
                      placeholderTextColor="#9CA3AF"
                      value={formTime}
                      onChangeText={setFormTime}
                    />
                  </View>
                </View>
              </View>

              {/* STEP 3: WHO */}
              <View style={styles.formGroup}>
                <View style={styles.stepHeaderRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>3</Text>
                  </View>
                  <Text style={styles.stepTitle}>Who</Text>
                </View>

                <TouchableOpacity
                  style={styles.formInputWithIcon}
                  onPress={() => setIsDeptDropdownOpen((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="people-outline" size={16} color="#6B7280" style={{ marginRight: 8 }} />
                  <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                    {formDepartment || 'Select Department / Organization'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>

                {isDeptDropdownOpen && (
                  <View style={styles.dropdownPickerBox}>
                    {departmentsList.map((dept) => (
                      <TouchableOpacity
                        key={dept}
                        style={styles.dropdownPickerItem}
                        onPress={() => {
                          setFormDepartment(dept);
                          setIsDeptDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownPickerItemText,
                            formDepartment === dept && { color: '#6D28D9', fontWeight: 'bold' },
                          ]}
                        >
                          {dept}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* SECTION: CONTENT & CAPTION */}
              <View style={styles.formGroup}>
                <View style={styles.contentHeaderRow}>
                  <Ionicons name="document-text" size={18} color="#6D28D9" style={{ marginRight: 6 }} />
                  <Text style={styles.stepTitle}>Content</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.subFieldLabel}>Caption</Text>
                  
                  <TouchableOpacity
                    style={[
                      styles.aiCheckPolicyBtn,
                      isCheckingPolicy && { opacity: 0.7 }
                    ]}
                    onPress={handleCheckPolicy}
                    disabled={isCheckingPolicy}
                    activeOpacity={0.75}
                  >
                    {isCheckingPolicy ? (
                      <ActivityIndicator size="small" color="#6D28D9" style={{ marginRight: 5 }} />
                    ) : (
                      <Ionicons name="sparkles" size={13} color="#6D28D9" style={{ marginRight: 5 }} />
                    )}
                    <Text style={styles.aiCheckPolicyBtnText}>
                      {isCheckingPolicy ? 'AI Analyzing...' : 'AI Check Policy Alignment'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.captionTextArea}
                  placeholder="Write your caption here..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  value={formCaption}
                  onChangeText={(val) => {
                    setFormCaption(val);
                    if (complianceScore > 0) {
                      setComplianceScore(0);
                    }
                  }}
                  textAlignVertical="top"
                />

                <View style={styles.captionMetaRow}>
                  <Text style={styles.characterCounter}>
                    {formCaption.length} / 2200 characters
                  </Text>
                  
                  {complianceScore > 0 && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      onPress={() => setIsComplianceModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.inlineScoreBadge,
                        {
                          backgroundColor: complianceStatus === 'compliant' ? '#ECFDF5' : '#FEF3C7',
                          borderColor: complianceStatus === 'compliant' ? '#A7F3D0' : '#FDE68A',
                        }
                      ]}>
                        <Ionicons
                          name={complianceStatus === 'compliant' ? 'checkmark-circle' : 'alert-circle'}
                          size={12}
                          color={complianceStatus === 'compliant' ? '#059669' : '#D97706'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[
                          styles.inlineScoreBadgeText,
                          { color: complianceStatus === 'compliant' ? '#059669' : '#D97706' }
                        ]}>
                          Score: {complianceScore}% ({complianceStatus === 'compliant' ? 'Compliant' : 'Review'})
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#6D28D9', fontWeight: '700', textDecorationLine: 'underline' }}>
                        View Analysis
                      </Text>
                    </TouchableOpacity>
                  )}
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
                  <View style={styles.attachedFilesList}>
                    {attachedFiles.map((file, idx) => (
                      <View key={idx} style={styles.attachedFileItem}>
                        <Ionicons name="attach" size={14} color="#6D28D9" />
                        <Text style={styles.attachedFileName} numberOfLines={1}>{file.name}</Text>
                        <TouchableOpacity
                          onPress={() =>
                            setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Ionicons name="close-circle" size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ))}
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
            </ScrollView>
          </View>
        )}
      </View>

      {/* ================= VIEW REQUEST PREVIEW MODAL ================= */}
      {selectedPost && (
        <Modal
          visible={Boolean(selectedPost)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPost(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{selectedPost.code}</Text>
                  </View>
                  <View style={{ marginLeft: 8 }}>{getStatusBadge(selectedPost.status)}</View>
                </View>
                <TouchableOpacity onPress={() => setSelectedPost(null)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {Boolean(selectedPost.thumbnailUrl) && (
                  <Image
                    source={{ uri: selectedPost.thumbnailUrl }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
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

                {Boolean(selectedPost.caption) && (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={styles.modalInfoLabel}>Caption:</Text>
                      <TouchableOpacity
                        style={styles.modalAiCheckBtn}
                        onPress={() => handleCheckExistingPostPolicy(selectedPost)}
                        activeOpacity={0.7}
                        disabled={isCheckingPolicy}
                      >
                        {isCheckingPolicy ? (
                          <ActivityIndicator size="small" color="#6D28D9" style={{ marginRight: 4 }} />
                        ) : (
                          <Ionicons name="sparkles" size={12} color="#6D28D9" style={{ marginRight: 4 }} />
                        )}
                        <Text style={styles.modalAiCheckBtnText}>
                          {isCheckingPolicy ? 'Analyzing...' : 'AI Policy Check'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.modalCaptionText}>{selectedPost.caption}</Text>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },

  /* Top Control Banner */
  topControlBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }
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

  /* Split Layout */
  splitLayout: {
    flexDirection: 'row',
    gap: 18,
    flex: 1,
    width: '100%',
  },
  splitLayoutStacked: {
    flexDirection: 'column',
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
  requestCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    width: '100%',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)' }
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    alignSelf: 'flex-start',
    width: '100%',
    maxHeight: 780,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)' }
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
    gap: 14,
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
});

export default ModernRequestorDashboard;

