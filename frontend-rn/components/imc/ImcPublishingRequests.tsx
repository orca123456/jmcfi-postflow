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

interface ImcPublishingRequestsProps {
  requests: any[];
  onReviewRequest: (req: any) => void;
  departments?: string[];
  mode?: 'requests' | 'published';
}

export const ImcPublishingRequests: React.FC<ImcPublishingRequestsProps> = ({
  requests,
  onReviewRequest,
  departments: propDepartments,
  mode = 'requests',
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<'All Time' | 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days'>('All Time');
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

  // Compute available departments
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    set.add('All Departments');
    if (propDepartments && propDepartments.length > 0) {
      propDepartments.forEach((d) => set.add(d));
    }
    requests.forEach((r) => {
      const dept =
        r.department ||
        r.requestor?.department ||
        (r.rawPost?.department ? (typeof r.rawPost.department === 'string' ? r.rawPost.department : r.rawPost.department.name) : null);
      if (dept && typeof dept === 'string' && dept.trim()) {
        set.add(dept.trim());
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
        const dept =
          r.department ||
          r.requestor?.department ||
          (r.rawPost?.department ? (typeof r.rawPost.department === 'string' ? r.rawPost.department : r.rawPost.department.name) : '');
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
          }
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const title = (r.title || '').toLowerCase();
        const dept = (r.department || r.requestor?.department || '').toLowerCase();
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
  }, [requests, mode, selectedDept, dateFilter, searchQuery]);

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
    <View style={styles.container}>
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
          {mode === 'published' ? 'Published Posts' : 'Publishing Requests'}
        </Text>
        <Text style={[styles.pageSubtitle, isDarkMode && styles.pageSubtitleDark]}>
          {mode === 'published'
            ? 'View and manage published releases across all official platforms.'
            : 'Review and prepare submitted publications for release.'}
        </Text>
      </View>

      {/* ================= MAIN CARD CONTAINER ================= */}
      <View style={[styles.mainCard, isDarkMode && styles.mainCardDark]}>
        {/* Card Toolbar Row */}
        <View style={[styles.cardToolbar, !isTablet && styles.cardToolbarStacked]}>
          <Text style={[styles.cardTitle, isDarkMode && styles.cardTitleDark]}>
            {mode === 'published' ? 'Published Content' : 'Publishing Requests'}
          </Text>

          {/* Right Toolbar Actions */}
          <View ref={filterDropdownsRef} style={[styles.toolbarActions, !isTablet && styles.toolbarActionsStacked]}>
            {/* 1. Date Range Dropdown */}
            <View style={{ position: 'relative', zIndex: isDateDropdownOpen ? 80 : 30 }}>
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
                <View style={[styles.dropdownMenu, isDarkMode && styles.dropdownMenuDark, { width: 140 }]}>
                  {(['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.dropdownMenuItem,
                        dateFilter === opt && styles.dropdownMenuItemActive,
                        dateFilter === opt && isDarkMode && styles.dropdownMenuItemActiveDark,
                      ]}
                      onPress={() => {
                        setDateFilter(opt);
                        setIsDateDropdownOpen(false);
                        setCurrentPage(1);
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
                </View>
              )}
            </View>

            {/* 2. Department Dropdown */}
            <View style={{ position: 'relative', zIndex: isDeptDropdownOpen ? 80 : 30 }}>
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
                  numberOfLines={1}
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
                          numberOfLines={1}
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
            <View style={[styles.searchBox, isDarkMode && styles.searchBoxDark]}>
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
        <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false}>
          <View style={[styles.tableContainer, !isDesktop && { minWidth: 920 }]}>
            {/* Table Header Row */}
            <View style={[styles.tableHeaderRow, isDarkMode && styles.tableHeaderRowDark]}>
              <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Request Title</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Department</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Requested By</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>Requested On</Text>
              <Text style={[styles.tableHeaderCell, { width: 110, textAlign: 'center' }]}>Platforms</Text>
              <Text style={[styles.tableHeaderCell, { width: 100, textAlign: 'right' }]}>Actions</Text>
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
                  {mode === 'published' ? 'No published posts yet' : 'No publishing requests found'}
                </Text>
                <Text style={[styles.emptyTableSubtitle, isDarkMode && styles.emptyTableSubtitleDark]}>
                  {mode === 'published'
                    ? 'Published announcements will appear here once released.'
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

                const departmentName =
                  req.department ||
                  req.requestor?.department ||
                  (req.rawPost?.department ? (typeof req.rawPost.department === 'string' ? req.rawPost.department : req.rawPost.department.name) : 'BSIT Department');

                const requestedByName = req.requestedBy || req.requestor?.full_name || 'Requestor';
                const requestedDate = formatRequestedDate(req.rawDate || req.created_at);

                return (
                  <View
                    key={req.id || idx}
                    style={[
                      styles.tableRow,
                      isDarkMode && styles.tableRowDark,
                      idx === paginatedRequests.length - 1 && { borderBottomWidth: 0 },
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
                        <Text
                          style={[styles.rowTitleText, isDarkMode && styles.rowTitleTextDark]}
                          numberOfLines={1}
                        >
                          {req.title || 'Untitled Request'}
                        </Text>
                        <Text style={[styles.rowSubtitleText, isDarkMode && styles.rowSubtitleTextDark]}>
                          {mediaCount > 0 ? `${mediaCount} photo${mediaCount > 1 ? 's' : ''} attached` : 'Text only'}
                        </Text>
                      </View>
                    </View>

                    {/* 2. Department Column */}
                    <View style={[styles.tableCell, { flex: 1.4 }]}>
                      <Text
                        style={[styles.rowCellText, isDarkMode && styles.rowCellTextDark]}
                        numberOfLines={1}
                      >
                        {departmentName}
                      </Text>
                    </View>

                    {/* 3. Requested By Column */}
                    <View style={[styles.tableCell, { flex: 1.3 }]}>
                      <Text
                        style={[styles.rowCellText, isDarkMode && styles.rowCellTextDark]}
                        numberOfLines={1}
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
                    <View style={[styles.tableCell, { width: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}>
                      {hasFb && (
                        <View style={styles.platformCircleFb}>
                          <Ionicons name="logo-facebook" size={14} color="#1877F2" />
                        </View>
                      )}
                      {hasIg && (
                        <View style={styles.platformCircleIg}>
                          <Ionicons name="logo-instagram" size={13} color="#E1306C" />
                        </View>
                      )}
                      {hasWeb && (
                        <View style={styles.platformCircleWeb}>
                          <Ionicons name="globe-outline" size={14} color="#059669" />
                        </View>
                      )}
                      {!hasFb && !hasIg && !hasWeb && (
                        <Text style={[styles.rowDateText, { fontSize: 11 }]}>None</Text>
                      )}
                    </View>

                    {/* 6. Actions Column */}
                    <View style={[styles.tableCell, { width: 100, alignItems: 'flex-end', justifyContent: 'center' }]}>
                      <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => onReviewRequest(req)}
                        activeOpacity={0.82}
                      >
                        <Text style={styles.reviewButtonText}>Review</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* ================= TABLE FOOTER & PAGINATION ================= */}
        <View style={[styles.tableFooter, !isTablet && styles.tableFooterStacked]}>
          <Text style={[styles.footerShowingText, isDarkMode && styles.footerShowingTextDark]}>
            Showing {startIndex} to {endIndex} of {totalItems} {mode === 'published' ? 'posts' : 'requests'}
          </Text>

          <View style={styles.paginationControlsRow}>
            {/* Previous Page Button */}
            <TouchableOpacity
              style={[
                styles.pageArrowBtn,
                isDarkMode && styles.pageArrowBtnDark,
                currentPage <= 1 && styles.pageArrowBtnDisabled,
              ]}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chevron-back"
                size={14}
                color={currentPage <= 1 ? (isDarkMode ? '#475569' : '#CBD5E1') : isDarkMode ? '#CBD5E1' : '#334155'}
              />
            </TouchableOpacity>

            {/* Next Page Button */}
            <TouchableOpacity
              style={[
                styles.pageArrowBtn,
                isDarkMode && styles.pageArrowBtnDark,
                currentPage >= totalPages && styles.pageArrowBtnDisabled,
              ]}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chevron-forward"
                size={14}
                color={currentPage >= totalPages ? (isDarkMode ? '#475569' : '#CBD5E1') : isDarkMode ? '#CBD5E1' : '#334155'}
              />
            </TouchableOpacity>

            {/* Items Per Page Dropdown */}
            <View style={{ position: 'relative', zIndex: isPerPageDropdownOpen ? 90 : 20 }}>
              <TouchableOpacity
                style={[styles.perPageDropdownBtn, isDarkMode && styles.perPageDropdownBtnDark]}
                onPress={() => {
                  setIsPerPageDropdownOpen(!isPerPageDropdownOpen);
                  setIsDeptDropdownOpen(false);
                  setIsDateDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.perPageDropdownBtnText, isDarkMode && styles.perPageDropdownBtnTextDark]}>
                  {itemsPerPage} / page
                </Text>
                <Ionicons
                  name={isPerPageDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={isDarkMode ? '#94A3B8' : '#64748B'}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>

              {isPerPageDropdownOpen && (
                <View style={[styles.dropdownMenu, isDarkMode && styles.dropdownMenuDark, { width: 110, bottom: 36, top: undefined }]}>
                  {[10, 20, 50].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.dropdownMenuItem,
                        itemsPerPage === num && styles.dropdownMenuItemActive,
                        itemsPerPage === num && isDarkMode && styles.dropdownMenuItemActiveDark,
                      ]}
                      onPress={() => {
                        setItemsPerPage(num);
                        setIsPerPageDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownMenuItemText,
                          isDarkMode && styles.dropdownMenuItemTextDark,
                          itemsPerPage === num && styles.dropdownMenuItemTextActive,
                        ]}
                      >
                        {num} / page
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 18,
  },
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
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  pageTitleDark: {
    color: '#F8FAFC',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  pageSubtitleDark: {
    color: '#94A3B8',
  },

  // Main Card
  mainCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Platform.select({ web: 28, default: 20 }),
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 1px 4px 0 rgba(15, 23, 42, 0.04)',
        }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 16,
          elevation: 2,
        }),
  },
  mainCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cardToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  cardToolbarStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  cardTitleDark: {
    color: '#F8FAFC',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  toolbarActionsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 36,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  filterDropdownBtnDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  filterDropdownBtnText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  filterDropdownBtnTextDark: {
    color: '#E2E8F0',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 4,
    zIndex: 99,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' } as any)
      : { elevation: 5 }),
  },
  dropdownMenuDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
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
    color: '#334155',
  },
  dropdownMenuItemTextDark: {
    color: '#E2E8F0',
  },
  dropdownMenuItemTextActive: {
    color: '#581C87',
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    minWidth: 200,
  },
  searchBoxDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
    outlineStyle: 'none' as any,
  },
  searchInputDark: {
    color: '#F8FAFC',
  },

  // Table Styles
  tableContainer: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  tableHeaderRowDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: '#334155',
  },
  tableHeaderCell: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 8,
  },
  tableRowDark: {
    borderBottomColor: '#334155',
  },
  tableCell: {
    justifyContent: 'center',
  },
  rowThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  rowThumbnailPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowThumbnailPlaceholderDark: {
    backgroundColor: '#0F172A',
  },
  rowTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.1,
  },
  rowTitleTextDark: {
    color: '#F8FAFC',
  },
  rowSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  rowSubtitleTextDark: {
    color: '#94A3B8',
  },
  rowCellText: {
    fontSize: 13.5,
    color: '#334155',
  },
  rowCellTextDark: {
    color: '#CBD5E1',
  },
  rowDateText: {
    fontSize: 13,
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

  // Review Button
  reviewButton: {
    backgroundColor: '#4C007C', // JMCFI Purple
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 0.15s ease-in-out',
        } as any)
      : {}),
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyTableTitleDark: {
    color: '#F8FAFC',
  },
  emptyTableSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 360,
  },
  emptyTableSubtitleDark: {
    color: '#94A3B8',
  },

  // Footer & Pagination
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 14,
  },
  tableFooterStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  footerShowingText: {
    fontSize: 13,
    color: '#64748B',
  },
  footerShowingTextDark: {
    color: '#94A3B8',
  },
  paginationControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  pageArrowBtnDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  pageArrowBtnDisabled: {
    opacity: 0.45,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : {}),
  },
  perPageDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  perPageDropdownBtnDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  perPageDropdownBtnText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '500',
  },
  perPageDropdownBtnTextDark: {
    color: '#CBD5E1',
  },
});

