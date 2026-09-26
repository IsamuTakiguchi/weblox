import type { TileId } from './types';

export interface TileDef {
  id: TileId;
  /** 1 文字。シリアライズに使う */
  char: string;
  /** こども向けの短い名前 */
  label: string;
  /** くわしい説明（つくるモードで表示） */
  hint: string;
  emoji: string;
  /** かんたんモードのパレットに出すか */
  kid: boolean;
  /** 壁として通れないか */
  solid: boolean;
  /** 触れるとダメージ */
  deadly: boolean;
  /** 取ると消えるアイテム */
  pickup: boolean;
}

export const TILES: readonly TileDef[] = [
  { id: 'empty', char: '.', label: 'けす', hint: 'マスを空にします（3D では奈落になる）', emoji: '🧽', kid: true, solid: false, deadly: false, pickup: false },
  { id: 'ground', char: '#', label: 'じめん', hint: '立てる床・ブロック', emoji: '🟩', kid: true, solid: true, deadly: false, pickup: false },
  { id: 'wall', char: 'W', label: 'かべ', hint: '通れないブロック（3D では高さ 3）', emoji: '🧱', kid: true, solid: true, deadly: false, pickup: false },
  { id: 'cloud', char: '~', label: 'くも', hint: '下からすり抜けられる足場（ジャンプ・3D）', emoji: '☁️', kid: false, solid: true, deadly: false, pickup: false },
  { id: 'coin', char: 'o', label: 'コイン', hint: '取ると 1 点', emoji: '🪙', kid: true, solid: false, deadly: false, pickup: true },
  { id: 'gem', char: '*', label: 'ほうせき', hint: '取ると 5 点', emoji: '💎', kid: false, solid: false, deadly: false, pickup: true },
  { id: 'heart', char: '+', label: 'ハート', hint: 'ライフが 1 ふえる', emoji: '❤️', kid: false, solid: false, deadly: false, pickup: true },
  { id: 'enemy', char: 'E', label: 'てき', hint: '左右に動く。ジャンプモードでは上から踏むと倒せる', emoji: '👾', kid: true, solid: false, deadly: true, pickup: false },
  { id: 'spike', char: '^', label: 'トゲ', hint: '触れるとミス', emoji: '🔺', kid: false, solid: false, deadly: true, pickup: false },
  { id: 'water', char: 'w', label: 'みず', hint: '落ちるとミス', emoji: '🌊', kid: false, solid: false, deadly: true, pickup: false },
  { id: 'spring', char: 'S', label: 'ばね', hint: '大ジャンプできる（ジャンプモード）', emoji: '🔼', kid: false, solid: false, deadly: false, pickup: false },
  { id: 'key', char: 'k', label: 'かぎ', hint: 'ドアを 1 つ開けられる', emoji: '🔑', kid: false, solid: false, deadly: false, pickup: true },
  { id: 'door', char: 'D', label: 'ドア', hint: 'かぎがあると開く', emoji: '🚪', kid: false, solid: true, deadly: false, pickup: false },
  { id: 'portal', char: '@', label: 'ワープ', hint: '別のワープに移動する', emoji: '🌀', kid: false, solid: false, deadly: false, pickup: false },
  { id: 'flower', char: 'f', label: 'はな', hint: 'かざり（何もおこらない）', emoji: '🌸', kid: true, solid: false, deadly: false, pickup: false },
  { id: 'goal', char: 'G', label: 'ゴール', hint: 'ここに着くとクリア', emoji: '🚩', kid: true, solid: false, deadly: false, pickup: false },
  { id: 'start', char: 'P', label: 'スタート', hint: '主人公がはじめにいる場所', emoji: '🙂', kid: true, solid: false, deadly: false, pickup: false },
];

const byId = new Map<TileId, TileDef>(TILES.map((t) => [t.id, t]));
const byChar = new Map<string, TileDef>(TILES.map((t) => [t.char, t]));

export function tileDef(id: TileId): TileDef {
  const def = byId.get(id);
  if (!def) throw new Error(`unknown tile: ${id}`);
  return def;
}

export function tileFromChar(ch: string): TileId {
  return byChar.get(ch)?.id ?? 'empty';
}

export function charFromTile(id: TileId): string {
  return tileDef(id).char;
}

export const KID_PALETTE: readonly TileId[] = ['ground', 'wall', 'coin', 'enemy', 'flower', 'goal', 'start', 'empty'];

export const PRO_PALETTE: readonly TileId[] = [
  'ground',
  'wall',
  'cloud',
  'coin',
  'gem',
  'heart',
  'enemy',
  'spike',
  'water',
  'spring',
  'key',
  'door',
  'portal',
  'flower',
  'goal',
  'start',
  'empty',
];
