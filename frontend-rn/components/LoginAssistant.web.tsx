import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Character from './PostflowCharacter.web';
import { playAssistantSound } from '../utils/assistantSound.web';
import type { LoginAssistantNotice } from './AuthExperience.types';

type Props = { privateMode: boolean; departing: boolean; activity: number; entryField: 'email' | 'password' | null; welcoming?: boolean; notice?: LoginAssistantNotice | null; lockSeconds: number };
type MessageOptions = { restart?: boolean; announce?: boolean };

const GREETING = 'Hello! Welcome to PostFlow.';
const LETTER_INTERVAL = 16;
const MAX_REVEAL_DURATION = 420;
const IDLE_INTERVAL = 10000;
const IDLE_LINES = ['Still there? No pop quiz, I promise.', 'Ready when you are.', 'No paper cuts in this workflow.', 'Let’s give your next post a good start.'];
const openingWord = (text: string) => text.match(/^\S+\s*/)?.[0] || text;

export default function LoginAssistant({ privateMode, departing, activity, entryField, welcoming = false, notice, lockSeconds }: Props) {
  const sleeping = lockSeconds > 0;
  const initialMessage = notice?.message || GREETING;
  const initiallyVisible = !welcoming && !departing && !sleeping;
  const [typing, setTyping] = useState(false);
  const [gesturing, setGesturing] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [message, setMessage] = useState(initialMessage);
  const [displayed, setDisplayed] = useState(initiallyVisible ? openingWord(initialMessage) : '');
  const [bubbleVisible, setBubbleVisible] = useState(initiallyVisible);
  const [tapActivity, setTapActivity] = useState(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = useRef(false);
  const currentMessage = useRef('');
  const hasResponded = useRef(false);
  const wasSleeping = useRef(sleeping);
  const lastNotice = useRef<number | null>(null);
  const idleIndex = useRef(0);

  const respond = useCallback((text = GREETING, options: MessageOptions = {}) => {
    if (departing || sleeping || welcoming) return;
    if (!options.restart && shown.current && currentMessage.current === text) return;
    hasResponded.current = true;
    shown.current = true;
    currentMessage.current = text;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setMessage(text);
    if (options.announce !== false) setAnnouncement(text);
    setBubbleVisible(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const openingLength = openingWord(text).length;
    setDisplayed(reduced ? text : text.slice(0, openingLength));
    setTyping(!reduced && text.length > openingLength);
    const finish = () => {
      setTyping(false);
    };
    if (reduced || text.length <= openingLength) finish();
    else {
      const interval = Math.min(LETTER_INTERVAL, MAX_REVEAL_DURATION / (text.length - openingLength));
      const started = performance.now();
      const reveal = () => {
        // Follow elapsed time so a busy frame cannot stretch a short reply out.
        const length = Math.min(text.length, openingLength + Math.max(1, Math.floor((performance.now() - started) / interval)));
        setDisplayed(text.slice(0, length));
        if (length < text.length) typingTimer.current = setTimeout(reveal, interval);
        else finish();
      };
      typingTimer.current = setTimeout(reveal, interval);
    }
  }, [departing, sleeping, welcoming]);

  useLayoutEffect(() => {
    if (departing || sleeping || welcoming) {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (gestureTimer.current) clearTimeout(gestureTimer.current);
      shown.current = false;
      setBubbleVisible(false);
      setTyping(false);
      setGesturing(false);
      wasSleeping.current = sleeping;
      if (sleeping) setAnnouncement('Too many attempts. You can try again when the timer finishes.');
      return;
    }
    if (notice) {
      wasSleeping.current = false;
      respond(notice.message, { restart: lastNotice.current !== notice.id });
      lastNotice.current = notice.id;
    } else if (wasSleeping.current) {
      wasSleeping.current = false;
      respond('I’m awake. Try again.');
    } else if (activity > 0) respond(entryField === 'password' ? 'I’ll look away.' : 'Use your account email.');
  }, [activity, entryField, notice?.id, notice?.message, sleeping, departing, welcoming, respond]);

  useLayoutEffect(() => {
    if (departing || sleeping || welcoming) return;
    if (!hasResponded.current) respond();
  }, [departing, sleeping, welcoming, respond]);

  useEffect(() => {
    if (departing || sleeping || welcoming || notice) return;
    idleIndex.current = 0;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !hasResponded.current) return;
      respond(IDLE_LINES[idleIndex.current++ % IDLE_LINES.length], { announce: false });
      if (gestureTimer.current) clearTimeout(gestureTimer.current);
      setGesturing(true);
      gestureTimer.current = setTimeout(() => setGesturing(false), 800);
    }, IDLE_INTERVAL);
    return () => clearInterval(timer);
  }, [departing, sleeping, welcoming, notice?.id, activity, tapActivity, respond]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (gestureTimer.current) clearTimeout(gestureTimer.current);
  }, []);

  // A change to the motion preference completes the current text without talking.
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => {
      if (!motion.matches) return;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      setDisplayed(currentMessage.current);
      setTyping(false);
    };
    motion.addEventListener('change', finish);
    return () => motion.removeEventListener('change', finish);
  }, []);

  return <div className={['pfa-login-mascot', welcoming && 'pfa-startup-actor', typing && !sleeping && 'pfa-responding', gesturing && 'pfa-gesturing', sleeping && 'pfa-sleeping'].filter(Boolean).join(' ')} data-speaking={typing && !sleeping && !departing && !welcoming} data-sleeping={sleeping}>
    <button className="pfa-character-trigger" type="button" aria-label="Say hello to PostFlow" disabled={departing || sleeping || welcoming}
      onClick={() => {
        setTapActivity(current => current + 1);
        if (gestureTimer.current) clearTimeout(gestureTimer.current);
        setGesturing(true);
        gestureTimer.current = setTimeout(() => setGesturing(false), 800);
        playAssistantSound('open');
      }}>
      <Character privateMode={privateMode || sleeping} tracking={!departing && !sleeping} flightPose={departing} arrival={welcoming} articulated decorative/>
    </button>
    {sleeping && <span className="pfa-sleep-mark" aria-hidden="true">z<span>z</span></span>}
    <div className={['pfa-login-speech', (bubbleVisible || sleeping) && !departing && !welcoming && 'pfa-speech-visible', notice && !sleeping && 'pfa-speech-error'].filter(Boolean).join(' ')} aria-hidden="true" data-message={sleeping ? 'Taking a short rest.' : message}>
      {sleeping ? <>
        <span>Taking a short rest.</span>
        <span className="pfa-sleep-countdown"><span>Try again in</span><strong>{lockSeconds}s</strong></span>
      </> : <span className="pfa-speech-content" data-text={message}><span className="pfa-speech-copy">{displayed}</span></span>}
    </div>
    <span className="pfa-assistant-announcement" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
