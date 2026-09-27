/**
 * 全画面まわりのヘルパー。
 * Roblox と同じく「ゲームを選んで ▶ を押したら全画面で始まる」体験にする。
 * iOS Safari は要素の全画面 API に対応していないので、その場合は
 * 画面いっぱいのレイアウト（.immersive）だけで代替する。
 */

export function canFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return Boolean(document.fullscreenElement || d.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<boolean> {
  if (!canFullscreen() || isFullscreen()) return isFullscreen();
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    return false;
  }
  // スマホでは Roblox と同じく横向きに固定を試みる（できない環境では無視）
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (v: string) => Promise<void> };
    if (o?.lock && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) await o.lock('landscape');
  } catch {
    /* noop */
  }
  return isFullscreen();
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return;
  const d = document as Document & { webkitExitFullscreen?: () => Promise<void> };
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {
    /* noop */
  }
  try {
    const o = screen.orientation as ScreenOrientation & { unlock?: () => void };
    o?.unlock?.();
  } catch {
    /* noop */
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await exitFullscreen();
  else await enterFullscreen();
}

/* ---------- ページのピンチズーム対策（iPhone） ---------- */

/**
 * プレイ中はページ自体がピンチで拡大されないようにする。
 * iOS Safari は viewport の user-scalable=no を無視するので、ジェスチャーイベントを止める。
 * 戻り値のクリーンアップで解除する。
 */
export function lockPageZoom(): () => void {
  if (typeof document === 'undefined') return () => {};
  const stop = (e: Event) => e.preventDefault();
  const onTouchMove = (e: TouchEvent) => {
    const scale = (e as TouchEvent & { scale?: number }).scale;
    if (e.touches.length > 1 || (scale !== undefined && scale !== 1)) e.preventDefault();
  };
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  document.addEventListener('gestureend', stop, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  return () => {
    document.removeEventListener('gesturestart', stop);
    document.removeEventListener('gesturechange', stop);
    document.removeEventListener('gestureend', stop);
    document.removeEventListener('touchmove', onTouchMove);
  };
}

/**
 * ページが拡大・スクロールされたままになっていたら元に戻す（ゲームをやめたあとにヘッダーが見切れないように）。
 * viewport meta を設定し直すと iOS Safari は倍率を 1 に戻す。
 */
export function resetPageView(): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta) {
    const content = meta.getAttribute('content') ?? '';
    meta.setAttribute('content', content.replace(/maximum-scale=[^,]*/, 'maximum-scale=1.0').replace(/initial-scale=[^,]*/, 'initial-scale=1.0'));
    // 値を変えないと再評価されないブラウザ向けに、いったん別の値にしてから戻す
    requestAnimationFrame(() => meta.setAttribute('content', content));
  }
  try {
    window.scrollTo({ top: 0, left: 0 });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  } catch {
    /* noop */
  }
}

/* ---------- 「▶ あそぶ」を押した直後だけ自動スタートするためのフラグ ---------- */

let pendingAutoStart = false;

export function requestAutoStart(): void {
  pendingAutoStart = true;
}

export function consumeAutoStart(): boolean {
  const v = pendingAutoStart;
  pendingAutoStart = false;
  return v;
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}
