import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import { authExperienceStyles } from './authExperienceStyles';
import LoginAssistant from './LoginAssistant.web';
import { characterStyles } from './postflowCharacterStyles';
import type { AuthExperienceProps } from './AuthExperience.types';

const INTRO_KEY = 'postflow_welcome_seen_v11';
const INTRO_DURATION = 2600;
const TRANSITION_DURATION = 950;

function shouldShowIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try { return sessionStorage.getItem(INTRO_KEY) !== '1'; } catch { return true; }
}

function Mark() {
  return <div className="pfa-mark">
    <Image source={require('../assets/images/jmc_logo.png')} style={{ width: 43, height: 43 }} />
    <span><strong>JMCFI PostFlow</strong><small>POST REQUEST MANAGEMENT</small></span>
  </div>;
}

export default function AuthExperience({ children, departing = false, onDepartureComplete, assistantNotice, lockSeconds = 0 }: AuthExperienceProps) {
  const [intro, setIntro] = useState(shouldShowIntro);
  const [leaving, setLeaving] = useState(false);
  const [privateMode, setPrivateMode] = useState(false);
  const [assistantActivity, setAssistantActivity] = useState(0);
  const [entryField, setEntryField] = useState<'email' | 'password' | null>(null);
  const introCharacter = useRef<HTMLDivElement>(null);
  const introWordmark = useRef<HTMLDivElement>(null);
  const assistantSlot = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const loginPanel = useRef<HTMLElement>(null);
  const cargo = useRef<HTMLDivElement>(null);
  const finishRef = useRef<() => void>(() => {});

  // The same mounted actor starts at the hero slot and docks into its own
  // login slot. No body artwork is replaced or crossfaded at the handoff.
  useLayoutEffect(() => {
    if (!intro || leaving) return;
    const measure = () => {
      const hero = introCharacter.current?.getBoundingClientRect();
      const target = assistantSlot.current?.getBoundingClientRect();
      if (!hero || !target || !target.width) return;
      root.current?.style.setProperty('--intro-x', `${hero.x + hero.width / 2 - target.x - target.width / 2}px`);
      root.current?.style.setProperty('--intro-y', `${hero.y + hero.height / 2 - target.y - target.height / 2}px`);
      root.current?.style.setProperty('--intro-scale', `${hero.width / target.width}`);
    };
    measure();
    let mounted = true;
    document.fonts.ready.then(() => { if (mounted) measure(); });
    window.addEventListener('resize', measure, { passive: true });
    return () => { mounted = false; window.removeEventListener('resize', measure); };
  }, [intro, leaving]);

  useLayoutEffect(() => {
    if (!departing) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const panel = loginPanel.current;
    const movingGroup = cargo.current;
    const bot = assistantSlot.current?.getBoundingClientRect();
    if (bot && panel) {
      // Solve both articulated hands on the side edge before any frame is painted.
      const poseAnimations = root.current!.getAnimations({ subtree: true }).filter(animation =>
        animation instanceof CSSAnimation && ['pfa-hero-pose', 'pfa-hero-brace', 'pfa-hero-elbow', 'pfa-push-shoulder', 'pfa-push-elbow', 'pfa-push-wrist', 'pfa-card-brace'].includes(animation.animationName));
      const initial = poseAnimations.map(animation => ({ animation, time: animation.currentTime, state: animation.playState }));
      for (const animation of poseAnimations) {
        animation.pause();
        animation.currentTime = Number(animation.effect!.getTiming().duration) * .44;
      }
      const card = panel.getBoundingClientRect();
      const anchor = root.current?.querySelector<SVGCircleElement>('.pfa-grip-anchor');
      const matrix = anchor?.getScreenCTM();
      const hand = anchor && matrix
        ? new DOMPoint(anchor.cx.baseVal.value, anchor.cy.baseVal.value).matrixTransform(matrix)
        : { x: bot.left + bot.width * .81, y: bot.top + bot.height * .85 };
      const secondAnchor = root.current?.querySelector<SVGCircleElement>('.pfa-second-grip-anchor');
      const shoulder = root.current?.querySelector<SVGGElement>('.pfa-push-arm');
      const forearm = root.current?.querySelector<SVGGElement>('.pfa-push-forearm');
      const secondMatrix = secondAnchor?.getScreenCTM();
      const armSpace = (shoulder?.parentElement as unknown as SVGSVGElement)?.getScreenCTM();
      const forearmMatrix = forearm?.getScreenCTM();
      if (secondAnchor && secondMatrix && armSpace && forearmMatrix) {
        const finger = new DOMPoint(115, 412).matrixTransform(secondMatrix).matrixTransform(forearmMatrix.inverse());
        const target = new DOMPoint(hand.x, hand.y - bot.height * .24).matrixTransform(armSpace.inverse());
        const upper = { x: -85, y: 90 };
        const lower = { x: finger.x - 200, y: finger.y - 550 };
        const reach = { x: target.x - 285, y: target.y - 460 };
        const upperLength = Math.hypot(upper.x, upper.y);
        const lowerLength = Math.hypot(lower.x, lower.y);
        const bend = -Math.acos(Math.max(-1, Math.min(1,
          (reach.x * reach.x + reach.y * reach.y - upperLength * upperLength - lowerLength * lowerLength) / (2 * upperLength * lowerLength))));
        const turn = Math.atan2(reach.y, reach.x) - Math.atan2(lowerLength * Math.sin(bend), upperLength + lowerLength * Math.cos(bend));
        const shoulderTurn = (turn - Math.atan2(upper.y, upper.x)) * 180 / Math.PI;
        const elbowTurn = (bend + Math.atan2(upper.y, upper.x) - Math.atan2(lower.y, lower.x)) * 180 / Math.PI;
        root.current?.style.setProperty('--push-shoulder', `${shoulderTurn}deg`);
        root.current?.style.setProperty('--push-elbow', `${elbowTurn > 180 ? elbowTurn - 360 : elbowTurn}deg`);
      }
      const gripMatrix = secondAnchor?.getScreenCTM();
      const secondHand = secondAnchor && gripMatrix
        ? new DOMPoint(115, 412).matrixTransform(gripMatrix) : hand;
      const dx = card.left + 2 - (hand.x + secondHand.x) / 2;
      const dy = card.top + card.height * .46 - (hand.y + secondHand.y) / 2;
      for (const { animation, time, state } of initial) {
        animation.currentTime = time ?? 0;
        if (state === 'running') animation.play();
      }
      const cx = bot.width / 2;
      const cy = bot.height / 2;
      root.current?.style.setProperty('--push-x', `${dx}px`);
      root.current?.style.setProperty('--push-y', `${dy}px`);
      // One continuous bank to the side; both hands settle before forward thrust.
      root.current?.style.setProperty('--flight-route', `path("M${cx} ${cy} C${cx - bot.width * .32} ${cy - bot.height * .24},${cx + dx - bot.width * .12} ${cy + dy},${cx + dx} ${cy + dy}")`);
      root.current?.style.setProperty('--depart-distance', `${window.innerWidth / 2 + card.width + bot.width}px`);
    }

    let completed = false;
    function finish() {
      if (completed) return;
      completed = true;
      onDepartureComplete?.();
    }
    function animationEnd(event: AnimationEvent) {
      if (event.target === movingGroup && event.animationName === 'pfa-card-depart') finish();
    }
    const change = () => { if (media.matches) finish(); };
    movingGroup?.addEventListener('animationend', animationEnd);
    media.addEventListener('change', change);
    // Also complete if animations are unavailable, interrupted, or disabled by the browser.
    const timer = setTimeout(finish, media.matches ? 0 : 1950);
    return () => {
      clearTimeout(timer);
      movingGroup?.removeEventListener('animationend', animationEnd);
      media.removeEventListener('change', change);
    };
  }, [departing, onDepartureComplete]);

  useEffect(() => {
    if (!intro) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    function finish() {
      if (started) return;
      started = true;
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* The animation still completes without storage. */ }
      const from = introCharacter.current?.getBoundingClientRect();
      const to = assistantSlot.current?.getBoundingClientRect();
      if (from && to && from.width > 0) {
        const dx = to.x + to.width / 2 - from.x - from.width / 2;
        const dy = to.y + to.height / 2 - from.y - from.height / 2;
        const cx = to.width / 2;
        const cy = to.height / 2;
        root.current?.style.setProperty('--actor-dock-route', `path("M${cx - dx} ${cy - dy} C${cx - dx * .75} ${cy - dy - 24},${cx - dx * .1} ${cy - 18},${cx} ${cy}")`);
      }
      setLeaving(true);
      finishTimer = setTimeout(() => {
        setIntro(false);
        setLeaving(false);
      }, media.matches ? 0 : TRANSITION_DURATION);
    }
    finishRef.current = finish;
    const timer = setTimeout(finish, INTRO_DURATION);
    const change = () => { if (media.matches) finish(); };
    media.addEventListener('change', change);
    change();
    return () => {
      finishRef.current = () => {};
      clearTimeout(timer);
      if (finishTimer) clearTimeout(finishTimer);
      media.removeEventListener('change', change);
    };
  }, [intro]);

  function trackField(event: React.FocusEvent<HTMLDivElement>) {
    const target = event.target as HTMLInputElement;
    setPrivateMode(target.name === 'password' || target.type === 'password');
  }

  return <div ref={root} className={`pfa-root ${intro ? 'pfa-welcoming' : 'pfa-ready'} ${leaving ? 'pfa-revealing' : ''} ${departing ? 'pfa-departing' : ''}`}>
    <style>{authExperienceStyles + characterStyles}</style>
    <div className="pfa-campus">
      <Image source={require('../assets/images/jmcbg2.jpeg')} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel="Jose Maria College campus" />
    </div>
    <div className="pfa-campus-shade"/>
    <div className="pfa-login-shell" inert={intro || departing} aria-hidden={intro || departing}>
      <header className="pfa-topbar"><Mark/></header>
      <main className="pfa-layout">
        <div className="pfa-login-group" ref={cargo}>
          <div className="pfa-assistant" ref={assistantSlot}>
            <div className="pfa-flight-route">
              <LoginAssistant privateMode={privateMode && !departing} departing={departing} activity={assistantActivity} entryField={entryField} welcoming={intro} notice={assistantNotice} lockSeconds={lockSeconds}/>
            </div>
          </div>
          <section ref={loginPanel} className="pfa-login-panel" aria-label="Account login" onFocusCapture={trackField} onInputCapture={event => {
            const target = event.target as HTMLInputElement;
            if (target.id === 'email' || target.id === 'password') {
              setEntryField(target.id);
              setAssistantActivity(current => current + 1);
            }
          }} onBlurCapture={event => {
            const next = event.relatedTarget as HTMLInputElement | null;
            setPrivateMode(next?.name === 'password' || next?.type === 'password');
          }}>
            <div className="pfa-form">{children}</div>
          </section>
          <p className="pfa-school-footer">© {new Date().getFullYear()} JMCFI PostFlow · Jose Maria College Foundation, Inc.</p>
        </div>
      </main>
    </div>
    {departing && <p className="pfa-sign-in-status" role="status" aria-live="polite">Sign-in successful.</p>}
    {intro && <section className={`pfa-intro ${leaving ? 'pfa-intro-leaving' : ''}`} aria-label="Welcome to JMCFI PostFlow" onClick={() => finishRef.current?.()} style={{ cursor: 'pointer' }}>
      <div className="pfa-intro-backdrop"/>
      <header className="pfa-topbar"><Mark/></header>
      <div className="pfa-intro-center">
        <div className="pfa-intro-character" ref={introCharacter}>
          <span className="pfa-intro-shadow" aria-hidden="true"/>
        </div>
        <div className="pfa-intro-wordmark" ref={introWordmark}>
          <span className="pfa-intro-institution">JMCFI</span>
          <div className="pfa-title-window"><h1><span>Post</span><span>Flow</span></h1></div>
          <p>Post Request Management System</p>
          <div className="pfa-intro-signature" aria-label="Request, review, publish">
            <span className="pfa-workflow-step"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H6V3zm7 0v5h4M9 12h6M9 16h5"/></svg>Request</span>
            <i aria-hidden="true"/>
            <span className="pfa-workflow-step"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 11v9H4V5h10M9 10l3 3 8-9"/></svg>Review</span>
            <i aria-hidden="true"/>
            <span className="pfa-workflow-step"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 11 18-8-7 18-3-8-8-2zm8 2L21 3"/></svg>Publish</span>
          </div>
        </div>
      </div>
      <p className="pfa-intro-school">JOSE MARIA COLLEGE FOUNDATION, INC.</p>
    </section>}
  </div>;
}
