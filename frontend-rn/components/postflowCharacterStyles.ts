// Shared web character artwork, gaze and motion.
export const characterStyles = `
.pfa-character { position: relative; width: 100%; aspect-ratio: 1; --gaze-x: 0px; --gaze-y: 0px; }
.pfa-character-motion { position: absolute; inset: 0; filter: drop-shadow(0 12px 12px #170a2a29); }
.pfa-character-pose { position: absolute; inset: 0; transform-origin: 50% 55%; }
.pfa-spine { position: absolute; inset: 0; transform-origin: 50% 82%; }
.pfa-head-look { position: absolute; inset: 0; transform-origin: 51.2% 55.5%; transition: transform .2s ease-out; }
.pfa-character img, .pfa-face, .pfa-body-art, .pfa-arms-art, .pfa-cloth-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; user-select: none; }
.pfa-cloth-art { overflow: visible; }
.pfa-arms-art { z-index: 2; overflow: visible; }
.pfa-drag-hand { display: none; position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.pfa-bot-base { visibility: hidden; }
.pfa-body-art, .pfa-face { overflow: visible; }
.pfa-head-rig { position: absolute; inset: 0; transform-origin: 51.2% 55.5%; }
.pfa-head-art { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.pfa-flight-arm { transform-origin: 285px 460px; }
.pfa-wave-forearm { transform-origin: 230px 530px; }
.pfa-flight-front-arm { transform-origin: 535px 500px; }
.pfa-forearm { transform-origin: 582px 595px; }
.pfa-push-arm, .pfa-push-upper { opacity: 0; transform-origin: 285px 460px; }
.pfa-push-forearm { transform-origin: 200px 550px; }
.pfa-push-hand { transform-origin: 160px 512px; }
.pfa-chest-rig { transform-origin: 410px 480px; }
.pfa-base-rig { transform-origin: 410px 716px; }
.pfa-cape-response, .pfa-cape { transform-origin: var(--pfa-cape-x,640px) var(--pfa-cape-y,540px); }
.pfa-cape { animation: pfa-cape-breeze 1.6s ease-in-out infinite alternate; }
.pfa-bot-hand { transform-origin: 19.6% 62.4%; }
.pfa-pupils { transform: translate(var(--gaze-x), var(--gaze-y)); }
.pfa-eye-light { filter: drop-shadow(0 0 6px #ca78ff90); }
.pfa-eye-pair { transform-box: fill-box; transform-origin: center; transition: transform .18s ease; }
.pfa-eye-blink { transform-box: fill-box; transform-origin: center; animation: pfa-blink 6s 2s infinite; }
.pfa-private .pfa-eye-pair { transform: scaleY(.08); }
.pfa-private .pfa-eye-blink { animation: none; }
@keyframes pfa-cape-breeze {
  0% { transform: rotate(-2deg) skewY(-2deg) scaleX(1); }
  50% { transform: rotate(2.5deg) skewY(3deg) scaleX(1.025); }
  100% { transform: rotate(5deg) skewY(5deg) scaleX(1.05); }
}
@keyframes pfa-blink { 0%,46%,50%,100% { transform: scaleY(1); } 48% { transform: scaleY(.07); } }
@media (prefers-reduced-motion: reduce) { .pfa-character * { animation: none !important; transition: none !important; } .pfa-character .pfa-pupils, .pfa-character .pfa-cape, .pfa-character .pfa-head-look { transform: none !important; } }
`;
