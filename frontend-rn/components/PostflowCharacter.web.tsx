import React, { useEffect, useId, useRef } from 'react';

const ASSETS = '/postflow-chatbot/assets';
const FLIGHT_CAPE = 'M493 464C551 456 593 493 632 521C716 526 789 575 810 659C768 613 721 629 682 665C625 707 552 715 492 697L494 651C560 659 587 615 568 577C548 540 518 502 493 464Z';

/** The original character gets a vector visor so its pupils can move independently. */
export default function PostflowCharacter({ privateMode = false, tracking = true, decorative = false, flightPose = false, arrival = false, articulated = false }: { privateMode?: boolean; tracking?: boolean; decorative?: boolean; flightPose?: boolean; arrival?: boolean; articulated?: boolean }) {
  const character = useRef<HTMLDivElement>(null);
  const svgId = useId().replace(/:/g, '');
  const rigged = flightPose || articulated;
  const cloth = useRef<SVGPathElement>(null);
  const upperFold = useRef<SVGPathElement>(null);
  const lowerFold = useRef<SVGPathElement>(null);
  const windMode = useRef({ arrival, flightPose });
  windMode.current = { arrival, flightPose };

  useEffect(() => {
    if (!rigged) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    let previous = 0;
    let lastPaint = 0;
    let x = 0, y = 0, vx = 0, vy = 0, wind = 4;
    const reset = () => {
      cloth.current?.setAttribute('d', FLIGHT_CAPE);
      upperFold.current?.setAttribute('d', 'M520 493 C602 523 692 565 785 625');
      lowerFold.current?.setAttribute('d', 'M518 534 C560 597 617 654 687 649');
    };
    const update = (time: number) => {
      frame = null;
      const step = previous ? Math.min(36, time - previous) / 16.667 : 1;
      previous = time;
      wind += ((windMode.current.flightPose ? 26 : windMode.current.arrival ? 4 : 7) - wind) * .06 * step;
      const targetX = (Math.sin(time * .0028) + Math.sin(time * .0057 + 1.2) * .35) * wind;
      const targetY = Math.sin(time * .0033 + .8) * wind * .65;
      vx = (vx + (targetX - x) * .03 * step) * Math.pow(.82, step);
      vy = (vy + (targetY - y) * .03 * step) * Math.pow(.82, step);
      x += vx * step;
      y += vy * step;
      // The small fabric bend needs fewer paints than the composited body motion.
      if (!lastPaint || time - lastPaint >= 32) {
        lastPaint = time;
        const n = (value: number) => value.toFixed(1);
        // Only the loose fabric moves. The neck seam and lower attachment stay fixed.
        cloth.current?.setAttribute('d', `M493 464C551 456 593 493 632 521C${n(716 + x * .25)} ${n(526 + y * .18)} ${n(789 + x * .65)} ${n(575 + y * .45)} ${n(810 + x)} ${n(659 + y)}C${n(768 + x * .85)} ${n(613 + y * .8)} ${n(721 + x * .45)} ${n(629 + y * .72)} ${n(682 + x * .25)} ${n(665 + y * .6)}C${n(625 + x * .15)} ${n(707 + y * .45)} 552 715 492 697L494 651C560 659 587 615 568 577C548 540 518 502 493 464Z`);
        upperFold.current?.setAttribute('d', `M520 493C602 523 ${n(692 + x * .45)} ${n(565 + y * .4)} ${n(785 + x * .8)} ${n(625 + y * .9)}`);
        lowerFold.current?.setAttribute('d', `M518 534C560 597 ${n(617 + x * .35)} ${n(654 + y * .4)} ${n(687 + x * .4)} ${n(649 + y * .55)}`);
      }
      frame = requestAnimationFrame(update);
    };
    const resume = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previous = 0;
      lastPaint = 0;
      if (motion.matches) { x = y = vx = vy = 0; reset(); }
      else if (document.visibilityState === 'visible') frame = requestAnimationFrame(update);
    };
    resume();
    motion.addEventListener('change', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      motion.removeEventListener('change', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [rigged]);

  useEffect(() => {
    const node = character.current;
    if (!node || !tracking) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    function update() {
      currentX += (targetX - currentX) * .16;
      currentY += (targetY - currentY) * .16;
      node!.style.setProperty('--gaze-x', `${currentX.toFixed(2)}px`);
      node!.style.setProperty('--gaze-y', `${currentY.toFixed(2)}px`);
      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > .035) {
        frame = requestAnimationFrame(update);
      } else {
        frame = null;
      }
    }

    function schedule() {
      if (frame === null) frame = requestAnimationFrame(update);
    }

    function follow(event: PointerEvent) {
      if (event.pointerType === 'touch' || motion.matches || privateMode) return;
      const rect = node!.getBoundingClientRect();
      const faceX = rect.left + rect.width * .51;
      const faceY = rect.top + rect.height * .34;
      targetX = Math.max(-1, Math.min(1, (event.clientX - faceX) / (window.innerWidth * .36))) * 12;
      targetY = Math.max(-1, Math.min(1, (event.clientY - faceY) / (window.innerHeight * .4))) * 8;
      schedule();
    }

    function reset() {
      targetX = 0;
      targetY = 0;
      schedule();
    }

    window.addEventListener('pointermove', follow, { passive: true });
    document.documentElement.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    motion.addEventListener('change', reset);
    reset();
    return () => {
      window.removeEventListener('pointermove', follow);
      document.documentElement.removeEventListener('pointerleave', reset);
      window.removeEventListener('blur', reset);
      motion.removeEventListener('change', reset);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [privateMode, tracking]);

  const visor = 'M277 158 C311 148 348 161 389 173 C454 192 526 185 577 211 C607 226 623 248 616 281 L596 358 C590 388 573 403 546 402 C439 400 330 378 262 352 C234 341 220 326 224 297 L238 217 C242 190 254 168 277 158Z';
  // Isolate the existing cape fabric, keeping the body and school crest stationary.
  const cape = 'M627 522 C717 526 783 574 810 659 C769 617 705 626 655 603 C644 576 637 548 627 522Z';
  const head = 'M90 0H740V435L631 456L492 478L340 464L278 438L190 399L90 366Z';
  const arm = 'M276 430C309 431 319 458 311 486C298 530 264 572 223 592C166 616 83 561 54 493L72 477C103 510 141 523 169 510C193 498 181 464 215 447C233 437 255 426 276 430Z';
  const frontArm = 'M534 486C570 489 582 517 591 552C621 565 665 596 679 637C693 679 680 733 655 759C626 779 586 752 566 720C550 694 552 670 541 650C522 623 513 595 510 564C500 523 507 500 534 486Z';
  const torso = 'M335 439C380 444 438 455 489 462L521 500L513 638C521 700 476 765 426 787C363 800 299 764 281 709L257 645L254 536L286 467Z';
  const fist = 'M571 620C627 607 671 640 679 679C688 724 656 767 626 765C596 765 570 747 560 721C549 691 546 648 571 620Z';
  const capeOutline = rigged ? FLIGHT_CAPE : cape;
  const closedGlove = <g transform="translate(160 512) rotate(180) translate(-615 -630)">
    <image href={`${ASSETS}/bot-base.webp`} width="820" height="820" clipPath={`url(#${svgId}-fist)`}/>
  </g>;

  return <div className={`pfa-character ${privateMode ? 'pfa-private' : ''} ${arrival ? 'pfa-arrival' : ''}`} ref={character} style={{ '--pfa-cape-x': rigged ? '493px' : '640px', '--pfa-cape-y': rigged ? '464px' : '540px' } as React.CSSProperties} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : "PostFlow assistant"} aria-hidden={decorative || undefined} data-tracking={tracking} data-hand-pose={rigged ? 'closed' : 'greeting'}>
    <div className="pfa-character-motion">
      <div className="pfa-character-pose">
      <div className="pfa-spine">
      <img className="pfa-bot-base" src={`${ASSETS}/bot-base.webp`} alt="" draggable={false}/>
      {rigged && <svg className="pfa-cloth-art" viewBox="0 0 820 820" aria-hidden="true">
        <g className="pfa-cape-response pfa-flight-fabric">
          <g className="pfa-cape">
            <path ref={cloth} className="pfa-cape-cloth" d={capeOutline} fill={`url(#${svgId}-cape-depth)`} stroke="#d9b768" strokeWidth="6"/>
            <g fill="none" strokeLinecap="round">
              <path ref={upperFold} d="M520 493 C602 523 692 565 785 625" stroke="#af75d8" strokeWidth="7" opacity=".32"/>
              <path ref={lowerFold} d="M518 534 C560 597 617 654 687 649" stroke="#240c46" strokeWidth="12" opacity=".2"/>
            </g>
            <circle className="pfa-cape-root-anchor" cx="493" cy="464" r="1" fill="transparent"/>
          </g>
        </g>
      </svg>}
      <svg className="pfa-body-art" viewBox="0 0 820 820" aria-hidden="true">
        <defs>
          <clipPath id={`${svgId}-fist`}><path d={fist}/></clipPath>
          <clipPath id={`${svgId}-cape`}><path d={capeOutline}/></clipPath>
          <mask id={`${svgId}-cape-fabric`} x="0" y="0" width="820" height="820" maskUnits="userSpaceOnUse"><path d={capeOutline} fill="white"/><path d={frontArm} fill="black"/></mask>
          {rigged && <>
            <clipPath id={`${svgId}-torso`}><path d={torso}/></clipPath>
            <clipPath id={`${svgId}-chest`}><rect width="820" height="724"/></clipPath>
            <clipPath id={`${svgId}-base`}><rect y="708" width="820" height="112"/></clipPath>
            <linearGradient id={`${svgId}-cape-depth`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#56228d"/><stop offset=".5" stopColor="#360c65"/><stop offset="1" stopColor="#6b30a7"/></linearGradient>
          </>}
          <mask id={`${svgId}-body`} x="0" y="0" width="820" height="820" maskUnits="userSpaceOnUse">
            <rect width="820" height="820" fill="white"/><path d={capeOutline} fill="black"/>
            {!rigged && <path d={frontArm} fill="white"/>}
            {rigged && <><path d={head} fill="black"/><path d={arm} fill="black"/><path d={frontArm} fill="black"/></>}
          </mask>
        </defs>
        {!rigged && <g className="pfa-cape-response pfa-flight-fabric">
          <g className="pfa-cape">
            <image href={`${ASSETS}/bot-base.webp`} width="820" height="820" clipPath={`url(#${svgId}-cape)`} mask={`url(#${svgId}-cape-fabric)`}/>
          </g>
        </g>}
        {rigged && <circle className="pfa-cape-body-anchor" cx="493" cy="464" r="1" fill="transparent"/>}
        {rigged ? <g className="pfa-torso-art" clipPath={`url(#${svgId}-torso)`}>
          <g className="pfa-chest-rig"><image href={`${ASSETS}/bot-base.webp`} width="820" height="820" clipPath={`url(#${svgId}-chest)`}/></g>
          <g className="pfa-base-rig"><image href={`${ASSETS}/bot-base.webp`} width="820" height="820" clipPath={`url(#${svgId}-base)`}/></g>
        </g> : <image href={`${ASSETS}/bot-base.webp`} width="820" height="820" mask={`url(#${svgId}-body)`}/>}
        {rigged && <g className="pfa-push-upper">
          <path d="M285 460L200 550" fill="none" stroke="#54217c" strokeWidth="82" strokeLinecap="round"/>
          <path d="M285 460L200 550" fill="none" stroke={`url(#${svgId}-arm-enamel)`} strokeWidth="64" strokeLinecap="round"/>
        </g>}
      </svg>
      <div className="pfa-head-rig">
      <div className="pfa-head-look">
      {rigged && <svg className="pfa-head-art" viewBox="0 0 820 820" aria-hidden="true">
        <defs><clipPath id={`${svgId}-head`}><path d={head}/></clipPath></defs>
        <image href={`${ASSETS}/bot-base.webp`} width="820" height="820" clipPath={`url(#${svgId}-head)`}/>
      </svg>}
      <svg className="pfa-face" viewBox="0 0 820 820" aria-hidden="true">
        <defs>
          <linearGradient id={`${svgId}-visor`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0" stopColor="#35144f"/><stop offset=".5" stopColor="#241034"/><stop offset="1" stopColor="#1c0d2e"/>
          </linearGradient>
          <radialGradient id={`${svgId}-reflection`} cx=".22" cy=".08" r=".9">
            <stop stopColor="#9563c3" stopOpacity=".19"/><stop offset="1" stopColor="#52217a" stopOpacity="0"/>
          </radialGradient>
          <mask id={`${svgId}-screen`}>
            <path d={visor} fill="white"/>
            <ellipse cx="485" cy="398" rx="33" ry="27" fill="black"/>
          </mask>
        </defs>
        <g mask={`url(#${svgId}-screen)`}>
          <path d={visor} fill={`url(#${svgId}-visor)`}/>
          <path d={visor} fill={`url(#${svgId}-reflection)`}/>
          <g fill="none" stroke="#d6a0fa" strokeWidth="7" strokeLinecap="round" opacity=".85">
            <path d="M291 205 Q321 190 349 209"/><path d="M526 241 Q550 235 574 255"/>
          </g>
          <g className="pfa-eye-pair">
            <g className="pfa-eye-blink">
              <g fill="#e7b9ff" className="pfa-eye-light">
                <ellipse cx="312" cy="270" rx="32" ry="38" transform="rotate(11 312 270)"/>
                <ellipse cx="533" cy="308" rx="32" ry="38" transform="rotate(11 533 308)"/>
              </g>
              <g className="pfa-eye-direction"><g className="pfa-pupils">
                <g fill="#45136c">
                  <ellipse cx="312" cy="271" rx="13" ry="24" transform="rotate(11 312 271)"/>
                  <ellipse cx="533" cy="309" rx="13" ry="24" transform="rotate(11 533 309)"/>
                </g>
                <g fill="#fff" opacity=".95"><circle cx="308" cy="262" r="5"/><circle cx="529" cy="300" r="5"/></g>
              </g></g>
            </g>
          </g>
          <path className="pfa-mouth" d="M382 322 Q416 336 450 331 C442 359 394 361 382 322Z" fill="#e7b9ff"/>
          <g stroke="#d89bfa" strokeWidth="5" strokeLinecap="round" opacity=".6"><path d="m258 310-9 8m23-4-9 8m286 36-9 8m23-4-9 8"/></g>
        </g>
      </svg>
      </div>
      </div>
      {rigged && <svg className="pfa-arms-art" viewBox="0 0 820 820" aria-hidden="true">
        <defs>
          <clipPath id={`${svgId}-arm`}><path d={arm}/></clipPath>
          <clipPath id={`${svgId}-wave-upper`}><rect x="220" y="410" width="120" height="190"/></clipPath>
          <clipPath id={`${svgId}-wave-lower`}><rect x="0" y="410" width="240" height="210"/></clipPath>
          <clipPath id={`${svgId}-front-arm`}><path d={frontArm}/></clipPath>
          <clipPath id={`${svgId}-upper-arm`}><rect x="490" y="470" width="210" height="142"/></clipPath>
          <clipPath id={`${svgId}-forearm`}><rect x="520" y="582" width="190" height="210"/></clipPath>
          <radialGradient id={`${svgId}-elbow`}><stop stopColor="#a572cd"/><stop offset="1" stopColor="#452064"/></radialGradient>
          <linearGradient id={`${svgId}-arm-enamel`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".5" stopColor="#f3ebff"/><stop offset="1" stopColor="#b28ad4"/></linearGradient>
        </defs>
        <g className="pfa-flight-front-arm">
          <g clipPath={`url(#${svgId}-front-arm)`}><image href={`${ASSETS}/bot-base.webp`} width="820" height="820" clipPath={`url(#${svgId}-upper-arm)`}/></g>
          <g className="pfa-forearm">
          <circle cx="582" cy="595" r="30" fill={`url(#${svgId}-elbow)`}/>
          <g clipPath={`url(#${svgId}-front-arm)`}><image href={`${ASSETS}/bot-base.webp`} width="820" height="820" clipPath={`url(#${svgId}-forearm)`}/></g>
          <circle className="pfa-grip-anchor" cx="660" cy="730" r="1" fill="transparent"/>
          </g>
        </g>
        <g className="pfa-flight-arm">
          <g clipPath={`url(#${svgId}-arm)`}><image href={`${ASSETS}/bot-base.webp`} width="820" height="820" clipPath={`url(#${svgId}-wave-upper)`}/></g>
          <g className="pfa-wave-forearm">
            <circle cx="230" cy="530" r="24" fill={`url(#${svgId}-elbow)`}/>
            <g clipPath={`url(#${svgId}-arm)`}><image href={`${ASSETS}/bot-base.webp`} width="820" height="820" clipPath={`url(#${svgId}-wave-lower)`}/></g>
            <g className="pfa-bot-hand pfa-closed-fist">{closedGlove}</g>
          </g>
        </g>
        <g className="pfa-push-arm">
          <g className="pfa-push-forearm">
            <circle cx="200" cy="550" r="35" fill={`url(#${svgId}-elbow)`}/>
            <path d="M200 550L85 439" fill="none" stroke="#54217c" strokeWidth="74" strokeLinecap="round"/>
            <path d="M196 544L85 439" fill="none" stroke={`url(#${svgId}-arm-enamel)`} strokeWidth="57" strokeLinecap="round"/>
            <path d="M188 535L103 454" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="8" strokeLinecap="round"/>
            <g transform="translate(-75 -73)">
              <g className="pfa-push-hand">
                {closedGlove}
                <circle className="pfa-second-grip-anchor" cx="115" cy="412" r="1" fill="transparent"/>
              </g>
            </g>
          </g>
        </g>
      </svg>}
      {!rigged && <svg className="pfa-drag-hand" viewBox="0 0 820 820" aria-hidden="true">{closedGlove}</svg>}
      {!rigged && <img className="pfa-bot-hand" src={`${ASSETS}/bot-wave-hand.webp`} alt="" draggable={false}/>}
      </div>
      </div>
    </div>
  </div>;
}

