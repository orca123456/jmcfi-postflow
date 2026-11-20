import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { PaginationControl } from '../ui/PaginationControl';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { resolveImageUrl } from '../../services/api';
import { useThemeStore } from '../../store/theme';
import { rq } from './requestorMotion';

export type RequestorOverviewState = {
  search: string;
  status: 'all' | 'review' | 'approved' | 'scheduled' | 'published';
  routingFilter?: 'all' | 'standard' | 'direct_imc';
  date: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;
  order: 'desc' | 'asc';
  page: number;
  perPage: number;
};

export const INITIAL_OVERVIEW_STATE: RequestorOverviewState = {
  search: '', status: 'all', routingFilter: 'all', date: 'all', startDate: '', endDate: '',
  order: 'desc', page: 1, perPage: 10,
};

type RequestorOverviewProps = {
  userName: string;
  requests: any[];
  loading: boolean;
  error: boolean;
  state: RequestorOverviewState;
  onStateChange: React.Dispatch<React.SetStateAction<RequestorOverviewState>>;
  onCreate: () => void;
  onOpen: (request: any) => void;
  onRetry: () => void;
};

const BRAND_PURPLE = '#4C007C';
const BRAND_GOLD = '#FFC72C';
const GOLD_INK = '#1A1A2E';
const DAY_MS = 86_400_000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const CONTROL_HEIGHT = 44;
const CTA_RADIUS = 8;
const TABLE_MIN_WIDTH = 860;
const TOOLBAR_MIN_WIDTH = 1000;
const STATUS_OPTIONS: { value: RequestorOverviewState['status']; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
];
const DATE_OPTIONS: { value: RequestorOverviewState['date']; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

function timestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? new Date(value) : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function inputDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return parsed.getTime() / DAY_MS;
}

function displayDate(request: any): string {
  const time = timestamp(request.created_at);
  if (time === null) return typeof request.date === 'string' && request.date !== 'Invalid Date' ? request.date : '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  }).format(new Date(time));
}

function displayInputDate(value: string): string {
  const day = inputDay(value);
  return day === null ? value : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(day * DAY_MS));
}

function categoryName(request: any): string {
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

  if (catName && !isOther) return catName;
  if (catName) return catName;
  return '—';
}

function requestCode(request: any): string {
  const code = request.request_code || request.code || request.reference_code || request.reference_number || request.request_number;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : request.id ? `#${request.id}` : '—';
}

function sentenceCase(value: unknown): string {
  const text = String(value || '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : 'Unknown';
}

function requestStatus(request: any): { label: string; stage: string } {
  const isDirect = String(request.routing_type || request.routingType || '').toLowerCase() === 'direct_imc';
  const workflows = request.approval_workflows || request.approvalWorkflows || request.rawPost?.approval_workflows || [];
  const imcWf = Array.isArray(workflows) ? [...workflows].reverse().find((w: any) => w.stage === 'imc_qa') : null;
  const imcAction = String(imcWf?.action || '').toLowerCase();
  const raw = String(request.rawStatus || '').toLowerCase();
  if (isDirect && !['approved', 'scheduled', 'published', 'rejected', 'returned_for_revision'].includes(raw)) {
    if (imcAction === 'editing') return { label: 'Editing', stage: 'IMC' };
    if (imcAction === 'reviewing') return { label: 'Reviewing', stage: 'IMC' };
  }
  if (raw === 'pending' || raw.startsWith('pending_')) {
    const stages: Record<string, string> = {
      pending_office_head: 'Department Head', pending_department_head: 'Department Head',
      pending_vice_president: 'Vice President', pending_president: 'President',
      pending_imc_qa: 'IMC QA', pending_imc: 'IMC', pending_publisher: 'Publisher',
    };
    const stage = stages[raw] || (raw.startsWith('pending_') ? sentenceCase(raw.slice(8)) : '');
    return { label: 'In review', stage };
  }
  if (['approved', 'scheduled', 'published'].includes(raw)) return { label: sentenceCase(raw), stage: '' };
  return { label: sentenceCase(request.statusLabel || request.status || raw), stage: '' };
}

function platformNames(value: any): string[] {
  let platforms = value;
  if (typeof platforms === 'string') {
    try { platforms = JSON.parse(platforms); } catch { platforms = platforms.split(','); }
  }
  if (!Array.isArray(platforms)) platforms = platforms ? [platforms] : [];
  const names = platforms.map((item: any) => typeof item === 'string' ? item : item?.name || item?.label || item?.platform || '')
    .filter((item: unknown): item is string => typeof item === 'string' && !!item.trim())
    .map((item: string) => item.trim());
  return [...new Map(names.map((name: string) => [name.toLowerCase(), name])).values()] as string[];
}

function platformDetails(name: string): { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color?: string } {
  switch (name.toLowerCase()) {
    case 'facebook': return { label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' };
    case 'instagram': return { label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' };
    case 'website': case 'web': case 'portal': case 'wordpress': return { label: 'Website', icon: 'globe-outline' };
    case 'twitter': return { label: 'Twitter', icon: 'logo-twitter', color: '#1DA1F2' };
    case 'x': return { label: 'X', icon: 'logo-twitter' };
    case 'linkedin': return { label: 'LinkedIn', icon: 'logo-linkedin', color: '#0077B5' };
    case 'tiktok': return { label: 'TikTok', icon: 'logo-tiktok' };
    case 'youtube': return { label: 'YouTube', icon: 'logo-youtube', color: '#FF0000' };
    default: return { label: name, icon: 'globe-outline' };
  }
}

export function RequestorOverview({
  userName, requests, loading, error, state, onStateChange, onCreate, onOpen, onRetry,
}: RequestorOverviewProps) {
  const isDarkMode = useThemeStore((store) => store.isDarkMode);
  const [contentWidth, setContentWidth] = useState(0);
  const [openMenu, setOpenMenu] = useState<'status' | 'date' | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const statusMenuRef = useRef<any>(null);
  const dateMenuRef = useRef<any>(null);
  const statusButtonRef = useRef<any>(null);
  const dateButtonRef = useRef<any>(null);
  const nativeDark = Platform.OS !== 'web' && isDarkMode;
  // Web neutral tokens follow the existing theme; these are Card's native dark surfaces.
  const palette = {
    surface: nativeDark ? '#1C2541' : Colors.surface,
    background: nativeDark ? '#0B132B' : Colors.background,
    secondarySurface: nativeDark ? '#25304C' : Colors.surfaceSecondary,
    border: nativeDark ? '#334155' : Colors.border,
    text: nativeDark ? '#F8FAFC' : Colors.textPrimary,
    secondaryText: nativeDark ? '#CBD5E1' : Colors.textSecondary,
    mutedText: nativeDark ? '#94A3B8' : Colors.textMuted,
  };
  const actionColor = isDarkMode ? BRAND_GOLD : BRAND_PURPLE;
  const isTable = contentWidth >= TABLE_MIN_WIDTH;
  const isWideToolbar = contentWidth >= TOOLBAR_MIN_WIDTH;
  const isWideHeader = contentWidth >= 700;
  const recentRequests = Array.isArray(requests) ? requests : [];
  const nowDay = Math.floor((Date.now() + MANILA_OFFSET_MS) / DAY_MS);
  const perPage = Number.isFinite(state.perPage) && state.perPage > 0 ? Math.floor(state.perPage) : 10;
  const filterSignature = JSON.stringify([state.search, state.status, state.routingFilter, state.date, state.startDate, state.endDate, state.order, perPage]);
  const previousFilterSignature = useRef(filterSignature);

  const routingCounts = useMemo(() => {
    let standard = 0;
    let direct = 0;
    for (const r of recentRequests) {
      const isDirect = String(r?.routing_type || (r as any)?.routingType || '').toLowerCase() === 'direct_imc' || r?.category === 'Direct to IMC';
      if (isDirect) {
        direct++;
      } else {
        standard++;
      }
    }
    return {
      all: recentRequests.length,
      standard,
      direct,
    };
  }, [recentRequests]);

  const filteredRequests = useMemo(() => {
    const search = state.search.trim().toLocaleLowerCase();
    const customStart = inputDay(state.startDate);
    const customEnd = inputDay(state.endDate);
    return recentRequests.filter((request) => {
      if (state.routingFilter === 'standard') {
        const isDirect = String(request.routing_type || (request as any).routingType || '').toLowerCase() === 'direct_imc' || request.category === 'Direct to IMC';
        if (isDirect) return false;
      } else if (state.routingFilter === 'direct_imc') {
        const isDirect = String(request.routing_type || (request as any).routingType || '').toLowerCase() === 'direct_imc' || request.category === 'Direct to IMC';
        if (!isDirect) return false;
      }
      if (search && ![request.title, categoryName(request), requestCode(request)]
        .some((value) => String(value || '').toLocaleLowerCase().includes(search))) return false;
      const rawStatus = String(request.rawStatus || '').toLowerCase();
      if (state.status === 'review' && rawStatus !== 'pending' && !rawStatus.startsWith('pending_')) return false;
      if (state.status !== 'all' && state.status !== 'review' && rawStatus !== state.status) return false;
      if (state.date === 'all') return true;
      const time = timestamp(request.created_at);
      if (time === null) return false;
      const day = Math.floor((time + MANILA_OFFSET_MS) / DAY_MS);
      if (state.date === 'today') return day === nowDay;
      if (state.date === 'yesterday') return day === nowDay - 1;
      if (state.date === 'week') return day >= nowDay - 6 && day <= nowDay;
      if (state.date === 'month') return day >= nowDay - 29 && day <= nowDay;
      return customStart !== null && customEnd !== null && day >= customStart && day <= customEnd;
    }).map((request, index) => ({ request, index })).sort((a, b) => {
      const first = timestamp(a.request.created_at);
      const second = timestamp(b.request.created_at);
      if (first === null) return second === null ? a.index - b.index : 1;
      if (second === null) return -1;
      return (state.order === 'desc' ? second - first : first - second) || a.index - b.index;
    }).map(({ request }) => request);
  }, [recentRequests, state.search, state.status, state.routingFilter, state.date, state.startDate, state.endDate, state.order, nowDay]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / perPage));
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(state.page) ? Math.floor(state.page) : 1));
  const visibleRequests = filteredRequests.slice((page - 1) * perPage, page * perPage);
  const hasFilters = !!state.search.trim() || state.status !== 'all' || state.date !== 'all';
  const selectedStatus = STATUS_OPTIONS.find((option) => option.value === state.status)?.label || 'All Status';
  const selectedDate = DATE_OPTIONS.find((option) => option.value === state.date)?.label || 'All time';
  const draftStartDay = inputDay(draftStart);
  const draftEndDay = inputDay(draftEnd);
  const validRange = draftStartDay !== null && draftEndDay !== null && draftEndDay >= draftStartDay;
  const rangeError = draftStart && draftEnd && !validRange
    ? 'Enter valid dates with the end date on or after the start date.' : '';

  useEffect(() => {
    const changed = previousFilterSignature.current !== filterSignature;
    previousFilterSignature.current = filterSignature;
    const nextPage = changed ? 1 : page;
    if (state.page !== nextPage) onStateChange((previous) => ({ ...previous, page: nextPage }));
  }, [filterSignature, page, state.page, onStateChange]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !openMenu || typeof document === 'undefined') return;
    const closeOutside = (event: Event) => {
      const menuRef = openMenu === 'status' ? statusMenuRef : dateMenuRef;
      if (!menuRef.current?.contains?.(event.target)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpenMenu(null);
      (openMenu === 'status' ? statusButtonRef : dateButtonRef).current?.focus?.();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenu]);

  const updateFilter = (patch: Partial<RequestorOverviewState>) => onStateChange((previous) => ({ ...previous, ...patch, page: 1 }));
  const clearFilters = () => {
    updateFilter({ search: '', status: 'all', date: 'all', startDate: '', endDate: '' });
    setOpenMenu(null);
  };
  const closeRange = () => {
    setRangeOpen(false);
    if (Platform.OS === 'web') setTimeout(() => dateButtonRef.current?.focus?.(), 0);
  };

  const renderPlatforms = (request: any) => {
    const names = platformNames(request.platforms);
    return names.length ? names.map((name) => {
      const platform = platformDetails(name);
      return (
        <View key={name.toLowerCase()} style={styles.platform}>
          <Ionicons name={platform.icon} size={16} color={platform.color || palette.secondaryText} />
          <Text style={[styles.smallText, { color: palette.secondaryText, flexShrink: 1 }]}>{platform.label}</Text>
        </View>
      );
    }) : <Text style={[styles.smallText, { color: palette.secondaryText }]}>—</Text>;
  };

  const renderStatus = (request: any) => {
    const status = requestStatus(request);
    return (
      <View style={styles.statusGroup}>
        <View style={[styles.statusPill, { backgroundColor: request.statusBg || palette.secondarySurface }]}>
          <Text style={[styles.statusText, { color: request.statusColor || palette.text }]}>{status.label}</Text>
        </View>
        {!!status.stage && <Text style={[styles.stageText, { color: palette.secondaryText }]}>{status.stage}</Text>}
      </View>
    );
  };


  return (
    <View nativeID="requestor-overview" style={styles.container}
      onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      {Platform.OS === 'web' && <style>{`
        :is(#requestor-overview, #requestor-overview-range) [role="button"] { cursor: pointer; }
        :is(#requestor-overview, #requestor-overview-range) :is([role="button"], input, select):focus-visible {
          outline: 2px solid ${actionColor} !important; outline-offset: 2px;
        }
        #requestor-overview-search:focus-within { border-color: ${actionColor} !important; }
        #requestor-overview #requestor-overview-search input:focus,
        #requestor-overview #requestor-overview-search input:focus-visible { outline: none !important; box-shadow: none !important; }
        #requestor-overview [aria-label="Create New Request"] [dir="auto"] { color: ${GOLD_INK} !important; }
        #requestor-overview [id^="requestor-overview-row-"]:hover { background-color: ${palette.secondarySurface} !important; }
        #requestor-overview [id^="requestor-overview-row-"]:focus-visible { outline-offset: -2px; }
        #requestor-overview-pagination > div { padding-left: 0 !important; padding-right: 0 !important; border-top-color: ${palette.border} !important; }
        #requestor-overview-pagination > div > div { flex-wrap: wrap; max-width: 100%; min-width: 0; }
        #requestor-overview-pagination select { margin-left: 8px !important; max-width: 100%; color: ${palette.text} !important; background-color: ${palette.surface} !important; border-color: ${palette.border} !important; }
      `}</style>}

      <View style={[styles.welcomeRow, !isWideHeader && styles.stacked]}>
        <View style={styles.welcomeCopy}>
          <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 1 } : {})}
            style={[styles.welcomeTitle, { color: palette.text, fontSize: isWideHeader ? FontSize.xxl : FontSize.xl }]}>
            Welcome, {userName}
          </Text>
          <Text style={[styles.subtitle, { color: palette.secondaryText }]}>Keep track of your post requests and their approval status.</Text>
        </View>
        <Pressable {...rq('primary')} accessibilityRole="button" accessibilityLabel="Create New Request" onPress={onCreate} style={styles.createButton}>
          <Ionicons name="add" size={18} color={GOLD_INK} />
          <Text style={styles.createButtonText}>Create New Request</Text>
        </Pressable>
      </View>

      {Platform.OS !== 'web' && openMenu && <Pressable accessibilityLabel="Close filters" onPress={() => setOpenMenu(null)} style={styles.nativeDismiss} />}

      <Card padding={isTable ? Spacing.lg : Spacing.md} style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {Platform.OS !== 'web' && openMenu && <Pressable accessibilityLabel="Close filters" onPress={() => setOpenMenu(null)} style={styles.nativePanelDismiss} />}
        <View style={[styles.panelHeader, !isWideToolbar && styles.stacked]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 2 } : {})}
              style={[styles.panelTitle, { color: palette.text }]}>Recent Post Requests</Text>

            {/* Pill Tabs: All (4) | Standard (2) | Direct to IMC (2) */}
            <View style={[styles.pillTabsContainer, { backgroundColor: nativeDark ? '#1E293B' : '#F1F5F9' }]}>
              <Pressable
                onPress={() => updateFilter({ routingFilter: 'all' })}
                style={[
                  styles.pillTab,
                  (!state.routingFilter || state.routingFilter === 'all') && [
                    styles.pillTabActive,
                    { backgroundColor: palette.surface, shadowColor: '#000' }
                  ]
                ]}
              >
                <Text style={[
                  styles.pillTabText,
                  { color: palette.secondaryText },
                  (!state.routingFilter || state.routingFilter === 'all') && [
                    styles.pillTabTextActive,
                    { color: palette.text }
                  ]
                ]}>
                  All ({routingCounts.all})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => updateFilter({ routingFilter: 'standard' })}
                style={[
                  styles.pillTab,
                  state.routingFilter === 'standard' && [
                    styles.pillTabActive,
                    { backgroundColor: palette.surface, shadowColor: '#000' }
                  ]
                ]}
              >
                <Text style={[
                  styles.pillTabText,
                  { color: palette.secondaryText },
                  state.routingFilter === 'standard' && [
                    styles.pillTabTextActive,
                    { color: palette.text }
                  ]
                ]}>
                  Standard ({routingCounts.standard})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => updateFilter({ routingFilter: 'direct_imc' })}
                style={[
                  styles.pillTab,
                  state.routingFilter === 'direct_imc' && [
                    styles.pillTabActive,
                    { backgroundColor: palette.surface, shadowColor: '#000' }
                  ]
                ]}
              >
                <Text style={[
                  styles.pillTabText,
                  { color: palette.secondaryText },
                  state.routingFilter === 'direct_imc' && [
                    styles.pillTabTextActive,
                    { color: palette.text }
                  ]
                ]}>
                  Direct to IMC ({routingCounts.direct})
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={[styles.toolbar, !isWideToolbar && styles.fullWidth]}>
            <View nativeID="requestor-overview-search" style={[styles.search, { backgroundColor: palette.background, borderColor: palette.border }, !isWideToolbar && styles.searchFull]}>
              <Ionicons name="search-outline" size={18} color={palette.secondaryText} />
              <TextInput value={state.search} onChangeText={(search) => updateFilter({ search })}
                accessibilityLabel="Search requests" onFocus={() => setOpenMenu(null)}
                placeholder="Search requests…" placeholderTextColor={palette.mutedText}
                style={[styles.searchInput, { color: palette.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} />
              {!!state.search && <Pressable accessibilityRole="button" accessibilityLabel="Clear search"
                onPress={() => updateFilter({ search: '' })} style={styles.clearSearch}>
                <Ionicons name="close" size={18} color={palette.secondaryText} />
              </Pressable>}
            </View>
            <View style={[styles.filterGroup, !isWideToolbar && styles.flexible]}>
              <View ref={statusMenuRef} style={[styles.dropdownHolder, { zIndex: openMenu === 'status' ? 30 : 20 }]}>
                <Pressable ref={statusButtonRef} accessibilityRole="button" accessibilityLabel="Filter by status"
                  {...(Platform.OS === 'web' ? { 'aria-expanded': openMenu === 'status' } : {})}
                  accessibilityState={{ expanded: openMenu === 'status' }}
                  onPress={() => setOpenMenu((previous) => previous === 'status' ? null : 'status')}
                  style={[styles.filterButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                  <Text style={[styles.filterLabel, { color: palette.text }]}>{selectedStatus}</Text>
                  <Ionicons name={openMenu === 'status' ? 'chevron-up' : 'chevron-down'} size={14} color={palette.secondaryText} />
                </Pressable>
                {openMenu === 'status' && <View style={[styles.dropdown, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  {STATUS_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="button"
                    accessibilityLabel={option.label} accessibilityState={{ selected: state.status === option.value }}
                    onPress={() => { updateFilter({ status: option.value }); setOpenMenu(null); statusButtonRef.current?.focus?.(); }}
                    style={[styles.dropdownOption, state.status === option.value && { backgroundColor: palette.secondarySurface }]}>
                    <Text style={[styles.filterLabel, { color: state.status === option.value ? actionColor : palette.text }]}>{option.label}</Text>
                    {state.status === option.value && <Ionicons name="checkmark" size={16} color={actionColor} />}
                  </Pressable>)}
                </View>}
              </View>
              <View ref={dateMenuRef} style={[styles.dropdownHolder, { zIndex: openMenu === 'date' ? 30 : 20 }]}>
                <Pressable ref={dateButtonRef} accessibilityRole="button" accessibilityLabel="Filter by date"
                  {...(Platform.OS === 'web' ? { 'aria-expanded': openMenu === 'date' } : {})}
                  accessibilityState={{ expanded: openMenu === 'date' }}
                  onPress={() => setOpenMenu((previous) => previous === 'date' ? null : 'date')}
                  style={[styles.filterButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                  <Ionicons name="calendar-outline" size={16} color={palette.secondaryText} />
                  <Text style={[styles.filterLabel, { color: palette.text }]}>{selectedDate}</Text>
                  <Ionicons name={openMenu === 'date' ? 'chevron-up' : 'chevron-down'} size={14} color={palette.secondaryText} />
                </Pressable>
                {openMenu === 'date' && <View style={[styles.dropdown, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  {DATE_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="button"
                    accessibilityLabel={option.label} accessibilityState={{ selected: state.date === option.value }}
                    onPress={() => {
                      setOpenMenu(null);
                      if (option.value === 'custom') {
                        setDraftStart(state.startDate); setDraftEnd(state.endDate); setRangeOpen(true);
                      } else { updateFilter({ date: option.value }); dateButtonRef.current?.focus?.(); }
                    }}
                    style={[styles.dropdownOption, state.date === option.value && { backgroundColor: palette.secondarySurface }]}>
                    <Text style={[styles.filterLabel, { color: state.date === option.value ? actionColor : palette.text }]}>{option.label}</Text>
                    {state.date === option.value && <Ionicons name="checkmark" size={16} color={actionColor} />}
                  </Pressable>)}
                </View>}
              </View>
            </View>
          </View>
        </View>


        <View style={styles.resultSummary}>
          <View style={styles.resultCount}>
            <Text accessibilityLiveRegion="polite" style={[styles.smallText, { color: palette.secondaryText }]}>
              {hasFilters ? `${filteredRequests.length} of ${recentRequests.length}` : recentRequests.length} recent {recentRequests.length === 1 && !hasFilters ? 'request' : 'requests'}
            </Text>
            {loading && recentRequests.length > 0 && <ActivityIndicator size="small" color={actionColor} accessibilityLabel="Refreshing recent requests" />}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Sort by ${state.order === 'desc' ? 'oldest' : 'newest'} first`}
            onPress={() => updateFilter({ order: state.order === 'desc' ? 'asc' : 'desc' })} style={styles.sortButton}>
            <Ionicons name="swap-vertical-outline" size={16} color={palette.secondaryText} />
            <Text style={[styles.smallText, { color: palette.secondaryText }]}>{state.order === 'desc' ? 'Newest first' : 'Oldest first'}</Text>
          </Pressable>
        </View>

        {error && recentRequests.length > 0 && <View accessibilityRole="alert" style={[styles.refreshError, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Ionicons name="alert-circle-outline" size={18} color={palette.secondaryText} />
          <Text style={[styles.smallText, { color: palette.secondaryText, flex: 1 }]}>Requests could not refresh. You can still browse the loaded requests.</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.textButton}><Text style={[styles.linkText, { color: actionColor }]}>Try again</Text></Pressable>
        </View>}

        {loading && recentRequests.length === 0 ? (
          <View style={styles.emptyState}><ActivityIndicator color={actionColor} size="large" /><Text style={[styles.bodyText, { color: palette.secondaryText }]}>Loading recent requests…</Text></View>
        ) : error && recentRequests.length === 0 ? (
          <View accessibilityRole="alert" style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={32} color={palette.mutedText} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Recent requests could not load</Text>
            <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Try again to view your recent post requests.</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.retryButton, { borderColor: actionColor }]}><Text style={[styles.linkText, { color: actionColor }]}>Try again</Text></Pressable>
          </View>
        ) : recentRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={32} color={palette.mutedText} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No recent requests yet</Text>
            <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Choose Create New Request above to get started.</Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={32} color={palette.mutedText} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No requests match these filters</Text>
            <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Try another search or clear your filters.</Text>
            <Pressable accessibilityRole="button" onPress={clearFilters} style={[styles.textButton, { alignSelf: 'center' }]}><Text style={[styles.linkText, { color: actionColor }]}>Clear filters</Text></Pressable>
          </View>
        ) : (
          <View>
            {isTable && <View style={[styles.tableHeader, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.columnHeading, styles.titleColumn, { color: palette.secondaryText }]}>Request title</Text>
              <Text style={[styles.columnHeading, styles.column, { color: palette.secondaryText }]}>Category</Text>
              <Text style={[styles.columnHeading, styles.column, { color: palette.secondaryText }]}>Platform</Text>
              <Text style={[styles.columnHeading, styles.column, { color: palette.secondaryText }]}>Date</Text>
              <Text style={[styles.columnHeading, styles.statusColumn, { color: palette.secondaryText }]}>Status</Text>
              <View style={styles.detailsColumn} />
            </View>}
            {visibleRequests.map((request, index) => {
              const imageUrl = resolveImageUrl(request.thumbnailUrl);
              return (
                <Pressable key={request.id ?? index} nativeID={`requestor-overview-row-${index}`}
                  {...(Platform.OS === 'web' ? { dataSet: { overviewRow: 'true', rq: 'row' } } : {})}
                  accessibilityRole="button" accessibilityLabel={`View request: ${request.title}`}
                  onPress={() => onOpen(request)}
                  style={[styles.requestRow, { borderColor: palette.border }, !isTable && [styles.requestCard, { backgroundColor: palette.surface }]]}>
                  <View style={[styles.titleCell, isTable ? styles.titleColumn : styles.fullWidth]}>
                    <View style={[styles.thumbnail, { backgroundColor: palette.background }]}>
                      {imageUrl && !failedImages[imageUrl] ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover"
                        accessibilityLabel={`Thumbnail for ${request.title}`} onError={() => setFailedImages((previous) => ({ ...previous, [imageUrl]: true }))} />
                        : <Ionicons name="document-text-outline" size={20} color={palette.mutedText} />}
                    </View>
                    <View style={styles.titleCopy}>
                      <Text numberOfLines={2} style={[styles.requestTitle, { color: palette.text }]}>{request.title || 'Untitled'}</Text>
                    </View>
                    {!isTable && <View {...rq('chevron')}><Ionicons name="chevron-forward" size={18} color={palette.mutedText} /></View>}
                  </View>
                  {isTable ? <>
                    <Text style={[styles.smallText, styles.column, { color: palette.secondaryText }]}>{categoryName(request)}</Text>
                    <View style={[styles.column, styles.platformList]}>{renderPlatforms(request)}</View>
                    <Text style={[styles.smallText, styles.column, { color: palette.secondaryText }]}>{displayDate(request)}</Text>
                    <View style={styles.statusColumn}>{renderStatus(request)}</View>
                    <View {...rq('chevron')} style={styles.detailsColumn}><Ionicons name="chevron-forward" size={18} color={palette.mutedText} /></View>
                  </> : <>
                    <View style={styles.cardMeta}>
                      <Text style={[styles.smallText, { color: palette.secondaryText, flex: 1 }]}>{categoryName(request)}</Text>
                      <Text style={[styles.smallText, { color: palette.secondaryText }]}>{displayDate(request)}</Text>
                    </View>
                    <View style={styles.cardFooter}>
                      <View style={styles.platformList}>{renderPlatforms(request)}</View>
                      {renderStatus(request)}
                    </View>
                  </>}
                </Pressable>
              );
            })}
          </View>
        )}

        {filteredRequests.length > 0 && <View nativeID="requestor-overview-pagination" style={styles.pagination}>
          <PaginationControl currentPage={page} totalItems={filteredRequests.length} itemsPerPage={perPage}
            onPageChange={(nextPage) => { setOpenMenu(null); onStateChange((previous) => ({ ...previous, page: nextPage })); }}
            onItemsPerPageChange={(nextPerPage) => updateFilter({ perPage: nextPerPage })}
            itemName="recent requests" pageSizeOptions={[5, 10, 20, 50]} />
        </View>}
      </Card>

      <Modal visible={rangeOpen} transparent animationType="none" onRequestClose={closeRange}>
        <View nativeID="requestor-overview-range" style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="Cancel custom date range" onPress={closeRange} style={styles.dismissBackdrop} />
          <View {...rq('modal')} accessibilityViewIsModal style={[styles.rangeDialog, { backgroundColor: palette.surface, borderColor: palette.border, borderTopWidth: 4, borderTopColor: BRAND_PURPLE }]}>
            <View style={styles.dialogHeading}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[styles.dialogEyebrow, { color: actionColor }]}>DATE FILTER</Text>
                <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 2 } : {})} style={[styles.panelTitle, { color: palette.text }]}>Custom date range</Text>
              </View>
              <Pressable {...rq('close')} accessibilityRole="button" accessibilityLabel="Cancel custom date range" onPress={closeRange} style={[styles.closeDialog, { borderColor: palette.border, backgroundColor: palette.background }]}><Ionicons name="close" size={20} color={palette.secondaryText} /></Pressable>
            </View>
            <Text style={[styles.smallText, { color: palette.secondaryText }]}>Filter by the date requested in Manila time.</Text>
            <View style={styles.dateField}>
              <Text nativeID="requestor-range-start-label" style={[styles.fieldLabel, { color: palette.text }]}>Start date</Text>
              {Platform.OS === 'web' ? <input id="overview-start-date" type="date" aria-labelledby="requestor-range-start-label" autoFocus value={draftStart}
                onChange={(event) => setDraftStart(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', height: CONTROL_HEIGHT, borderRadius: BorderRadius.md, border: `1px solid ${palette.border}`, padding: Spacing.sm, backgroundColor: palette.background, color: palette.text, colorScheme: isDarkMode ? 'dark' : 'light', fontSize: FontSize.sm }} />
                : <TextInput accessibilityLabel="Start date, YYYY-MM-DD" value={draftStart} onChangeText={setDraftStart} placeholder="YYYY-MM-DD" placeholderTextColor={palette.mutedText} autoCapitalize="none" style={[styles.dateInput, { color: palette.text, backgroundColor: palette.background, borderColor: palette.border }]} />}
            </View>
            <View style={styles.dateField}>
              <Text nativeID="requestor-range-end-label" style={[styles.fieldLabel, { color: palette.text }]}>End date</Text>
              {Platform.OS === 'web' ? <input id="overview-end-date" type="date" aria-labelledby="requestor-range-end-label" value={draftEnd} min={draftStart || undefined}
                onChange={(event) => setDraftEnd(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', height: CONTROL_HEIGHT, borderRadius: BorderRadius.md, border: `1px solid ${palette.border}`, padding: Spacing.sm, backgroundColor: palette.background, color: palette.text, colorScheme: isDarkMode ? 'dark' : 'light', fontSize: FontSize.sm }} />
                : <TextInput accessibilityLabel="End date, YYYY-MM-DD" value={draftEnd} onChangeText={setDraftEnd} placeholder="YYYY-MM-DD" placeholderTextColor={palette.mutedText} autoCapitalize="none" style={[styles.dateInput, { color: palette.text, backgroundColor: palette.background, borderColor: palette.border }]} />}
            </View>
            {!!rangeError && <Text accessibilityRole="alert" style={[styles.smallText, { color: Colors.error }]}>{rangeError}</Text>}
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" onPress={closeRange} style={[styles.dialogButton, { borderWidth: 1, borderColor: palette.border }]}><Text style={[styles.linkText, { color: palette.text }]}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !validRange }} disabled={!validRange}
                onPress={() => { if (validRange) { updateFilter({ date: 'custom', startDate: draftStart, endDate: draftEnd }); closeRange(); } }}
                style={[styles.dialogButton, { backgroundColor: BRAND_PURPLE, opacity: validRange ? 1 : 0.45 }]}><Text style={[styles.linkText, { color: '#FFFFFF' }]}>Apply range</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', minWidth: 0, gap: Spacing.lg, position: 'relative' },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.lg },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  welcomeCopy: { flex: 1, minWidth: 0, gap: Spacing.sm },
  welcomeTitle: { fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.sm, lineHeight: 20 },
  createButton: { minHeight: CONTROL_HEIGHT, borderRadius: CTA_RADIUS, backgroundColor: BRAND_GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  createButtonText: { color: GOLD_INK, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
  panel: { borderWidth: 1, overflow: 'visible', zIndex: 3 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, zIndex: 20 },
  panelTitle: { fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.bold, flexShrink: 1 },
  pillTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  pillTab: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  pillTabActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  pillTabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pillTabTextActive: {
    fontWeight: '700',
  },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', minWidth: 0 },
  fullWidth: { width: '100%' },
  flexible: { flex: 1 },
  search: { minHeight: CONTROL_HEIGHT, width: 232, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingLeft: Spacing.sm, gap: Spacing.sm },
  searchFull: { flexBasis: '100%', width: '100%', flexGrow: 1 },
  searchInput: { flex: 1, minWidth: 0, height: CONTROL_HEIGHT - 2, fontSize: FontSize.sm, paddingVertical: Spacing.sm, paddingRight: Spacing.sm },
  clearSearch: { width: 36, height: CONTROL_HEIGHT - 2, alignItems: 'center', justifyContent: 'center' },
  filterGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, minWidth: 0 },
  dropdownHolder: { position: 'relative', flexGrow: 1, flexBasis: 144, minWidth: 0 },
  filterButton: { minHeight: CONTROL_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm },
  filterLabel: { flex: 1, fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.medium },
  dropdown: { position: 'absolute', top: CONTROL_HEIGHT + Spacing.sm, left: 0, right: 0, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.xs, shadowColor: '#000', shadowOffset: { width: 0, height: Spacing.xs }, shadowOpacity: 0.1, shadowRadius: Spacing.md, elevation: 8, zIndex: 40 },
  dropdownOption: { minHeight: CONTROL_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  dismissBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  nativeDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2 },
  nativePanelDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
  textButton: { minHeight: CONTROL_HEIGHT, justifyContent: 'center', paddingHorizontal: Spacing.sm, alignSelf: 'flex-start' },
  linkText: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold },
  resultSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  resultCount: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sortButton: { flexDirection: 'row', alignItems: 'center', minHeight: CONTROL_HEIGHT, gap: Spacing.xs, paddingHorizontal: Spacing.xs },
  smallText: { fontSize: FontSize.sm, lineHeight: 20 },
  bodyText: { fontSize: FontSize.md, lineHeight: 24 },
  refreshError: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  emptyState: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md },
  emptyTitle: { fontSize: FontSize.md, lineHeight: 24, fontWeight: FontWeight.semiBold, textAlign: 'center' },
  emptyCopy: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center', maxWidth: 360 },
  retryButton: { minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: BorderRadius.md },
  tableHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderTopLeftRadius: BorderRadius.md, borderTopRightRadius: BorderRadius.md },
  columnHeading: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold },
  titleColumn: { flex: 2.2, minWidth: 0 },
  column: { flex: 1, minWidth: 0 },
  statusColumn: { flex: 1.3, minWidth: 0 },
  detailsColumn: { width: 24, alignItems: 'center', justifyContent: 'center' },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 80, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  requestCard: { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  titleCell: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  thumbnail: { width: 44, height: 44, flexShrink: 0, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  titleCopy: { flex: 1, minWidth: 0, gap: Spacing.xs },
  requestTitle: { fontSize: FontSize.md, lineHeight: 20, fontWeight: FontWeight.semiBold },
  platformList: { gap: Spacing.xs, minWidth: 0, flexShrink: 1 },
  platform: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minWidth: 0 },
  statusGroup: { alignItems: 'flex-start', gap: Spacing.xs, minWidth: 0, flexShrink: 1 },
  statusPill: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, alignSelf: 'flex-start' },
  statusText: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold },
  stageText: { fontSize: FontSize.xs, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: Spacing.sm },
  cardFooter: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md, flexWrap: 'wrap' },
  pagination: { marginTop: Spacing.sm, minWidth: 0 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(17, 24, 39, 0.5)', padding: Spacing.md },
  rangeDialog: { width: '100%', maxWidth: 420, padding: Spacing.lg, gap: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  dialogHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dialogEyebrow: { fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.6 },
  closeDialog: { width: 40, height: 40, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dateField: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold },
  dateInput: { minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, fontSize: FontSize.sm },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: Spacing.sm, paddingTop: Spacing.xs },
  dialogButton: { minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
});
