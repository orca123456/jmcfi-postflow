import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { PaginationControl } from '../ui/PaginationControl';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { resolveImageUrl } from '../../services/api';
import { useThemeStore } from '../../store/theme';
import { rq } from './requestorMotion';

type RequestorRejectedProps = {
  requests: any[];
  loading: boolean;
  error: boolean;
  onOpen: (request: any) => void;
  onRetry: () => void;
};

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const BRAND_PURPLE = '#4C007C';
const BRAND_GOLD = '#FFC72C';
const CONTROL_HEIGHT = 44;
const TABLE_MIN_WIDTH = 1000;
const FULL_PAGINATION_MIN_WIDTH = 640;
const DAY_MS = 86_400_000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

function inputDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed.getTime() / DAY_MS : null;
}

function titleOf(request: any): string {
  return typeof request.title === 'string' && request.title.trim() ? request.title.trim() : 'Untitled request';
}

function categoryOf(request: any): string {
  if (String(request.routing_type || request.routingType || '').toLowerCase() === 'direct_imc') {
    return 'Direct to IMC';
  }
  const catName = request.category?.name || (typeof request.category === 'string' ? request.category : '');
  const isOther = ['other', 'others'].includes(String(catName || '').trim().toLowerCase());
  const dept = request.department || request.requestor?.department || '';
  if (request.other_category_name && typeof request.other_category_name === 'string') {
    const custom = request.other_category_name.trim();
    if (isOther) return custom || 'Others';
    if (!catName && custom.toLowerCase() !== String(dept).toLowerCase()) {
      return custom;
    }
  }
  return catName || 'Uncategorized';
}

function reasonOf(request: any): string {
  const reason = request.rejectionReason || request.rejection_reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : '';
}

function reviewerOf(request: any): string {
  return typeof request.rejectedBy === 'string' ? request.rejectedBy.trim() : '';
}

function timestampOf(request: any): number | null {
  if (!request.created_at) return null;
  const value = new Date(request.created_at).getTime();
  return Number.isNaN(value) ? null : value;
}

function requestedDate(request: any): string {
  const timestamp = timestampOf(request);
  if (timestamp === null) {
    return typeof request.date === 'string' && request.date.trim() && request.date !== 'Invalid Date'
      ? request.date : 'Date unavailable';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  }).format(new Date(timestamp));
}

function statusOf(request: any): { label: string; revision: boolean } {
  const raw = String(request.rawStatus || request.status || '').toLowerCase().replace(/\s+/g, '_');
  if (raw === 'returned_for_revision') return { label: 'Returned for revision', revision: true };
  if (raw === 'rejected') return { label: 'Rejected', revision: false };
  const label = String(request.statusLabel || request.status_label || request.status || '').replace(/_/g, ' ').trim();
  return { label: label || 'Status unavailable', revision: label.toLowerCase().includes('revision') };
}

function platformsOf(request: any): string[] {
  let value = request.platforms ?? request.target_platforms;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = value.split(','); }
  }
  const platforms = Array.isArray(value) ? value : value ? [value] : [];
  const names = platforms.map((platform: any) => typeof platform === 'string' ? platform : platform?.name || platform?.label || '')
    .filter((name: unknown): name is string => typeof name === 'string' && !!name.trim())
    .map((name: string) => name.trim());
  return [...new Map(names.map((name: string) => [name.toLowerCase(), name])).values()] as string[];
}

function platformDetails(name: string): { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string } {
  switch (name.toLowerCase()) {
    case 'facebook': return { label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' };
    case 'instagram': return { label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' };
    case 'website': case 'web': case 'portal': case 'wordpress': return { label: 'Website', icon: 'globe-outline', color: '#059669' };
    case 'twitter': return { label: 'Twitter', icon: 'logo-twitter', color: '#1DA1F2' };
    case 'x': return { label: 'X', icon: 'logo-twitter', color: '#000000' };
    case 'linkedin': return { label: 'LinkedIn', icon: 'logo-linkedin', color: '#0A66C2' };
    case 'tiktok': return { label: 'TikTok', icon: 'logo-tiktok', color: '#000000' };
    case 'youtube': return { label: 'YouTube', icon: 'logo-youtube', color: '#FF0000' };
    default: return { label: name, icon: 'globe-outline', color: '#64748B' };
  }
}

export function RequestorRejected({ requests, loading, error, onOpen, onRetry }: RequestorRejectedProps) {
  const isDarkMode = useThemeStore((store) => store.isDarkMode);
  const [contentWidth, setContentWidth] = useState(0);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const dateMenuRef = useRef<any>(null);
  const dateButtonRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !dateMenuOpen || typeof document === 'undefined') return;
    const closeOutside = (event: Event) => {
      if (!dateMenuRef.current?.contains?.(event.target)) setDateMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setDateMenuOpen(false);
      dateButtonRef.current?.focus?.();
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [dateMenuOpen]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [focusedControl, setFocusedControl] = useState<string | null>(null);
  const nativeDark = Platform.OS !== 'web' && isDarkMode;
  const palette = {
    surface: nativeDark ? '#1C2541' : Colors.surface,
    background: nativeDark ? '#0B132B' : Colors.background,
    secondarySurface: nativeDark ? '#25304C' : Colors.surfaceSecondary,
    border: nativeDark ? '#334155' : Colors.border,
    text: nativeDark ? '#F8FAFC' : Colors.textPrimary,
    secondaryText: nativeDark ? '#CBD5E1' : Colors.textSecondary,
    mutedText: nativeDark ? '#94A3B8' : Colors.textMuted,
    error: nativeDark ? '#F87171' : Colors.error,
    rejectedText: isDarkMode ? '#F87171' : '#B91C1C',
    rejectedBackground: isDarkMode ? '#7F1D1D' : '#FEE2E2',
    revisionText: isDarkMode ? '#FBBF24' : '#B45309',
    revisionBackground: isDarkMode ? '#78350F' : '#FEF3C7',
  };
  const actionColor = isDarkMode ? BRAND_GOLD : BRAND_PURPLE;
  const loadedRequests = Array.isArray(requests) ? requests : [];
  const query = search.trim().toLocaleLowerCase();
  const today = Math.floor((Date.now() + MANILA_OFFSET_MS) / DAY_MS);
  const isTable = contentWidth >= TABLE_MIN_WIDTH;
  const wideToolbar = contentWidth >= 800;
  const filteredRequests = useMemo(() => loadedRequests.filter((request) => {
    if (query && ![titleOf(request), categoryOf(request), reasonOf(request), reviewerOf(request)]
      .some((value) => value.toLocaleLowerCase().includes(query))) return false;
    if (dateFilter === 'all') return true;
    const timestamp = timestampOf(request);
    if (timestamp === null) return false;
    const day = Math.floor((timestamp + MANILA_OFFSET_MS) / DAY_MS);
    if (dateFilter === 'yesterday') return day === today - 1;
    if (dateFilter === 'custom') {
      const start = inputDay(rangeStart), end = inputDay(rangeEnd);
      return start !== null && end !== null && day >= start && day <= end;
    }
    const days = dateFilter === 'today' ? 1 : dateFilter === 'week' ? 7 : 30;
    return day <= today && day >= today - days + 1;
  }), [loadedRequests, query, dateFilter, today, rangeStart, rangeEnd]);
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / perPage));
  const page = Math.max(1, Math.min(currentPage, totalPages));
  const visibleRequests = filteredRequests.slice((page - 1) * perPage, page * perPage);
  const hasFilters = !!query || dateFilter !== 'all';
  const dateLabel = DATE_OPTIONS.find((option) => option.value === dateFilter)?.label || 'All time';
  const clearFilters = () => { setSearch(''); setDateFilter('all'); setRangeStart(''); setRangeEnd(''); setRangeOpen(false); setCurrentPage(1); };
  const startDay = inputDay(draftStart), endDay = inputDay(draftEnd);
  const validRange = startDay !== null && endDay !== null && endDay >= startDay;
  const focusProps = (key: string) => ({
    onFocus: () => setFocusedControl(key),
    onBlur: () => setFocusedControl((previous) => previous === key ? null : previous),
  });
  const focusStyle = (key: string) => focusedControl === key ? { borderColor: actionColor } : undefined;

  const renderRetry = () => (
    <Pressable accessibilityRole="button" accessibilityLabel="Retry loading rejected and returned requests" onPress={onRetry}
      {...focusProps('retry')} style={({ pressed }) => [styles.outlineButton, { borderColor: palette.border }, pressed && styles.pressed, focusStyle('retry')]}>
      <Ionicons name="refresh-outline" size={16} color={actionColor} />
      <Text style={[styles.actionText, { color: actionColor }]}>Try again</Text>
    </Pressable>
  );

  const renderClear = (key: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel="Clear request search and date filters" onPress={clearFilters}
      {...focusProps(key)} style={({ pressed }) => [styles.textButton, pressed && styles.pressed, focusStyle(key)]}>
      <Text style={[styles.actionText, { color: actionColor }]}>Clear filters</Text>
    </Pressable>
  );

  const renderPlatforms = (request: any) => {
    const names = platformsOf(request);
    return <View style={styles.platforms}>
      {names.length ? names.map((name) => {
        const platform = platformDetails(name);
        return <View key={name.toLowerCase()} style={styles.platform}>
          <Ionicons name={platform.icon} size={14} color={platform.color} />
          <Text style={[styles.platformLabel, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>{platform.label}</Text>
        </View>;
      }) : <Text style={[styles.smallText, { color: palette.secondaryText }]}>—</Text>}
    </View>;
  };

  return (
    <View nativeID="requestor-rejected" style={styles.container}
      onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      {Platform.OS === 'web' && <style>{`
        #requestor-rejected [role="button"] { cursor: pointer; }
        #requestor-rejected [dir="auto"] { overflow-wrap: anywhere; }
        #requestor-rejected :is([role="button"], input, select):focus-visible {
          outline: 2px solid ${actionColor} !important; outline-offset: 2px;
        }
        #requestor-rejected-search:focus-within { border-color: ${actionColor} !important; }
        #requestor-rejected #requestor-rejected-search input:focus,
        #requestor-rejected #requestor-rejected-search input:focus-visible { outline: none !important; box-shadow: none !important; }
        #requestor-rejected [id^="requestor-rejected-details-"]:hover {
          filter: brightness(1.12);
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(124, 58, 237, 0.42) !important;
        }
        #requestor-rejected [id^="requestor-rejected-date-"]:hover { filter: brightness(0.96); }
        #requestor-rejected [id^="requestor-rejected-status-revision-"] [dir="auto"] { color: ${palette.revisionText} !important; }
        #requestor-rejected [id^="requestor-rejected-status-rejected-"] [dir="auto"] { color: ${palette.rejectedText} !important; }
        #requestor-rejected-pagination > div { padding-left: 0 !important; padding-right: 0 !important; border-top-color: ${palette.border} !important; }
        #requestor-rejected-pagination > div > div { flex-wrap: wrap; max-width: 100%; min-width: 0; }
        #requestor-rejected-pagination [role="button"] { width: ${CONTROL_HEIGHT}px !important; height: ${CONTROL_HEIGHT}px !important; }
        #requestor-rejected-pagination [aria-selected="true"] { background-color: ${BRAND_PURPLE} !important; }
        #requestor-rejected-pagination [aria-selected="true"] [dir="auto"] { color: #FFFFFF !important; }
        #requestor-rejected-pagination select { height: ${CONTROL_HEIGHT}px !important; max-width: 100%; color: ${palette.text} !important; background-color: ${palette.surface} !important; border-color: ${palette.border} !important; }
      `}</style>}

      <View style={styles.heading}>
        <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 1 } : {})}
          style={[styles.pageTitle, { color: palette.text, fontSize: contentWidth >= 700 ? FontSize.xxl : FontSize.xl }]}>
          Rejected Requests
        </Text>
        <Text style={[styles.smallText, { color: palette.secondaryText }]}>Review feedback on rejected requests and requests returned for revision.</Text>
      </View>

      <Card padding={isTable ? Spacing.lg : Spacing.md} style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.panelHeader, !wideToolbar && styles.stacked]}>
          <View style={styles.panelCopy}>
            <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 2 } : {})}
              style={[styles.panelTitle, { color: palette.text }]}>Review feedback</Text>
            <Text style={[styles.smallText, { color: palette.secondaryText }]}>
              {loading && !loadedRequests.length ? 'Loading your requests…'
                : error && !loadedRequests.length ? 'Your requests could not be loaded.'
                  : `${loadedRequests.length} ${loadedRequests.length === 1 ? 'request' : 'requests'} with feedback`}
            </Text>
          </View>
          <View style={[styles.toolbar, !wideToolbar && styles.fullWidth]}>
            <View nativeID="requestor-rejected-search" style={[styles.search, { backgroundColor: palette.background, borderColor: palette.border }, !wideToolbar && styles.flexible, focusStyle('search')]}>
              <Ionicons name="search-outline" size={18} color={palette.secondaryText} />
              <TextInput accessibilityLabel="Search requests by title, category, reason, or reviewer" value={search}
                onChangeText={(value) => { setSearch(value); setCurrentPage(1); }} placeholder="Search requests…"
                placeholderTextColor={palette.mutedText} autoCapitalize="none" autoCorrect={false} {...focusProps('search')}
                style={[styles.searchInput, { color: palette.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} />
              {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear request search"
                onPress={() => { setSearch(''); setCurrentPage(1); }} {...focusProps('clear-search')}
                style={({ pressed }) => [styles.clearSearch, pressed && styles.pressed, focusStyle('clear-search')]}>
                <Ionicons name="close" size={18} color={palette.secondaryText} />
              </Pressable>}
            </View>

            <View ref={dateMenuRef} style={[styles.dropdownHolder, { zIndex: dateMenuOpen ? 30 : 20 }, !wideToolbar && styles.flexible]}>
              <Pressable ref={dateButtonRef} accessibilityRole="button" accessibilityLabel="Filter request date"
                {...(Platform.OS === 'web' ? { 'aria-expanded': dateMenuOpen } : {})}
                accessibilityState={{ expanded: dateMenuOpen }}
                onPress={() => setDateMenuOpen((prev) => !prev)}
                {...focusProps('date-menu')}
                style={({ pressed }) => [styles.filterButton, { borderColor: palette.border, backgroundColor: palette.surface }, pressed && styles.pressed, focusStyle('date-menu')]}>
                <Ionicons name="calendar-outline" size={16} color={palette.secondaryText} />
                <Text style={[styles.filterLabel, { color: palette.text }]}>
                  {dateFilter === 'custom' && rangeStart && rangeEnd ? `${rangeStart} – ${rangeEnd}` : dateLabel}
                </Text>
                <Ionicons name={dateMenuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={palette.secondaryText} />
              </Pressable>
              {dateMenuOpen && <View style={[styles.dropdown, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                {DATE_OPTIONS.map((option) => <Pressable key={option.value} nativeID={`requestor-rejected-date-${option.value}`}
                  accessibilityRole="button" accessibilityLabel={`Filter request date: ${option.label}`} accessibilityState={{ selected: dateFilter === option.value }}
                  onPress={() => {
                    setDateMenuOpen(false);
                    if (option.value === 'custom') {
                      setDraftStart(rangeStart); setDraftEnd(rangeEnd); setRangeOpen(true);
                    } else {
                      setDateFilter(option.value); setCurrentPage(1); setRangeOpen(false); dateButtonRef.current?.focus?.();
                    }
                  }}
                  style={[styles.dropdownOption, dateFilter === option.value && { backgroundColor: palette.secondarySurface }]}>
                  <Text style={[styles.filterLabel, { color: dateFilter === option.value ? actionColor : palette.text }]}>{option.label}</Text>
                  {dateFilter === option.value && <Ionicons name="checkmark" size={16} color={actionColor} />}
                </Pressable>)}
              </View>}
            </View>
          </View>
        </View>

        <Modal visible={rangeOpen} transparent animationType="none" onRequestClose={() => setRangeOpen(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable accessibilityLabel="Cancel custom date range" onPress={() => setRangeOpen(false)} style={styles.dismissBackdrop} />
            <View style={[styles.rangeDialog, { backgroundColor: palette.surface, borderColor: '#4D027D', borderWidth: 2 }]}>
              <View style={styles.dialogHeading}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[styles.dialogEyebrow, { color: actionColor }]}>DATE FILTER</Text>
                  <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 2 } : {})} style={[styles.panelTitle, { color: palette.text }]}>Custom date range</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Cancel custom date range" onPress={() => setRangeOpen(false)} style={[styles.closeDialog, { borderColor: palette.border, backgroundColor: palette.background }]}>
                  <Ionicons name="close" size={20} color={palette.secondaryText} />
                </Pressable>
              </View>
              <Text style={[styles.smallText, { color: palette.secondaryText }]}>Choose the requested dates in Manila time.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>
                {([{ label: 'Start date', value: draftStart, change: setDraftStart }, { label: 'End date', value: draftEnd, change: setDraftEnd }]).map((field) => <View key={field.label} style={{ flexGrow: 1, flexBasis: 160, minWidth: 0, gap: Spacing.sm }}>
                  <Text style={[styles.smallText, { color: palette.text, fontWeight: FontWeight.semiBold }]}>{field.label}</Text>
                  {Platform.OS === 'web' ? <input type="date" aria-label={`Rejected ${field.label.toLowerCase()}`} value={field.value} onChange={(event) => field.change(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', minWidth: 0, height: CONTROL_HEIGHT, padding: Spacing.sm, borderRadius: BorderRadius.md, border: `1px solid ${palette.border}`, color: palette.text, backgroundColor: palette.surface, colorScheme: isDarkMode ? 'dark' : 'light', fontSize: FontSize.sm }} />
                    : <TextInput accessibilityLabel={`Rejected ${field.label.toLowerCase()}, YYYY-MM-DD`} value={field.value} onChangeText={field.change} placeholder="YYYY-MM-DD" style={{ minHeight: CONTROL_HEIGHT, padding: Spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: BorderRadius.md, color: palette.text, backgroundColor: palette.surface }} />}
                </View>)}
              </View>
              {!!draftStart && !!draftEnd && !validRange && <Text accessibilityRole="alert" style={[styles.smallText, { color: palette.error }]}>Choose valid dates with the end date on or after the start date.</Text>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'flex-end', paddingTop: Spacing.xs }}>
                <Pressable accessibilityRole="button" onPress={() => setRangeOpen(false)} style={styles.textButton}><Text style={[styles.actionText, { color: palette.text }]}>Cancel</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Apply rejected request date range" disabled={!validRange} onPress={() => { if (validRange) { setRangeStart(draftStart); setRangeEnd(draftEnd); setDateFilter('custom'); setCurrentPage(1); setRangeOpen(false); } }} style={[styles.outlineButton, { borderColor: actionColor, opacity: validRange ? 1 : .45 }]}><Text style={[styles.actionText, { color: actionColor }]}>Apply range</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {hasFilters && <View style={styles.filterSummary}>
          <Text accessibilityLiveRegion="polite" style={[styles.smallText, { color: palette.secondaryText, flexShrink: 1 }]}>
            {filteredRequests.length} {filteredRequests.length === 1 ? 'match' : 'matches'}{query ? ` for “${search.trim()}”` : ''}{dateFilter !== 'all' ? ` · ${dateLabel}` : ''}
          </Text>
          {renderClear('clear-filters')}
        </View>}

        {loading && !!loadedRequests.length && <View accessibilityLiveRegion="polite" style={styles.refreshStatus}>
          <ActivityIndicator size="small" color={actionColor} />
          <Text style={[styles.smallText, { color: palette.secondaryText }]}>Refreshing requests…</Text>
        </View>}
        {error && !!loadedRequests.length && <View accessibilityRole="alert" style={[styles.refreshError, { borderColor: palette.border, backgroundColor: palette.background }]}>
          <Ionicons name="alert-circle-outline" size={20} color={palette.error} />
          <Text style={[styles.smallText, { color: palette.text, flexGrow: 1, flexBasis: 180 }]}>Couldn’t refresh requests. Your previous list is still shown.</Text>
          {renderRetry()}
        </View>}

        {loading && !loadedRequests.length ? <View accessibilityLiveRegion="polite" style={styles.emptyState}>
          <ActivityIndicator color={actionColor} size="large" />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Loading requests</Text>
          <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Your requests and reviewer feedback will appear here.</Text>
        </View> : error && !loadedRequests.length ? <View accessibilityRole="alert" style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={40} color={palette.error} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>We couldn’t load your requests</Text>
          <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Try again to view rejected requests and requests returned for revision.</Text>
          {renderRetry()}
        </View> : !loadedRequests.length ? <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: palette.secondarySurface }]}>
            <Ionicons name="chatbox-ellipses-outline" size={32} color={actionColor} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No rejected or returned requests</Text>
          <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Requests that are rejected or returned for revision will appear here with reviewer feedback.</Text>
        </View> : !filteredRequests.length ? <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={40} color={palette.secondaryText} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No requests match your filters</Text>
          <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Try another search or a wider date range to find your request.</Text>
          {renderClear('empty-clear')}
        </View> : <View style={styles.list}>
          {isTable && <View style={[styles.tableHeader, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: palette.border }]}>
            <Text style={[styles.columnHeading, styles.titleColumn, { color: palette.secondaryText }]}>Request title</Text>
            <Text style={[styles.columnHeading, styles.feedbackColumn, { color: palette.secondaryText }]}>Status &amp; feedback</Text>
            <Text style={[styles.columnHeading, styles.dateColumn, { color: palette.secondaryText }]}>Requested on</Text>
            <Text style={[styles.columnHeading, styles.platformColumn, { color: palette.secondaryText }]}>Platforms</Text>
            <Text style={[styles.columnHeading, styles.actionColumn, { color: palette.secondaryText, textAlign: 'center' }]}>Actions</Text>
          </View>}
          {visibleRequests.map((request, index) => {
            const title = titleOf(request);
            const reviewer = reviewerOf(request);
            const status = statusOf(request);
            const imageUrl = resolveImageUrl(request.thumbnailUrl);
            const imageKey = `${request.id}:${imageUrl}`;
            const controlKey = String(request.id ?? index);
            const isDirect = String(request.routing_type || request.routingType || '').toLowerCase() === 'direct_imc' || categoryOf(request) === 'Direct to IMC';
            const statusColor = status.revision
              ? (isDarkMode ? '#FBBF24' : '#D97706')
              : (isDarkMode ? '#F87171' : '#DC2626');
            const statusBackground = status.revision
              ? (isDarkMode ? '#451A03' : '#FEF3C7')
              : (isDarkMode ? '#450A0A' : '#FEE2E2');
            const statusBorder = status.revision
              ? (isDarkMode ? '#78350F' : '#FDE68A')
              : (isDarkMode ? '#7F1D1D' : '#FECACA');
            return <View key={controlKey} {...rq('row')} style={[isTable ? styles.requestRow : styles.requestCard, { borderColor: palette.border }]}>
              <View style={[styles.titleCell, isTable && styles.titleColumn]}>
                <View style={[styles.thumbnail, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                  {imageUrl && !failedImages[imageKey] ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover"
                    accessible={false} onError={() => setFailedImages((previous) => ({ ...previous, [imageKey]: true }))} />
                    : <Ionicons name="document-text-outline" size={20} color={isDarkMode ? '#64748B' : '#94A3B8'} />}
                </View>
                <View style={styles.titleCopy}>
                  <Text numberOfLines={2} style={[styles.requestTitle, { color: palette.text }]}>{title}</Text>
                  {isDirect ? (
                    <View style={styles.directImcBadge}>
                      <Ionicons name="flash" size={10} color="#7C3AED" style={{ marginRight: 3 }} />
                      <Text style={styles.directImcBadgeText}>Direct to IMC</Text>
                    </View>
                  ) : (
                    <Text style={[styles.smallText, { color: palette.secondaryText }]}>{categoryOf(request)}</Text>
                  )}
                </View>
              </View>
              <View style={[styles.feedback, isTable && styles.feedbackColumn, !isTable && styles.feedbackCard, !isTable && { backgroundColor: palette.background, borderColor: palette.border }]}>
                <View nativeID={`requestor-rejected-status-${status.revision ? 'revision' : 'rejected'}-${controlKey}`} style={[styles.statusPill, { backgroundColor: statusBackground, borderColor: statusBorder }]}>
                  <Ionicons name={status.revision ? 'create-outline' : 'close-circle'} size={12} color={statusColor} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{status.label}</Text>
                </View>
                <Text style={[styles.reviewer, { color: palette.text }]}>{reviewer ? `Feedback from ${reviewer}` : 'Reviewer not recorded'}</Text>
                {Boolean(reasonOf(request)) ? (
                  <View style={[styles.reasonBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                    <Ionicons name="chatbox-ellipses-outline" size={12} color={isDarkMode ? '#94A3B8' : '#64748B'} style={{ marginTop: 2, marginRight: 5 }} />
                    <Text numberOfLines={2} style={[styles.reasonText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                      {reasonOf(request)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.smallText, { color: palette.secondaryText, fontStyle: 'italic' }]}>No feedback was provided.</Text>
                )}
              </View>
              {isTable ? <>
                <Text style={[styles.smallText, styles.dateColumn, { color: palette.secondaryText }]}>{requestedDate(request)}</Text>
                <View style={styles.platformColumn}>{renderPlatforms(request)}</View>
              </> : <View style={styles.cardMeta}>
                <View style={styles.requestedDate}>
                  <Ionicons name="time-outline" size={16} color={palette.secondaryText} />
                  <Text style={[styles.smallText, { color: palette.secondaryText, flexShrink: 1 }]}>
                    {requestedDate(request) === 'Date unavailable' ? 'Request date unavailable' : `Requested ${requestedDate(request)}`}
                  </Text>
                </View>
                {renderPlatforms(request)}
              </View>}
              <View style={[styles.actions, isTable && styles.actionColumn]}>
                <Pressable nativeID={`requestor-rejected-details-${controlKey}`} accessibilityRole="button"
                  accessibilityLabel={`View request details: ${title}`} onPress={() => onOpen(request)} {...focusProps(`details-${controlKey}`)}
                  style={({ pressed }) => [styles.pillViewButton, pressed && styles.pressed, focusStyle(`details-${controlKey}`)]}>
                  <Ionicons name="eye-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <Text style={styles.pillViewButtonText}>View details</Text>
                </Pressable>
              </View>
            </View>;
          })}
        </View>}

        {!!filteredRequests.length && <View nativeID="requestor-rejected-pagination" style={styles.pagination}>
          {Platform.OS === 'web' && contentWidth >= FULL_PAGINATION_MIN_WIDTH ? <PaginationControl currentPage={page} totalItems={filteredRequests.length}
            itemsPerPage={perPage} onPageChange={setCurrentPage} onItemsPerPageChange={(value) => { setPerPage(value); setCurrentPage(1); }}
            itemName="requests" pageSizeOptions={[5, 10, 20, 50]} /> : <View style={[styles.compactPagination, { borderColor: palette.border }]}>
            <Text accessibilityLiveRegion="polite" style={[styles.smallText, { color: palette.secondaryText }]}>
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filteredRequests.length)} of {filteredRequests.length} requests
            </Text>
            {totalPages > 1 && <View style={styles.compactControls}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous request page" disabled={page === 1}
                accessibilityState={{ disabled: page === 1 }} onPress={() => setCurrentPage(page - 1)} {...focusProps('previous')}
                style={({ pressed }) => [styles.pageArrow, { borderColor: palette.border, opacity: page === 1 ? 0.4 : 1 }, pressed && styles.pressed, focusStyle('previous')]}>
                <Ionicons name="chevron-back" size={18} color={palette.text} />
              </Pressable>
              <Text style={[styles.smallText, { color: palette.text }]}>Page {page} of {totalPages}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next request page" disabled={page === totalPages}
                accessibilityState={{ disabled: page === totalPages }} onPress={() => setCurrentPage(page + 1)} {...focusProps('next')}
                style={({ pressed }) => [styles.pageArrow, { borderColor: palette.border, opacity: page === totalPages ? 0.4 : 1 }, pressed && styles.pressed, focusStyle('next')]}>
                <Ionicons name="chevron-forward" size={18} color={palette.text} />
              </Pressable>
            </View>}
          </View>}
        </View>}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', minWidth: 0, gap: Spacing.lg },
  heading: { gap: Spacing.sm, minWidth: 0 },
  pageTitle: { fontWeight: FontWeight.bold },
  smallText: { fontSize: FontSize.sm, lineHeight: 20 },
  panel: { borderWidth: 1, minWidth: 0, overflow: 'visible', zIndex: 3 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.md, zIndex: 25 },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  panelCopy: { gap: Spacing.xs, minWidth: 0, flexShrink: 1 },
  panelTitle: { fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.bold },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', minWidth: 0, zIndex: 25 },
  flexible: { flex: 1 },
  fullWidth: { width: '100%' },
  search: { minHeight: 38, width: 232, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingLeft: Spacing.sm, gap: Spacing.sm },
  searchInput: { flex: 1, minWidth: 0, height: 36, fontSize: FontSize.sm, paddingVertical: 4, paddingRight: Spacing.sm },
  clearSearch: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  dropdownHolder: { position: 'relative', width: 160, minWidth: 140 },
  filterButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm },
  filterLabel: { flex: 1, fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.medium },
  dropdown: { position: 'absolute', top: 44, left: 0, right: 0, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.xs, shadowColor: '#000', shadowOffset: { width: 0, height: Spacing.xs }, shadowOpacity: 0.1, shadowRadius: Spacing.md, elevation: 8, zIndex: 40 },
  dropdownOption: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(17, 24, 39, 0.5)', padding: Spacing.md },
  dismissBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  rangeDialog: { width: '100%', maxWidth: 420, padding: Spacing.lg, gap: Spacing.md, borderRadius: 16, borderWidth: 2, borderColor: '#4D027D' },
  dialogHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dialogEyebrow: { fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.6 },
  closeDialog: { width: 40, height: 40, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold },
  textButton: { minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: BorderRadius.sm },
  outlineButton: { minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, maxWidth: '100%' },
  pillViewButton: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        boxShadow: '0 2px 5px rgba(124, 58, 237, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        transition: 'all 120ms ease',
      } as any)
      : {}),
  },
  pillViewButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  directImcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  directImcBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
    letterSpacing: 0.2,
  },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
    maxWidth: '100%',
  },
  reasonText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
    flexShrink: 1,
  },
  platformLabel: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
    flexShrink: 1,
  },
  filterSummary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  refreshStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  refreshError: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  emptyState: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md },
  emptyIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.lg },
  emptyTitle: { fontSize: FontSize.md, lineHeight: 24, fontWeight: FontWeight.semiBold, textAlign: 'center' },
  emptyCopy: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center', maxWidth: 360 },
  list: { minWidth: 0 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 40, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderTopLeftRadius: BorderRadius.md, borderTopRightRadius: BorderRadius.md },
  columnHeading: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold },
  titleColumn: { flex: 2.3, minWidth: 0 },
  feedbackColumn: { flex: 2.5, minWidth: 0 },
  dateColumn: { flex: 1.1, minWidth: 0 },
  platformColumn: { flex: 1.1, minWidth: 0 },
  actionColumn: { width: 130, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  requestCard: { gap: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, minWidth: 0 },
  titleCell: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, minWidth: 0 },
  thumbnail: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, flexShrink: 0, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  titleCopy: { flex: 1, minWidth: 0, gap: Spacing.xs },
  requestTitle: { fontSize: FontSize.md, lineHeight: 20, fontWeight: FontWeight.semiBold },
  feedback: { gap: Spacing.sm, minWidth: 0 },
  feedbackCard: { padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md },
  reviewer: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.medium },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, alignSelf: 'flex-start', maxWidth: '100%', borderWidth: 1 },
  statusText: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold, flexShrink: 1 },
  cardMeta: { gap: Spacing.sm, minWidth: 0 },
  requestedDate: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 0 },
  platforms: { flexDirection: 'column', gap: 4, minWidth: 0, justifyContent: 'center' },
  platform: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, minWidth: 0 },
  pagination: { marginTop: Spacing.sm, minWidth: 0 },
  compactPagination: { paddingTop: Spacing.md, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.md },
  compactControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, maxWidth: '100%' },
  pageArrow: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: BorderRadius.md },
  pressed: { opacity: 0.76 },
});
