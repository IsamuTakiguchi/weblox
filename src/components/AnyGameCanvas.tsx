import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { GameData, GameResult } from '../engine/types';
import { canFullscreen, isFullscreen, toggleFullscreen } from '../fullscreen';
import { GameCanvas } from './GameCanvas';
import type { HudState } from './hud';

// three.js を含む 3D 描画は必要なときだけ読み込む（2D だけ遊ぶ人の読み込みを軽くする）
const GameCanvas3D = lazy(() => import('./GameCanvas3D'));
const GardenGame = lazy(() => import('../games/GardenGame'));
const FishingGame = lazy(() => import('../games/FishingGame'));

interface Props {
  game: GameData;
  onFinish: (result: GameResult) => void;
  resetKey?: number;
  autoStart?: boolean;
  paused?: boolean;
  /** 左上のメニューボタンを押したとき（指定すると表示） */
  onMenu?: () => void;
  /** 全画面ボタンを出すか */
  fullscreenButton?: boolean;
  /** トップバー右側に足す要素 */
  extra?: ReactNode;
}

/**
 * Roblox の画面構成に合わせたゲームフレーム：
 * 上部に半透明のバー（左上メニュー・ライフ・コイン・スコア・時間）、下にゲーム画面。
 * ゲームのモードに応じて 2D / 3D のプレイ画面を出し分ける。
 */
export function AnyGameCanvas({ game, onFinish, resetKey, autoStart, paused, onMenu, fullscreenButton, extra }: Props) {
  const [hud, setHud] = useState<HudState>({ lives: game.rules.lives, coins: 0, total: 0, score: 0, keys: 0, time: null });
  const [fs, setFs] = useState(isFullscreen());
  const onHud = useCallback((h: HudState) => setHud(h), []);

  useEffect(() => {
    const on = () => setFs(isFullscreen());
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      document.removeEventListener('webkitfullscreenchange', on);
    };
  }, []);

  const hearts = '❤️'.repeat(Math.max(0, Math.min(9, hud.lives)));
  const mode = game.rules.mode;
  const mini = mode === 'garden' || mode === 'fishing';
  const modeIcon = mode === '3d' ? '🧊 3D' : mode === 'platformer' ? '🦘' : mode === 'garden' ? '🌱' : mode === 'fishing' ? '🎣' : '🚶';

  const canvasProps = { game, onFinish, onHud, resetKey, autoStart, paused };
  return (
    <div className="play-wrap">
      <div className="topbar" role="toolbar" aria-label="ゲームのじょうほう">
        {onMenu && (
          <button type="button" className="menu-btn" onClick={onMenu} aria-label="メニュー" title="メニュー (Esc)">
            <img src={`${import.meta.env.BASE_URL}icons/logo.svg`} alt="" width={28} height={28} />
          </button>
        )}
        {!mini && (
          <span className="hud-item" title="ライフ">
            {hearts || '💔'}
          </span>
        )}
        {mode === 'garden' ? (
          <>
            <span className="hud-item" title="おかね">
              ◈ {hud.score}
            </span>
            <span className="hud-item" title="しゅうかく">
              🧺 {hud.coins}
            </span>
          </>
        ) : mode === 'fishing' ? (
          <>
            <span className="hud-item" title="ポイント">
              ⭐ {hud.score}
            </span>
            <span className="hud-item" title="つった数">
              🐟 {hud.coins}
            </span>
          </>
        ) : (
          <>
            <span className="hud-item" title="コイン">
              🪙 {hud.coins}/{hud.total}
            </span>
            <span className="hud-item" title="スコア">
              ⭐ {hud.score}
            </span>
          </>
        )}
        {hud.keys > 0 && <span className="hud-item">🔑 {hud.keys}</span>}
        {hud.time !== null && (
          <span className={`hud-item ${hud.time < 10 ? 'hud-danger' : ''}`} title="のこり時間">
            ⏱ {Math.ceil(hud.time)}
          </span>
        )}
        <span className="spacer" />
        {extra}
        <span className="hud-item hint">{modeIcon}</span>
        {fullscreenButton && canFullscreen() && (
          <button type="button" className="menu-btn" onClick={() => void toggleFullscreen()} aria-label={fs ? '全画面をやめる' : '全画面'} title="全画面 (F)">
            {fs ? '⤡' : '⛶'}
          </button>
        )}
      </div>
      {mode === '3d' ? (
        <Suspense fallback={<div className="canvas-wrap loading-3d">🧊 3D を よみこみ中…</div>}>
          <GameCanvas3D {...canvasProps} />
        </Suspense>
      ) : mode === 'garden' ? (
        <Suspense fallback={<div className="canvas-wrap loading-3d">🌱 よみこみ中…</div>}>
          <GardenGame game={game} onFinish={onFinish} onHud={onHud} resetKey={resetKey} paused={paused} />
        </Suspense>
      ) : mode === 'fishing' ? (
        <Suspense fallback={<div className="canvas-wrap loading-3d">🎣 よみこみ中…</div>}>
          <FishingGame game={game} onFinish={onFinish} onHud={onHud} resetKey={resetKey} paused={paused} />
        </Suspense>
      ) : (
        <GameCanvas {...canvasProps} />
      )}
    </div>
  );
}
