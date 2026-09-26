import { useEffect, useRef, useState } from 'react';
import { playEvents, sfx } from '../audio';
import type { GameData, GameResult } from '../engine/types';
import { Renderer3D, type CameraState } from '../engine3d/render3d';
import { Sim3D } from '../engine3d/sim';
import { getState } from '../store/store';
import type { HudState } from './hud';
import { TouchControls } from './TouchControls';

interface Props {
  game: GameData;
  onFinish: (result: GameResult) => void;
  onHud?: (hud: HudState) => void;
  resetKey?: number;
  autoStart?: boolean;
  paused?: boolean;
}

interface Keys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  camLeft: boolean;
  camRight: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
}

const emptyKeys = (): Keys => ({ forward: false, back: false, left: false, right: false, jump: false, camLeft: false, camRight: false, zoomIn: false, zoomOut: false });

function keyFor(code: string): keyof Keys | null {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      return 'forward';
    case 'ArrowDown':
    case 'KeyS':
      return 'back';
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    case 'Space':
    case 'KeyZ':
    case 'KeyX':
      return 'jump';
    case 'KeyQ':
      return 'camLeft';
    case 'KeyE':
      return 'camRight';
    case 'KeyI':
      return 'zoomIn';
    case 'KeyO':
      return 'zoomOut';
    default:
      return null;
  }
}

const MIN_DIST = 3;
const MAX_DIST = 18;

/**
 * 3D モードのプレイ画面。Roblox と同じ操作：
 *  PC   : WASD / 矢印で移動、スペースでジャンプ、マウスドラッグでカメラ、ホイールか I / O でズーム
 *  スマホ: 左側をなぞってジョイスティック、右側をなぞってカメラ、ピンチでズーム、右下ボタンでジャンプ
 */
export function GameCanvas3D({ game, onFinish, onHud, resetKey = 0, autoStart = false, paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Sim3D | null>(null);
  const keysRef = useRef<Keys>(emptyKeys());
  const stickRef = useRef({ x: 0, y: 0, jump: false });
  const camRef = useRef<CameraState>({ yaw: Math.PI, pitch: 0.55, distance: 9 });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onHudRef = useRef(onHud);
  onHudRef.current = onHud;
  const [started, setStarted] = useState(autoStart);
  const [webglError, setWebglError] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    simRef.current = new Sim3D(game);
    // デバッグ用（開発者ツールから状態を見られるようにする）
    (window as unknown as { __weblox3d?: Sim3D }).__weblox3d = simRef.current;
    finishedRef.current = false;
    keysRef.current = emptyKeys();
    stickRef.current = { x: 0, y: 0, jump: false };
    camRef.current = { yaw: Math.PI, pitch: 0.55, distance: 9 };
    const s = simRef.current;
    onHudRef.current?.({ lives: s.lives, coins: 0, total: s.totalCoins, score: 0, keys: 0, time: s.remainingTime });
    setStarted(autoStart);
  }, [game, resetKey, autoStart]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = keyFor(e.code);
      if (!k) return;
      e.preventDefault();
      if (!started) setStarted(true);
      keysRef.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = keyFor(e.code);
      if (k) keysRef.current[k] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [started]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const sim = simRef.current;
    if (!canvas || !wrap || !sim) return;
    let renderer: Renderer3D;
    try {
      renderer = new Renderer3D(canvas, game, getState().profile.avatar.color);
    } catch {
      setWebglError(true);
      return;
    }
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      renderer.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    let hudTick = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const s = simRef.current;
      if (!s) return;
      // rAF のタイムスタンプは初期化時刻より前のことがあるため、0 未満にならないようにする
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const k = keysRef.current;
      const st = stickRef.current;
      const cam = camRef.current;
      if (k.camLeft) cam.yaw += 2.2 * dt;
      if (k.camRight) cam.yaw -= 2.2 * dt;
      if (k.zoomIn) cam.distance = Math.max(MIN_DIST, cam.distance - 8 * dt);
      if (k.zoomOut) cam.distance = Math.min(MAX_DIST, cam.distance + 8 * dt);
      if (started && !pausedRef.current && !s.finished) {
        // カメラ相対の移動方向をワールド座標に変換
        const f = (k.forward ? 1 : 0) - (k.back ? 1 : 0) + st.y;
        const r = (k.right ? 1 : 0) - (k.left ? 1 : 0) + st.x;
        const fx = -Math.sin(cam.yaw);
        const fz = -Math.cos(cam.yaw);
        const rx = Math.cos(cam.yaw);
        const rz = -Math.sin(cam.yaw);
        s.step(dt, { x: fx * f + rx * r, z: fz * f + rz * r }, k.jump || st.jump);
      } else if (!started) {
        s.time += dt;
      }
      const ev = s.drainEvents();
      if (ev.length) {
        playEvents(ev);
        renderer.handleEvents(ev, s);
      }
      renderer.render(s, cam, dt);
      hudTick += dt;
      if (hudTick > 0.1 || ev.length) {
        hudTick = 0;
        onHudRef.current?.({ lives: s.lives, coins: s.coins, total: s.totalCoins, score: s.score, keys: s.keys, time: s.remainingTime });
      }
      if (s.finished && !finishedRef.current) {
        finishedRef.current = true;
        const result = s.finished;
        setTimeout(() => onFinish(result), 700);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    };
  }, [started, onFinish, resetKey, game]);

  return (
    <div className="canvas-wrap canvas-3d" ref={wrapRef}>
      <canvas ref={canvasRef} className="game-canvas" />
      <TouchControls
        showJump
        handlers={{
          onAnyInput: () => {
            if (!started) setStarted(true);
          },
          onMove: (x, y) => {
            stickRef.current.x = x;
            stickRef.current.y = y;
          },
          onJump: (down) => {
            stickRef.current.jump = down;
          },
          onLook: (dx, dy) => {
            const cam = camRef.current;
            cam.yaw -= dx * 0.008;
            cam.pitch = Math.max(0.12, Math.min(1.25, cam.pitch + dy * 0.006));
          },
          onZoom: (factor) => {
            const cam = camRef.current;
            cam.distance = Math.max(MIN_DIST, Math.min(MAX_DIST, cam.distance / factor));
          },
        }}
      />
      {webglError && (
        <div className="start-overlay">
          <span className="start-label">3D を表示できません</span>
          <span className="start-help">このブラウザでは WebGL が使えないようです</span>
        </div>
      )}
      {!started && !webglError && (
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
          <span className="start-help">WASD でうごく　スペース でジャンプ　ドラッグ でカメラ　スマホは左をなぞってうごき、右をなぞってカメラ</span>
        </button>
      )}
    </div>
  );
}

export default GameCanvas3D;
