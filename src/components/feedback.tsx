import { useEffect, useState } from 'react';

type Listener = (msg: string) => void;
const toastListeners = new Set<Listener>();
const confettiListeners = new Set<() => void>();

export function toast(msg: string): void {
  for (const l of toastListeners) l(msg);
}

export function fireConfetti(): void {
  for (const l of confettiListeners) l();
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer = 0;
    const l: Listener = (m) => {
      setMsg(m);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 2600);
    };
    toastListeners.add(l);
    return () => {
      toastListeners.delete(l);
      window.clearTimeout(timer);
    };
  }, []);
  if (!msg) return null;
  return (
    <div className="toast" role="status">
      {msg}
    </div>
  );
}

const PIECES = ['🎉', '⭐', '✨', '🎈', '🪙', '💎', '🌟'];

export function ConfettiHost() {
  const [pieces, setPieces] = useState<{ id: number; left: number; delay: number; dur: number; text: string }[]>([]);
  useEffect(() => {
    let nextId = 0;
    const l = () => {
      const batch = Array.from({ length: 40 }, () => ({
        id: nextId++,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2 + Math.random() * 1.5,
        text: PIECES[Math.floor(Math.random() * PIECES.length)],
      }));
      setPieces(batch);
      window.setTimeout(() => setPieces([]), 4200);
    };
    confettiListeners.add(l);
    return () => {
      confettiListeners.delete(l);
    };
  }, []);
  if (!pieces.length) return null;
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <span key={p.id} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}>
          {p.text}
        </span>
      ))}
    </div>
  );
}
