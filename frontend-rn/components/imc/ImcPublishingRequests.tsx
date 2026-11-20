import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  useWindowDimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveImageUrl } from '../../services/api';
import { useThemeStore } from '../../store/theme';
import { Colors, Spacing } from '../../constants/theme';
import { dashboardStyles, dashboardUi, useDashboardLayout } from '../ui/dashboardDesign';
import { DepartmentCell } from '../../utils/departmentFormatter';
import { PaginationControl } from '../ui/PaginationControl';

export type ImcPublishingMode = 'direct-imc' | 'in-progress-editing' | 'for-approval' | 'published' | 'requests';

interface ImcPublishingRequestsProps {
  requests: any[];
  onReviewRequest: (req: any) => void;
  onApproveRequest?: (req: any) => void;
  onRejectRequest?: (req: any) => void;
  departments?: string[];
  mode?: ImcPublishingMode;
}

export const ImcPublishingRequests: React.FC<ImcPublishingRequestsProps> = ({
  requests,
  onReviewRequest,
  onApproveRequest,
  onRejectRequest,
  departments: propDepartments,
  mode = 'requests',
}) => {
  const { onLayout, isCompact } = useDashboardLayout();
  const isTablet = !isCompact;
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<'All Time' | 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Range'>('All Time');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isPerPageDropdownOpen, setIsPerPageDropdownOpen] = useState(false);

  // Close dropdowns when clicking outside on web
  const filterDropdownsRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          filterDropdownsRef.current &&
          !filterDropdownsRef.current.contains(e.target as Node)
        ) {
          setIsDeptDropdownOpen(false);
          setIsDateDropdownOpen(false);
          setIsPerPageDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, []);

  // Resolve string department safely whether passed as string or backend Department object
  const resolveDepartmentName = (r: any, fallback = ''): string => {
    const candidates = [r?.dept, r?.department, r?.requestor?.department, r?.rawPost?.department];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (c && typeof c === 'object') {
        const name = c.display_name || c.name;
        if (typeof name === 'string' && name.trim()) return name.trim();
      }
    }
    return fallback;
  };

  // Compute available departments
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    set.add('All Departments');
    if (propDepartments && propDepartments.length > 0) {
      propDepartments.forEach((d) => set.add(d));
    }
    requests.forEach((r) => {
      const dept = resolveDepartmentName(r);
      if (dept) {
        set.add(dept);
      }
    });
    return Array.from(set);
  }, [requests, propDepartments]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Direct IMC flow prioritization or published filter
      if (mode === 'published') {
        const st = String(r.status || '').toLowerCase();
        if (st !== 'published') return false;
      }

      // Department filter
      if (selectedDept !== 'All Departments') {
        const dept = resolveDepartmentName(r);
        if (dept !== selectedDept) return false;
      }

      // Date filter
      if (dateFilter !== 'All Time') {
        const createdAt = r.rawDate || (r.created_at ? new Date(r.created_at) : null);
        if (createdAt && !isNaN(createdAt.getTime())) {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (dateFilter === 'Today') {
            if (createdAt < startOfToday) return false;
          } else if (dateFilter === 'Yesterday') {
            const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
            if (createdAt < startOfYesterday || createdAt >= startOfToday) return false;
          } else if (dateFilter === 'Last 7 Days') {
            const startOf7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (createdAt < startOf7Days) return false;
          } else if (dateFilter === 'Last 30 Days') {
            const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (createdAt < startOf30Days) return false;
          } else if (dateFilter === 'Custom Range') {
            const start = customStartDate ? new Date(customStartDate) : null;
            const end = customEndDate ? new Date(customEndDate) : null;
            if (start && !isNaN(start.getTime())) {
              const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
              if (createdAt < startOfDay) return false;
            }
            if (end && !isNaN(end.getTime())) {
              const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
              if (createdAt > endOfDay) return false;
            }
          }
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const title = (r.title || '').toLowerCase();
        const dept = resolveDepartmentName(r).toLowerCase();
        const requestedBy = (r.requestedBy || r.requestor?.full_name || '').toLowerCase();
        const caption = (r.caption || r.caption_narrative || '').toLowerCase();
        if (
          !title.includes(q) &&
          !dept.includes(q) &&
          !requestedBy.includes(q) &&
          !caption.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [requests, mode, selectedDept, dateFilter, customStartDate, customEndDate, searchQuery]);

  // Pagination calculation
  const totalItems = filteredRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Helpers
  const getThumbnailUri = (req: any): string | null => {
    if (req.featured_image) return resolveImageUrl(req.featured_image);
    if (Array.isArray(req.media) && req.media.length > 0) {
      const firstImg =
        req.media.find((m: any) => {
          const mime = (m.mime_type || m.type || '').toLowerCase();
          const path = (m.file_path || m.url || m.uri || '').toLowerCase();
          return mime.startsWith('image') || path.match(/\.(jpg|jpeg|png|webp|gif)/);
        }) || req.media[0];
      return resolveImageUrl(firstImg.file_path || firstImg.url || firstImg.uri);
    }
    if (req.rawPost?.featured_image) return resolveImageUrl(req.rawPost.featured_image);
    return null;
  };

  const getMediaCount = (req: any): number => {
    if (Array.isArray(req.media)) return req.media.length;
    if (Array.isArray(req.rawPost?.media)) return req.rawPost.media.length;
    if (req.featured_image) return 1;
    return 0;
  };

  const formatRequestedDate = (dateVal: any): string => {
    if (!dateVal) return 'Nov 08, 2026';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const getPlatformList = (platforms: any): string[] => {
    if (!platforms) return [];
    if (Array.isArray(platforms)) return platforms.map((p) => String(p).toLowerCase());
    if (typeof platforms === 'object') {
      return Object.keys(platforms)
        .filter((k) => !!platforms[k])
        .map((k) => k.toLowerCase());
    }
    if (typeof platforms === 'string') {
      try {
        const parsed = JSON.parse(platforms);
        return getPlatformList(parsed);
      } catch {
        return [platforms.toLowerCase()];
      }
    }
    return [];
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* ================= PAGE HEADER & BREADCRUMB ================= */}
      <View style={styles.pageHeader}>
        <View style={styles.breadcrumbRow}>
          <Text style={[styles.breadcrumbText, isDarkMode && styles.breadcrumbTextDark]}>
            IMC
          </Text>
          <Text style={[styles.breadcrumbDivider, isDarkMode && styles.breadcrumbDividerDark]}>
            /
          </Text>
          <Text style={[styles.breadcrumbCurrent, isDarkMode && styles.breadcrumbCurrentDark]}>
            PUBLICATION MANAGEMENT
          </Text>
        </View>

        <Text style={[styles.pageTitle, isDarkMode && styles.pageTitleDark]}>
          {mode === 'published'
            ? 'Published Posts'
            : mode === 'in-progress-editing'
              ? 'In-Progress Editing'
              : mode === 'for-approval'
                ? 'For Approval'
                : 'Direct to IMC Requests'}
        </Text>
        <Text style={[styles.pageSubtitle, isDarkMode && styles.pageSubtitleDark]}>
          {mode === 'published'
            ? 'View and manage published releases across all official platforms.'
            : mode === 'in-progress-editing'
              ? 'Requests where raw photos or captions are actively being edited and prepared for publication.'
              : mode === 'for-approval'
                ? 'Standard department requests requiring IMC QA clearance. Review, approve, or reject.'
                : 'Incoming requests sent directly to IMC for editing, refinement, and publication.'}
        </Text>
      </View>

      {/* ================= MAIN CARD CONTAINER ================= */}
      <View style={[styles.mainCard, isDarkMode && styles.mainCardDark]}>
        {/* Card Toolbar Row */}
        <View style={[styles.cardToolbar, !isTablet && styles.cardToolbarStacked]}>
          <Text style={[styles.cardTitle, isDarkMode && styles.cardTitleDark]}>
            {mode === 'published'
              ? 'Published Content'
              : mode === 'in-progress-editing'
                ? 'Currently Editing'
                : mode === 'for-approval'
                  ? 'Standard Requests Awaiting Approval'
                  : 'Direct to IMC Queue'}
          </Text>

          {/* Right Toolbar Actions */}
          <View ref={filterDropdownsRef} style={[styles.toolbarActions, !isTablet && styles.toolbarActionsStacked]}>
            {/* 1. Date Range Dropdown */}
            <View style={{ position: 'relative', zIndex: isDateDropdownOpen ? 1000 : 30 }}>
              <TouchableOpacity
                style={[styles.filterDropdownBtn, isDarkMode && styles.filterDropdownBtnDark]}
                onPress={() => {
                  setIsDateDropdownOpen(!isDateDropdownOpen);
                  setIsDeptDropdownOpen(false);
                  setIsPerPageDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={isDarkMode ? '#94A3B8' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.filterDropdownBtnText, isDarkMode && styles.filterDropdownBtnTextDark]}>
                  {dateFilter}
                </Text>
                <Ionicons
                  name={isDateDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={isDarkMode ? '#94A3B8' : '#64748B'}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>

              {isDateDropdownOpen && (
                <View style={[styles.dropdownMenu, isDarkMode && styles.dropdownMenuDark, { minWidth: 200, width: 210 }]}>
                  {(['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.dropdownMenuItem,
                        dateFilter === opt && styles.dropdownMenuItemActive,
                        dateFilter === opt && isDarkMode && styles.dropdownMenuItemActiveDark,
                      ]}
                      onPress={() => {
                        setDateFilter(opt);
                        if (opt !== 'Custom Range') {
                          setIsDateDropdownOpen(false);
                          setCurrentPage(1);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownMenuItemText,
                          isDarkMode && styles.dropdownMenuItemTextDark,
                          dateFilter === opt && styles.dropdownMenuItemTextActive,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {dateFilter === 'Custom Range' && (
                    <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? Colors.border : '#E2E8F0' }}>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: isDarkMode ? '#94A3B8' : Colors.textSecondary, marginBottom: 4 }}>Start Date</Text>
                      {Platform.OS === 'web' ? (
                        <input
                          aria-label="Start Date"
                          type="date"
                          style={{
                            height: 32,
                            fontSize: 12,
                            borderRadius: 6,
                            border: `1px solid ${isDarkMode ? Colors.border : '#CBD5E1'}`,
                            paddingLeft: 8,
                            paddingRight: 8,
                            outline: 'none',
                            backgroundColor: isDarkMode ? Colors.surface : '#FFFFFF',
                            color: isDarkMode ? '#F8FAFC' : Colors.textPrimary,
                            width: '100%',
                            marginBottom: 8,
                            boxSizing: 'border-box',
                          }}
                          value={customStartDate}
                          onChange={(e: any) => {
                            setCustomStartDate(e.target.value);
                            setCurrentPage(1);
                          }}
                        />
                      ) : (
                        <TextInput
                          style={[styles.searchInput, { height: 32, marginBottom: 8, fontSize: 12 }]}
                          placeholder="YYYY-MM-DD"
                          value={customStartDate}
                          onChangeText={(v) => {
                            setCustomStartDate(v);
                            setCurrentPage(1);
                          }}
                        />
                      )}
                      <Text style={{ fontSize: 11, fontWeight: '500', color: isDarkMode ? '#94A3B8' : Colors.textSecondary, marginBottom: 4 }}>End Date</Text>
                      {Platform.OS === 'web' ? (
                        <input
                          aria-label="End Date"
                          type="date"
                          style={{
                            height: 32,
                            fontSize: 12,
                            borderRadius: 6,
                            border: `1px solid ${isDarkMode ? Colors.border : '#CBD5E1'}`,
                            paddingLeft: 8,
                            paddingRight: 8,
                            outline: 'none',
                            backgroundColor: isDarkMode ? Colors.surface : '#FFFFFF',
                            color: isDarkMode ? '#F8FAFC' : Colors.textPrimary,
                            width: '100%',
                            marginBottom: 8,
                            boxSizing: 'border-box',
                          }}
                          value={customEndDate}
                          onChange={(e: any) => {
                            setCustomEndDate(e.target.value);
                            setCurrentPage(1);
                          }}
                        />
                      ) : (
                        <TextInput
                          style={[styles.searchInput, { height: 32, marginBottom: 8, fontSize: 12 }]}
                          placeholder="YYYY-MM-DD"
                          value={customEndDate}
                          onChangeText={(v) => {
                            setCustomEndDate(v);
                            setCurrentPage(1);
                          }}
                        />
                      )}
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#4D007C',
                          height: 32,
                          borderRadius: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 4,
                          ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
                        }}
                        onPress={() => {
                          setIsDateDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* 2. Department Dropdown */}
            <View style={{ position: 'relative', zIndex: isDeptDropdownOpen ? 1000 : 30 }}>
              <TouchableOpacity
                style={[styles.filterDropdownBtn, isDarkMode && styles.filterDropdownBtnDark]}
                onPress={() => {
                  setIsDeptDropdownOpen(!isDeptDropdownOpen);
                  setIsDateDropdownOpen(false);
                  setIsPerPageDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.filterDropdownBtnText, isDarkMode && styles.filterDropdownBtnTextDark]}
                  numberOfLines={2}
                >
                  {selectedDept}
                </Text>
                <Ionicons
                  name={isDeptDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={isDarkMode ? '#94A3B8' : '#64748B'}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>

              {isDeptDropdownOpen && (
                <View style={[styles.dropdownMenu, isDarkMode && styles.dropdownMenuDark, { width: 220, maxHeight: 250 }]}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {departmentOptions.map((dept) => (
                      <TouchableOpacity
                        key={dept}
                        style={[
                          styles.dropdownMenuItem,
                          selectedDept === dept && styles.dropdownMenuItemActive,
                          selectedDept === dept && isDarkMode && styles.dropdownMenuItemActiveDark,
                        ]}
                        onPress={() => {
                          setSelectedDept(dept);
                          setIsDeptDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownMenuItemText,
                            isDarkMode && styles.dropdownMenuItemTextDark,
                            selectedDept === dept && styles.dropdownMenuItemTextActive,
                          ]}
                          numberOfLines={2}
                        >
                          {dept}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* 3. Search Bar */}
            <View {...(Platform.OS === 'web' ? { dataSet: { dashboardField: 'search' } } : {})} style={[styles.searchBox, !isTablet && { width: '100%' }, isDarkMode && styles.searchBoxDark]}>
              <Ionicons
                name="search"
                size={15}
                color={isDarkMode ? '#94A3B8' : '#94A3B8'}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={[styles.searchInput, isDarkMode && styles.searchInputDark]}
                placeholder="Search requests..."
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                value={searchQuery}
                onChangeText={(val) => {
                  setSearchQuery(val);
                  setCurrentPage(1);
                }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ================= DATA TABLE ================= */}
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: dashboardUi.tableMinWidth, flexGrow: 1 }} style={{ width: '100%' }}>
          <View style={styles.tableContainer}>
            {/* Table Header Row */}
            <View style={[styles.tableHeaderRow, isDarkMode && styles.tableHeaderRowDark]}>
              <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Request title</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Department</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Requested by</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>Date</Text>
              <Text style={[styles.tableHeaderCell, { width: 125, textAlign: 'left' }]}>Platform</Text>
              <View style={{ width: mode === 'for-approval' ? 180 : 120, alignItems: 'center', justifyContent: 'center', paddingRight: 0 }}>
                <Text style={[styles.tableHeaderCell, { paddingRight: 0, textAlign: 'center' }]}>Actions</Text>
              </View>
            </View>

            {/* Table Body Rows */}
            {paginatedRequests.length === 0 ? (
              <View style={styles.emptyTableState}>
                <Ionicons
                  name="document-text-outline"
                  size={42}
                  color={isDarkMode ? '#475569' : '#CBD5E1'}
                  style={{ marginBottom: 10 }}
                />
                <Text style={[styles.emptyTableTitle, isDarkMode && styles.emptyTableTitleDark]}>
                  {mode === 'published'
                    ? 'No published posts yet'
                    : mode === 'in-progress-editing'
                      ? 'No requests currently being edited'
                      : mode === 'for-approval'
                        ? 'No standard requests awaiting approval'
                        : 'No Direct to IMC requests found'}
                </Text>
                <Text style={[styles.emptyTableSubtitle, isDarkMode && styles.emptyTableSubtitleDark]}>
                  {mode === 'published'
                    ? 'Published announcements will appear here once released.'
                    : mode === 'in-progress-editing'
                      ? 'When you start editing or download photos from a request, it will appear here.'
                      : mode === 'for-approval'
                        ? 'All standard department submissions have been cleared or acted on.'
                        : 'Requests submitted directly to IMC for publication will appear here.'}
                </Text>
              </View>
            ) : (
              paginatedRequests.map((req, idx) => {
                const thumbUri = getThumbnailUri(req);
                const mediaCount = getMediaCount(req);
                const platformsList = getPlatformList(req.platforms || req.target_platforms || req.rawPost?.target_platforms);

                const hasFb = platformsList.includes('facebook') || platformsList.includes('fb');
                const hasIg = platformsList.includes('instagram') || platformsList.includes('ig');
                const hasWeb = platformsList.includes('website') || platformsList.includes('portal') || platformsList.includes('wordpress');

                const departmentName = resolveDepartmentName(req, 'BSIT Department');

                const requestedByName = req.requestedBy || req.requestor?.full_name || 'Requestor';
                const requestedDate = formatRequestedDate(req.rawDate || req.created_at);

                return (
                  <TouchableOpacity
                    key={req.id || idx}
                    activeOpacity={0.7}
                    onPress={() => onReviewRequest(req)}
                    style={[
                      styles.tableRow,
                      isDarkMode && styles.tableRowDark,
                      idx === paginatedRequests.length - 1 && { borderBottomWidth: 0 },
                      Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
                    ]}
                  >
                    {/* 1. Request Title Column with Thumbnail */}
                    <View style={[styles.tableCell, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
                      {thumbUri ? (
                        <Image source={{ uri: thumbUri }} style={styles.rowThumbnail} resizeMode="cover" />
                      ) : (
                        <View style={[styles.rowThumbnailPlaceholder, isDarkMode && styles.rowThumbnailPlaceholderDark]}>
                          <Ionicons name="image-outline" size={22} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                        </View>
                      )}

                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text
                            style={[styles.rowTitleText, isDarkMode && styles.rowTitleTextDark]}
                            numberOfLines={2}
                          >
                            {req.title || 'Untitled Request'}
                          </Text>
                          {mode !== 'direct-imc' && mode !== 'in-progress-editing' && (String(req.routing_type || req.rawPost?.routing_type || '').toLowerCase() === 'direct_imc') && (
                            <View style={styles.directImcRowBadge}>
                              <Text style={styles.directImcRowBadgeText}>Direct to IMC</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.rowSubtitleText, isDarkMode && styles.rowSubtitleTextDark]}>
                          {mediaCount > 0 ? `${mediaCount} photo${mediaCount > 1 ? 's' : ''} attached` : 'Text only'}
                        </Text>
                      </View>
                    </View>

                    {/* 2. Department Column */}
                    <View style={[styles.tableCell, { flex: 1.4 }]}>
                      <DepartmentCell department={departmentName} />
                    </View>

                    {/* 3. Requested By Column */}
                    <View style={[styles.tableCell, { flex: 1.3 }]}>
                      <Text
                        style={[styles.rowCellText, isDarkMode && styles.rowCellTextDark]}
                        numberOfLines={2}
                      >
                        {requestedByName}
                      </Text>
                    </View>

                    {/* 4. Requested On Column */}
                    <View style={[styles.tableCell, { flex: 1.1 }]}>
                      <Text style={[styles.rowDateText, isDarkMode && styles.rowDateTextDark]}>
                        {requestedDate}
                      </Text>
                    </View>

                    {/* 5. Platforms Column */}
                    <View style={[styles.tableCell, { width: 125, gap: 4, justifyContent: 'center' }]}>
                      {hasFb && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="logo-facebook" size={14} color="#1877F2" />
                          <Text style={[styles.rowCellText, { fontSize: 12.5, lineHeight: 18, color: isDarkMode ? '#94A3B8' : '#475569' }]}>Facebook</Text>
                        </View>
                      )}
                      {hasIg && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="logo-instagram" size={14} color="#E1306C" />
                          <Text style={[styles.rowCellText, { fontSize: 12.5, lineHeight: 18, color: isDarkMode ? '#94A3B8' : '#475569' }]}>Instagram</Text>
                        </View>
                      )}
                      {hasWeb && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="globe-outline" size={14} color="#059669" />
                          <Text style={[styles.rowCellText, { fontSize: 12.5, lineHeight: 18, color: isDarkMode ? '#94A3B8' : '#475569' }]}>Website</Text>
                        </View>
                      )}
                      {!hasFb && !hasIg && !hasWeb && (
                        <Text style={{ fontSize: 13, color: isDarkMode ? '#64748B' : '#94A3B8' }}>—</Text>
                      )}
                    </View>

                    {/* 6. Actions Column */}
                    <View style={[styles.tableCell, { width: mode === 'for-approval' ? 180 : 120, paddingRight: 0, alignItems: 'center', justifyContent: 'center' }]}>
                      {mode === 'for-approval' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'nowrap' }}>
                          <TouchableOpacity
                            style={styles.pillApproveBtn}
                            onPress={(e) => {
                              (e as any)?.stopPropagation?.();
                              onApproveRequest ? onApproveRequest(req) : onReviewRequest(req);
                            }}
                            activeOpacity={0.82}
                          >
                            <Ionicons name="checkmark-sharp" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.pillApproveBtnText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.pillRejectBtn}
                            onPress={(e) => {
                              (e as any)?.stopPropagation?.();
                              onRejectRequest ? onRejectRequest(req) : onReviewRequest(req);
                            }}
                            activeOpacity={0.82}
                          >
                            <Ionicons name="close-sharp" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.pillRejectBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      ) : mode === 'in-progress-editing' ? (
                        <TouchableOpacity
                          style={[styles.pillApproveBtn, { backgroundColor: '#7C3AED', paddingHorizontal: 14 }]}
                          onPress={(e) => {
                            (e as any)?.stopPropagation?.();
                            onReviewRequest(req);
                          }}
                          activeOpacity={0.82}
                        >
                          <Ionicons name="create-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.pillApproveBtnText}>Edit</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.pillApproveBtn, { backgroundColor: '#7C3AED', paddingHorizontal: 14 }]}
                          onPress={(e) => {
                            (e as any)?.stopPropagation?.();
                            onReviewRequest(req);
                          }}
                          activeOpacity={0.82}
                        >
                          <Ionicons name="eye-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.pillApproveBtnText}>{mode === 'published' ? 'View' : 'Review'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* ================= TABLE FOOTER & PAGINATION ================= */}
        <PaginationControl
          currentPage={currentPage}
          totalItems={filteredRequests.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newPerPage) => {
            setItemsPerPage(newPerPage);
            setCurrentPage(1);
          }}
          itemName={mode === 'published' ? 'posts' : 'requests'}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { ...dashboardStyles.workspace },
  pageHeader: {
    width: '100%',
    gap: 4,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#581C87',
    letterSpacing: 0.8,
  },
  breadcrumbTextDark: {
    color: '#C084FC',
  },
  breadcrumbDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: '#581C87',
    marginHorizontal: 1,
  },
  breadcrumbDividerDark: {
    color: '#C084FC',
  },
  breadcrumbCurrent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#581C87',
    letterSpacing: 0.8,
  },
  breadcrumbCurrentDark: {
    color: '#E9D5FF',
  },
  pageTitle: { ...dashboardStyles.pageTitle },
  pageTitleDark: {
    color: Colors.textPrimary,
  },
  pageSubtitle: { ...dashboardStyles.subtitle },
  pageSubtitleDark: {
    color: Colors.textSecondary,
  },

  // Main Card
  mainCard: { ...dashboardStyles.panel, width: '100%' },
  mainCardDark: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  cardToolbar: { ...dashboardStyles.panelHeader, zIndex: 100 },
  cardToolbarStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  cardTitle: { ...dashboardStyles.panelTitle },
  cardTitleDark: {
    color: Colors.textPrimary,
  },
  toolbarActions: { ...dashboardStyles.toolbar },
  toolbarActionsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  filterDropdownBtn: { ...dashboardStyles.control },
  filterDropdownBtnDark: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  filterDropdownBtnText: { ...dashboardStyles.controlText },
  filterDropdownBtnTextDark: {
    color: '#E2E8F0',
  },
  dropdownMenu: {
    position: 'absolute',
    top: dashboardUi.controlHeight + Spacing.xs,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    zIndex: 1001,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' } as any)
      : { elevation: 5 }),
  },
  dropdownMenuDark: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  dropdownMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  dropdownMenuItemActive: {
    backgroundColor: '#F3E8FF',
  },
  dropdownMenuItemActiveDark: {
    backgroundColor: '#3B0764',
  },
  dropdownMenuItemText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  dropdownMenuItemTextDark: {
    color: '#E2E8F0',
  },
  dropdownMenuItemTextActive: {
    color: '#581C87',
    fontWeight: '700',
  },
  searchBox: { ...dashboardStyles.search },
  searchBoxDark: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  searchInput: { ...dashboardStyles.searchInput },
  searchInputDark: {
    color: Colors.textPrimary,
  },

  // Table Styles
  tableContainer: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableHeaderRowDark: {
    backgroundColor: Colors.surface,
    borderBottomColor: Colors.border,
  },
  tableHeaderCell: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#64748B',
    paddingRight: Spacing.sm,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  tableRowDark: {
    backgroundColor: Colors.surface,
    borderBottomColor: Colors.border,
  },
  tableCell: { justifyContent: 'center', minWidth: 0, paddingRight: Spacing.sm },
  rowThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  rowThumbnailPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowThumbnailPlaceholderDark: {
    backgroundColor: Colors.surface,
  },
  rowTitleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  rowTitleTextDark: {
    color: '#F8FAFC',
  },
  rowSubtitleText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
    marginTop: 2,
  },
  rowSubtitleTextDark: {
    color: '#94A3B8',
  },
  directImcRowBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  directImcRowBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  rowCellText: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '500',
    color: '#475569',
  },
  rowCellTextDark: {
    color: '#94A3B8',
  },
  rowDateText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#64748B',
  },
  rowDateTextDark: {
    color: '#94A3B8',
  },

  // Platform Circles
  platformCircleFb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformCircleIg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformCircleWeb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Pill Approve / Reject Buttons
  pillApproveBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  pillApproveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  pillRejectBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  pillRejectBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Review Button
  reviewButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: dashboardUi.purple,
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Empty State
  emptyTableState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptyTableTitleDark: {
    color: Colors.textPrimary,
  },
  emptyTableSubtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
  },
  emptyTableSubtitleDark: {
    color: Colors.textSecondary,
  },

  // Footer & Pagination
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 14,
  },
  tableFooterStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  footerShowingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  footerShowingTextDark: {
    color: Colors.textSecondary,
  },
  paginationControlsRow: { ...dashboardStyles.toolbar },
  pageArrowBtn: { ...dashboardStyles.secondaryButton, width: dashboardUi.controlHeight, paddingHorizontal: 0 },
  pageArrowBtnDark: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  pageArrowBtnDisabled: {
    opacity: 0.45,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : {}),
  },
  perPageDropdownBtn: { ...dashboardStyles.control },
  perPageDropdownBtnDark: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  perPageDropdownBtnText: { ...dashboardStyles.controlText },
  perPageDropdownBtnTextDark: {
    color: Colors.textSecondary,
  },
});

