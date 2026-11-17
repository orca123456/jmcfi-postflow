/**
 * ChatBot (web) — JMCFI PostFlow Interactive Assistant
 *
 * Web-only replacement for the old JMC-logo chatbot. Metro resolves this file
 * instead of ChatBot.tsx on the web platform; native keeps the original.
 *
 * Visuals/animations come from /postflow-chatbot/postflow-chatbot.css and the
 * sprite assets in /postflow-chatbot/assets (served from frontend-rn/public).
 * Replies are powered by the existing PostFlow AI endpoint (chatbotApi), with
 * the assistant package's built-in FAQ used as an offline fallback.
 */
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { chatbotApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { useThemeStore } from '../store/theme';
import PostflowCharacter from './PostflowCharacter.web';
import { characterStyles } from './postflowCharacterStyles';
import { useApproverReviewCount } from './useApproverReviewCount';
import { consumeAssistantWelcome, getAssistantWelcome, subscribeAssistantWelcome } from '../utils/assistantWelcome';
import { getAssistantSoundEnabled, subscribeAssistantSound, setAssistantSoundEnabled, playAssistantSound, prepareAssistantAudio } from '../utils/assistantSound.web';

const BASE = '/postflow-chatbot';
const CSS_ID = 'postflow-chatbot-css';

type Role = 'admin' | 'approver' | 'requestor';
type ChatTurn = { role: 'user' | 'assistant'; content: string };

/* ── Helpers ──────────────────────────────────────────────────────────── */
function loadStylesheet(): Promise<void> {
  return new Promise((resolve) => {
    const existing = document.getElementById(CSS_ID) as HTMLLinkElement | null;
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => resolve(), { once: true });
      return;
    }
    const link = document.createElement('link');
    link.id = CSS_ID;
    link.rel = 'stylesheet';
    link.href = `${BASE}/postflow-chatbot.css`;
    link.addEventListener('load', () => { link.dataset.loaded = '1'; resolve(); }, { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(link);
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Minimal, safe markdown: escape first, then **bold**, `code`, headings and bullets. */
function formatReply(raw: string) {
  return escapeHtml(raw)
    .replace(/^#{1,3}\s+(.*)$/gm, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** Built-in FAQ from the assistant package (used only if the AI endpoint fails). */
function localAnswer(q: string) {
  const t = q.toLowerCase();
  if (/hello|hi|hey|good (morning|afternoon|evening)/.test(t)) return 'Hello! 👋 I can help you with posting requests, approval steps, and publication updates. What would you like to know?';
  if (/approv|workflow|department head|vpaa|vice president|imc|who review/.test(t)) return 'PostFlow requests go through three approval levels:\n1. Department Head\n2. Vice President for Academic Affairs (VPAA)\n3. Institutional Media Center (IMC)\nOnce IMC approves, the approved post can be published automatically to the selected platforms.';
  if (/track|status|request|pending/.test(t)) return 'To check a request, open My Requests in PostFlow and select your submission. You can review its current status and approval history there.';
  if (/reject|decline|reason|revision/.test(t)) return 'If your request is rejected, check the request details and notification for the reviewer’s reason. Update the content based on their comments before submitting again.';
  if (/publish|platform|facebook|post|failed/.test(t)) return 'A post is scheduled for automatic publishing after final IMC approval. If publication fails, check its status in PostFlow and contact the IMC or the system administrator if the issue continues.';
  if (/register|log in|login|account|password|sign in/.test(t)) return 'Use your authorized JMCFI account to sign in. For account access or password concerns, contact your PostFlow administrator.';
  if (/email|notif|remind/.test(t)) return 'PostFlow uses email notifications to inform requestors and approvers about important actions and status changes. Check your institutional email inbox for updates.';
  return 'I can help with PostFlow approvals, request tracking, publishing, and notifications. For a specific account or request, please check your dashboard or contact your PostFlow administrator.';
}

/* ── Component ────────────────────────────────────────────────────────── */
export function ChatBot() {
  const user = useAuthStore((s) => s.user);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  const { role, greeting, welcome, choices } = useMemo(() => {
    const raw = (user?.role || '').toLowerCase();
    const isAdmin = ['admin', 'it_publisher', 'it_admin'].includes(raw);
    const isApprover = !isAdmin && ['approver', 'office_head', 'vice_president', 'imc_qa_checker', 'president'].includes(raw);
    const r: Role = isAdmin ? 'admin' : isApprover ? 'approver' : 'requestor';
    const firstName = user?.first_name || user?.name?.split(' ')[0] || '';
    const greeting = firstName ? `Hi, ${firstName}.` : 'How can I help?';

    if (r === 'admin') {
      return {
        role: r,
        greeting,
        welcome: 'Get help with accounts, publishing, and system settings.',
        choices: [
          ['System health', 'System health & publishing status'],
          ['Manage users', 'How to manage user accounts & roles'],
          ['Audit logs', 'Review recent audit logs'],
          ['Platform tokens', 'Platform token configuration'],
        ],
      };
    }
    if (r === 'approver') {
      return {
        role: r,
        greeting,
        welcome: 'Get help reviewing requests and moving approvals forward.',
        choices: [
          ['Pending reviews', 'How to review pending posts'],
          ['Branding guidelines', 'Compliance & branding guidelines'],
          ['Return for revision', 'Returning a post for revision'],
          ['Approval stages', 'How does the approval process work?'],
        ],
      };
    }
    return {
      role: r,
      greeting,
      welcome: 'Get help with your requests, approvals, and publishing.',
      choices: [
        ['Approval process', 'How does the approval process work?'],
        ['Track a request', 'How do I track my request?'],
        ['Publishing help', 'What if publishing failed?'],
        ['Post guidelines', 'Check post guidelines'],
      ],
    };
  }, [user]);

  const review = useApproverReviewCount(role === 'approver');
  const reviewMessage = review.count === null
    ? 'I’m here to help with your reviews.'
    : review.count === 0 ? 'You’re all caught up. No requests awaiting your approval.'
    : `${review.count} ${review.count === 1 ? 'request is' : 'requests are'} awaiting your approval.`;
  const name = user?.first_name || user?.name?.split(' ')[0];
  const welcomeTitle = name ? `Welcome back, ${name}.` : 'Welcome to PostFlow.';
  const welcomeTicket = useSyncExternalStore(subscribeAssistantWelcome, getAssistantWelcome, () => null);
  const soundEnabled = useSyncExternalStore(subscribeAssistantSound, getAssistantSoundEnabled, () => true);
  const [widgetReady, setWidgetReady] = useState(false);
  const [welcoming, setWelcoming] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const greetRef = useRef<((message: string) => void) | null>(null);
  const layoutRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!widgetReady || !welcomeTicket?.ready || welcomeTicket.userId !== user?.id) return;
    // Greet as soon as the dashboard is ready; the real review count updates live.
    if (consumeAssistantWelcome(welcomeTicket.userId)) {
      greetRef.current?.(`${welcomeTitle} ${role === 'approver' ? reviewMessage : welcome}`);
    }
  }, [widgetReady, welcomeTicket, user?.id, role, reviewMessage, welcomeTitle, welcome]);

  useEffect(() => {
    layoutRef.current?.();
    if (welcoming) setAnnouncement(`${welcomeTitle} ${role === 'approver' ? reviewMessage : welcome}`);
  }, [welcoming, welcomeTitle, role, reviewMessage, welcome]);

  const rootRef = useRef<HTMLDivElement>(null);
  // Keep the latest welcome text available to the imperative layer.
  const welcomeRef = useRef(`${greeting} ${welcome}`);
  welcomeRef.current = `${greeting} ${welcome}${role === 'approver' ? ` ${reviewMessage}` : ''}`;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setWidgetReady(false);
    let disposed = false;
    const cleanups: Array<() => void> = [];
    const on = <K extends keyof HTMLElementEventMap>(
      el: EventTarget, ev: K | string, fn: (e: any) => void, opts?: AddEventListenerOptions,
    ) => {
      el.addEventListener(ev as string, fn, opts);
      cleanups.push(() => el.removeEventListener(ev as string, fn, opts));
    };
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
      timers.add(t);
      return t;
    };

    loadStylesheet().then(() => {
      if (disposed) return;
      const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
      const trigger = q<HTMLButtonElement>('[data-pf-launcher]');
      const greetingButton = q<HTMLButtonElement>('[data-pf-greeting]');
      const panel = q<HTMLElement>('[data-pf-panel]');
      const closer = q<HTMLButtonElement>('[data-pf-close]');
      const body = q<HTMLDivElement>('[data-pf-messages]');
      const form = q<HTMLFormElement>('[data-pf-form]');
      const input = q<HTMLTextAreaElement>('[data-pf-input]');
      const send = q<HTMLButtonElement>('[data-pf-send]');
      const status = q<HTMLSpanElement>('[data-pf-status]');

      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const motionOk = () => !motion.matches;
      const limit = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
      const history: ChatTurn[] = [{ role: 'assistant', content: welcomeRef.current }];
      let press: null | { id: number; sx: number; sy: number; x: number; y: number; moved: boolean; lx: number; ly: number; time: number; vx: number; vy: number } = null;
      let active = false;
      let busy = false;
      let speakTimer: ReturnType<typeof setTimeout> | undefined;
      let greetTimer: ReturnType<typeof setTimeout> | undefined;
      let landingTimer: ReturnType<typeof setTimeout> | undefined;
      const resetCape = () => {
        root.style.setProperty('--pf-tilt', '0deg');
        root.style.setProperty('--pf-cape-rot', '0deg');
        root.style.setProperty('--pf-cape-skew', '0deg');
        root.style.setProperty('--pf-cape-stretch', '1');
      };
      const motionChanged = () => { if (!motionOk()) resetCape(); };
      motion.addEventListener('change', motionChanged);
      cleanups.push(() => motion.removeEventListener('change', motionChanged));

      const showGreeting = (ms = 0) => {
        if (active) return;
        root.classList.add('pf-active-greet');
        if (greetTimer) clearTimeout(greetTimer);
        if (ms > 0) greetTimer = later(() => root.classList.remove('pf-active-greet'), ms);
      };
      const hideGreeting = () => { if (greetTimer) clearTimeout(greetTimer); root.classList.remove('pf-active-greet'); };
      const startSpeaking = (ms = 2200) => {
        root.classList.add('pf-speaking');
        if (speakTimer) clearTimeout(speakTimer);
        speakTimer = later(() => root.classList.remove('pf-speaking'), ms);
      };

      const viewport = () => {
        const visible = window.visualViewport;
        return { left: visible?.offsetLeft || 0, top: visible?.offsetTop || 0, width: visible?.width || innerWidth, height: visible?.height || innerHeight };
      };
      const layout = () => {
        const r = root.getBoundingClientRect();
        const v = viewport();
        const pw = Math.min(360, v.width - 24);
        const m = 12;
        const left = limit(r.right - pw, v.left + m, v.left + v.width - pw - m);
        panel.style.width = `${pw}px`;
        panel.style.left = `${left - r.left}px`;
        panel.style.right = 'auto';
        root.classList.toggle('pf-align-left', r.left < 180);
        const roomAbove = r.top - v.top - m - 12;
        const roomBelow = v.top + v.height - r.bottom - m - 12;
        const below = roomBelow > roomAbove;
        root.classList.toggle('pf-below', below);
        panel.style.height = `${Math.max(0, Math.min(role === 'approver' ? 496 : 448, below ? roomBelow : roomAbove))}px`;
        const greetingWidth = Math.min(220, v.width - 24);
        const fitsLeft = r.left - greetingWidth - 10 >= v.left + m;
        const fitsRight = r.right + greetingWidth + 10 <= v.left + v.width - m;
        const greetingLeft = fitsLeft ? r.left - greetingWidth - 10 : fitsRight ? r.right + 10 : limit(r.right - greetingWidth, v.left + m, v.left + v.width - greetingWidth - m);
        greetingButton.style.width = `${greetingWidth}px`;
        greetingButton.style.left = `${greetingLeft - r.left}px`;
        greetingButton.style.right = 'auto';
        const greetingHeight = greetingButton.offsetHeight || 80;
        const desiredTop = fitsLeft || fitsRight ? r.top + 13 : r.top - v.top > greetingHeight + 20 ? r.top - greetingHeight - 10 : r.bottom + 10;
        greetingButton.style.top = `${limit(desiredTop, v.top + m, v.top + v.height - greetingHeight - m) - r.top}px`;
        root.classList.toggle('pf-greeting-right', !fitsLeft && fitsRight);
        root.classList.toggle('pf-greeting-stacked', !fitsLeft && !fitsRight);
      };
      const setPos = (x: number, y: number) => {
        const v = viewport();
        root.style.left = `${limit(x, v.left + 7, v.left + v.width - root.offsetWidth - 7)}px`;
        root.style.top = `${limit(y, v.top + 6, v.top + v.height - root.offsetHeight - 7)}px`;
        root.style.right = 'auto';
        root.style.bottom = 'auto';
        layout();
      };
      setPos(
        innerWidth - root.offsetWidth - (innerWidth < 600 ? 14 : 24),
        innerHeight - root.offsetHeight - (innerWidth < 600 ? 12 : 18),
      );
      root.style.visibility = 'visible';

      on(window, 'resize', () => { const r = root.getBoundingClientRect(); setPos(r.left, r.top); }, { passive: true });
      if (window.visualViewport) {
        const fitViewport = () => { const r = root.getBoundingClientRect(); setPos(r.left, r.top); };
        on(window.visualViewport, 'resize', fitViewport, { passive: true });
        on(window.visualViewport, 'scroll', fitViewport, { passive: true });
      }

      const wave = () => {
        if (!motionOk()) return;
        root.classList.remove('pf-wave');
        void root.offsetWidth;
        root.classList.add('pf-wave');
        later(() => root.classList.remove('pf-wave'), 1180);
      };
      const open = (next: boolean) => {
        if (next && !active) playAssistantSound('open');
        active = next;
        root.classList.toggle('pf-open', next);
        trigger.setAttribute('aria-expanded', String(next));
        trigger.setAttribute('aria-label', next ? 'Close PostFlow assistant' : 'Open PostFlow assistant');
        panel.setAttribute('aria-hidden', String(!next));
        (panel as any).inert = !next;
        hideGreeting();
        root.classList.remove('pf-speaking');
        layout();
        if (next) { wave(); later(() => input.focus({ preventScroll: true }), 100); }
        else trigger.focus({ preventScroll: true });
      };
      (panel as any).inert = true;

      on(trigger, 'mouseenter', () => { showGreeting(); startSpeaking(); wave(); });
      on(trigger, 'mouseleave', () => { if (!press) { showGreeting(180); root.classList.remove('pf-speaking'); } });
      on(trigger, 'focus', () => { showGreeting(); startSpeaking(); });
      on(root, 'focusout', (e: FocusEvent) => { if (!press && !root.contains(e.relatedTarget as Node)) { hideGreeting(); root.classList.remove('pf-speaking'); } });
      on(greetingButton, 'mouseenter', () => showGreeting());
      on(greetingButton, 'mouseleave', hideGreeting);
      on(greetingButton, 'focus', () => showGreeting());
      on(greetingButton, 'click', () => open(true));
      on(trigger, 'touchstart', () => { showGreeting(2200); startSpeaking(2200); }, { passive: true });

      on(trigger, 'pointerdown', (e: PointerEvent) => {
        if (e.button !== 0 || press) return;
        prepareAssistantAudio();
        if (landingTimer) { clearTimeout(landingTimer); timers.delete(landingTimer); }
        root.classList.remove('pf-landing');
        const r = root.getBoundingClientRect();
        press = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: r.left, y: r.top, moved: false, lx: e.clientX, ly: e.clientY, time: e.timeStamp, vx: 0, vy: 0 };
        trigger.setPointerCapture(e.pointerId);
        startSpeaking(2600);
      });
      on(trigger, 'pointermove', (e: PointerEvent) => {
        if (!press || press.id !== e.pointerId) return;
        const dx = e.clientX - press.sx;
        const dy = e.clientY - press.sy;
        if (!press.moved && Math.hypot(dx, dy) > 6) {
          press.moved = true;
          root.classList.remove('pf-landing');
          root.classList.add('pf-flying');
          showGreeting(4000);
          startSpeaking(4000);
        }
        if (!press.moved) return;
        // Normalize to a 60 Hz frame so mouse, pen and touch produce the same response.
        const elapsed = limit(e.timeStamp - press.time, 8, 64);
        press.vx = press.vx * .4 + (e.clientX - press.lx) * (16.67 / elapsed) * .6;
        press.vy = press.vy * .4 + (e.clientY - press.ly) * (16.67 / elapsed) * .6;
        press.lx = e.clientX;
        press.ly = e.clientY;
        press.time = e.timeStamp;
        if (motionOk()) {
          const speed = Math.min(Math.hypot(press.vx, press.vy), 24);
          root.style.setProperty('--pf-tilt', `${limit(press.vx * 1.05, -14, 14)}deg`);
          root.style.setProperty('--pf-cape-rot', `${limit(-press.vx * .65 + press.vy * .2, -16, 16)}deg`);
          root.style.setProperty('--pf-cape-skew', `${limit(-press.vx * .4, -8, 8)}deg`);
          root.style.setProperty('--pf-cape-stretch', (1 + speed * .012).toFixed(3));
        }
        setPos(press.x + dx, press.y + dy);
        e.preventDefault();
      });
      const finish = (e: PointerEvent) => {
        if (!press || press.id !== e.pointerId) return;
        const p = press;
        press = null;
        if (trigger.hasPointerCapture(e.pointerId)) trigger.releasePointerCapture(e.pointerId);
        root.classList.remove('pf-flying');
        if (p.moved) {
          const r = root.getBoundingClientRect();
          const boost = motionOk() ? 2.4 : 0;
          setPos(r.left + p.vx * boost, r.top + p.vy * boost);
          root.classList.add('pf-landing');
          // Let the cape ease back from its current drag pose immediately on release.
          resetCape();
          landingTimer = later(() => {
            root.classList.remove('pf-landing');
            landingTimer = undefined;
          }, 520);
          if (e.pointerType === 'touch') { showGreeting(1200); startSpeaking(1200); }
          else { root.classList.remove('pf-speaking'); hideGreeting(); }
        } else if (e.type !== 'pointercancel') {
          open(!active);
        }
      };
      on(trigger, 'pointerup', finish);
      on(trigger, 'pointercancel', finish);
      on(trigger, 'keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(!active); } });
      on(trigger, 'click', (e: MouseEvent) => { if (e.detail !== 0) e.preventDefault(); });
      on(closer, 'click', () => open(false));
      on(document, 'keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && active) open(false); });
      on(document, 'pointerdown', (e: PointerEvent) => { if (active && !root.contains(e.target as Node)) open(false); });

      const bubble = (message: string, kind: 'user' | 'bot') => {
        const b = document.createElement('div');
        b.className = `pf-bubble pf-in${kind === 'user' ? ' pf-user' : ''}`;
        if (kind === 'bot') b.innerHTML = formatReply(message);
        else b.textContent = message;
        body.append(b);
        body.scrollTop = body.scrollHeight;
      };
      const typing = () => {
        const el = document.createElement('div');
        el.className = 'pf-bubble pf-typing';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-label', 'Assistant is typing');
        el.innerHTML = '<i></i><i></i><i></i>';
        body.append(el);
        body.scrollTop = body.scrollHeight;
        return el;
      };
      const reply = async (text: string) => {
        try {
          // Include the current queue summary when the user asks a follow-up.
          history[0].content = welcomeRef.current;
          const recent = history.slice(-11);
          if (recent[0] !== history[0]) recent.unshift(history[0]);
          const res = await chatbotApi.sendMessage(recent);
          const r = res?.data?.reply;
          if (typeof r === 'string' && r.trim()) return r;
          return localAnswer(text);
        } catch (err) {
          console.error('PostFlow assistant error:', err);
          return localAnswer(text);
        }
      };
      const updateComposer = () => {
        input.style.height = '44px';
        input.style.height = `${Math.min(104, Math.max(44, input.scrollHeight))}px`;
        send.disabled = busy || !input.value.trim();
        form.classList.toggle('pf-busy', busy);
        form.setAttribute('aria-busy', String(busy));
      };
      const sendText = async (raw: string) => {
        const text = String(raw || '').trim().slice(0, 500);
        if (!text || busy) return;
        busy = true;
        playAssistantSound('send');
        input.value = '';
        updateComposer();
        status.textContent = 'Message sent. Assistant is typing.';
        body.querySelector('.pf-introduction')?.remove();
        bubble(text, 'user');
        history.push({ role: 'user', content: text });
        const indicator = typing();
        root.classList.add('pf-speaking');
        try {
          const response = await reply(text);
          if (disposed) return;
          indicator.remove();
          bubble(response, 'bot');
          history.push({ role: 'assistant', content: response });
          status.textContent = 'Reply received.';
          playAssistantSound('reply');
          startSpeaking(1600);
        } finally {
          busy = false;
          updateComposer();
          if (!disposed) input.focus({ preventScroll: true });
        }
      };
      on(form, 'submit', (e: Event) => { e.preventDefault(); sendText(input.value); });
      on(input, 'input', updateComposer);
      on(input, 'keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendText(input.value); }
      });
      updateComposer();
      root.querySelectorAll<HTMLButtonElement>('[data-pf-question]').forEach((b) =>
        on(b, 'click', () => sendText(b.dataset.pfQuestion || '')),
      );

      layoutRef.current = layout;
      greetRef.current = message => {
        setWelcoming(true);
        setAnnouncement(message);
        showGreeting(9000);
        wave();
        startSpeaking(1800);
        playAssistantSound('welcome');
        later(() => setWelcoming(false), 9000);
      };
      setWidgetReady(true);

      cleanups.push(() => { if (speakTimer) clearTimeout(speakTimer); if (greetTimer) clearTimeout(greetTimer); });
    });

    return () => {
      disposed = true;
      greetRef.current = null;
      layoutRef.current = null;
      cleanups.forEach((fn) => fn());
      timers.forEach((t) => clearTimeout(t));
    };
    // Re-initialise when the signed-in role changes (welcome/chips differ).
  }, [role]);

  const roleLabel = role === 'admin' ? 'Admin' : role === 'approver' ? 'Approver' : 'Requestor';

  return (
    <div
      key={role}
      ref={rootRef}
      className={`pf-assistant${isDarkMode ? ' pf-dark' : ''}`}
      data-postflow-assistant=""
      style={{ visibility: 'hidden' }}
    >
      <style>{characterStyles}</style>
      <section className="pf-panel" data-pf-panel="" id="pf-assistant-dialog" role="dialog" aria-label="PostFlow Assistant" aria-hidden="true">
        <header className="pf-head">
          <span className="pf-avatar"><PostflowCharacter tracking={false} decorative /></span>
          <div className="pf-heading">
            <h2>PostFlow Assistant</h2>
            <p>
              <span className="pf-online" aria-hidden="true" />
              Here to help
              <span className="pf-role">{roleLabel}</span>
            </p>
          </div>
          <button className="pf-sound-toggle" type="button" aria-pressed={!soundEnabled} aria-label={soundEnabled ? 'Mute assistant sounds' : 'Enable assistant sounds'} title={soundEnabled ? 'Mute assistant sounds' : 'Enable assistant sounds'} onClick={() => {
            setAssistantSoundEnabled(!soundEnabled);
            if (!soundEnabled) playAssistantSound('open');
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4Z" />
              {soundEnabled ? <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /> : <path d="m16 9 5 6m0-6-5 6" />}
            </svg>
          </button>
          <button className="pf-close" type="button" data-pf-close="" aria-label="Close chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="pf-messages" data-pf-messages="" aria-live="polite" aria-relevant="additions">
          <div className="pf-introduction">
            <div className="pf-welcome"><h3>{greeting}</h3><p>{welcome}</p></div>
            {role === 'approver' && <p className={`pf-review-summary ${review.count !== null && review.count > 0 ? 'pf-review-pending' : ''}`} role="status" aria-live="polite" aria-atomic="true">{reviewMessage}</p>}
            <p className="pf-topic-label">Explore a topic</p>
            <div className="pf-choices">
              {choices.map(([label, question]) => (
                <button key={label} type="button" data-pf-question={question}>
                  <span>{label}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
                </button>
              ))}
            </div>
          </div>
        </div>
        <form className="pf-form" data-pf-form="">
          <label className="pf-sr" htmlFor="pf-chat-message">Type your message</label>
          <div className="pf-compose">
            <textarea className="pf-input" id="pf-chat-message" data-pf-input="" rows={1} maxLength={500} placeholder="Ask about PostFlow…" autoComplete="off" required />
            <button className="pf-send" data-pf-send="" type="submit" aria-label="Send message" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
            </button>
          </div>
          <p className="pf-compose-hint">Enter to send <span>·</span> Shift + Enter for a new line</p>
        </form>
        <span className="pf-sr" data-pf-status="" role="status" aria-live="polite" />
      </section>
      <button
        className="pf-launcher"
        type="button"
        data-pf-launcher=""
        aria-label="Open PostFlow assistant"
        aria-expanded="false"
        aria-controls="pf-assistant-dialog"
        title="Drag to move, click to chat"
      >
        <span className="pf-bot" aria-hidden="true">
          <PostflowCharacter decorative />
        </span>
      </button>
      <button className="pf-greeting" data-pf-greeting="" type="button" aria-label="Chat with PostFlow">
        <span className="pf-greeting-title">{welcoming ? welcomeTitle : 'Hi! How can I help you?'}</span>
        {(welcoming || role === 'approver') && <span className="pf-greeting-detail">{role === 'approver' ? reviewMessage : welcome}</span>}
        <span className="pf-greeting-action">Ask PostFlow <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></span>
      </button>
      <span className="pf-sr" data-pf-welcome-announcement="" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>
  );
}
