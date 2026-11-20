import React from 'react';
import { Platform } from 'react-native';

/**
 * One shared, web-only stylesheet that gives every requestor screen the same
 * motion and interaction language. It only adds movement, hover/press feedback
 * and spacing; it never changes the JMCFI brand colors or the background.
 *
 * Motion rules:
 *  - short (160-320ms), ease-out, small distances (≤ 8px)
 *  - entrance only, nothing loops except loading shimmer
 *  - fully disabled for users who prefer reduced motion
 */
const PAGES = [
  '#requestor-overview',
  '#requestor-drafts',
  '#requestor-rejected',
  '#requestor-type-selector',
  '#requestor-standard-form',
  '#requestor-imc-workspace',
  '#requestor-workspace #postflow-policy-rules',
].join(', ');

const EASE = 'cubic-bezier(.2, .7, .2, 1)';
const ROW = '[data-rq="row"], [data-overview-row]';

const css = `
@keyframes rq-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes rq-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rq-pop { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes rq-shimmer { from { background-position: -480px 0; } to { background-position: 480px 0; } }

/* Keep the last rows clear of the floating assistant launcher on desktop. */
@media (min-width: 1024px) {
  #requestor-workspace { padding-bottom: 80px; box-sizing: border-box; }
}

/* Page entrance: every tab arrives the same way. */
:is(${PAGES}) { animation: rq-enter 300ms ${EASE} both; }

/* Rows and list cards: quick staggered entrance + calm hover tint. */
:is(${ROW}) {
  animation: rq-enter 320ms ${EASE} both;
  transition: background-color 160ms ease, box-shadow 180ms ease, border-color 160ms ease;
}
:is(${ROW}):nth-child(2) { animation-delay: 30ms; }
:is(${ROW}):nth-child(3) { animation-delay: 60ms; }
:is(${ROW}):nth-child(4) { animation-delay: 90ms; }
:is(${ROW}):nth-child(5) { animation-delay: 120ms; }
:is(${ROW}):nth-child(6) { animation-delay: 150ms; }
:is(${ROW}):nth-child(7) { animation-delay: 180ms; }
:is(${ROW}):nth-child(n+8) { animation-delay: 210ms; }
:is(${ROW}):hover { background-color: rgba(76, 0, 124, 0.035) !important; }
:is(${ROW}):active { background-color: rgba(76, 0, 124, 0.06) !important; }

/* Trailing chevrons glide forward on hover to hint "open". */
[data-rq="chevron"] { transition: transform 180ms ${EASE}; }
:is(${ROW}, [data-rq="card"]):hover [data-rq="chevron"] { transform: translateX(3px); }

/* Clickable cards lift slightly. */
[data-rq="card"] { transition: transform 200ms ${EASE}, box-shadow 200ms ease, border-color 160ms ease; }
[data-rq="card"]:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(76, 0, 124, 0.10); }
[data-rq="card"]:active { transform: translateY(0); box-shadow: 0 4px 12px rgba(76, 0, 124, 0.08); }

/* Buttons: one consistent press feel across all requestor screens and windows. */
:is(#requestor-workspace, [data-rq="modal"]) [role="button"]:not([data-rq="row"]):not([data-overview-row]):not([data-rq="card"]) {
  transition: transform 120ms ease, box-shadow 180ms ease, background-color 160ms ease, border-color 160ms ease, filter 160ms ease;
}
:is(#requestor-workspace, [data-rq="modal"]) [role="button"]:not([data-rq="row"]):not([data-overview-row]):not([data-rq="card"]):not([aria-disabled="true"]):active {
  transform: scale(.97);
}

/* Gold primary actions: soft lift and warm glow. */
[data-rq="primary"]:not([aria-disabled="true"]):hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(255, 199, 44, 0.38); filter: none !important; }
[data-rq="primary"]:not([aria-disabled="true"]):active { transform: translateY(0) scale(.98); box-shadow: 0 3px 8px rgba(255, 199, 44, 0.30); }

/* Floating windows: same pop-in and the same close button behaviour. */
[data-rq="modal"] { animation: rq-pop 240ms ${EASE} both; }
[data-rq="close"] { transition: background-color 160ms ease, transform 160ms ease; cursor: pointer; }
[data-rq="close"]:hover { background-color: rgba(76, 0, 124, 0.10) !important; }

/* Loading placeholders. */
[data-rq="skeleton"] {
  background-image: linear-gradient(90deg, rgba(148, 163, 184, 0.14) 0%, rgba(148, 163, 184, 0.30) 50%, rgba(148, 163, 184, 0.14) 100%);
  background-size: 960px 100%;
  animation: rq-shimmer 1.3s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  :is(${PAGES}), :is(${ROW}), [data-rq] { animation: none !important; transition: none !important; }
  [data-rq="card"]:hover, [data-rq="primary"]:hover, :is(${ROW}, [data-rq="card"]):hover [data-rq="chevron"] { transform: none !important; }
  :is(#requestor-workspace, [data-rq="modal"]) [role="button"]:active { transform: none !important; }
}
`;

export function RequestorPolish() {
  if (Platform.OS !== 'web') return null;
  return <style>{css}</style>;
}
