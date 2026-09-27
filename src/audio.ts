import type { RuntimeEvent } from './engine/runtime';

let ctx: AudioContext | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('weblox.muted', m ? '1' : '0');
  } catch {
    /* noop */
  }
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem('weblox.muted') === '1';
  } catch {
    return muted;
  }
}
muted = isMuted();

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08, slide = 0): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination);
  o.start();
  o.stop(ac.currentTime + dur + 0.02);
}

function melody(notes: [number, number][], type: OscillatorType = 'square'): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  let t = 0;
  for (const [f, d] of notes) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, ac.currentTime + t);
    g.gain.linearRampToValueAtTime(0.08, ac.currentTime + t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + d);
    o.connect(g).connect(ac.destination);
    o.start(ac.currentTime + t);
    o.stop(ac.currentTime + t + d + 0.02);
    t += d;
  }
}

export const sfx = {
  coin: () => tone(1046, 0.12, 'square', 0.06, 400),
  gem: () => melody([[880, 0.08], [1174, 0.08], [1568, 0.14]]),
  heart: () => melody([[659, 0.1], [784, 0.1], [988, 0.16]], 'triangle'),
  key: () => melody([[1318, 0.07], [1568, 0.12]]),
  door: () => tone(220, 0.25, 'sawtooth', 0.05, 80),
  portal: () => tone(300, 0.35, 'sine', 0.08, 900),
  spring: () => tone(400, 0.2, 'square', 0.06, 700),
  stomp: () => tone(200, 0.15, 'square', 0.08, -120),
  hurt: () => tone(180, 0.3, 'sawtooth', 0.08, -120),
  caught: () => melody([[330, 0.12], [262, 0.12], [196, 0.3]], 'sawtooth'),
  checkpoint: () => melody([[988, 0.07], [1318, 0.07], [1568, 0.18]], 'triangle'),
  ride: () => tone(260, 0.5, 'sine', 0.06, 520),
  alarm: () => melody([[880, 0.15], [660, 0.15], [880, 0.15], [660, 0.15]], 'square'),
  jump: () => tone(500, 0.1, 'square', 0.04, 300),
  tap: () => tone(700, 0.05, 'triangle', 0.04),
  place: () => tone(520, 0.06, 'triangle', 0.05, 200),
  erase: () => tone(300, 0.06, 'triangle', 0.04, -100),
  win: () => melody([[523, 0.12], [659, 0.12], [784, 0.12], [1046, 0.3], [784, 0.1], [1046, 0.4]]),
  lose: () => melody([[392, 0.2], [349, 0.2], [311, 0.2], [261, 0.5]], 'sawtooth'),
  reward: () => melody([[784, 0.08], [988, 0.08], [1174, 0.08], [1568, 0.25]], 'triangle'),
};

export function playEvents(events: RuntimeEvent[]): void {
  for (const e of events) {
    const f = (sfx as Record<string, (() => void) | undefined>)[e.type];
    f?.();
  }
}

/* ---------- よみあげ（字が読めないこども向け） ---------- */

let speechEnabled = true;
try {
  speechEnabled = localStorage.getItem('weblox.speech') !== '0';
} catch {
  /* noop */
}

export function isSpeechEnabled(): boolean {
  return speechEnabled;
}

export function setSpeechEnabled(v: boolean): void {
  speechEnabled = v;
  try {
    localStorage.setItem('weblox.speech', v ? '1' : '0');
  } catch {
    /* noop */
  }
  if (!v) stopSpeaking();
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, force = false): void {
  if (!canSpeak() || (!speechEnabled && !force)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.95;
    u.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const ja = voices.find((v) => v.lang.startsWith('ja'));
    if (ja) u.voice = ja;
    window.speechSynthesis.speak(u);
  } catch {
    /* noop */
  }
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
