import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { PaginationControl } from '../ui/PaginationControl';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { resolveImageUrl } from '../../services/api';
import { useThemeStore } from '../../store/theme';

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
  const category = request.other_category_name || request.category?.name || request.category;
  return typeof category === 'string' && category.trim() ? category.trim() : 'Uncategorized';
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

function platformDetails(name: string): { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] } {
  switch (name.toLowerCase()) {
    case 'facebook': return { label: 'Facebook', icon: 'logo-facebook' };
    case 'instagram': return { label: 'Instagram', icon: 'logo-instagram' };
    case 'website': case 'web': case 'portal': case 'wordpress': return { label: 'Website', icon: 'globe-outline' };
    case 'twitter': return { label: 'Twitter', icon: 'logo-twitter' };
    case 'x': return { label: 'X', icon: 'logo-twitter' };
    case 'linkedin': return { label: 'LinkedIn', icon: 'logo-linkedin' };
    case 'tiktok': return { label: 'TikTok', icon: 'logo-tiktok' };
    case 'youtube': return { label: 'YouTube', icon: 'logo-youtube' };
    default: return { label: name, icon: 'globe-outline' };
  }
}

export function RequestorRejected({ requests, loading, error, onOpen, onRetry }: RequestorRejectedProps) {
  const isDarkMode = useThemeStore((store) => store.isDarkMode);
  const [contentWidth, setContentWidth] = useState(0);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [rangeOpen, setRangeOpen] = useState(false);
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
          <Ionicons name={platform.icon} size={16} color={palette.secondaryText} />
          <Text style={[styles.smallText, { color: palette.secondaryText, flexShrink: 1 }]}>{platform.label}</Text>
        </View>;
      }) : <Text style={[styles.smallText, { color: palette.secondaryText }]}>No platforms selected</Text>}
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
        #requestor-rejected [id^="requestor-rejected-details-"]:hover,
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
          <View nativeID="requestor-rejected-search" style={[styles.search, { backgroundColor: palette.background, borderColor: palette.border }, !wideToolbar && styles.fullWidth, focusStyle('search')]}>
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
        </View>

        <View style={styles.dateFilters}>
          <View style={styles.dateLabel}>
            <Ionicons name="calendar-outline" size={16} color={palette.secondaryText} />
            <Text style={[styles.smallText, { color: palette.secondaryText }]}>Requested on</Text>
          </View>
          <View style={styles.dateOptions}>
            {DATE_OPTIONS.map((option) => {
              const selected = dateFilter === option.value;
              return <Pressable key={option.value} nativeID={`requestor-rejected-date-${option.value}`}
                accessibilityRole="button" accessibilityLabel={`Filter request date: ${option.label}`} accessibilityState={{ selected }}
                {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
                onPress={() => {
                  if (option.value === 'custom') { setDraftStart(rangeStart); setDraftEnd(rangeEnd); setRangeOpen(true); }
                  else { setDateFilter(option.value); setCurrentPage(1); setRangeOpen(false); }
                }} {...focusProps(`date-${option.value}`)}
                style={({ pressed }) => [styles.dateButton, { borderColor: selected ? actionColor : palette.border, backgroundColor: selected ? palette.secondarySurface : palette.surface }, pressed && styles.pressed, focusStyle(`date-${option.value}`)]}>
                <Text style={[styles.actionText, { color: selected ? actionColor : palette.secondaryText }]}>{option.label}</Text>
              </Pressable>;
            })}
          </View>
        </View>

        {rangeOpen && <View style={{ gap: Spacing.md, padding: Spacing.md, borderWidth: 1, borderColor: palette.border, borderRadius: BorderRadius.md, backgroundColor: palette.background }}>
          <Text accessibilityRole="header" style={[styles.actionText, { color: palette.text }]}>Custom date range</Text>
          <Text style={[styles.smallText, { color: palette.secondaryText }]}>Choose the requested dates in Manila time.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>
            {([{ label: 'Start date', value: draftStart, change: setDraftStart }, { label: 'End date', value: draftEnd, change: setDraftEnd }]).map((field) => <View key={field.label} style={{ flexGrow: 1, flexBasis: 160, minWidth: 0, gap: Spacing.sm }}>
              <Text style={[styles.smallText, { color: palette.text }]}>{field.label}</Text>
              {Platform.OS === 'web' ? <input type="date" aria-label={`Rejected ${field.label.toLowerCase()}`} value={field.value} onChange={(event) => field.change(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', minWidth: 0, height: CONTROL_HEIGHT, padding: Spacing.sm, borderRadius: BorderRadius.md, border: `1px solid ${palette.border}`, color: palette.text, backgroundColor: palette.surface, colorScheme: isDarkMode ? 'dark' : 'light', fontSize: FontSize.sm }} />
                : <TextInput accessibilityLabel={`Rejected ${field.label.toLowerCase()}, YYYY-MM-DD`} value={field.value} onChangeText={field.change} placeholder="YYYY-MM-DD" style={{ minHeight: CONTROL_HEIGHT, padding: Spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: BorderRadius.md, color: palette.text, backgroundColor: palette.surface }} />}
            </View>)}
          </View>
          {!!draftStart && !!draftEnd && !validRange && <Text accessibilityRole="alert" style={[styles.smallText, { color: palette.error }]}>Choose valid dates with the end date on or after the start date.</Text>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'flex-end' }}>
            <Pressable accessibilityRole="button" onPress={() => setRangeOpen(false)} style={styles.textButton}><Text style={[styles.actionText, { color: palette.text }]}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Apply rejected request date range" disabled={!validRange} onPress={() => { if (validRange) { setRangeStart(draftStart); setRangeEnd(draftEnd); setDateFilter('custom'); setCurrentPage(1); setRangeOpen(false); } }} style={[styles.outlineButton, { borderColor: actionColor, opacity: validRange ? 1 : .45 }]}><Text style={[styles.actionText, { color: actionColor }]}>Apply range</Text></Pressable>
          </View>
        </View>}

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
          {isTable && <View style={[styles.tableHeader, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Text style={[styles.columnHeading, styles.titleColumn, { color: palette.secondaryText }]}>Request title</Text>
            <Text style={[styles.columnHeading, styles.feedbackColumn, { color: palette.secondaryText }]}>Status &amp; feedback</Text>
            <Text style={[styles.columnHeading, styles.dateColumn, { color: palette.secondaryText }]}>Requested on</Text>
            <Text style={[styles.columnHeading, styles.platformColumn, { color: palette.secondaryText }]}>Platforms</Text>
            <Text style={[styles.columnHeading, styles.actionColumn, { color: palette.secondaryText, textAlign: 'right' }]}>Actions</Text>
          </View>}
          {visibleRequests.map((request, index) => {
            const title = titleOf(request);
            const reviewer = reviewerOf(request);
            const status = statusOf(request);
            const imageUrl = resolveImageUrl(request.thumbnailUrl);
            const imageKey = `${request.id}:${imageUrl}`;
            const controlKey = String(request.id ?? index);
            const statusColor = status.revision ? palette.revisionText : palette.rejectedText;
            const statusBackground = status.revision ? palette.revisionBackground : palette.rejectedBackground;
            return <View key={controlKey} style={[isTable ? styles.requestRow : styles.requestCard, { borderColor: palette.border }]}>
              <View style={[styles.titleCell, isTable && styles.titleColumn]}>
                <View style={[styles.thumbnail, { backgroundColor: palette.secondarySurface }]}>
                  {imageUrl && !failedImages[imageKey] ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover"
                    accessible={false} onError={() => setFailedImages((previous) => ({ ...previous, [imageKey]: true }))} />
                    : <Ionicons name="document-text-outline" size={20} color={palette.secondaryText} />}
                </View>
                <View style={styles.titleCopy}>
                  <Text style={[styles.requestTitle, { color: palette.text }]}>{title}</Text>
                  <Text style={[styles.smallText, { color: palette.secondaryText }]}>{categoryOf(request)}</Text>
                </View>
              </View>
              <View style={[styles.feedback, isTable && styles.feedbackColumn, !isTable && styles.feedbackCard, !isTable && { backgroundColor: palette.background, borderColor: palette.border }]}>
                <View nativeID={`requestor-rejected-status-${status.revision ? 'revision' : 'rejected'}-${controlKey}`} style={[styles.statusPill, { backgroundColor: statusBackground }]}>
                  <Ionicons name={status.revision ? 'create-outline' : 'close-circle-outline'} size={14} color={statusColor} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{status.label}</Text>
                </View>
                <Text style={[styles.reviewer, { color: palette.text }]}>{reviewer ? `Feedback from ${reviewer}` : 'Reviewer not recorded'}</Text>
                <Text style={[styles.smallText, { color: palette.secondaryText }]}>{reasonOf(request) || 'No feedback was provided.'}</Text>
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
                  style={({ pressed }) => [styles.outlineButton, { borderColor: palette.border, backgroundColor: palette.surface }, pressed && styles.pressed, focusStyle(`details-${controlKey}`)]}>
                  <Ionicons name="eye-outline" size={18} color={actionColor} />
                  <Text style={[styles.actionText, { color: actionColor, flexShrink: 1 }]}>View details</Text>
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
  panel: { borderWidth: 1, minWidth: 0 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.md },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  panelCopy: { gap: Spacing.xs, minWidth: 0, flexShrink: 1 },
  panelTitle: { fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.bold },
  search: { minHeight: CONTROL_HEIGHT, width: 320, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingLeft: Spacing.sm, gap: Spacing.sm },
  fullWidth: { width: '100%' },
  searchInput: { flex: 1, minWidth: 0, height: CONTROL_HEIGHT, fontSize: FontSize.sm, paddingVertical: Spacing.sm, paddingRight: Spacing.sm },
  clearSearch: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: BorderRadius.sm },
  dateFilters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  dateLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: CONTROL_HEIGHT, paddingRight: Spacing.sm },
  dateOptions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, minWidth: 0, flexShrink: 1 },
  dateButton: { minHeight: CONTROL_HEIGHT, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold },
  textButton: { minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: BorderRadius.sm },
  outlineButton: { minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, maxWidth: '100%' },
  filterSummary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  refreshStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  refreshError: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  emptyState: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md },
  emptyIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.lg },
  emptyTitle: { fontSize: FontSize.md, lineHeight: 24, fontWeight: FontWeight.semiBold, textAlign: 'center' },
  emptyCopy: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center', maxWidth: 360 },
  list: { minWidth: 0 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderTopLeftRadius: BorderRadius.md, borderTopRightRadius: BorderRadius.md },
  columnHeading: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold },
  titleColumn: { flex: 2.2, minWidth: 0 },
  feedbackColumn: { flex: 2.5, minWidth: 0 },
  dateColumn: { flex: 1.1, minWidth: 0 },
  platformColumn: { flex: 1.1, minWidth: 0 },
  actionColumn: { width: 148, flexShrink: 0 },
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
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, alignSelf: 'flex-start', maxWidth: '100%' },
  statusText: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold, flexShrink: 1 },
  cardMeta: { gap: Spacing.sm, minWidth: 0 },
  requestedDate: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 0 },
  platforms: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, minWidth: 0 },
  platform: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, maxWidth: '100%' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, minWidth: 0 },
  pagination: { marginTop: Spacing.sm, minWidth: 0 },
  compactPagination: { paddingTop: Spacing.md, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.md },
  compactControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, maxWidth: '100%' },
  pageArrow: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: BorderRadius.md },
  pressed: { opacity: 0.76 },
});
