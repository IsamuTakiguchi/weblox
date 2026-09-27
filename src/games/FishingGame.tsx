import { useEffect, useRef, useState } from 'react';
import { sfx, speak } from '../audio';
import type { HudState } from '../components/hud';
import type { GameData, GameResult } from '../engine/types';
import { createFishing, FISHES, FISHING_TARGET, tap, tick, type FishingState } from './fishing';

interface Props {
  game: GameData;
  onFinish: (result: GameResult) => void;
  onHud?: (hud: HudState) => void;
  resetKey?: number;
  paused?: boolean;
}

/** 「つりの たび」：Fisch 風のタイミングゲーム（画面をタップするだけ） */
export function FishingGame({ game, onFinish, onHud, resetKey = 0, paused = false }: Props) {
  const [s, setS] = useState<FishingState>(() => createFishing());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const finishedRef = useRef(false);
  const onHudRef = useRef(onHud);
  onHudRef.current = onHud;
  const timeLimit = game.rules.timeLimit;

  useEffect(() => {
    setS(createFishing());
    finishedRef.current = false;
    speak('がめんを タップして さおを なげよう。びっくりマークが でたら、みどりの ところで タップ！');
  }, [resetKey]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      if (pausedRef.current) return;
      setS((cur) => {
        if (cur.finished) return cur;
        const n = tick(cur, dt, timeLimit);
        if (n.lastEvent === 'bite') sfx.key();
        if (n.lastEvent === 'miss' && cur.phase === 'bite') sfx.hurt();
        return n;
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [timeLimit, resetKey]);

  useEffect(() => {
    onHudRef.current?.({ lives: 0, coins: s.caught, total: 0, score: s.score, keys: 0, time: timeLimit > 0 ? Math.max(0, timeLimit - s.elapsed) : null });
    if (s.finished && !finishedRef.current) {
      finishedRef.current = true;
      const outcome = s.finished;
      setTimeout(() => onFinish({ outcome, score: s.score, coins: s.caught, totalCoins: s.caught, timeMs: Math.round(s.elapsed * 1000), livesLeft: 0 }), 800);
    }
  }, [s, onFinish, timeLimit]);

  const onTap = () => {
    setS((cur) => {
      const n = tap(cur);
      switch (n.lastEvent) {
        case 'cast':
          sfx.jump();
          break;
        case 'catch':
          sfx.gem();
          break;
        case 'miss':
          sfx.hurt();
          break;
        case 'win':
          sfx.win();
          break;
        default:
          break;
      }
      return n;
    });
  };

  const zone = s.fish ? s.fish.zone : 0.3;
  return (
    <button type="button" className={`canvas-wrap mini fishing phase-${s.phase}`} onPointerDown={onTap} aria-label="つりをする">
      <div className="mini-top">
        <div className="mini-goal">
          もくひょう: <b>⭐ {FISHING_TARGET}</b>
          <div className="mini-bar">
            <div className="mini-bar-fill" style={{ width: `${Math.min(100, (s.score / FISHING_TARGET) * 100)}%` }} />
          </div>
        </div>
        <div className="mini-money">⭐ {s.score}</div>
      </div>
      <div className="fishing-scene">
        <div className="fishing-sky">
          <span className="fishing-sun">☀️</span>
          <span className="fishing-cloud">☁️</span>
        </div>
        <div className="fishing-sea">
          <div className="fisher">
            <span className="fisher-emoji">🧑‍🎣</span>
            <span className="fisher-line" />
            <span className="fisher-bob">{s.phase === 'bite' ? '❗' : s.phase === 'waiting' ? '🎣' : ''}</span>
          </div>
          {s.phase === 'caught' && s.fish && (
            <div className="fish-pop">
              <span className="fish-emoji">{s.fish.emoji}</span>
              <span className="fish-name">
                {s.fish.name}！ {s.fish.points > 0 ? `+${s.fish.points}` : 'はずれ…'}
              </span>
            </div>
          )}
          {s.phase === 'missed' && <div className="fish-pop miss">にげられた… 💨</div>}
        </div>
      </div>
      {s.phase === 'bite' && (
        <div className="timing">
          <div className="timing-bar">
            <div className="timing-zone" style={{ left: `${(s.zoneCenter - zone / 2) * 100}%`, width: `${zone * 100}%` }} />
            <div className="timing-marker" style={{ left: `${s.marker * 100}%` }} />
          </div>
          <div className="timing-label">みどりで タップ！</div>
        </div>
      )}
      {s.phase === 'idle' && <div className="mini-help big">🎣 タップして さおを なげる</div>}
      {s.phase === 'waiting' && <div className="mini-help big">…まってる…</div>}
      <div className="fish-legend">
        {FISHES.filter((f) => f.points > 0).map((f) => (
          <span key={f.id}>
            {f.emoji}
            {f.points}
          </span>
        ))}
      </div>
    </button>
  );
}

export default FishingGame;
