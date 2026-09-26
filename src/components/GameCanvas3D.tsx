import { useEffect, useRef, useState } from 'react';
import { playEvents, sfx } from '../audio';
import type { GameData, GameResult } from '../engine/types';
import { Renderer3D, type CameraState } from '../engine3d/render3d';
import { Sim3D } from '../engine3d/sim';
import { getState } from '../store/store';

interface Props {
  game: GameData;
  onFinish: (result: GameResult) => void;
  resetKey?: number;
  autoStart?: boolean;
}

interface Keys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  camLeft: boolean;
  camRight: boolean;
}

const emptyKeys = (): Keys => ({ forward: false, back: false, left: false, right: false, jump: false, camLeft: false, camRight: false });

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
    default:
      return null;
  }
}

/**
 * 3D モードのプレイ画面。三人称視点で、Roblox と同じく
 * WASD / 矢印で移動、スペースでジャンプ、ドラッグ（または Q/E）でカメラ回転。
 */
export function GameCanvas3D({ game, onFinish, resetKey = 0, autoStart = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Sim3D | null>(null);
  const keysRef = useRef<Keys>(emptyKeys());
  const camRef = useRef<CameraState>({ yaw: Math.PI, pitch: 0.55, distance: 9 });
  const [started, setStarted] = useState(autoStart);
  const [hud, setHud] = useState({ lives: game.rules.lives, coins: 0, total: 0, score: 0, keys: 0, time: null as number | null });
  const [webglError, setWebglError] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    simRef.current = new Sim3D(game);
    // デバッグ用（開発者ツールから状態を見られるようにする）
    (window as unknown as { __weblox3d?: Sim3D }).__weblox3d = simRef.current;
    finishedRef.current = false;
    keysRef.current = emptyKeys();
    camRef.current = { yaw: Math.PI, pitch: 0.55, distance: 9 };
    const s = simRef.current;
    setHud({ lives: s.lives, coins: 0, total: s.totalCoins, score: 0, keys: 0, time: s.remainingTime });
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

    // ドラッグでカメラ回転
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const cam = camRef.current;
      cam.yaw -= dx * 0.008;
      cam.pitch = Math.max(0.12, Math.min(1.25, cam.pitch + dy * 0.006));
    };
    const onUp = () => {
      dragging = false;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

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
      const cam = camRef.current;
      if (k.camLeft) cam.yaw += 2.2 * dt;
      if (k.camRight) cam.yaw -= 2.2 * dt;
      if (started && !s.finished) {
        // カメラ相対の移動方向をワールド座標に変換
        const f = (k.forward ? 1 : 0) - (k.back ? 1 : 0);
        const r = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        const fx = -Math.sin(cam.yaw);
        const fz = -Math.cos(cam.yaw);
        const rx = Math.cos(cam.yaw);
        const rz = -Math.sin(cam.yaw);
        const wasOnGround = s.player.onGround;
        s.step(dt, { x: fx * f + rx * r, z: fz * f + rz * r }, k.jump);
        if (wasOnGround && !s.player.onGround && k.jump) {
          /* ジャンプ音はイベント経由 */
        }
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
        setHud({ lives: s.lives, coins: s.coins, total: s.totalCoins, score: s.score, keys: s.keys, time: s.remainingTime });
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
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      renderer.dispose();
    };
  }, [started, onFinish, resetKey, game]);

  const press = (k: keyof Keys, on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (on && !started) setStarted(true);
    keysRef.current[k] = on;
  };
  const padBtn = (k: keyof Keys, label: string, cls = '') => (
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
        <span className="hud-item hint" style={{ marginLeft: 'auto', fontWeight: 600 }}>
          🧊 3D
        </span>
      </div>
      <div className="canvas-wrap canvas-3d" ref={wrapRef}>
        <canvas ref={canvasRef} className="game-canvas" />
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
            onClick={() => {
              sfx.tap();
              setStarted(true);
            }}
          >
            <span className="start-big">▶</span>
            <span className="start-label">スタート！</span>
            <span className="start-help">WASD / ↑↓←→ でうごく　スペース でジャンプ　ドラッグ / Q E でカメラ</span>
          </button>
        )}
      </div>
      <div className="pad" aria-label="そうさボタン">
        <div className="pad-cross">
          {padBtn('camLeft', '↶', 'pad-cam')}
          {padBtn('forward', '▲')}
          {padBtn('camRight', '↷', 'pad-cam')}
          {padBtn('left', '◀')}
          <span className="pad-center" />
          {padBtn('right', '▶')}
          <span />
          {padBtn('back', '▼')}
          <span />
        </div>
        <div className="pad-group">{padBtn('jump', '⤒', 'pad-jump')}</div>
      </div>
    </div>
  );
}

export default GameCanvas3D;
