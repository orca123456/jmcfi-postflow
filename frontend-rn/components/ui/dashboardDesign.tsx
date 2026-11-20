import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, Platform, TextStyle, useWindowDimensions, ViewStyle } from 'react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { useThemeStore } from '../../store/theme';

// The requestor workspace is the visual reference for every role dashboard.
// These values describe presentation only; role data and actions remain in their pages.
export const dashboardUi = {
  purple: '#4C007C', gold: '#FFC72C', goldInk: '#1A1A2E', controlHeight: 44,
  tableMinWidth: 960, pageGap: Spacing.lg,
};

export const dashboardStyles = {
  workspace: { width: '100%', minWidth: 0, gap: Spacing.lg },
  pageHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, minWidth: 0 },
  headerCopy: { flex: 1, minWidth: 0, gap: Spacing.sm },
  pageTitle: { fontSize: FontSize.xxl, lineHeight: 36, fontWeight: FontWeight.bold, color: Colors.textPrimary, flexShrink: 1 },
  pageTitleMobile: { fontSize: FontSize.xl, lineHeight: 28 },
  subtitle: { fontSize: FontSize.sm, lineHeight: 20, color: Colors.textSecondary, flexShrink: 1 },
  panel: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, padding: Spacing.lg, minWidth: 0 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.md, minWidth: 0, zIndex: 20 },
  panelTitle: { fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.bold, color: Colors.textPrimary, flexShrink: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, minWidth: 0 },
  search: { minHeight: 44, width: 232, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, backgroundColor: Colors.background, paddingHorizontal: Spacing.sm },
  searchInput: { flex: 1, minWidth: 0, height: 42, fontSize: FontSize.sm, color: Colors.textPrimary, paddingVertical: Spacing.sm },
  control: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, backgroundColor: Colors.background, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, minWidth: 0 },
  controlText: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.medium, color: Colors.textPrimary, flexShrink: 1 },
  primaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: '#4C007C', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minWidth: 0 },
  primaryButtonText: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold, color: '#FFFFFF' },
  secondaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minWidth: 0 },
  secondaryButtonText: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, minWidth: 0 },
  metricCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, minHeight: 128, minWidth: 0, justifyContent: 'space-between' },
  metricLabel: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold, color: Colors.textSecondary },
  metricValue: { fontSize: FontSize.xxl, lineHeight: 36, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  metricHint: { fontSize: FontSize.xs, lineHeight: 16, color: Colors.textSecondary },
  tableHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  columnHeading: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold, color: Colors.textSecondary },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 80, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1, borderColor: Colors.border },
  cellText: { fontSize: FontSize.sm, lineHeight: 20, color: Colors.textPrimary, flexShrink: 1 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, maxWidth: '100%' },
  statusText: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold, flexShrink: 1 },
  label: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold, color: Colors.textSecondary },
  input: { minHeight: 44, minWidth: 0, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, color: Colors.textPrimary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: FontSize.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  modalCard: { width: '100%', maxWidth: 820, maxHeight: '90%', minWidth: 0, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 4, borderTopColor: '#4C007C', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSize.md + 2, lineHeight: 24, fontWeight: FontWeight.bold, color: Colors.textPrimary, flexShrink: 1 },
  modalBody: { padding: Spacing.lg, gap: Spacing.md },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
} satisfies Record<string, ViewStyle | TextStyle>;

export function useDashboardLayout() {
  const window = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || window.width;
  // Breakpoints are anchored to viewport dimensions to prevent oscillation / flickering loops
  // caused by scrollbar toggling or flex wrapping.
  const isNarrow = window.width < 640;
  const isCompact = window.width < 960;
  const isWide = window.width >= 1080;
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setMeasuredWidth((prev) => (Math.abs(prev - nextWidth) >= 4 ? nextWidth : prev));
  }, []);
  return { width, onLayout, isNarrow, isCompact, isWide };
}

export function DashboardUiPolish({ rootId }: { rootId: string }) {
  const dark = useThemeStore((state) => state.isDarkMode);
  if (Platform.OS !== 'web') return null;
  const focusColor = dark ? '#D8B4FE' : dashboardUi.purple;
  // Only controls explicitly marked by each role page receive field focus styling.
  return React.createElement('style', null, `
    #${rootId} [role="button"]:focus-visible { outline: 2px solid ${focusColor}; outline-offset: 2px; }
    #${rootId} [data-dashboard-field] { min-width: 0; }
    #${rootId} [data-dashboard-field]:focus-within { border-color: ${focusColor} !important; box-shadow: 0 0 0 2px rgba(76,0,124,.08); }
    #${rootId} [data-dashboard-field] input { outline: none !important; box-shadow: none !important; min-width: 0; }
    #${rootId} input, #${rootId} textarea, #${rootId} select { box-sizing: border-box; max-width: 100%; }
    #${rootId} [data-dashboard-pagination] > div > div { flex-wrap: wrap; min-width: 0; max-width: 100%; }
    @media (prefers-reduced-motion: no-preference) { #${rootId} [role="button"] { transition: background-color 160ms ease, border-color 160ms ease; } }
  `);
}
