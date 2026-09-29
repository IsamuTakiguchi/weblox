import { useEffect, useRef, useState } from 'react';
import { playEvents, sfx } from '../audio';
import { type RemotePlayer2D, renderRuntime } from '../engine/render';
import { GameRuntime, type InputState } from '../engine/runtime';
import type { GameData, GameResult } from '../engine/types';
import type { RoomSession } from '../net/room';
import { TouchControls } from './TouchControls';
import type { HudState } from './hud';

interface Props {
  game: GameData;
  onFinish: (result: GameResult) => void;
  onHud?: (hud: HudState) => void;
  /** 再スタート時に呼ばれる（キー） */
  resetKey?: number;
  autoStart?: boolean;
  paused?: boolean;
  /** マルチプレイの部屋 */
  room?: RoomSession;
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

/** 2D ゲームのプレイ画面（あるく／ジャンプ） */
export function GameCanvas({ game, onFinish, onHud, resetKey = 0, autoStart = false, paused = false, room }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const wrapRef = useRef<HTMLDivElement>(null);
  const rtRef = useRef<GameRuntime | null>(null);
  const keyInput = useRef<InputState>(emptyInput());
  const stickInput = useRef<InputState>(emptyInput());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onHudRef = useRef(onHud);
  onHudRef.current = onHud;
  const [started, setStarted] = useState(autoStart);
  const finishedRef = useRef(false);
  const platformer = game.rules.mode === 'platformer';

  // ランタイム作成
  useEffect(() => {
    rtRef.current = new GameRuntime(game);
    finishedRef.current = false;
    keyInput.current = emptyInput();
    stickInput.current = emptyInput();
    const rt = rtRef.current;
    onHudRef.current?.({ lives: rt.lives, coins: 0, total: rt.totalCoins, score: 0, keys: 0, time: rt.remainingTime });
    setStarted(autoStart);
  }, [game, resetKey, autoStart]);

  // キーボード
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = keyToInput(e.code);
      if (!k) return;
      e.preventDefault();
      if (!started) setStarted(true);
      if (!keyInput.current[k] && (k === 'jump' || (k === 'up' && platformer)) && rtRef.current?.player.onGround) sfx.jump();
      keyInput.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = keyToInput(e.code);
      if (k) keyInput.current[k] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [started, platformer]);

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
    const merged = emptyInput();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const rt = rtRef.current;
      if (!rt) return;
      // rAF のタイムスタンプは初期化時刻より前のことがあるため、0 未満にならないようにする
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const a = keyInput.current;
      const b = stickInput.current;
      merged.left = a.left || b.left;
      merged.right = a.right || b.right;
      merged.up = a.up || b.up;
      merged.down = a.down || b.down;
      merged.jump = a.jump || b.jump;
      if (started && !pausedRef.current && !rt.finished) rt.step(dt, merged);
      else rt.time += dt; // アニメだけ動かす
      // マルチプレイ：自分の位置を送り、ほかの人を描く
      let others: RemotePlayer2D[] = [];
      const room = roomRef.current;
      if (room) {
        const p = rt.player;
        room.sendState({ x: p.x, y: p.y, z: 0, yaw: 0, f: p.facing, w: rt.time, g: p.onGround, r: false });
        const list = room.others(dt);
        others = list.map((o) => ({ x: o.shown!.x, y: o.shown!.y, face: o.avatar.face, name: o.name, it: o.it }));
        if (room.amIt && !rt.finished) {
          for (const o of list) if (Math.abs(o.shown!.x - p.x) < 0.8 && Math.abs(o.shown!.y - p.y) < 0.8) room.tag(o.id);
        }
      }
      renderRuntime(ctx, rt, canvas.width, canvas.height, others);
      const ev = rt.drainEvents();
      if (ev.length) playEvents(ev);
      hudTick += dt;
      if (hudTick > 0.1 || ev.length) {
        hudTick = 0;
        onHudRef.current?.({ lives: rt.lives, coins: rt.coins, total: rt.totalCoins, score: rt.score, keys: rt.keys, time: rt.remainingTime });
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

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="game-canvas" />
      <TouchControls
        showJump={platformer}
        handlers={{
          onAnyInput: () => {
            if (!started) setStarted(true);
          },
          onMove: (x, y) => {
            const s = stickInput.current;
            s.left = x < -0.3;
            s.right = x > 0.3;
            if (platformer) {
              // ジャンプゲームではスティックを上に倒してもジャンプできる
              const wasUp = s.up;
              s.up = y > 0.6;
              if (s.up && !wasUp && rtRef.current?.player.onGround) sfx.jump();
              s.down = false;
            } else {
              s.up = y > 0.3;
              s.down = y < -0.3;
            }
          },
          onJump: (down) => {
            if (down && rtRef.current?.player.onGround) sfx.jump();
            stickInput.current.jump = down;
          },
        }}
      />
      {!started && (
        <button
          type="button"
          className="start-overlay"
          onPointerDown={() => {
            sfx.tap();
            setStarted(true);
          }}
          onClick={() => setStarted(true)}
        >
          <span className="start-big">▶</span>
          <span className="start-label">タップで スタート！</span>
          <span className="start-help">{platformer ? '← → でうごく　スペース でジャンプ　スマホは左をなぞって 右のボタンでジャンプ' : '↑ ↓ ← → でうごく　スマホは画面をなぞってうごく'}</span>
        </button>
      )}
    </div>
  );
}
