// Authentication preserves the campus photo and purple identity, with a Merriweather brand heading.
export const authExperienceStyles = `
.pfa-root {
  --pfa-purple: #4b0082;
  --pfa-ink: #30203f;
  --pfa-error-ink: #9e3a50;
  --pfa-font: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
  position: relative;
  flex: 1;
  min-height: 100%;
  overflow: auto;
  isolation: isolate;
  background: #251b2e;
  color: var(--pfa-ink);
  font-family: var(--pfa-font);
  -webkit-font-smoothing: antialiased;
}
.pfa-root * { box-sizing: border-box; }
.pfa-form input { font-family: var(--pfa-font); }
.pfa-form :is(#postflow-email-error, #postflow-password-error, #postflow-login-feedback) { animation: pfa-feedback-enter .18s ease-out both; }
@keyframes pfa-feedback-enter { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
/* Read the browser's actual input state so autofill never sits behind a centered label. */
@supports selector(:has(input)) {
  .pfa-form :is(#postflow-email-field, #postflow-password-field) [id$='-label'] {
    top: 50% !important;
    transform: translateY(-50%);
    transition: top .16s ease-out, transform .16s ease-out;
  }
  .pfa-form :is(#postflow-email-field, #postflow-password-field) [id$='-label'] > * {
    font-size: 13px !important;
    line-height: 18px !important;
    transition: font-size .16s ease-out, line-height .16s ease-out, color .16s ease-out;
  }
  .pfa-form :is(#postflow-email-field, #postflow-password-field):has(input:is(:focus, :not(:placeholder-shown), :autofill, :-webkit-autofill)) [id$='-label'] {
    top: 6px !important;
    transform: none;
  }
  .pfa-form :is(#postflow-email-field, #postflow-password-field):has(input:is(:focus, :not(:placeholder-shown), :autofill, :-webkit-autofill)) [id$='-label'] > * {
    font-size: 11px !important;
    line-height: 15px !important;
  }
  /* Saved credentials rise immediately; typing and focus keep the smooth transition. */
  .pfa-form :is(#postflow-email-field, #postflow-password-field):has(input:is(:autofill, :-webkit-autofill)) :is([id$='-label'], [id$='-label'] > *),
  .pfa-form :is(#postflow-email-field, #postflow-password-field):has(input:not(:placeholder-shown)):not(:focus-within) :is([id$='-label'], [id$='-label'] > *) {
    transition: none;
  }
}
.pfa-campus-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #190f2447, #170b2440 50%, #190f24a6);
  pointer-events: none;
}
.pfa-login-shell { position: relative; min-height: 100dvh; display: flex; flex-direction: column; }
.pfa-welcoming .pfa-login-shell { visibility: hidden; }
.pfa-revealing .pfa-login-shell { visibility: visible; }
.pfa-topbar { position: absolute; z-index: 2; left: 0; top: 0; padding: 30px 38px; }
.pfa-mark { display: flex; align-items: center; gap: 12px; color: #fff; }
.pfa-mark strong { display: block; font-family: 'Merriweather_700Bold', Georgia, serif; font-size: 19px; line-height: 25px; font-weight: 400; letter-spacing: -.3px; white-space: nowrap; }
.pfa-mark small { display: block; font-size: 10px; line-height: 14px; font-weight: 700; letter-spacing: 2.1px; margin-top: 2px; opacity: .85; white-space: nowrap; }
.pfa-layout {
  position: relative;
  flex: 1;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0,1fr);
  place-items: center;
  padding: 32px 24px;
}
.pfa-login-group { position: relative; width: 100%; max-width: 360px; min-width: 0; container-type: inline-size; --pfa-avatar-size: 120px; --pfa-avatar-inset: 16px; }
.pfa-login-panel {
  position: relative;
  z-index: 2;
  width: 100%;
  background: #fff;
  border: 1px solid #ffffffa6;
  border-radius: 16px;
  box-shadow: 0 18px 70px #170c2533, 0 2px 8px #170c2514;
  padding: 18px 24px;
}
.pfa-form { display: flex; width: 100%; }
.pfa-form > div { width: 100%; }
.pfa-school-footer { text-align: center; color: #f3edf6; font-size: 10px; line-height: 16px; letter-spacing: 0; margin: 12px 0 0; padding: 0 4px; text-shadow: 0 1px 6px #170c2560; }
.pfa-ready .pfa-login-panel, .pfa-revealing .pfa-login-panel { animation: pfa-panel-enter .85s cubic-bezier(.2,.7,.2,1) both; }
.pfa-assistant {
  position: relative;
  z-index: 3;
  margin: 0 0 -14px var(--pfa-avatar-inset);
  width: var(--pfa-avatar-size);
  height: var(--pfa-avatar-size);
  pointer-events: none;
}
.pfa-assistant .pfa-character-motion { animation: pfa-assistant-hover 5.6s ease-in-out infinite; will-change: transform; backface-visibility: hidden; }
.pfa-ready:not(.pfa-departing) .pfa-assistant .pfa-cape { animation: pfa-auth-cape 3.8s ease-in-out infinite alternate; }
@keyframes pfa-auth-cape { from { transform: rotate(0) skewY(0); } to { transform: rotate(1deg) skewY(1deg); } }
.pfa-login-mascot { position: relative; width: 100%; height: 100%; }
.pfa-welcoming .pfa-login-group { z-index: 11; }
.pfa-welcoming .pfa-login-mascot { visibility: visible; pointer-events: none; transform: translate3d(var(--intro-x,0px),var(--intro-y,0px),0) scale(var(--intro-scale,1)); transform-origin: 50% 50%; perspective: 900px; }
.pfa-revealing .pfa-startup-actor { offset-path: var(--actor-dock-route); offset-anchor: 50% 50%; offset-rotate: 0deg; animation: pfa-actor-dock .95s cubic-bezier(.35,0,.2,1) both; }
.pfa-revealing .pfa-startup-actor .pfa-cape { animation: none; transform: none; }
@keyframes pfa-actor-dock { from { offset-distance: 0%; transform: scale(var(--intro-scale,1)); } to { offset-distance: 100%; transform: scale(1); } }
@keyframes pfa-actor-dock-fallback { from { transform: translate(var(--intro-x),var(--intro-y)) scale(var(--intro-scale)); } to { transform: translate(0,0) scale(1); } }

.pfa-character-trigger { position: relative; display: block; width: 100%; height: 100%; padding: 0; margin: 0; border: 0; border-radius: 28px; background: transparent; appearance: none; line-height: 0; cursor: pointer; pointer-events: auto; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.pfa-character-trigger:focus-visible { outline: none; }
.pfa-character-trigger:focus-visible::after { content: ''; position: absolute; bottom: 2px; left: 36%; width: 28%; height: 3px; border-radius: 3px; background: #dbc0ed; box-shadow: 0 0 0 2px #4b008229; }
.pfa-character-trigger:disabled { pointer-events: none; cursor: default; }
.pfa-login-speech { position: absolute; left: calc(100% + 8px); top: 14px; width: max-content; max-width: calc(100cqw - var(--pfa-avatar-size) - var(--pfa-avatar-inset) - var(--pfa-avatar-inset) - 8px); padding: 9px 12px; border: 1px solid #e8d8f3; border-radius: 14px 14px 14px 4px; background: #fffafd; color: #493356; font: 500 13px/18px var(--pfa-font); text-align: left; box-shadow: 0 8px 26px #24093524; opacity: 0; visibility: hidden; transform: translate(-5px, 3px) scale(.97); transform-origin: left center; transition: opacity .12s ease-out, transform .16s cubic-bezier(.2,.7,.2,1); pointer-events: none; }
.pfa-login-speech::before { content: ''; position: absolute; left: -5px; top: 15px; width: 8px; height: 8px; background: #fffafd; border-left: 1px solid #e8d8f3; border-bottom: 1px solid #e8d8f3; transform: rotate(45deg); }
.pfa-login-speech.pfa-speech-visible { opacity: 1; visibility: visible; transform: translate(0,0) scale(1); }
.pfa-speech-content { display: grid; min-width: 0; }
.pfa-speech-content::after { content: attr(data-text); visibility: hidden; grid-area: 1 / 1; }
.pfa-speech-copy { grid-area: 1 / 1; }
.pfa-speech-error { color: var(--pfa-error-ink); }
.pfa-sleep-countdown { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 4px; font-size: 11px; color: #756980; }
.pfa-sleep-countdown strong { color: var(--pfa-purple); font-size: 16px; line-height: 20px; font-weight: 650; font-variant-numeric: tabular-nums; }
.pfa-sleeping .pfa-character-motion { animation: pfa-sleep-breathe 3s ease-in-out infinite; }
.pfa-sleeping .pfa-character-pose { transform: rotate(4deg); }
.pfa-sleeping .pfa-cape { animation-duration: 4.8s; }
.pfa-sleep-mark { position: absolute; left: 8%; top: 3%; color: #f7efff; font: 650 16px/1 var(--pfa-font); text-shadow: 0 1px 6px #251035; animation: pfa-sleep-drift 3s ease-in-out infinite; }
.pfa-sleep-mark span { position: relative; top: -8px; margin-left: 2px; font-size: 11px; }
@keyframes pfa-sleep-breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(2px); } }
@keyframes pfa-sleep-drift { 0%,100% { opacity: .55; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
.pfa-departing .pfa-login-speech { display: none; }
.pfa-assistant-announcement { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pfa-ready:not(.pfa-departing) .pfa-responding .pfa-mouth { transform-box: fill-box; transform-origin: center; animation: pfa-login-talk .38s ease-in-out infinite; }
.pfa-ready:not(.pfa-departing) .pfa-gesturing .pfa-character-pose { animation: pfa-login-greeting .8s ease-in-out both; }
.pfa-ready:not(.pfa-departing) .pfa-gesturing .pfa-bot-hand { animation: pfa-wave .8s ease-in-out both; }
@keyframes pfa-login-talk { 0%,100% { transform: scaleY(.4); } 30% { transform: scaleX(.94) scaleY(1.35); } 65% { transform: scaleY(.65); } 85% { transform: scaleX(.97) scaleY(1.1); } }
@keyframes pfa-login-greeting { 0%,100% { transform: translateY(0) rotate(0); } 35% { transform: translateY(-3px) rotate(-3deg); } 70% { transform: translateY(-1px) rotate(1deg); } }
.pfa-flight-route { position: relative; width: 100%; height: 100%; }
.pfa-campus { position: absolute; inset: 0; overflow: hidden; }
.pfa-campus > * { transform-origin: 50% 42%; }
.pfa-welcoming .pfa-campus > * { animation: pfa-campus-arrival 4.45s cubic-bezier(.18,.6,.25,1) both; }
.pfa-intro { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; color: #fff; overflow: hidden; perspective: 1100px; }
.pfa-intro-backdrop { position: absolute; inset: 0; background: radial-gradient(ellipse at 48% 44%,#2d104a30,#180d2270 76%); transition: opacity .85s ease; }
.pfa-intro-center { position: relative; display: grid; grid-template-columns: minmax(0,300px) minmax(0,1fr); align-items: center; gap: clamp(28px,4vw,64px); width: min(880px,100%); padding: 85px 40px; text-align: left; }
.pfa-intro-character { --landing-x: 0px; --landing-y: -100px; --landing-scale: .62; position: relative; z-index: 3; width: clamp(220px,26vw,300px); aspect-ratio: 1; perspective: 900px; }
.pfa-intro-shadow { position: absolute; left: 24%; bottom: 0; width: 52%; height: 7%; border-radius: 50%; background: #180a2a; filter: blur(12px); opacity: .2; animation: pfa-arrival-shadow 3.4s ease-out both; }
.pfa-startup-actor .pfa-character-motion { filter: none; animation: pfa-entrance 3.4s cubic-bezier(.24,.65,.3,1) both; }
.pfa-startup-actor .pfa-eye-light { filter: none; }
.pfa-startup-actor .pfa-cloth-art, .pfa-startup-actor .pfa-head-rig { will-change: transform; }
.pfa-startup-actor .pfa-character-pose { animation: pfa-arrival-pose 3.4s cubic-bezier(.24,.65,.3,1) both; }
.pfa-startup-actor .pfa-head-rig { animation: pfa-arrival-head 3.4s cubic-bezier(.24,.65,.3,1) both; }
.pfa-startup-actor .pfa-flight-arm { animation: pfa-arrival-reach 3.4s cubic-bezier(.24,.65,.3,1) both; }
.pfa-startup-actor .pfa-bot-hand { animation: pfa-arrival-palm 3.4s cubic-bezier(.24,.65,.3,1) both; }
.pfa-startup-actor .pfa-wave-forearm { animation: pfa-arrival-wave-elbow 3.4s cubic-bezier(.24,.65,.3,1) both; }
.pfa-startup-actor .pfa-cape-response { transform-origin: var(--pfa-cape-x,640px) var(--pfa-cape-y,540px); animation: pfa-arrival-cape 3.4s cubic-bezier(.24,.65,.3,1) both; }
.pfa-startup-actor .pfa-eye-blink { animation: pfa-arrival-blink 3.4s linear both; }
.pfa-startup-actor .pfa-cape { animation: none; transform: none; }
.pfa-intro-wordmark { position: relative; z-index: 4; min-width: 0; width: 100%; text-shadow: 0 2px 24px #160b2820; transition: opacity .45s ease, transform .6s ease; }
.pfa-intro-institution { display: block; font-family: var(--pfa-font); font-size: 19px; font-weight: 600; letter-spacing: 3px; color: #f1e6fa; animation: pfa-wordmark-enter .65s .6s both; }
.pfa-title-window { overflow: hidden; margin: 10px -8px 12px; padding: 4px 8px; }
.pfa-intro-wordmark h1 { font-family: 'Merriweather_700Bold',Georgia,serif; font-size: clamp(58px,6.2vw,80px); font-weight: 400; letter-spacing: -2.5px; line-height: 1.18; margin: 0; animation: pfa-title-reveal .85s .65s cubic-bezier(.2,.7,.2,1) both; }
.pfa-intro-wordmark h1 span { display: inline; }
.pfa-intro-wordmark > p { color: #eee7f2; font-size: 13px; line-height: 21px; letter-spacing: .15px; margin: 0; animation: pfa-wordmark-enter .65s .95s both; }
.pfa-intro-signature { display: flex; align-items: center; gap: 8px; margin-top: 22px; color: #f3eaf9; font-size: 10.5px; line-height: 18px; letter-spacing: .3px; }
.pfa-workflow-step { --step-delay: 0.7s; display: flex; align-items: center; gap: 7px; padding: 8px 0; font-weight: 500; animation: pfa-wordmark-enter .4s var(--step-delay) both, pfa-stage-focus .8s var(--step-delay) both; }
.pfa-workflow-step:nth-of-type(2) { --step-delay: 1.2s; }
.pfa-workflow-step:nth-of-type(3) { --step-delay: 1.7s; }
.pfa-workflow-step svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 90; animation: pfa-signature-draw .6s var(--step-delay) both; }
.pfa-intro-signature i { position: relative; width: 12px; height: 1px; background: #d5bbed40; }
.pfa-intro-signature i::after { content: ''; position: absolute; inset: 0; background: #ebd7fa; transform-origin: left; animation: pfa-stage-link .4s 1.05s both; }
.pfa-intro-signature i:last-of-type::after { animation-delay: 1.55s; }
.pfa-intro-school { position: absolute; bottom: 27px; left: 20px; right: 20px; font-size: 9px; font-weight: 500; line-height: 16px; letter-spacing: 1.6px; text-align: center; color: #eee5f1; transition: opacity .4s ease; }
.pfa-intro .pfa-topbar { transition: opacity .45s ease; }
.pfa-intro-leaving { pointer-events: none; }
.pfa-intro-leaving .pfa-intro-backdrop, .pfa-intro-leaving .pfa-intro-wordmark, .pfa-intro-leaving .pfa-intro-school, .pfa-intro-leaving .pfa-topbar { opacity: 0; }
.pfa-intro-leaving .pfa-intro-wordmark { transform: translateY(8px); }
.pfa-revealing .pfa-startup-actor .pfa-character-motion { animation: none; }
.pfa-revealing .pfa-startup-actor :is(.pfa-character-pose,.pfa-spine,.pfa-head-rig,.pfa-flight-front-arm,.pfa-flight-arm,.pfa-wave-forearm,.pfa-bot-hand,.pfa-forearm,.pfa-chest-rig,.pfa-base-rig,.pfa-cape-response) { animation: none; }
.pfa-intro-leaving .pfa-intro-shadow { opacity: 0; transition: opacity .3s; animation: none; }
@keyframes pfa-stage-focus { 0% { color: #d9c9e9; } 45% { color: #fff; } 100% { color: #f3eaf9; } }
@keyframes pfa-signature-draw { from { stroke-dashoffset: 90; } to { stroke-dashoffset: 0; } }
@keyframes pfa-stage-link { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: .8; } }
@keyframes pfa-assistant-hover { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-4px,0); } }
@keyframes pfa-campus-arrival { from { transform: scale(1.02); } to { transform: scale(1); } }
@keyframes pfa-title-reveal { from { opacity: 0; transform: translateY(105%) rotate(2deg); } to { opacity: 1; transform: translateY(0) rotate(0); } }
@keyframes pfa-arrival-pose { 0% { transform: rotate(-3deg); } 26%,100% { transform: rotate(0); } }
@keyframes pfa-arrival-head { 0%,36% { transform: rotate(0); } 46% { transform: rotate(2deg); } 60%,100% { transform: rotate(0); } }
@keyframes pfa-arrival-reach { 0%,34% { transform: rotate(0); } 46% { transform: rotate(-3deg); } 60%,100% { transform: rotate(0); } }
@keyframes pfa-arrival-palm { 0%,36% { transform: rotate(0); } 46% { transform: rotate(8deg); } 60%,100% { transform: rotate(0); } }
@keyframes pfa-arrival-wave-elbow { 0%,34% { transform: rotate(0); } 46% { transform: rotate(6deg); } 60%,100% { transform: rotate(0); } }
@keyframes pfa-arrival-cape { 0% { transform: rotate(4deg); } 26%,100% { transform: rotate(0); } }

@keyframes pfa-entrance {
  0% { opacity: 0; transform: translate3d(-10%,8%,0) scale(.985); }
  8% { opacity: 1; }
  26%,100% { opacity: 1; transform: translate3d(0,0,0) scale(1); }
}
@keyframes pfa-arrival-shadow { 0% { opacity: 0; transform: scale(.55); } 40% { opacity: .16; transform: scale(.9); } 70%,100% { opacity: .2; transform: scale(1); } }
@keyframes pfa-arrival-blink { 0%,72%,80%,100% { transform: scaleY(1); } 76% { transform: scaleY(.08); } }


/* Successful sign-in: fly to the card's edge, make contact, then push it away. */
.pfa-departing { --push-x: -190px; --push-y: 180px; --depart-distance: 110vw; overflow: hidden; }
.pfa-departing .pfa-login-shell { overflow: hidden; }
.pfa-departing .pfa-login-group { animation: pfa-card-depart 1.75s linear both, pfa-depart-fade 1.75s linear both; will-change: transform, opacity; }
.pfa-root.pfa-departing .pfa-login-panel { --push-card-scale: .97; transform-origin: right center; animation: pfa-card-brace 1.75s cubic-bezier(.3,0,.25,1) both; }
.pfa-departing .pfa-flight-route { offset-path: var(--flight-route); offset-rotate: 0deg; offset-anchor: 50% 50%; animation: pfa-approach 1.75s linear both; will-change: offset-distance; }
.pfa-departing .pfa-assistant .pfa-character-motion { animation-play-state: paused; }
.pfa-departing .pfa-character-pose { animation: pfa-hero-pose 1.75s cubic-bezier(.3,0,.25,1) both; }
.pfa-departing .pfa-head-rig { animation: pfa-hero-head 1.75s cubic-bezier(.3,0,.25,1) both; }
.pfa-departing .pfa-flight-arm { animation: pfa-hero-reach 1.75s cubic-bezier(.3,0,.25,1) both, pfa-wave-arm-leave 1.75s linear both; }
.pfa-departing .pfa-push-arm, .pfa-departing .pfa-push-upper { animation: pfa-push-shoulder 1.75s cubic-bezier(.3,0,.25,1) both, pfa-push-arm-enter 1.75s linear both; }
.pfa-departing .pfa-push-forearm { animation: pfa-push-elbow 1.75s cubic-bezier(.3,0,.25,1) both; }
.pfa-departing .pfa-push-hand { animation: pfa-push-wrist 1.75s cubic-bezier(.3,0,.25,1) both; }
.pfa-departing .pfa-flight-front-arm { animation: pfa-hero-brace 1.75s cubic-bezier(.3,0,.25,1) both; }
.pfa-departing .pfa-forearm { animation: pfa-hero-elbow 1.75s cubic-bezier(.3,0,.25,1) both; }
.pfa-departing .pfa-bot-hand { animation: pfa-hero-palm 1.75s cubic-bezier(.3,0,.25,1) both; }
.pfa-departing .pfa-cape-response { transform-origin: var(--pfa-cape-x,640px) var(--pfa-cape-y,540px); animation: pfa-hero-cape-flow 1.75s cubic-bezier(.3,0,.25,1) both; }
.pfa-departing .pfa-cape { transform-origin: var(--pfa-cape-x,640px) var(--pfa-cape-y,540px); animation: pfa-hero-cape-ripple .52s ease-in-out infinite alternate; }
.pfa-departing .pfa-pupils { transform: translate(10px,2px); }
.pfa-sign-in-status { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@keyframes pfa-card-depart {
  0% { transform: translateX(0); }
  44% { transform: translateX(0); animation-timing-function: cubic-bezier(.45,0,.8,.65); }
  100% { transform: translateX(var(--depart-distance)); }
}
@keyframes pfa-depart-fade { 0%,80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes pfa-card-brace { 0%,12% { transform: scale(1); } 44%,100% { transform: scale(var(--push-card-scale)); } }
@keyframes pfa-wave-arm-leave { 0%,14% { opacity: 1; } 25%,100% { opacity: 0; } }
@keyframes pfa-push-arm-enter { 0%,14% { opacity: 0; } 25%,100% { opacity: 1; } }
@keyframes pfa-push-shoulder { 0%,12% { transform: rotate(-80deg); } 44%,100% { transform: rotate(var(--push-shoulder,-120deg)); } }
@keyframes pfa-push-elbow { 0%,12% { transform: rotate(-110deg); } 44%,100% { transform: rotate(var(--push-elbow,-133deg)); } }
@keyframes pfa-push-wrist { 0%,12% { transform: rotate(0); } 35%,100% { transform: rotate(-22deg); } }
@keyframes pfa-approach {
  0% { offset-distance: 0%; animation-timing-function: cubic-bezier(.38,0,.25,1); }
  44%,100% { offset-distance: 100%; }
}
@keyframes pfa-hero-pose {
  0% { transform: rotate(0); }
  12% { transform: rotate(-7deg) scale(.98); }
  30% { transform: rotate(60deg) scale(1.02); }
  44%,100% { transform: rotate(48deg); }
}
@keyframes pfa-hero-head {
  0%,12% { transform: rotate(0); }
  30% { transform: rotate(-51deg); }
  44%,100% { transform: rotate(-48deg); }
}
@keyframes pfa-hero-reach {
  0%,12% { transform: rotate(0); }
  30% { transform: rotate(-100deg) scale(1.03); }
  44%,100% { transform: rotate(var(--grip-reach,-135deg)) scale(1.08); }
}
@keyframes pfa-hero-palm {
  0%,12% { transform: rotate(0); }
  35%,100% { transform: rotate(-150deg); }
}
@keyframes pfa-hero-brace {
  0%,12% { transform: rotate(0); }
  30% { transform: rotate(-48deg); }
  44%,100% { transform: rotate(-54deg); }
}
@keyframes pfa-hero-elbow { 0%,12% { transform: rotate(0); } 30% { transform: rotate(8deg); } 44%,100% { transform: rotate(-18deg); } }
@keyframes pfa-hero-cape-flow {
  0% { transform: rotate(0) scaleX(1); }
  14% { transform: rotate(-12deg) skewY(-4deg) scaleX(1.08); }
  32% { transform: rotate(65deg) skewY(8deg) scaleX(1.18); }
  44% { transform: rotate(88deg) skewY(5deg) scaleX(1.24); }
  70%,100% { transform: rotate(97deg) skewY(8deg) scaleX(1.3); }
}
@keyframes pfa-hero-cape-ripple {
  from { transform: rotate(-5deg) skewY(-5deg) scaleY(.96); }
  to { transform: rotate(8deg) skewY(7deg) scaleY(1.06); }
}
@media (max-width: 700px) { .pfa-root.pfa-departing .pfa-login-panel { --push-card-scale: .75; } }
@supports not (offset-path: path('M0 0L1 1')) {
  .pfa-revealing .pfa-startup-actor { animation-name: pfa-actor-dock-fallback; }
  .pfa-departing .pfa-flight-route { animation-name: pfa-approach-fallback; }
}
@keyframes pfa-approach-fallback {
  0% { transform: translate(0,0); animation-timing-function: cubic-bezier(.38,0,.25,1); }
  44%,100% { transform: translate(var(--push-x),var(--push-y)); }
}
@keyframes pfa-hover { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-6px) rotate(.6deg); } }
@keyframes pfa-wave { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-10deg); } 50% { transform: rotate(7deg); } 75% { transform: rotate(-5deg); } }
@keyframes pfa-wordmark-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pfa-panel-enter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 700px) {
  .pfa-topbar { padding: 21px 24px; }
  .pfa-login-shell > .pfa-topbar { position: relative; align-self: flex-start; }
  .pfa-mark strong { font-size: 17px; line-height: 23px; }
  .pfa-mark small { font-size: 8px; line-height: 12px; letter-spacing: 1.65px; }
  .pfa-mark > div { width: 36px !important; height: 36px !important; }
  .pfa-layout { min-height: calc(100dvh - 78px); padding: 16px 18px 28px; }
  .pfa-login-panel { padding: 18px 24px; border-radius: 14px; }
  .pfa-login-group { --pfa-avatar-size: 112px; }
  .pfa-login-speech { top: 9px; padding: 8px 10px; border-radius: 14px 14px 14px 4px; font-size: 12px; line-height: 17px; }
  .pfa-login-speech::before { top: 20px; }
  .pfa-intro-center { display: flex; flex-direction: column; gap: 18px; padding: 90px 24px 70px; text-align: center; }
  .pfa-intro-character { width: clamp(170px,28vh,230px); }
  .pfa-intro-institution { font-size: 18px; }
  .pfa-title-window { margin-top: 10px; margin-bottom: 12px; }
  .pfa-intro-signature { justify-content: center; gap: 6px; margin-top: 19px; }
  .pfa-workflow-step { padding: 6px 8px; gap: 5px; }
  .pfa-intro-signature i { width: 8px; }
  .pfa-intro-wordmark h1 { font-size: clamp(46px,11.8vw,60px); letter-spacing: -1.5px; }
  .pfa-intro-wordmark > p { font-size: 11px; }
  .pfa-intro-school { font-size: 7px; letter-spacing: 1.2px; bottom: 22px; }
}
@media (max-width: 370px) {
  .pfa-login-panel { padding-left: 22px; padding-right: 22px; }
  .pfa-layout { padding-left: 14px; padding-right: 14px; }
  .pfa-intro-character { width: clamp(170px,28vh,210px); }
  .pfa-workflow-step { font-size: 9.5px; padding: 6px; }
  .pfa-workflow-step svg { width: 14px; height: 14px; }
}
@media (max-height: 700px) and (min-width: 701px) {
  .pfa-layout { padding: 12px 24px; }
  .pfa-login-group { --pfa-avatar-size: 96px; }
  .pfa-topbar { padding-top: 23px; }
  .pfa-intro-center { grid-template-columns: minmax(0,220px) minmax(0,1fr); width: min(740px,100%); padding-top: 70px; padding-bottom: 60px; }
  .pfa-intro-character { width: 220px; }
  .pfa-intro-wordmark h1 { font-size: 64px; }
}
@media (max-height: 700px) and (max-width: 700px) {
  .pfa-login-shell > .pfa-topbar { padding: 14px 20px; }
  .pfa-layout { min-height: calc(100dvh - 64px); padding: 8px 14px 16px; }
  .pfa-login-group { --pfa-avatar-size: 84px; }
  .pfa-login-speech { top: 0; }
}
@media (max-height: 620px) { .pfa-login-panel #postflow-login-logo { width: 52px !important; height: 52px !important; } }
@media (prefers-reduced-motion: reduce) {
  .pfa-root * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  .pfa-pupils, .pfa-cape { transform: none; }
}
`;
