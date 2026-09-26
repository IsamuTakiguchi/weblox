import { lazy, Suspense } from 'react';
import type { GameData, GameResult } from '../engine/types';
import { GameCanvas } from './GameCanvas';

// three.js を含む 3D 描画は必要なときだけ読み込む（2D だけ遊ぶ人の読み込みを軽くする）
const GameCanvas3D = lazy(() => import('./GameCanvas3D'));

interface Props {
  game: GameData;
  onFinish: (result: GameResult) => void;
  resetKey?: number;
  autoStart?: boolean;
}

/** ゲームのモードに応じて 2D / 3D のプレイ画面を出し分ける */
export function AnyGameCanvas(props: Props) {
  if (props.game.rules.mode === '3d') {
    return (
      <Suspense
        fallback={
          <div className="play-wrap">
            <div className="hud">🧊 3D を よみこみ中…</div>
            <div className="canvas-wrap" />
          </div>
        }
      >
        <GameCanvas3D {...props} />
      </Suspense>
    );
  }
  return <GameCanvas {...props} />;
}
