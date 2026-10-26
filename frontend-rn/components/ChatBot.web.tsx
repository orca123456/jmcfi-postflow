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
import React, { useEffect, useMemo, useRef } from 'react';
import { chatbotApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { useThemeStore } from '../store/theme';

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

  const { role, welcome, choices } = useMemo(() => {
    const raw = (user?.role || '').toLowerCase();
    const isAdmin = ['admin', 'it_publisher', 'it_admin'].includes(raw);
    const isApprover = !isAdmin && ['approver', 'office_head', 'vice_president', 'imc_qa_checker', 'president'].includes(raw);
    const r: Role = isAdmin ? 'admin' : isApprover ? 'approver' : 'requestor';
    const firstName = user?.first_name || user?.name?.split(' ')[0] || '';
    const hi = firstName ? `Hi, ${firstName}! 👋` : 'Hi! 👋';

    if (r === 'admin') {
      return {
        role: r,
        welcome: `${hi} Welcome to PostFlow. Ask me about system health, users, audit logs or platform settings.`,
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
        welcome: `${hi} Welcome to PostFlow. Need help reviewing a publication request?`,
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
      welcome: `${hi} Welcome to PostFlow. Need help with a publication request?`,
      choices: [
        ['Approval process', 'How does the approval process work?'],
        ['Track a request', 'How do I track my request?'],
        ['Publishing help', 'What if publishing failed?'],
        ['Post guidelines', 'Check post guidelines'],
      ],
    };
  }, [user]);

  const rootRef = useRef<HTMLDivElement>(null);
  // Keep the latest welcome text available to the imperative layer.
  const welcomeRef = useRef(welcome);
  welcomeRef.current = welcome;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | Document | Window, ev: K | string, fn: (e: any) => void, opts?: AddEventListenerOptions,
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
      const panel = q<HTMLElement>('[data-pf-panel]');
      const closer = q<HTMLButtonElement>('[data-pf-close]');
      const body = q<HTMLDivElement>('[data-pf-messages]');
      const form = q<HTMLFormElement>('[data-pf-form]');
      const input = q<HTMLInputElement>('[data-pf-input]');
      const send = q<HTMLButtonElement>('[data-pf-send]');
      const status = q<HTMLSpanElement>('[data-pf-status]');

      const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const limit = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
      const history: ChatTurn[] = [{ role: 'assistant', content: welcomeRef.current }];
      let press: null | { id: number; sx: number; sy: number; x: number; y: number; moved: boolean; lx: number; ly: number; vx: number; vy: number } = null;
      let active = false;
      let busy = false;
      let speakTimer: ReturnType<typeof setTimeout> | undefined;
      let greetTimer: ReturnType<typeof setTimeout> | undefined;

      const showGreeting = (ms = 0) => {
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

      const layout = () => {
        const r = root.getBoundingClientRect();
        const pw = Math.min(352, innerWidth - 18);
        const m = 9;
        const left = limit(r.right - pw, m, innerWidth - pw - m);
        panel.style.left = `${left - r.left}px`;
        panel.style.right = 'auto';
        root.classList.toggle('pf-align-left', r.left < 180);
        const roomAbove = r.top - m - 10;
        const roomBelow = innerHeight - r.bottom - m - 10;
        const below = roomBelow > roomAbove;
        root.classList.toggle('pf-below', below);
        panel.style.height = `${Math.max(185, Math.min(492, below ? roomBelow : roomAbove))}px`;
      };
      const setPos = (x: number, y: number) => {
        root.style.left = `${limit(x, 7, innerWidth - root.offsetWidth - 7)}px`;
        root.style.top = `${limit(y, 6, innerHeight - root.offsetHeight - 7)}px`;
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

      const wave = () => {
        if (!motionOk) return;
        root.classList.remove('pf-wave');
        void root.offsetWidth;
        root.classList.add('pf-wave');
        later(() => root.classList.remove('pf-wave'), 1180);
      };
      const open = (next: boolean) => {
        active = next;
        root.classList.toggle('pf-open', next);
        trigger.setAttribute('aria-expanded', String(next));
        trigger.setAttribute('aria-label', next ? 'Close PostFlow assistant' : 'Open PostFlow assistant');
        panel.setAttribute('aria-hidden', String(!next));
        (panel as any).inert = !next;
        layout();
        if (next) { wave(); later(() => input.focus({ preventScroll: true }), 100); }
        else trigger.focus({ preventScroll: true });
      };
      (panel as any).inert = true;

      on(trigger, 'mouseenter', () => { showGreeting(); startSpeaking(); wave(); });
      on(trigger, 'mouseleave', () => { if (!press) { hideGreeting(); root.classList.remove('pf-speaking'); } });
      on(trigger, 'focus', () => { showGreeting(); startSpeaking(); });
      on(trigger, 'blur', () => { if (!press) { hideGreeting(); root.classList.remove('pf-speaking'); } });
      on(trigger, 'touchstart', () => { showGreeting(2200); startSpeaking(2200); }, { passive: true });

      on(trigger, 'pointerdown', (e: PointerEvent) => {
        if (e.button !== 0 || press) return;
        const r = root.getBoundingClientRect();
        press = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: r.left, y: r.top, moved: false, lx: e.clientX, ly: e.clientY, vx: 0, vy: 0 };
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
        press.vx = e.clientX - press.lx;
        press.vy = e.clientY - press.ly;
        press.lx = e.clientX;
        press.ly = e.clientY;
        const speed = Math.min(Math.hypot(press.vx, press.vy), 20);
        const angle = (Math.atan2(press.vy, press.vx) * 180) / Math.PI;
        root.style.setProperty('--pf-tilt', `${limit(press.vx * 1.05, -14, 14)}deg`);
        root.style.setProperty('--pf-cape-rot', `${limit(angle * 0.06 + press.vx * 0.13, -9, 9)}deg`);
        root.style.setProperty('--pf-cape-shift', `${-2.5 - speed * 0.3}px`);
        root.style.setProperty('--pf-cape-stretch', (1 + Math.min(speed * 0.009, 0.16)).toFixed(3));
        root.style.setProperty('--pf-cape-lift', `${limit(-press.vy * 0.1, -3.6, 3.6)}px`);
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
          const boost = motionOk ? 2.4 : 0;
          setPos(r.left + p.vx * boost, r.top + p.vy * boost);
          root.classList.add('pf-landing');
          later(() => {
            root.classList.remove('pf-landing');
            root.style.setProperty('--pf-tilt', '0deg');
            root.style.setProperty('--pf-cape-rot', '0deg');
            root.style.setProperty('--pf-cape-shift', '-1px');
            root.style.setProperty('--pf-cape-stretch', '1');
            root.style.setProperty('--pf-cape-lift', '0px');
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
          const res = await chatbotApi.sendMessage(history.slice(-12));
          const r = res?.data?.reply;
          if (typeof r === 'string' && r.trim()) return r;
          return localAnswer(text);
        } catch (err) {
          console.error('PostFlow assistant error:', err);
          return localAnswer(text);
        }
      };
      const sendText = async (raw: string) => {
        const text = String(raw || '').trim().slice(0, 500);
        if (!text || busy) return;
        busy = true;
        input.value = '';
        send.disabled = true;
        send.classList.remove('pf-sending');
        void send.offsetWidth;
        send.classList.add('pf-sending');
        status.textContent = 'Message sent. Assistant is typing.';
        body.querySelector('.pf-choices')?.remove();
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
          startSpeaking(1600);
        } finally {
          busy = false;
          send.disabled = false;
          later(() => send.classList.remove('pf-sending'), 500);
          if (!disposed) input.focus({ preventScroll: true });
        }
      };
      on(form, 'submit', (e: Event) => { e.preventDefault(); sendText(input.value); });
      root.querySelectorAll<HTMLButtonElement>('[data-pf-question]').forEach((b) =>
        on(b, 'click', () => sendText(b.dataset.pfQuestion || '')),
      );

      cleanups.push(() => { if (speakTimer) clearTimeout(speakTimer); if (greetTimer) clearTimeout(greetTimer); });
    });

    return () => {
      disposed = true;
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
      <section className="pf-panel" data-pf-panel="" id="pf-assistant-dialog" role="dialog" aria-label="PostFlow Assistant" aria-hidden="true">
        <header className="pf-head">
          <img className="pf-avatar" src={`${BASE}/assets/bot-full.webp`} alt="" draggable={false} />
          <div className="pf-heading">
            <h2>PostFlow Assistant</h2>
            <p>
              <span className="pf-online" aria-hidden="true" />
              Here to help
              <span className="pf-role">{roleLabel}</span>
            </p>
          </div>
          <button className="pf-close" type="button" data-pf-close="" aria-label="Close chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="pf-messages" data-pf-messages="" aria-live="polite" aria-relevant="additions">
          <div className="pf-day">PostFlow help</div>
          <div className="pf-bubble">{welcome}</div>
          <div className="pf-choices">
            {choices.map(([label, question]) => (
              <button key={label} type="button" data-pf-question={question}>{label}</button>
            ))}
          </div>
        </div>
        <form className="pf-form" data-pf-form="">
          <label className="pf-sr" htmlFor="pf-chat-message">Type your message</label>
          <input className="pf-input" id="pf-chat-message" data-pf-input="" type="text" maxLength={500} placeholder="Ask me anything about PostFlow..." autoComplete="off" required />
          <button className="pf-send" data-pf-send="" type="submit" aria-label="Send message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
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
          <span className="pf-sprite pf-body-layer" />
          <span className="pf-sprite pf-cape-live" />
          <img className="pf-sprite pf-eye-blink" src={`${BASE}/assets/bot-blink.webp`} alt="" draggable={false} />
          <img className="pf-sprite pf-mouth-sprite" src={`${BASE}/assets/bot-mouth-talking.webp`} alt="" draggable={false} />
          <img className="pf-sprite pf-wave-hand" src={`${BASE}/assets/bot-wave-hand.webp`} alt="" draggable={false} />
        </span>
      </button>
      <span className="pf-greeting" aria-hidden="true">👋 Hi! How can I help you today?</span>
    </div>
  );
}
