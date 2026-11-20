import { Platform } from 'react-native';

/**
 * Shared hooks into the requestor polish stylesheet (see RequestorPolish.tsx).
 * On web these become `data-rq-*` attributes; on native they are no-ops.
 *
 * - row:     table rows / list cards (staggered entrance + hover tint)
 * - card:    selectable or clickable cards (gentle hover lift)
 * - primary: gold call-to-action buttons (soft hover glow)
 * - modal:   floating window panels (pop-in entrance)
 * - close:   modal close buttons (consistent hover state)
 * - chevron: trailing arrow that nudges on row hover
 * - skeleton: loading placeholder shimmer
 */
export type RqRole = 'row' | 'card' | 'primary' | 'modal' | 'close' | 'chevron' | 'skeleton';

export function rq(role: RqRole): Record<string, unknown> {
  if (Platform.OS !== 'web') return {};
  return { dataSet: { rq: role } };
}
