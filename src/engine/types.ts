/** タイル（マス）の種類 */
export type TileId =
  | 'empty'
  | 'ground'
  | 'wall'
  | 'cloud'
  | 'coin'
  | 'gem'
  | 'heart'
  | 'enemy'
  | 'spike'
  | 'water'
  | 'spring'
  | 'key'
  | 'door'
  | 'portal'
  | 'flower'
  | 'goal'
  | 'start'
  /** 3D 用の高い床（2〜5 段）。2D では壁／床として扱う */
  | 'step2'
  | 'step3'
  | 'step4'
  | 'step5';

/**
 * 上から見る（あるく）、横から見る（ジャンプ）、立体（3D）、
 * それにマップを使わないミニゲーム（はたけ・つり）
 */
export type GameMode = 'topdown' | 'platformer' | '3d' | 'garden' | 'fishing';

/** マップ（タイル）で遊ぶモードか */
export function isTileMode(mode: GameMode): boolean {
  return mode === 'topdown' || mode === 'platformer' || mode === '3d';
}

/** クリア条件 */
export type WinCondition = 'goal' | 'coins' | 'both';

export type ThemeId = 'meadow' | 'space' | 'ocean' | 'candy' | 'volcano' | 'snow';

export interface GameRules {
  mode: GameMode;
  /** 1〜5 */
  speed: number;
  /** 1〜5 （platformer のみ） */
  jump: number;
  /** 1〜9 */
  lives: number;
  /** 秒。0 なら制限なし */
  timeLimit: number;
  win: WinCondition;
  /** 0〜5。0 なら敵は動かない */
  enemySpeed: number;
}

export interface GameData {
  id: string;
  version: 1;
  title: string;
  description: string;
  author: string;
  authorAvatar: string;
  theme: ThemeId;
  /** 主人公の絵文字 */
  hero: string;
  width: number;
  height: number;
  /** 行優先。1 文字 = 1 マス（tiles.ts の charMap 参照） */
  tiles: string;
  rules: GameRules;
  createdAt: number;
  updatedAt: number;
  /** かんたんモードで作られたか */
  kidMode: boolean;
}

export interface PublishedGame extends GameData {
  publishedAt: number;
  plays: number;
  likes: number;
  /** 同梱サンプルなら true（削除不可） */
  featured?: boolean;
  /** ホームで並べるコレクション名（例: 'popular' = Roblox で人気のあそび風） */
  collection?: string;
}

export type GameOutcome = 'win' | 'lose';

export interface GameResult {
  outcome: GameOutcome;
  score: number;
  coins: number;
  totalCoins: number;
  timeMs: number;
  livesLeft: number;
}
