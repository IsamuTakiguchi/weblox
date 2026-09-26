import { useEffect, useRef } from 'react';
import { sfx } from '../audio';

/**
 * Roblox のモバイル操作を再現したタッチレイヤー。
 *  - 画面の左側どこでもタッチ → その場所に「ダイナミック・サムスティック」が出て、
 *    指を動かした方向にキャラクターが歩く（Roblox の Dynamic Thumbstick）
 *  - 画面の右側をドラッグ → カメラ回転（3D）。2 本指でピンチ → ズーム
 *  - 右下の丸ボタン → ジャンプ
 *  - PC ではマウスのドラッグ（左右どちらのボタンでも）でカメラ回転、ホイールでズーム
 */
export interface TouchHandlers {
  /** x: 右が +、y: 前（画面の上）が +。長さ 0〜1 */
  onMove: (x: number, y: number) => void;
  onJump?: (down: boolean) => void;
  /** カメラ回転（ピクセル差分） */
  onLook?: (dx: number, dy: number) => void;
  /** ズーム倍率（>1 で寄る） */
  onZoom?: (factor: number) => void;
  /** 何かを触ったとき（スタートのトリガーに使う） */
  onAnyInput?: () => void;
}

interface Props {
  handlers: TouchHandlers;
  showJump: boolean;
  /** スティックを出す領域の幅（画面幅に対する割合） */
  stickZone?: number;
}

const RADIUS = 52;

type Role = 'stick' | 'look';
interface Tracked {
  role: Role;
  x: number;
  y: number;
  /** stick 用：台座の位置 */
  baseX: number;
  baseY: number;
}

export function TouchControls({ handlers, showJump, stickZone = 0.55 }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const layer = layerRef.current;
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!layer || !base || !knob) return;
    const pointers = new Map<number, Tracked>();
    let stickId: number | null = null;
    let pinchDist = 0;

    const showStick = (bx: number, by: number, kx: number, ky: number) => {
      base.style.display = 'block';
      knob.style.display = 'block';
      base.style.transform = `translate(${bx - RADIUS}px, ${by - RADIUS}px)`;
      knob.style.transform = `translate(${kx - 26}px, ${ky - 26}px)`;
    };
    const hideStick = () => {
      base.style.display = 'none';
      knob.style.display = 'none';
    };

    const lookPointers = () => [...pointers.entries()].filter(([, t]) => t.role === 'look');

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.jump-btn')) return;
      handlersRef.current.onAnyInput?.();
      const rect = layer.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      let role: Role = 'look';
      if (e.pointerType !== 'mouse' && stickId === null && lx < rect.width * stickZone) role = 'stick';
      if (role === 'look' && !handlersRef.current.onLook && e.pointerType !== 'mouse') {
        // 2D ゲームでは右側のタッチもスティックにする（片手で遊べるように）
        if (stickId === null) role = 'stick';
        else return;
      }
      if (role === 'look' && !handlersRef.current.onLook) return;
      layer.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { role, x: lx, y: ly, baseX: lx, baseY: ly });
      if (role === 'stick') {
        stickId = e.pointerId;
        showStick(lx, ly, lx, ly);
        handlersRef.current.onMove(0, 0);
      } else {
        const lp = lookPointers();
        if (lp.length === 2) {
          const [a, b] = lp.map(([, t]) => t);
          pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        }
      }
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      const t = pointers.get(e.pointerId);
      if (!t) return;
      const rect = layer.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      if (t.role === 'stick') {
        let dx = lx - t.baseX;
        let dy = ly - t.baseY;
        const d = Math.hypot(dx, dy);
        if (d > RADIUS) {
          // 台座が指についてくる（Roblox のダイナミック・サムスティック）
          const k = (d - RADIUS) / d;
          t.baseX += dx * k;
          t.baseY += dy * k;
          dx = lx - t.baseX;
          dy = ly - t.baseY;
        }
        const nd = Math.min(1, Math.hypot(dx, dy) / RADIUS);
        const ang = Math.atan2(dy, dx);
        const mx = Math.cos(ang) * nd;
        const my = -Math.sin(ang) * nd;
        showStick(t.baseX, t.baseY, t.baseX + dx, t.baseY + dy);
        handlersRef.current.onMove(Math.hypot(dx, dy) < 4 ? 0 : mx, Math.hypot(dx, dy) < 4 ? 0 : my);
      } else {
        const lp = lookPointers();
        if (lp.length >= 2) {
          t.x = lx;
          t.y = ly;
          const [a, b] = lp.map(([, q]) => q);
          const nd = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDist > 0 && nd > 0) handlersRef.current.onZoom?.(nd / pinchDist);
          pinchDist = nd;
          return;
        }
        const dx = lx - t.x;
        const dy = ly - t.y;
        t.x = lx;
        t.y = ly;
        handlersRef.current.onLook?.(dx, dy);
      }
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      const t = pointers.get(e.pointerId);
      if (!t) return;
      pointers.delete(e.pointerId);
      if (t.role === 'stick') {
        stickId = null;
        hideStick();
        handlersRef.current.onMove(0, 0);
      } else {
        pinchDist = 0;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!handlersRef.current.onZoom) return;
      e.preventDefault();
      handlersRef.current.onZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    const onContext = (e: Event) => e.preventDefault();

    layer.addEventListener('pointerdown', onDown);
    layer.addEventListener('pointermove', onMove);
    layer.addEventListener('pointerup', onUp);
    layer.addEventListener('pointercancel', onUp);
    layer.addEventListener('wheel', onWheel, { passive: false });
    layer.addEventListener('contextmenu', onContext);
    return () => {
      layer.removeEventListener('pointerdown', onDown);
      layer.removeEventListener('pointermove', onMove);
      layer.removeEventListener('pointerup', onUp);
      layer.removeEventListener('pointercancel', onUp);
      layer.removeEventListener('wheel', onWheel);
      layer.removeEventListener('contextmenu', onContext);
    };
  }, [stickZone]);

  const jumpDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handlersRef.current.onAnyInput?.();
    handlersRef.current.onJump?.(true);
    sfx.tap();
  };
  const jumpUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handlersRef.current.onJump?.(false);
  };

  return (
    <div className="touch-layer" ref={layerRef} aria-label="タッチそうさ">
      <div className="stick-base" ref={baseRef} aria-hidden />
      <div className="stick-knob" ref={knobRef} aria-hidden />
      {showJump && (
        <button
          type="button"
          className="jump-btn"
          onPointerDown={jumpDown}
          onPointerUp={jumpUp}
          onPointerLeave={jumpUp}
          onPointerCancel={jumpUp}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="ジャンプ"
        >
          <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden>
            <path d="M12 4l7 8h-4v8H9v-8H5z" fill="currentColor" />
          </svg>
        </button>
      )}
    </div>
  );
}
