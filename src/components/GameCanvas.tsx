import { useEffect, useRef, useState } from 'react';
import { playEvents, sfx } from '../audio';
import { renderRuntime } from '../engine/render';
import { GameRuntime, type InputState } from '../engine/runtime';
import type { GameData, GameResult } from '../engine/types';

interface Props {
  game: GameData;
  onFinish: (result: GameResult) => void;
  /** 再スタート時に呼ばれる（キー） */
  resetKey?: number;
  autoStart?: boolean;
}

const emptyInput = (): InputState => ({ left: false, right: false, up: false, down: false, jump: false });

function keyToInput(code: string): keyof InputState | null {
  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    case 'ArrowUp':
    case 'KeyW':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    case 'Space':
    case 'KeyZ':
    case 'KeyX':
      return 'jump';
    default:
      return null;
  }
}

export function GameCanvas({ game, onFinish, resetKey = 0, autoStart = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rtRef = useRef<GameRuntime | null>(null);
  const inputRef = useRef<InputState>(emptyInput());
  const [started, setStarted] = useState(autoStart);
  const [hud, setHud] = useState({ lives: game.rules.lives, coins: 0, total: 0, score: 0, keys: 0, time: null as number | null });
  const finishedRef = useRef(false);

  // ランタイム作成
  useEffect(() => {
    rtRef.current = new GameRuntime(game);
    finishedRef.current = false;
    inputRef.current = emptyInput();
    const rt = rtRef.current;
    setHud({ lives: rt.lives, coins: 0, total: rt.totalCoins, score: 0, keys: 0, time: rt.remainingTime });
    setStarted(autoStart);
  }, [game, resetKey, autoStart]);

  // キーボード
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = keyToInput(e.code);
      if (!k) return;
      e.preventDefault();
      if (!started) setStarted(true);
      if (!inputRef.current[k] && (k === 'jump' || (k === 'up' && game.rules.mode === 'platformer')) && rtRef.current?.player.onGround) sfx.jump();
      inputRef.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = keyToInput(e.code);
      if (!k) return;
      inputRef.current[k] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [started, game.rules.mode]);

  // ループ
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    let hudTick = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const rt = rtRef.current;
      if (!rt) return;
      // rAF のタイムスタンプは初期化時刻より前のことがあるため、0 未満にならないようにする
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (started && !rt.finished) rt.step(dt, inputRef.current);
      else if (!started) rt.time += dt; // アニメだけ動かす
      renderRuntime(ctx, rt, canvas.width, canvas.height);
      const ev = rt.drainEvents();
      if (ev.length) playEvents(ev);
      hudTick += dt;
      if (hudTick > 0.1 || ev.length) {
        hudTick = 0;
        setHud({ lives: rt.lives, coins: rt.coins, total: rt.totalCoins, score: rt.score, keys: rt.keys, time: rt.remainingTime });
      }
      if (rt.finished && !finishedRef.current) {
        finishedRef.current = true;
        const result = rt.finished;
        setTimeout(() => onFinish(result), 600);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [started, onFinish, resetKey, game]);

  const press = (k: keyof InputState, on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (on && !started) setStarted(true);
    if (on && !inputRef.current[k] && (k === 'jump' || k === 'up') && game.rules.mode === 'platformer' && rtRef.current?.player.onGround) sfx.jump();
    inputRef.current[k] = on;
  };
  const padBtn = (k: keyof InputState, label: string, cls = '') => (
    <button
      type="button"
      className={`pad-btn ${cls}`}
      onPointerDown={press(k, true)}
      onPointerUp={press(k, false)}
      onPointerLeave={press(k, false)}
      onPointerCancel={press(k, false)}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      {label}
    </button>
  );

  const platformer = game.rules.mode === 'platformer';
  const hearts = '❤️'.repeat(Math.max(0, Math.min(9, hud.lives)));

  return (
    <div className="play-wrap">
      <div className="hud">
        <span className="hud-item" title="ライフ">
          {hearts || '💔'}
        </span>
        <span className="hud-item" title="コイン">
          🪙 {hud.coins}/{hud.total}
        </span>
        <span className="hud-item" title="スコア">
          ⭐ {hud.score}
        </span>
        {hud.keys > 0 && <span className="hud-item">🔑 {hud.keys}</span>}
        {hud.time !== null && (
          <span className={`hud-item ${hud.time < 10 ? 'hud-danger' : ''}`} title="のこり時間">
            ⏱ {Math.ceil(hud.time)}
          </span>
        )}
      </div>
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="game-canvas" />
        {!started && (
          <button
            type="button"
            className="start-overlay"
            onClick={() => {
              sfx.tap();
              setStarted(true);
            }}
          >
            <span className="start-big">▶</span>
            <span className="start-label">スタート！</span>
            <span className="start-help">{platformer ? '← → でうごく　スペース / ↑ でジャンプ' : '↑ ↓ ← → でうごく'}</span>
          </button>
        )}
      </div>
      <div className="pad" aria-label="そうさボタン">
        {platformer ? (
          <>
            <div className="pad-group">
              {padBtn('left', '◀')}
              {padBtn('right', '▶')}
            </div>
            <div className="pad-group">{padBtn('jump', '⤒', 'pad-jump')}</div>
          </>
        ) : (
          <div className="pad-cross">
            <span />
            {padBtn('up', '▲')}
            <span />
            {padBtn('left', '◀')}
            <span className="pad-center" />
            {padBtn('right', '▶')}
            <span />
            {padBtn('down', '▼')}
            <span />
          </div>
        )}
      </div>
    </div>
  );
}
