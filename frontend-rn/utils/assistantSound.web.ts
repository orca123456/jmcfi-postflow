const SOUND_KEY = 'postflow.assistant.sound';
const listeners = new Set<() => void>();
let enabled = true;
let context: AudioContext | null = null;
let output: GainNode | null = null;
let lastPlayed = -Infinity;

export function getAssistantSoundEnabled() {
  try { enabled = localStorage.getItem(SOUND_KEY) !== 'off'; } catch { /* Keep the in-memory preference. */ }
  return enabled;
}

export function subscribeAssistantSound(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => { if (event.key === SOUND_KEY || event.key === null) listener(); };
  window.addEventListener('storage', changed);
  return () => { listeners.delete(listener); window.removeEventListener('storage', changed); };
}

/** Called directly from sign-in or a chatbot action to unlock browser audio. */
export function prepareAssistantAudio() {
  if (!getAssistantSoundEnabled()) return;
  try {
    const Audio = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    if (!context || context.state === 'closed') {
      context = new Audio();
      output = context.createGain();
      output.gain.value = .22;
      output.connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch { /* Chat remains usable when browser audio is unavailable. */ }
}

export function setAssistantSoundEnabled(value: boolean) {
  enabled = value;
  try { localStorage.setItem(SOUND_KEY, value ? 'on' : 'off'); } catch { /* Session-only preference. */ }
  if (context && output) {
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(value ? .22 : 0, context.currentTime, .012);
  }
  if (value) prepareAssistantAudio();
  listeners.forEach(listener => listener());
}

export function playAssistantError() { playAssistantSound('error'); }

export function playAssistantSound(kind: 'welcome' | 'open' | 'send' | 'reply' | 'error') {
  if (!getAssistantSoundEnabled() || document.visibilityState !== 'visible') return;
  prepareAssistantAudio();
  const audio = context;
  const destination = output;
  if (!audio || !destination) return;
  const play = () => {
    if (!getAssistantSoundEnabled() || audio.state !== 'running' || document.visibilityState !== 'visible' || performance.now() - lastPlayed < 120) return;
    lastPlayed = performance.now();
    const notes = kind === 'error' ? [349.23, 293.66] : kind === 'welcome' ? [523.25, 659.25, 783.99] : kind === 'reply' ? [659.25, 783.99] : kind === 'send' ? [440] : [587.33];
    notes.forEach((frequency, index) => {
      const start = audio.currentTime + index * .085;
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(.13, start + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + .17);
      oscillator.connect(envelope);
      envelope.connect(destination);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + .18);
    });
  };
  try {
    if (audio.state === 'running') play();
    else void audio.resume().then(play).catch(() => {});
  } catch { /* A blocked sound never interrupts an interaction. */ }
}
