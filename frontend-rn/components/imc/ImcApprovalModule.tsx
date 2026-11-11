import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { postsApi, resolveImageUrl } from '../../services/api';
import {
  View,
  Modal,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { PaginationControl } from '../ui/PaginationControl';

export interface ImcRequestItem {
  id: string;
  code: string;
  title: string;
  status: 'Pending' | 'Approved' | 'Reviewing' | 'Rejected';
  date: string;
  time?: string;
  department: string;
  requestedBy: string;
  snippet: string;
  caption: string;
  thumbnailUrl: string;
  mediaAttachments?: string[];
  category?: string;
  platforms?: string[];
  approval_workflows?: any[];
  routing_type?: string;
}

export interface ImcApprovalModuleProps {
  initialTab?: string;
  initialSelectedId?: string;
  onViewDetails?: (req: ImcRequestItem) => void;
  onSwitchToClassic?: () => void;
}

export const ImcApprovalModule: React.FC<ImcApprovalModuleProps> = ({
  initialTab,
  initialSelectedId,
  onViewDetails,
  onSwitchToClassic,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [requests, setRequests] = useState<ImcRequestItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>(initialSelectedId || '');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Pending' | 'Approved' | 'Reviewing'>(
    initialTab === 'Approved' || initialTab === 'approved' ? 'Approved' : 'Pending'
  );

  const sectionHeading = useMemo(() => {
    if (activeFilter === 'Approved') return 'Approved Content Requests';
    if (activeFilter === 'Reviewing') return 'Reviewing Content Requests';
    return 'Pending Content Requests';
  }, [activeFilter]);

  const sectionSubheading = useMemo(() => {
    if (activeFilter === 'Approved') {
      return 'Review institutional content requests approved and cleared by QA.';
    }
    return 'Review the latest requests awaiting your approval.';
  }, [activeFilter]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Detail panel state
  const [detailTab, setDetailTab] = useState<'details' | 'info' | 'activity'>('details');
  const [editableCaption, setEditableCaption] = useState('');
  const [replacementFile, setReplacementFile] = useState<any>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const selectedRequest = useMemo(() => {
    return requests.find((r) => r.id === selectedRequestId) || requests[0] || null;
  }, [requests, selectedRequestId]);


  const loadImcRequests = useCallback(async () => {
    try {
      const res = await postsApi.list({ per_page: 50 });
      const apiPosts = res.data?.data || [];
      const mapped: ImcRequestItem[] = Array.isArray(apiPosts)
        ? apiPosts.map((p: any) => {
          let st: ImcRequestItem['status'] = 'Pending';
          if (p.status === 'approved' || p.status === 'scheduled' || p.status === 'published') {
            st = 'Approved';
          } else if (p.status === 'rejected') {
            st = 'Rejected';
          } else if (p.status === 'pending_imc_qa') {
            st = 'Pending';
          } else {
            st = 'Reviewing';
          }

          const rawThumb = p.media?.[0]?.url || p.featured_image;
          const thumb = rawThumb ? (resolveImageUrl(rawThumb) || '') : '';

          return {
            id: String(p.id),
            code: p.slug ? p.slug.split('-').slice(0, 3).join('-').toUpperCase() : `CR-2026-${String(p.id).padStart(3, '0')}`,
            title: p.title,
            status: st,
            date: p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today',
            time: p.created_at ? new Date(p.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : undefined,
            department: p.requestor?.department || 'Department',
            requestedBy: p.requestor?.full_name || 'Requestor',
            snippet: p.caption_narrative ? p.caption_narrative.slice(0, 60) + '...' : '',
            caption: p.caption_narrative || '',
            thumbnailUrl: thumb,
            category: p.category?.name || p.other_category_name || (typeof p.category === 'string' ? p.category : 'General Announcement'),
            platforms: p.target_platforms || [],
            approval_workflows: p.approval_workflows || [],
            routing_type: p.routing_type || 'standard',
          };
        })
        : [];

      setRequests(mapped);
      if (initialSelectedId) {
        const found = mapped.find((r) => r.id === initialSelectedId);
        if (found) {
          setSelectedRequestId(found.id);
          setIsSidePanelOpen(true);
        } else if (mapped[0]) {
          setSelectedRequestId(mapped[0].id);
        }
      } else if (mapped[0]) {
        setSelectedRequestId(mapped[0].id);
      } else {
        setSelectedRequestId('');
      }
    } catch (err) {
      console.log('Error loading requests in IMC module:', err);
      setRequests([]);
    }
  }, [initialSelectedId]);

  useEffect(() => {
    loadImcRequests();
  }, [loadImcRequests]);

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedRequestId(initialSelectedId);
      setIsSidePanelOpen(true);
    }
  }, [initialSelectedId]);

  // Sync caption when selected request changes
  React.useEffect(() => {
    if (selectedRequest) {
      setEditableCaption(selectedRequest.caption);
    }
  }, [selectedRequest?.id]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return requests.filter((req) => {
      const matchSearch =
        !q ||
        (req.title || '').toLowerCase().includes(q) ||
        (req.code || '').toLowerCase().includes(q) ||
        (req.department || '').toLowerCase().includes(q) ||
        (req.requestedBy || '').toLowerCase().includes(q);
      const matchFilter = activeFilter === 'All' || req.status === activeFilter;
      return matchSearch && matchFilter;
    });
  }, [requests, searchQuery, activeFilter]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  const handleDecision = async (type: 'Approve' | 'Edit & Approve' | 'Reject') => {
    if (!selectedRequest) return;
    const postId = Number(selectedRequest.id);
    setIsActionLoading(true);

    try {
      if (!isNaN(postId) && postId > 0) {
        if (type === 'Approve') {
          await postsApi.approve(postId);
        } else if (type === 'Edit & Approve') {
          if (replacementFile) {
            const form = new FormData();
            form.append('caption_narrative', editableCaption);
            if (replacementFile instanceof File || replacementFile instanceof Blob) {
              form.append('media', replacementFile);
            } else if (replacementFile.file instanceof File || replacementFile.file instanceof Blob) {
              form.append('media', replacementFile.file);
            } else if (Platform.OS === 'web' && replacementFile.uri) {
              try {
                const r = await fetch(replacementFile.uri);
                const b = await r.blob();
                form.append('media', b, replacementFile.name || 'replacement.jpg');
              } catch {
                form.append('media', replacementFile as any);
              }
            } else {
              form.append('media', {
                uri: replacementFile.uri,
                name: replacementFile.name || 'replacement.jpg',
                type: replacementFile.mimeType || 'image/jpeg',
              } as any);
            }
            await postsApi.approve(postId, form as any);
          } else {
            await postsApi.approve(postId, { caption_narrative: editableCaption });
          }
        } else {
          await postsApi.reject(postId, {
            rejection_reason: 'Rejected by IMC QA reviewer.',
            reason: 'Rejected by IMC QA reviewer.',
          });
        }
      }
    } catch (err: any) {
      console.log('Approval API note:', err?.response?.data?.message || err?.message);
    } finally {
      setIsActionLoading(false);
    }

    // Update status in local state for instantaneous feedback
    if (type === 'Approve' || type === 'Edit & Approve') {
      setRequests((prev) =>
        prev.map((item) =>
          item.id === selectedRequest.id
            ? { ...item, status: 'Approved', caption: editableCaption }
            : item
        )
      );
    } else {
      setRequests((prev) =>
        prev.map((item) =>
          item.id === selectedRequest.id ? { ...item, status: 'Rejected' } : item
        )
      );
    }

    const actionText =
      type === 'Approve'
        ? `Request "${selectedRequest.title}" approved successfully!`
        : type === 'Edit & Approve'
          ? `Request "${selectedRequest.title}" updated and approved directly by IMC!`
          : `Request "${selectedRequest.title}" rejected.`;

    setActionFeedback(actionText);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handlePickNewMedia = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        multiple: false,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const file = res.assets[0];
        const rawFile = (file as any).file || file;
        setReplacementFile(rawFile);
        setRequests((prev) =>
          prev.map((item) =>
            item.id === selectedRequest?.id ? { ...item, thumbnailUrl: file.uri } : item
          )
        );
      }
    } catch {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const f = e.target.files?.[0];
          if (f) {
            setReplacementFile(f);
            const url = URL.createObjectURL(f);
            setRequests((prev) =>
              prev.map((item) =>
                item.id === selectedRequest?.id ? { ...item, thumbnailUrl: url } : item
              )
            );
          }
        };
        input.click();
      }
    }
  };

  const handleDownloadImage = async (url?: string, filename?: string) => {
    if (!url) return;
    try {
      const fullUrl = resolveImageUrl(url) || url;
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        try {
          const resp = await fetch(fullUrl, { mode: 'cors' });
          if (resp.ok) {
            const blob = await resp.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename || 'attachment.png';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              document.body.removeChild(a);
              window.URL.revokeObjectURL(blobUrl);
            }, 100);
            return;
          }
        } catch {
          // Fallback if fetch/CORS blocks
        }
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = fullUrl;
        a.download = filename || 'attachment.png';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
      } else {
        Linking.openURL(fullUrl);
      }
    } catch (err) {
      console.log('Error downloading image:', err);
    }
  };

  const getStatusBadge = (status: ImcRequestItem['status']) => {
    switch (status) {
      case 'Pending':
        return (
          <View style={[styles.statusBadge, styles.statusPending]}>
            <Ionicons name="time" size={13} color="#D97706" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#D97706' }]}>Pending</Text>
          </View>
        );
      case 'Approved':
        return (
          <View style={[styles.statusBadge, styles.statusApproved]}>
            <Ionicons name="checkmark-circle" size={13} color="#16A34A" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#16A34A' }]}>Approved</Text>
          </View>
        );
      case 'Rejected':
        return (
          <View style={[styles.statusBadge, styles.statusRejected]}>
            <Ionicons name="close-circle" size={13} color="#DC2626" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#DC2626' }]}>Rejected</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.statusBadge, styles.statusReviewing]}>
            <Ionicons name="sync" size={13} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#0284C7' }]}>Reviewing</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Toast Feedback */}
      {actionFeedback && (
        <View style={styles.feedbackBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#15803D" />
          <Text style={styles.feedbackBannerText}>{actionFeedback}</Text>
        </View>
      )}

      {/* ================= MAIN SPLIT CONTENT ================= */}
      <View style={[styles.splitLayout, !isDesktop && styles.splitLayoutStacked]}>
        {/* ================= LEFT COLUMN: REQUESTS LIST ================= */}
        <View
          style={[
            styles.leftSection,
            { flex: 1, width: '100%' },
            isDesktop && isSidePanelOpen && !isPanelMaximized && { flex: 1.25 },
            isDesktop && isSidePanelOpen && isPanelMaximized && { display: 'none' },
          ]}
        >
          {/* Header Row: Document Icon + Title + Subtitle + Search + Filter */}
          <View style={styles.listHeaderRow}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.headerIconSquare}>
                <Ionicons name="document-text" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.sectionHeading}>{sectionHeading}</Text>
                <Text style={styles.sectionSubheading}>
                  {sectionSubheading}
                </Text>
              </View>
            </View>

            <View style={styles.searchAndFilterGroup}>
              {Boolean(onSwitchToClassic) && (
                <TouchableOpacity
                  style={styles.switchClassicBtn}
                  onPress={onSwitchToClassic}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal" size={15} color="#581C87" style={{ marginRight: 6 }} />
                  <Text style={styles.switchClassicBtnText}>Switch to Classic Dashboard</Text>
                </TouchableOpacity>
              )}

              {/* Search Bar */}
              <View style={styles.searchBarContainer}>
                <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by title, department..."
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

          {/* Cards List */}
          <ScrollView
            style={styles.cardsScroll}
            contentContainerStyle={styles.cardsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="file-tray-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No matching requests found</Text>
                <Text style={styles.emptySubtitle}>Adjust your search or filter criteria</Text>
              </View>
            ) : (
              paginatedRequests.map((item) => {
                const isSelected = selectedRequestId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.requestCard,
                      isSelected && styles.requestCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedRequestId(item.id);
                      setIsSidePanelOpen(true);
                    }}
                    activeOpacity={0.85}
                  >
                    {/* Left Thumbnail with Photo Preview click */}
                    {item.thumbnailUrl ? (
                      <TouchableOpacity
                        onPress={() => setLightboxImage(item.thumbnailUrl)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: item.thumbnailUrl }}
                          style={styles.cardThumbnail}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.cardThumbnail, styles.cardThumbnailPlaceholder]}>
                        <Ionicons name="image-outline" size={32} color="#94A3B8" />
                      </View>
                    )}

                    {/* Right Card Body */}
                    <View style={styles.cardBody}>
                      {/* Top Row: Code Tag + Status Badge */}
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

                      {/* Info Row: WHEN | WHO (Dept) | WHO (Requester) */}
                      <View style={styles.detailsRow}>
                        {/* WHEN */}
                        <View style={styles.detailCol}>
                          <Ionicons name="calendar-outline" size={15} color="#4B5563" style={{ marginRight: 5 }} />
                          <View>
                            <Text style={styles.detailValueBold}>{item.date}</Text>
                            {Boolean(item.time) && (
                              <Text style={styles.detailValueSub}>{item.time}</Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.detailDivider} />

                        {/* DEPARTMENT */}
                        <View style={styles.detailCol}>
                          <Ionicons name="business-outline" size={15} color="#4B5563" style={{ marginRight: 5 }} />
                          <Text style={styles.detailValue} numberOfLines={1}>
                            {item.department}
                          </Text>
                        </View>

                        <View style={styles.detailDivider} />

                        {/* REQUESTER */}
                        <View style={styles.detailCol}>
                          <Ionicons name="person-outline" size={15} color="#4B5563" style={{ marginRight: 5 }} />
                          <View>
                            <Text style={styles.detailValueBold} numberOfLines={1}>
                              {item.requestedBy}
                            </Text>
                            <Text style={styles.detailValueSub}>(Requester)</Text>
                          </View>
                        </View>
                      </View>

                      {/* Quote Snippet Row */}
                      <View style={styles.snippetRow}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color="#6D28D9" style={{ marginRight: 6 }} />
                        <Text style={styles.snippetText} numberOfLines={1}>
                          &ldquo;{item.snippet}&rdquo;
                        </Text>
                      </View>

                      {/* Action Buttons Row */}
                      <View style={styles.cardFooterActions}>
                        <TouchableOpacity
                          style={styles.viewDetailsBtn}
                          onPress={() => {
                            setSelectedRequestId(item.id);
                            setIsSidePanelOpen(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="eye-outline" size={14} color="#6D28D9" style={{ marginRight: 4 }} />
                          <Text style={styles.viewDetailsBtnText}>View Details</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.reviewBtn}
                          onPress={() => {
                            setSelectedRequestId(item.id);
                            setIsSidePanelOpen(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.reviewBtnText}>Review</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {filteredRequests.length > 0 && (
            <View style={styles.paginationCard}>
              <PaginationControl
                currentPage={currentPage}
                totalItems={filteredRequests.length}
                itemsPerPage={itemsPerPage}
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

        {/* ================= RIGHT COLUMN: CONTENT REQUEST DETAILS PANEL ================= */}
        {isSidePanelOpen && selectedRequest && (
          <View
            style={[
              styles.rightSection,
              isDesktop && { flex: 1 },
              isPanelMaximized && { flex: 1, width: '100%', alignSelf: 'stretch', maxHeight: undefined },
            ]}
          >
            {/* Purple Banner Header */}
            <View style={styles.panelHeaderPurple}>
              <View style={styles.panelHeaderLeft}>
                <Ionicons name="document-text" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.panelHeaderTitle}>Content Request Details</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* Maximize / Restore Toggle */}
                <TouchableOpacity
                  style={styles.panelCloseBtn}
                  onPress={() => setIsPanelMaximized((prev) => !prev)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isPanelMaximized ? 'contract' : 'expand'}
                    size={17}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Close Button */}
                <TouchableOpacity
                  style={styles.panelCloseBtn}
                  onPress={() => {
                    setIsSidePanelOpen(false);
                    setIsPanelMaximized(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Panel Form Body */}
            <ScrollView
              style={styles.panelScroll}
              contentContainerStyle={styles.panelScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Top Meta: Code Tag & Status */}
              <View style={styles.panelTopMetaRow}>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>{selectedRequest.code}</Text>
                </View>
                {getStatusBadge(selectedRequest.status)}
              </View>

              {/* Title */}
              <Text style={styles.panelTitle}>{selectedRequest.title}</Text>

              {/* Header Details: Date | Dept | Requester */}
              <View style={styles.panelDetailsSummaryRow}>
                <View style={styles.panelSummaryCol}>
                  <Ionicons name="calendar-outline" size={15} color="#4B5563" style={{ marginRight: 4 }} />
                  <View>
                    <Text style={styles.panelSummaryBold}>{selectedRequest.date}</Text>
                    {Boolean(selectedRequest.time) && (
                      <Text style={styles.panelSummarySub}>{selectedRequest.time}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.panelSummaryDivider} />

                <View style={styles.panelSummaryCol}>
                  <Ionicons name="business-outline" size={15} color="#4B5563" style={{ marginRight: 4 }} />
                  <Text style={styles.panelSummaryBold} numberOfLines={1}>{selectedRequest.department}</Text>
                </View>

                <View style={styles.panelSummaryDivider} />

                <View style={styles.panelSummaryCol}>
                  <Ionicons name="person-outline" size={15} color="#4B5563" style={{ marginRight: 4 }} />
                  <View>
                    <Text style={styles.panelSummaryBold} numberOfLines={1}>{selectedRequest.requestedBy}</Text>
                    <Text style={styles.panelSummarySub}>(Requester)</Text>
                  </View>
                </View>
              </View>

              {/* Tabs Bar: Content Details | Request Info | Activity Log */}
              <View style={styles.detailTabBar}>
                <TouchableOpacity
                  style={[styles.detailTabItem, detailTab === 'details' && styles.detailTabItemActive]}
                  onPress={() => setDetailTab('details')}
                >
                  <Ionicons
                    name="image-outline"
                    size={15}
                    color={detailTab === 'details' ? '#6D28D9' : '#6B7280'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.detailTabText, detailTab === 'details' && styles.detailTabTextActive]}>
                    Content Details
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailTabItem, detailTab === 'info' && styles.detailTabItemActive]}
                  onPress={() => setDetailTab('info')}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={15}
                    color={detailTab === 'info' ? '#6D28D9' : '#6B7280'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.detailTabText, detailTab === 'info' && styles.detailTabTextActive]}>
                    Request Info
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailTabItem, detailTab === 'activity' && styles.detailTabItemActive]}
                  onPress={() => setDetailTab('activity')}
                >
                  <Ionicons
                    name="time-outline"
                    size={15}
                    color={detailTab === 'activity' ? '#6D28D9' : '#6B7280'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.detailTabText, detailTab === 'activity' && styles.detailTabTextActive]}>
                    Activity Log
                  </Text>
                </TouchableOpacity>
              </View>

              {detailTab === 'details' && (
                <>
                  {/* CAPTION SECTION */}
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionBlockTitle}>Caption</Text>

                    {/* Rich Text Editor Toolbar */}
                    <View style={styles.richToolbar}>
                      <TouchableOpacity style={styles.toolbarIconBtn}>
                        <Text style={styles.toolbarIconTextBold}>B</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarIconBtn}>
                        <Text style={styles.toolbarIconTextItalic}>I</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarIconBtn}>
                        <Text style={styles.toolbarIconTextUnderline}>U</Text>
                      </TouchableOpacity>
                      <View style={styles.toolbarDivider} />
                      <TouchableOpacity style={styles.toolbarIconBtn}>
                        <Ionicons name="link-outline" size={15} color="#4B5563" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarIconBtn}>
                        <Ionicons name="image-outline" size={15} color="#4B5563" />
                      </TouchableOpacity>
                      <View style={styles.toolbarDivider} />
                      <TouchableOpacity style={styles.toolbarIconBtn}>
                        <Ionicons name="list-outline" size={15} color="#4B5563" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarIconBtn}>
                        <Ionicons name="reorder-four-outline" size={15} color="#4B5563" />
                      </TouchableOpacity>
                    </View>

                    {/* Text Area */}
                    <TextInput
                      style={styles.captionInput}
                      value={editableCaption}
                      onChangeText={setEditableCaption}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* MEDIA ATTACHMENT SECTION */}
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionBlockTitle}>Media Attachment</Text>

                    <View style={styles.mediaAttachmentRow}>
                      {/* Attached Thumbnail Preview with delete badge, download badge, and photo preview */}
                      {Boolean(selectedRequest.thumbnailUrl) && (
                        <View style={{ alignItems: 'center' }}>
                          <TouchableOpacity
                            style={styles.mediaPreviewCard}
                            onPress={() => setLightboxImage(selectedRequest.thumbnailUrl)}
                            activeOpacity={0.85}
                          >
                            <Image
                              source={{ uri: resolveImageUrl(selectedRequest.thumbnailUrl) || selectedRequest.thumbnailUrl }}
                              style={styles.mediaPreviewImage}
                              resizeMode="cover"
                            />
                            <View style={styles.mediaEnlargeBadge}>
                              <Ionicons name="scan-outline" size={12} color="#FFFFFF" />
                            </View>
                            <TouchableOpacity
                              style={styles.mediaDownloadBadge}
                              onPress={(e: any) => {
                                if (e && e.stopPropagation) e.stopPropagation();
                                handleDownloadImage(selectedRequest.thumbnailUrl, `${selectedRequest.code || 'media'}-attachment.png`);
                              }}
                            >
                              <Ionicons name="download-outline" size={12} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.mediaRemoveBadge}
                              onPress={(e: any) => {
                                if (e && e.stopPropagation) e.stopPropagation();
                                setReplacementFile(null);
                                setRequests((prev) =>
                                  prev.map((item) =>
                                    item.id === selectedRequest?.id ? { ...item, thumbnailUrl: '' } : item
                                  )
                                );
                              }}
                            >
                              <Ionicons name="close" size={12} color="#FFFFFF" />
                            </TouchableOpacity>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.quickDownloadBtn}
                            onPress={() => handleDownloadImage(selectedRequest.thumbnailUrl, `${selectedRequest.code || 'media'}-attachment.png`)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="download-outline" size={12} color="#6D28D9" style={{ marginRight: 4 }} />
                            <Text style={styles.quickDownloadBtnText}>Download</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Replace Image Upload Dropzone */}
                      <TouchableOpacity
                        style={styles.replaceImageDropzone}
                        onPress={handlePickNewMedia}
                        activeOpacity={0.8}
                      >
                        <View style={styles.replaceCloudCircle}>
                          <Ionicons name="cloud-upload-outline" size={20} color="#6D28D9" />
                        </View>
                        <Text style={styles.replaceTitle}>Replace Image</Text>
                        <Text style={styles.replaceSub}>Drag & drop or click to upload</Text>
                        <Text style={styles.replaceFormats}>(JPG, PNG, WEBP)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* DECISION SECTION */}
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionBlockTitle}>Decision</Text>

                    <View style={styles.decisionActionsRow}>
                      {/* APPROVE BUTTON */}
                      <TouchableOpacity
                        style={styles.decisionBtnApprove}
                        onPress={() => handleDecision('Approve')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={{ marginRight: 6 }} />
                        <Text style={styles.decisionBtnApproveText}>Approve</Text>
                      </TouchableOpacity>

                      {/* EDIT & APPROVE BUTTON */}
                      <TouchableOpacity
                        style={styles.decisionBtnEditApprove}
                        onPress={() => handleDecision('Edit & Approve')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="pencil" size={15} color="#6D28D9" style={{ marginRight: 6 }} />
                        <Text style={styles.decisionBtnEditText}>Edit & Approve</Text>
                      </TouchableOpacity>

                      {/* REJECT BUTTON */}
                      <TouchableOpacity
                        style={styles.decisionBtnReject}
                        onPress={() => handleDecision('Reject')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                        <Text style={styles.decisionBtnRejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {detailTab === 'info' && (
                <View style={styles.tabContentCard}>
                  <Text style={styles.tabContentHeading}>Additional Request Info</Text>
                  <View style={styles.infoFieldRow}>
                    <Text style={styles.infoFieldLabel}>Category:</Text>
                    <Text style={styles.infoFieldValue}>{selectedRequest.category || 'General Announcement'}</Text>
                  </View>
                  <View style={styles.infoFieldRow}>
                    <Text style={styles.infoFieldLabel}>Department:</Text>
                    <Text style={styles.infoFieldValue}>{selectedRequest.department || 'General'}</Text>
                  </View>
                  <View style={styles.infoFieldRow}>
                    <Text style={styles.infoFieldLabel}>Channels / Platforms:</Text>
                    <Text style={styles.infoFieldValue}>
                      {selectedRequest.platforms && selectedRequest.platforms.length > 0
                        ? selectedRequest.platforms.map((p: string) => p.toUpperCase()).join(', ')
                        : 'Institutional Platforms'}
                    </Text>
                  </View>
                  <View style={styles.infoFieldRow}>
                    <Text style={styles.infoFieldLabel}>Routing Path:</Text>
                    <Text style={styles.infoFieldValue}>
                      {selectedRequest.routing_type === 'direct_imc'
                        ? 'Direct to IMC (Fast-Track)'
                        : 'Standard Multi-Stage'}
                    </Text>
                  </View>
                  <View style={styles.infoFieldRow}>
                    <Text style={styles.infoFieldLabel}>Review Status:</Text>
                    <Text style={[styles.infoFieldValue, { color: selectedRequest.status === 'Approved' ? '#16A34A' : '#D97706', fontWeight: 'bold' }]}>
                      {selectedRequest.status}
                    </Text>
                  </View>
                </View>
              )}

              {detailTab === 'activity' && (
                <View style={styles.tabContentCard}>
                  <Text style={styles.tabContentHeading}>Review History & Activity</Text>
                  <View style={styles.activityStep}>
                    <View style={styles.activityStepDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityStepTitle}>Content Created & Submitted</Text>
                      <Text style={styles.activityStepDate}>
                        {selectedRequest.date} {selectedRequest.time ? `at ${selectedRequest.time}` : ''} by {selectedRequest.requestedBy}
                      </Text>
                    </View>
                  </View>
                  {selectedRequest.approval_workflows && selectedRequest.approval_workflows.length > 0 ? (
                    selectedRequest.approval_workflows.map((w: any, idx: number) => {
                      const isApproved = w.action === 'approved';
                      const isRejected = w.action === 'rejected';
                      const dotColor = isApproved ? '#16A34A' : isRejected ? '#DC2626' : '#6D28D9';
                      const stageLabel =
                        w.stage === 'office_head'
                          ? 'Department Head Review'
                          : w.stage === 'vice_president'
                            ? 'Vice President Review'
                            : 'IMC Quality Assurance';
                      const approverName = w.approver?.full_name || 'Reviewer';
                      const actionLabel = isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Action taken';

                      return (
                        <View key={w.id || idx} style={styles.activityStep}>
                          <View style={[styles.activityStepDot, { backgroundColor: dotColor }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.activityStepTitle}>{stageLabel}: {actionLabel}</Text>
                            <Text style={styles.activityStepDate}>
                              {w.created_at ? new Date(w.created_at).toLocaleString() : ''} by {approverName}
                            </Text>
                            {Boolean(w.comments) && (
                              <Text style={{ fontSize: 12, color: '#4B5563', fontStyle: 'italic', marginTop: 2 }}>
                                "{w.comments}"
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.activityStep}>
                      <View style={[styles.activityStepDot, { backgroundColor: '#6D28D9' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityStepTitle}>
                          {selectedRequest.status === 'Approved' ? 'Approved by IMC QA' : 'Awaiting Integrated Marketing Review'}
                        </Text>
                        <Text style={styles.activityStepDate}>
                          {selectedRequest.status === 'Approved' ? 'Institutional Review Complete' : 'Currently at Quality Assurance Stage'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Lightbox Modal for High-Resolution Photo Preview */}
      {Boolean(lightboxImage) && (
        <Modal
          visible={Boolean(lightboxImage)}
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxImage(null)}
        >
          <View style={styles.lightboxOverlay}>
            <View style={styles.lightboxCard}>
              <View style={styles.lightboxHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="image" size={18} color="#FFC72C" />
                  <Text style={styles.lightboxTitle}>Media Attachment Preview</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    style={styles.lightboxDownloadBtn}
                    onPress={() => handleDownloadImage(lightboxImage || undefined, `${selectedRequest?.code || 'media'}-attachment.png`)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="download-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.lightboxDownloadBtnText}>Download Image</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.lightboxCloseBtn}
                    onPress={() => setLightboxImage(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
              {lightboxImage && (
                <Image
                  source={{ uri: resolveImageUrl(lightboxImage) || lightboxImage }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    width: '100%',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)' }
      : { elevation: 2 }),
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

  switchClassicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
  },
  switchClassicBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#581C87',
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
    marginBottom: 16,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconSquare: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#581C87', // JMCFI Purple
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E1B4B',
    letterSpacing: -0.3,
  },
  sectionSubheading: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
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
    width: 240,
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
  },
  cardsScrollContent: {
    paddingBottom: 24,
    gap: 14,
  },
  paginationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
    overflow: 'hidden',
  },
  requestCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    width: '100%',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)' }
      : { elevation: 1 }),
  },
  requestCardSelected: {
    borderColor: '#6D28D9',
    borderWidth: 2,
    backgroundColor: '#FAF5FF',
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
  statusRejected: {
    backgroundColor: '#FEE2E2',
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
    marginBottom: 6,
    lineHeight: 20,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  detailCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#E2E8F0',
  },
  detailValueBold: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  detailValueSub: {
    fontSize: 10,
    color: '#6B7280',
  },

  snippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  snippetText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#4B5563',
    flex: 1,
  },

  cardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6D28D9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  viewDetailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6D28D9',
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#581C87', // JMCFI Purple
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* RIGHT SECTION: DETAILS PANEL */
  rightSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    alignSelf: 'flex-start',
    width: '100%',
    maxHeight: 820,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)' }
      : { elevation: 3 }),
  },
  panelHeaderPurple: {
    backgroundColor: '#581C87',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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

  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    padding: 16,
    gap: 14,
  },

  panelTopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    lineHeight: 24,
  },
  panelDetailsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    gap: 10,
    flexWrap: 'wrap',
  },
  panelSummaryCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  panelSummaryDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
  },
  panelSummaryBold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  panelSummarySub: {
    fontSize: 10,
    color: '#6B7280',
  },

  /* Internal Tabs Bar */
  detailTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  detailTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  detailTabItemActive: {
    borderBottomColor: '#6D28D9',
  },
  detailTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  detailTabTextActive: {
    color: '#6D28D9',
    fontWeight: '700',
  },

  sectionBlock: {
    gap: 6,
  },
  sectionBlockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
  },

  /* Rich Text Toolbar */
  richToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  toolbarIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarIconTextBold: {
    fontWeight: '900',
    fontSize: 13,
    color: '#374151',
  },
  toolbarIconTextItalic: {
    fontStyle: 'italic',
    fontWeight: '700',
    fontSize: 13,
    color: '#374151',
  },
  toolbarIconTextUnderline: {
    textDecorationLine: 'underline',
    fontWeight: '700',
    fontSize: 13,
    color: '#374151',
  },
  toolbarDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  captionInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1F2937',
    minHeight: 80,
    outlineWidth: 0,
    lineHeight: 18,
  },

  /* Media Attachment Section */
  mediaAttachmentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  mediaPreviewCard: {
    position: 'relative',
    width: 150,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  mediaRemoveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(30, 27, 75, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceImageDropzone: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  replaceCloudCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  replaceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  replaceSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  replaceFormats: {
    fontSize: 9,
    color: '#9CA3AF',
  },

  /* Decision Action Buttons */
  decisionActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  decisionBtnApprove: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#16A34A',
    borderRadius: 8,
    paddingVertical: 10,
  },
  decisionBtnApproveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  decisionBtnEditApprove: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#6D28D9',
    borderRadius: 8,
    paddingVertical: 10,
  },
  decisionBtnEditText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6D28D9',
  },
  decisionBtnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 10,
  },
  decisionBtnRejectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Info & Activity Tabs */
  tabContentCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  tabContentHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  infoFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoFieldLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  infoFieldValue: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
  },
  activityStep: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  activityStepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginTop: 5,
  },
  activityStepTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  activityStepDate: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },

  /* Empty state */
  emptyContainer: {
    padding: 40,
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

  mediaEnlargeBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    padding: 3,
  },
  mediaDownloadBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(109, 40, 217, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#F5F3FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  quickDownloadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },

  /* Lightbox Modal */
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  lightboxCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    overflow: 'hidden',
    maxWidth: 960,
    width: '100%',
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#4338CA',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  lightboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  lightboxTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  lightboxDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6D28D9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  lightboxDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  lightboxCloseBtn: {
    padding: 4,
  },
  lightboxImage: {
    width: '100%',
    height: 520,
    backgroundColor: '#0F172A',
  },
});

export default ImcApprovalModule;
