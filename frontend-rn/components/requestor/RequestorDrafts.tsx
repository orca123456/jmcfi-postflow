import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { PaginationControl } from '../ui/PaginationControl';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { resolveImageUrl } from '../../services/api';
import { useThemeStore } from '../../store/theme';

type RequestorDraftsProps = {
  drafts: any[];
  loading: boolean;
  error: boolean;
  onCreate: () => void;
  onEdit: (draft: any) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
};

const BRAND_PURPLE = '#4C007C';
const BRAND_GOLD = '#FFC72C';
const GOLD_INK = '#1A1A2E';
const CONTROL_HEIGHT = 44;
const CTA_RADIUS = 8;
const TABLE_MIN_WIDTH = 920;
const FULL_PAGINATION_MIN_WIDTH = 640;
const INITIAL_PAGE_SIZE = 10;

function plainCaption(value: unknown): string {
  if (typeof value !== 'string') return '';
  const entities: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  };
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (!name.startsWith('#')) return entities[name.toLowerCase()] ?? entity;
      const code = name.slice(1, 2).toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    })
    .replace(/\s+/g, ' ').trim();
}

function titleOf(draft: any): string {
  return typeof draft.title === 'string' && draft.title.trim() ? draft.title.trim() : 'Untitled draft';
}

function categoryOf(draft: any): string {
  const value = draft.other_category_name || draft.category?.name || draft.category;
  return typeof value === 'string' && value.trim() ? value.trim() : 'Uncategorized';
}

function savedDateOf(draft: any): string {
  const value = draft.updated_at || draft.rawPost?.updated_at || draft.created_at || draft.rawPost?.created_at;
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
      }).format(date);
    }
  }
  return typeof draft.dateSaved === 'string' && draft.dateSaved.trim() && draft.dateSaved !== 'Invalid Date'
    ? draft.dateSaved : 'Date unavailable';
}

export function RequestorDrafts({ drafts, loading, error, onCreate, onEdit, onDelete, onRetry }: RequestorDraftsProps) {
  const isDarkMode = useThemeStore((store) => store.isDarkMode);
  const [contentWidth, setContentWidth] = useState(0);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(INITIAL_PAGE_SIZE);
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
  };
  const actionColor = isDarkMode ? BRAND_GOLD : BRAND_PURPLE;
  const isTable = contentWidth >= TABLE_MIN_WIDTH;
  const wideHeader = contentWidth >= 700;
  const loadedDrafts = Array.isArray(drafts) ? drafts : [];
  const query = search.trim().toLocaleLowerCase();
  const filteredDrafts = useMemo(() => loadedDrafts.filter((draft) => !query || [
    titleOf(draft), categoryOf(draft), plainCaption(draft.caption || draft.caption_narrative || draft.rawPost?.caption_narrative),
  ].some((value) => value.toLocaleLowerCase().includes(query))), [loadedDrafts, query]);
  const totalPages = Math.max(1, Math.ceil(filteredDrafts.length / perPage));
  const page = Math.min(totalPages, Math.max(1, currentPage));
  const visibleDrafts = filteredDrafts.slice((page - 1) * perPage, page * perPage);
  const clearSearch = () => { setSearch(''); setCurrentPage(1); };
  const focusProps = (key: string) => ({
    onFocus: () => setFocusedControl(key),
    onBlur: () => setFocusedControl((previous) => previous === key ? null : previous),
  });
  const focusStyle = (key: string) => focusedControl === key ? { borderColor: actionColor } : undefined;

  const renderCreateButton = (empty = false) => (
    <Pressable nativeID={empty ? 'requestor-drafts-create-empty' : 'requestor-drafts-create'}
      accessibilityRole="button" accessibilityLabel={empty ? 'Start a new request' : 'Create New Request'}
      onPress={onCreate} {...focusProps(empty ? 'create-empty' : 'create')}
      style={({ pressed }) => [styles.createButton, empty && { alignSelf: 'center' }, pressed && styles.pressed, focusStyle(empty ? 'create-empty' : 'create')]}>
      <Ionicons name="add" size={18} color={GOLD_INK} />
      <Text style={styles.createButtonText}>{empty ? 'Start a New Request' : 'Create New Request'}</Text>
    </Pressable>
  );

  const renderRetry = () => (
    <Pressable accessibilityRole="button" accessibilityLabel="Retry loading drafts" onPress={onRetry}
      {...focusProps('retry')} style={({ pressed }) => [styles.outlineButton,
        { borderColor: palette.border, backgroundColor: palette.surface }, pressed && styles.pressed, focusStyle('retry')]}>
      <Ionicons name="refresh-outline" size={16} color={actionColor} />
      <Text style={[styles.actionText, { color: actionColor }]}>Try again</Text>
    </Pressable>
  );

  return (
    <View nativeID="requestor-drafts" style={styles.container}
      onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      {Platform.OS === 'web' && <style>{`
        #requestor-drafts [role="button"] { cursor: pointer; }
        #requestor-drafts :is([role="button"], input, select):focus-visible {
          outline: 2px solid ${actionColor} !important; outline-offset: 2px;
        }
        #requestor-drafts-search:focus-within { border-color: ${actionColor} !important; }
        #requestor-drafts [id^="requestor-drafts-create"] [dir="auto"],
        #requestor-drafts [id^="requestor-drafts-edit-"] [dir="auto"] { color: ${GOLD_INK} !important; }
        #requestor-drafts [id^="requestor-drafts-title-"]:hover { background-color: ${palette.secondarySurface} !important; }
        #requestor-drafts [id^="requestor-drafts-title-"]:hover [dir="auto"]:first-child { text-decoration: underline; }
        #requestor-drafts [id^="requestor-drafts-edit-"]:hover,
        #requestor-drafts [id^="requestor-drafts-create"]:hover { filter: brightness(0.96); }
        #requestor-drafts [id^="requestor-drafts-delete-"]:hover { background-color: ${palette.secondarySurface} !important; }
        #requestor-drafts-pagination > div { padding-left: 0 !important; padding-right: 0 !important; border-top-color: ${palette.border} !important; }
        #requestor-drafts-pagination > div > div { flex-wrap: wrap; max-width: 100%; min-width: 0; }
        #requestor-drafts-pagination select { max-width: 100%; color: ${palette.text} !important; background-color: ${palette.surface} !important; border-color: ${palette.border} !important; }
      `}</style>}

      <View style={[styles.welcomeRow, !wideHeader && styles.stacked]}>
        <View style={styles.welcomeCopy}>
          <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 1 } : {})}
            style={[styles.welcomeTitle, { color: palette.text, fontSize: wideHeader ? FontSize.xxl : FontSize.xl }]}>
            Draft Post Requests
          </Text>
          <Text style={[styles.subtitle, { color: palette.secondaryText }]}>
            Pick up where you left off. Edit your saved drafts and submit them for approval when ready.
          </Text>
        </View>
        {renderCreateButton()}
      </View>

      <Card padding={isTable ? Spacing.lg : Spacing.md} style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.panelHeader, !wideHeader && styles.stacked]}>
          <View style={styles.panelCopy}>
            <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 2 } : {})}
              style={[styles.panelTitle, { color: palette.text }]}>Saved Drafts</Text>
            <Text style={[styles.smallText, { color: palette.secondaryText }]}>
              {loading && !loadedDrafts.length ? 'Loading your saved work…'
                : error && !loadedDrafts.length ? 'Your drafts could not be loaded.'
                  : `${loadedDrafts.length} saved ${loadedDrafts.length === 1 ? 'draft' : 'drafts'}`}
            </Text>
          </View>
          <View nativeID="requestor-drafts-search" style={[styles.search,
            { backgroundColor: palette.background, borderColor: palette.border }, !wideHeader && styles.searchFull, focusStyle('search')]}>
            <Ionicons name="search-outline" size={18} color={palette.secondaryText} />
            <TextInput value={search} onChangeText={(value) => { setSearch(value); setCurrentPage(1); }}
              accessibilityLabel="Search drafts by title, category, or caption" placeholder="Search drafts…"
              placeholderTextColor={palette.mutedText} autoCapitalize="none" autoCorrect={false} {...focusProps('search')}
              style={[styles.searchInput, { color: palette.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} />
            {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear draft search" onPress={clearSearch}
              {...focusProps('clear-search')} style={({ pressed }) => [styles.clearSearch, pressed && styles.pressed, focusStyle('clear-search')]}>
              <Ionicons name="close" size={18} color={palette.secondaryText} />
            </Pressable>}
          </View>
        </View>

        {!!query && <View style={styles.filterSummary}>
          <Text accessibilityLiveRegion="polite" style={[styles.smallText, { color: palette.secondaryText, flexShrink: 1 }]}>
            {filteredDrafts.length} {filteredDrafts.length === 1 ? 'match' : 'matches'} for “{search.trim()}”
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Clear draft search filter" onPress={clearSearch}
            {...focusProps('clear-filter')} style={({ pressed }) => [styles.textButton, pressed && styles.pressed, focusStyle('clear-filter')]}>
            <Text style={[styles.actionText, { color: actionColor }]}>Clear search</Text>
          </Pressable>
        </View>}

        {loading && !!loadedDrafts.length && <View accessibilityLiveRegion="polite" style={styles.refreshStatus}>
          <ActivityIndicator size="small" color={actionColor} />
          <Text style={[styles.smallText, { color: palette.secondaryText }]}>Refreshing drafts…</Text>
        </View>}
        {error && !!loadedDrafts.length && <View accessibilityRole="alert" style={[styles.refreshError, { borderColor: palette.border, backgroundColor: palette.background }]}>
          <Ionicons name="alert-circle-outline" size={20} color={palette.error} />
          <Text style={[styles.smallText, { color: palette.text, flexGrow: 1, flexBasis: 180 }]}>Couldn’t refresh drafts. Your saved list is still shown.</Text>
          {renderRetry()}
        </View>}

        {loading && !loadedDrafts.length ? (
          <View accessibilityLiveRegion="polite" style={styles.emptyState}>
            <ActivityIndicator color={actionColor} size="large" />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Loading drafts</Text>
            <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Your saved post requests will appear here.</Text>
          </View>
        ) : error && !loadedDrafts.length ? (
          <View accessibilityRole="alert" style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={40} color={palette.error} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>We couldn’t load your drafts</Text>
            <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Try again to see your saved post requests.</Text>
            {renderRetry()}
          </View>
        ) : !loadedDrafts.length ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: palette.secondarySurface }]}>
              <Ionicons name="create-outline" size={32} color={actionColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No saved drafts yet</Text>
            <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Start a post request and save it as a draft to finish later.</Text>
            {renderCreateButton(true)}
          </View>
        ) : !filteredDrafts.length ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={40} color={palette.secondaryText} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No drafts match your search</Text>
            <Text style={[styles.emptyCopy, { color: palette.secondaryText }]}>Try another title, category, or word from your caption.</Text>
            <Pressable accessibilityRole="button" onPress={clearSearch} {...focusProps('empty-clear')}
              style={({ pressed }) => [styles.outlineButton, { borderColor: palette.border }, pressed && styles.pressed, focusStyle('empty-clear')]}>
              <Text style={[styles.actionText, { color: actionColor }]}>Clear search</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {isTable && <View style={[styles.tableHeader, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.columnHeading, styles.titleColumn, { color: palette.secondaryText }]}>Request title</Text>
              <Text style={[styles.columnHeading, styles.column, { color: palette.secondaryText }]}>Category</Text>
              <Text style={[styles.columnHeading, styles.column, { color: palette.secondaryText }]}>Date saved</Text>
              <Text style={[styles.columnHeading, styles.statusColumn, { color: palette.secondaryText }]}>Status</Text>
              <Text style={[styles.columnHeading, styles.actionColumn, { color: palette.secondaryText, textAlign: 'right' }]}>Actions</Text>
            </View>}
            {visibleDrafts.map((draft, index) => {
              const title = titleOf(draft);
              const caption = plainCaption(draft.caption || draft.caption_narrative || draft.rawPost?.caption_narrative);
              const savedDate = savedDateOf(draft);
              const imageUrl = resolveImageUrl(draft.thumbnailUrl);
              const imageKey = `${draft.id}:${imageUrl}`;
              const controlKey = String(draft.id ?? index);
              const status = <View style={[styles.statusPill, { backgroundColor: palette.secondarySurface }]}>
                <Text style={[styles.statusText, { color: palette.secondaryText }]}>Draft</Text>
              </View>;
              return (
                <View key={controlKey} style={[isTable ? styles.draftRow : styles.draftCard, { borderColor: palette.border }]}>
                  <Pressable nativeID={`requestor-drafts-title-${controlKey}`} accessibilityRole="button"
                    accessibilityLabel={`Edit draft: ${title}`} onPress={() => onEdit(draft)} {...focusProps(`title-${controlKey}`)}
                    style={({ pressed }) => [styles.titleCell, isTable && styles.titleColumn, pressed && { backgroundColor: palette.secondarySurface }, focusStyle(`title-${controlKey}`)]}>
                    <View style={[styles.thumbnail, { backgroundColor: palette.secondarySurface }]}>
                      {imageUrl && !failedImages[imageKey] ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover"
                        accessible={false} onError={() => setFailedImages((previous) => ({ ...previous, [imageKey]: true }))} />
                        : <Ionicons name="document-text-outline" size={20} color={palette.secondaryText} />}
                    </View>
                    <View style={styles.titleCopy}>
                      <Text numberOfLines={2} style={[styles.draftTitle, { color: palette.text }]}>{title}</Text>
                      <Text numberOfLines={isTable ? 1 : 2} style={[styles.smallText, { color: palette.secondaryText }]}>{caption || 'No caption added yet'}</Text>
                    </View>
                  </Pressable>
                  {isTable ? <>
                    <Text style={[styles.smallText, styles.column, { color: palette.secondaryText }]}>{categoryOf(draft)}</Text>
                    <Text style={[styles.smallText, styles.column, { color: palette.secondaryText }]}>{savedDate}</Text>
                    <View style={styles.statusColumn}>{status}</View>
                  </> : <>
                    <View style={styles.cardMeta}>
                      <Text style={[styles.smallText, { color: palette.secondaryText, flexShrink: 1 }]}>{categoryOf(draft)}</Text>
                      {status}
                    </View>
                    <View style={styles.savedDate}>
                      <Ionicons name="time-outline" size={16} color={palette.secondaryText} />
                      <Text style={[styles.smallText, { color: palette.secondaryText, flexShrink: 1 }]}>{savedDate === 'Date unavailable' ? 'Date saved unavailable' : `Saved ${savedDate}`}</Text>
                    </View>
                  </>}
                  <View style={[styles.actions, isTable && styles.actionColumn]}>
                    <Pressable nativeID={`requestor-drafts-edit-${controlKey}`} accessibilityRole="button"
                      accessibilityLabel={`Edit and submit draft: ${title}`} onPress={() => onEdit(draft)} {...focusProps(`edit-${controlKey}`)}
                      style={({ pressed }) => [styles.editButton, pressed && styles.pressed, focusStyle(`edit-${controlKey}`)]}>
                      <Ionicons name="create-outline" size={16} color={GOLD_INK} />
                      <Text style={styles.createButtonText}>Edit &amp; submit</Text>
                    </Pressable>
                    <Pressable nativeID={`requestor-drafts-delete-${controlKey}`} accessibilityRole="button"
                      accessibilityLabel={`Delete draft: ${title}`} onPress={() => onDelete(draft.id)} {...focusProps(`delete-${controlKey}`)}
                      style={({ pressed }) => [styles.deleteButton, { borderColor: palette.border },
                        pressed && { backgroundColor: palette.secondarySurface }, focusStyle(`delete-${controlKey}`)]}>
                      <Ionicons name="trash-outline" size={18} color={palette.error} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!!filteredDrafts.length && <View nativeID="requestor-drafts-pagination" style={styles.pagination}>
          {Platform.OS === 'web' && contentWidth >= FULL_PAGINATION_MIN_WIDTH ? <PaginationControl currentPage={page} totalItems={filteredDrafts.length}
            itemsPerPage={perPage} onPageChange={setCurrentPage} onItemsPerPageChange={(value) => { setPerPage(value); setCurrentPage(1); }}
            itemName="drafts" pageSizeOptions={[5, 10, 20, 50]} /> : <View style={[styles.compactPagination, { borderColor: palette.border }]}>
            <Text accessibilityLiveRegion="polite" style={[styles.smallText, { color: palette.secondaryText }]}>
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filteredDrafts.length)} of {filteredDrafts.length} drafts
            </Text>
            {totalPages > 1 && <View style={styles.compactControls}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous draft page" disabled={page === 1}
                accessibilityState={{ disabled: page === 1 }} onPress={() => setCurrentPage(page - 1)} {...focusProps('previous')}
                style={({ pressed }) => [styles.pageArrow, { borderColor: palette.border, opacity: page === 1 ? 0.4 : 1 }, pressed && styles.pressed, focusStyle('previous')]}>
                <Ionicons name="chevron-back" size={18} color={palette.text} />
              </Pressable>
              <Text style={[styles.smallText, { color: palette.text }]}>Page {page} of {totalPages}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next draft page" disabled={page === totalPages}
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
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.lg },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  welcomeCopy: { flex: 1, minWidth: 0, gap: Spacing.sm },
  welcomeTitle: { fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.sm, lineHeight: 20 },
  createButton: { minHeight: CONTROL_HEIGHT, borderRadius: CTA_RADIUS, backgroundColor: BRAND_GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 2, borderColor: 'transparent', maxWidth: '100%' },
  createButtonText: { color: GOLD_INK, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, flexShrink: 1 },
  panel: { borderWidth: 1, minWidth: 0 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.md },
  panelCopy: { gap: Spacing.xs, minWidth: 0, flexShrink: 1 },
  panelTitle: { fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.bold },
  smallText: { fontSize: FontSize.sm, lineHeight: 20 },
  search: { minHeight: CONTROL_HEIGHT, width: 280, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingLeft: Spacing.sm, gap: Spacing.sm },
  searchFull: { width: '100%' },
  searchInput: { flex: 1, minWidth: 0, height: CONTROL_HEIGHT, fontSize: FontSize.sm, paddingVertical: Spacing.sm, paddingRight: Spacing.sm },
  clearSearch: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: BorderRadius.sm },
  filterSummary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  textButton: { minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: BorderRadius.sm },
  actionText: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold },
  refreshStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  refreshError: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  emptyState: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md },
  emptyIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.lg },
  emptyTitle: { fontSize: FontSize.md, lineHeight: 24, fontWeight: FontWeight.semiBold, textAlign: 'center' },
  emptyCopy: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center', maxWidth: 360 },
  outlineButton: { minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md },
  list: { minWidth: 0 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: CONTROL_HEIGHT, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderTopLeftRadius: BorderRadius.md, borderTopRightRadius: BorderRadius.md },
  columnHeading: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold },
  titleColumn: { flex: 2.6, minWidth: 0 },
  column: { flex: 1, minWidth: 0 },
  statusColumn: { width: 64, alignItems: 'flex-start' },
  actionColumn: { width: 184, flexShrink: 0 },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  draftCard: { gap: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, minWidth: 0 },
  titleCell: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 0, minHeight: CONTROL_HEIGHT, borderWidth: 2, borderColor: 'transparent', borderRadius: BorderRadius.sm },
  thumbnail: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, flexShrink: 0, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  titleCopy: { flex: 1, minWidth: 0, gap: Spacing.xs },
  draftTitle: { fontSize: FontSize.md, lineHeight: 20, fontWeight: FontWeight.semiBold },
  cardMeta: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm },
  savedDate: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusPill: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, alignSelf: 'flex-start' },
  statusText: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, minWidth: 0 },
  editButton: { minHeight: CONTROL_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: BRAND_GOLD, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: CTA_RADIUS, borderWidth: 2, borderColor: 'transparent', flexShrink: 1 },
  deleteButton: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: CTA_RADIUS, borderWidth: 1 },
  pagination: { marginTop: Spacing.sm, minWidth: 0 },
  compactPagination: { paddingTop: Spacing.md, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.md },
  compactControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pageArrow: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: BorderRadius.md },
  pressed: { opacity: 0.76 },
});
