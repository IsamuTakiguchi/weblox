import { useEffect, useRef, useState } from 'react';
import { sfx, speak } from '../audio';
import type { HudState } from '../components/hud';
import type { GameData, GameResult } from '../engine/types';
import { createGarden, GARDEN_TARGET, progress, SEEDS, selectSeed, stageEmoji, tapPlot, tick, type GardenState } from './garden';

interface Props {
  game: GameData;
  onFinish: (result: GameResult) => void;
  onHud?: (hud: HudState) => void;
  resetKey?: number;
  paused?: boolean;
}

/** 「はたけを そだてよう」：Grow a Garden 風のミニゲーム（タップだけで遊べる） */
export function GardenGame({ game, onFinish, onHud, resetKey = 0, paused = false }: Props) {
  const [s, setS] = useState<GardenState>(() => createGarden());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const finishedRef = useRef(false);
  const onHudRef = useRef(onHud);
  onHudRef.current = onHud;
  const timeLimit = game.rules.timeLimit;

  useEffect(() => {
    setS(createGarden());
    finishedRef.current = false;
    speak('タネを えらんで、はたけを タップして うえよう');
  }, [resetKey]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      if (pausedRef.current) return;
      setS((cur) => (cur.finished ? cur : tick(cur, dt, timeLimit)));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [timeLimit, resetKey]);

  useEffect(() => {
    onHudRef.current?.({ lives: 0, coins: s.harvested, total: 0, score: s.money, keys: 0, time: timeLimit > 0 ? Math.max(0, timeLimit - s.elapsed) : null });
    if (s.finished && !finishedRef.current) {
      finishedRef.current = true;
      const outcome = s.finished;
      setTimeout(() => onFinish({ outcome, score: s.money, coins: s.harvested, totalCoins: s.harvested, timeMs: Math.round(s.elapsed * 1000), livesLeft: 0 }), 600);
    }
  }, [s, onFinish, timeLimit]);

  const act = (fn: (cur: GardenState) => GardenState) => {
    setS((cur) => {
      const n = fn(cur);
      switch (n.lastEvent) {
        case 'plant':
          sfx.place();
          break;
        case 'water':
          sfx.coin();
          break;
        case 'harvest':
          sfx.gem();
          break;
        case 'nomoney':
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
  const selected = SEEDS.find((x) => x.id === s.selected) ?? SEEDS[0];

  return (
    <div className="canvas-wrap mini garden">
      <div className="mini-top">
        <div className="mini-goal">
          もくひょう: <b>◈ {GARDEN_TARGET}</b>
          <div className="mini-bar">
            <div className="mini-bar-fill" style={{ width: `${Math.min(100, (s.money / GARDEN_TARGET) * 100)}%` }} />
          </div>
        </div>
        <div className="mini-money">◈ {s.money}</div>
      </div>
      <div className="garden-grid">
        {s.plots.map((p, i) => {
          const pr = progress(p);
          const grown = p.seed && pr >= 1;
          return (
            <button
              key={i}
              type="button"
              className={`plot ${grown ? 'grown' : ''} ${p.seed ? 'planted' : ''}`}
              onClick={() => act((cur) => tapPlot(cur, i))}
              aria-label={p.seed ? `${p.seed.name} ${Math.round(pr * 100)}%` : 'あいている はたけ'}
            >
              <span className="plot-emoji">{p.seed ? stageEmoji(p) : ''}</span>
              {p.seed && !grown && (
                <span className="plot-progress">
                  <span style={{ width: `${pr * 100}%` }} />
                </span>
              )}
              {p.seed && !grown && !p.watered && <span className="plot-hint">💧</span>}
              {grown && <span className="plot-hint">✋ しゅうかく</span>}
            </button>
          );
        })}
      </div>
      <div className="seed-shop">
        {SEEDS.map((seed) => (
          <button
            key={seed.id}
            type="button"
            className={`seed ${s.selected === seed.id ? 'selected' : ''} ${s.money < seed.cost ? 'poor' : ''}`}
            onClick={() => {
              sfx.tap();
              act((cur) => selectSeed(cur, seed.id));
              speak(seed.name);
            }}
          >
            <span className="seed-emoji">{seed.emoji}</span>
            <span className="seed-name">{seed.name}</span>
            <span className="seed-cost">◈ {seed.cost}</span>
            <span className="seed-sell">→ ◈ {seed.sell}</span>
          </button>
        ))}
      </div>
      <p className="mini-help">
        {selected.emoji} {selected.name} を えらび中。あいた はたけを タップで うえる → 💧 タップで みずやり → そだったら タップで しゅうかく！
      </p>
    </div>
  );
}

export default GardenGame;
