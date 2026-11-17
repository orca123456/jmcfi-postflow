import { readyAssistantWelcome } from './assistantWelcome';

type Handoff = {
  overlay: HTMLElement;
  deadline: ReturnType<typeof setTimeout>;
  frame: number | null;
  animation: Animation | null;
  motion: MediaQueryList;
  motionChanged: () => void;
  revealing: boolean;
};

let pending: Handoff | null = null;

function clearHandoff(active: Handoff | null = pending, announce = true) {
  if (!active) return;
  clearTimeout(active.deadline);
  if (active.frame !== null) cancelAnimationFrame(active.frame);
  active.motion.removeEventListener('change', active.motionChanged);
  active.animation?.cancel();
  active.overlay.remove();
  if (pending === active) { pending = null; if (announce) readyAssistantWelcome(); }
}

/** Keep the campus visible across the route change, then uncover the mounted dashboard. */
export function beginDashboardHandoff(navigate: () => void) {
  clearHandoff(pending, false);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const source = document.querySelector<HTMLElement>('.pfa-root');
  if (motion.matches || !source) { readyAssistantWelcome(); navigate(); return; }

  const overlay = source.cloneNode(true) as HTMLElement;
  // The card and character have already left. Only the campus and brand crossfade.
  overlay.querySelectorAll('.pfa-layout, .pfa-intro, .pfa-sign-in-status').forEach(node => node.remove());
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('data-postflow-handoff', '');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', width: '100vw', height: '100dvh',
    minHeight: '0', overflow: 'hidden', zIndex: '2147483000',
    pointerEvents: 'none', opacity: '1',
  });
  document.body.appendChild(overlay);

  const active: Handoff = {
    overlay, deadline: setTimeout(() => clearHandoff(active), 2500),
    frame: null, animation: null, motion, revealing: false,
    motionChanged: () => { if (motion.matches) clearHandoff(active); },
  };
  pending = active;
  motion.addEventListener('change', active.motionChanged);
  try { navigate(); } catch (error) { clearHandoff(active, false); throw error; }
}

export function completeDashboardHandoff() {
  const active = pending;
  if (!active || active.revealing) return;
  active.revealing = true;
  if (active.motion.matches) { clearHandoff(active); return; }
  // Wait for the new route's layout and first paint; no blank frame between screens.
  active.frame = requestAnimationFrame(() => {
    active.frame = requestAnimationFrame(() => {
      active.frame = null;
      if (pending !== active) return;
      active.overlay.dataset.phase = 'revealing';
      if (typeof active.overlay.animate !== 'function') {
        active.overlay.style.transition = 'opacity 450ms ease';
        active.overlay.style.opacity = '0';
        clearTimeout(active.deadline);
        active.deadline = setTimeout(() => clearHandoff(active), 500);
        return;
      }
      active.animation = active.overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 450, easing: 'cubic-bezier(.25,.6,.3,1)', fill: 'forwards',
      });
      active.animation.finished.then(() => clearHandoff(active), () => clearHandoff(active));
    });
  });
}
