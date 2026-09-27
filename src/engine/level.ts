import { charFromTile, tileFromChar } from './tiles';
import type { GameData, GameRules, TileId } from './types';

export const KID_WIDTH = 12;
export const KID_HEIGHT = 8;

export const GRID_SIZES: readonly { label: string; width: number; height: number }[] = [
  { label: 'ちいさい 12×8', width: 12, height: 8 },
  { label: 'ふつう 16×10', width: 16, height: 10 },
  { label: 'おおきい 24×12', width: 24, height: 12 },
  { label: 'とくだい 32×16', width: 32, height: 16 },
  { label: 'パーク 40×20', width: 40, height: 20 },
];

/** てきに使える絵文字（スタジオで選べる） */
export const ENEMY_EMOJIS: readonly string[] = ['👾', '👻', '🦖', '🦇', '🐊', '🐍', '🦈', '🐝', '🤖', '😈', '🐺', '🎃'];

export function newId(prefix = 'g'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function defaultRules(mode: GameRules['mode'] = 'topdown'): GameRules {
  return { mode, speed: 3, jump: 3, lives: 3, timeLimit: 0, win: 'goal', enemySpeed: 2 };
}

export function emptyTiles(width: number, height: number): string {
  return '.'.repeat(width * height);
}

export function createGame(partial: Partial<GameData> = {}): GameData {
  const now = Date.now();
  const width = partial.width ?? KID_WIDTH;
  const height = partial.height ?? KID_HEIGHT;
  return {
    id: partial.id ?? newId(),
    version: 1,
    title: partial.title ?? '',
    description: partial.description ?? '',
    author: partial.author ?? '',
    authorAvatar: partial.authorAvatar ?? '🙂',
    theme: partial.theme ?? 'meadow',
    hero: partial.hero ?? '🙂',
    enemyEmoji: partial.enemyEmoji,
    width,
    height,
    tiles: partial.tiles ?? emptyTiles(width, height),
    rules: partial.rules ?? defaultRules(),
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    kidMode: partial.kidMode ?? true,
  };
}

export function getTile(game: Pick<GameData, 'width' | 'height' | 'tiles'>, x: number, y: number): TileId {
  if (x < 0 || y < 0 || x >= game.width || y >= game.height) return 'empty';
  return tileFromChar(game.tiles.charAt(y * game.width + x));
}

export function setTile(tiles: string, width: number, x: number, y: number, tile: TileId): string {
  const i = y * width + x;
  return tiles.slice(0, i) + charFromTile(tile) + tiles.slice(i + 1);
}

/** 同じ種類のマスをすべて別の種類に置き換える */
export function replaceAll(tiles: string, from: TileId, to: TileId): string {
  const f = charFromTile(from);
  const t = charFromTile(to);
  return tiles.split(f).join(t);
}

export function countTile(game: Pick<GameData, 'tiles'>, tile: TileId): number {
  const ch = charFromTile(tile);
  let n = 0;
  for (const c of game.tiles) if (c === ch) n++;
  return n;
}

export function findTiles(game: Pick<GameData, 'width' | 'height' | 'tiles'>, tile: TileId): { x: number; y: number }[] {
  const ch = charFromTile(tile);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < game.tiles.length; i++) {
    if (game.tiles.charAt(i) === ch) out.push({ x: i % game.width, y: Math.floor(i / game.width) });
  }
  return out;
}

/** グリッドサイズを変える（左上を基準に切り出し／空白で埋める） */
export function resizeTiles(tiles: string, oldW: number, oldH: number, newW: number, newH: number): string {
  let out = '';
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      out += x < oldW && y < oldH ? tiles.charAt(y * oldW + x) || '.' : '.';
    }
  }
  return out;
}

export interface ValidationIssue {
  level: 'error' | 'warn';
  message: string;
  /** こども向けの短い言い方 */
  kidMessage: string;
}

export function validateGame(game: GameData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // マップを使わないミニゲームはチェックなし
  if (game.rules.mode === 'garden' || game.rules.mode === 'fishing') return issues;
  const starts = countTile(game, 'start');
  const goals = countTile(game, 'goal');
  const coins = countTile(game, 'coin');
  if (starts === 0) {
    issues.push({ level: 'error', message: 'スタート位置がありません', kidMessage: 'スタートをおいてね 🙂' });
  } else if (starts > 1) {
    issues.push({ level: 'error', message: 'スタート位置は 1 つだけにしてください', kidMessage: 'スタートは1つだけだよ' });
  }
  if ((game.rules.win === 'goal' || game.rules.win === 'both') && goals === 0) {
    issues.push({ level: 'error', message: 'ゴールがありません', kidMessage: 'ゴールをおいてね 🚩' });
  }
  if ((game.rules.win === 'coins' || game.rules.win === 'both') && coins === 0) {
    issues.push({ level: 'error', message: 'コインを集めるルールなのにコインがありません', kidMessage: 'コインをおいてね 🪙' });
  }
  if (game.tiles.length !== game.width * game.height) {
    issues.push({ level: 'error', message: 'マップのサイズが正しくありません', kidMessage: 'マップがこわれているよ' });
  }
  if (countTile(game, 'portal') === 1) {
    issues.push({ level: 'warn', message: 'ワープは 2 つ以上ないと使えません', kidMessage: 'ワープは2ついるよ' });
  }
  if (countTile(game, 'door') > 0 && countTile(game, 'key') === 0) {
    issues.push({ level: 'warn', message: 'ドアがあるのにかぎがありません', kidMessage: 'かぎをおいてね 🔑' });
  }
  return issues;
}

/**
 * こども向け：足りないものを自動で補って遊べる状態にする。
 * - スタートがなければ空いているマスに置く
 * - ゴールがなければ、コインがあれば「コインぜんぶ」ルールに、なければ右下付近にゴールを置く
 */
export function autoFix(game: GameData): GameData {
  let tiles = game.tiles;
  let rules = { ...game.rules };
  const { width, height } = game;

  const firstEmpty = (fromEnd: boolean): { x: number; y: number } | null => {
    const order = [...Array(width * height).keys()];
    if (fromEnd) order.reverse();
    // 3D モードは空マス = 奈落なので、床（ground）の上に置く
    const placeable: TileId = rules.mode === '3d' ? 'ground' : 'empty';
    for (const i of order) {
      const x = i % width;
      const y = Math.floor(i / width);
      if (tileFromChar(tiles.charAt(i)) !== placeable) continue;
      // ジャンプモードなら足元に床があるマスを優先
      if (rules.mode === 'platformer') {
        const below = y + 1 < height ? tileFromChar(tiles.charAt((y + 1) * width + x)) : 'empty';
        if (below !== 'ground' && below !== 'wall' && below !== 'cloud') continue;
      }
      return { x, y };
    }
    // 見つからなければ条件をゆるめる
    for (const i of order) {
      const t = tileFromChar(tiles.charAt(i));
      if (t === 'empty' || t === 'ground') return { x: i % width, y: Math.floor(i / width) };
    }
    return null;
  };

  const starts = countTile({ tiles }, 'start');
  if (starts === 0) {
    const p = firstEmpty(false);
    if (p) tiles = setTile(tiles, width, p.x, p.y, 'start');
  } else if (starts > 1) {
    // 最初の 1 つだけ残す
    let seen = false;
    let out = '';
    for (const c of tiles) {
      if (c === charFromTile('start')) {
        out += seen ? '.' : c;
        seen = true;
      } else out += c;
    }
    tiles = out;
  }

  const goals = countTile({ tiles }, 'goal');
  const coins = countTile({ tiles }, 'coin');
  if (goals === 0) {
    if (coins > 0) rules.win = 'coins';
    else {
      const p = firstEmpty(true);
      if (p) tiles = setTile(tiles, width, p.x, p.y, 'goal');
      rules.win = 'goal';
    }
  } else if (rules.win === 'coins' && coins === 0) {
    rules.win = 'goal';
  }

  return { ...game, tiles, rules, updatedAt: Date.now() };
}

/** 3D モード用に、空のマスをすべて床で埋める（空 = 奈落なので） */
export function fillAll(tiles: string, tile: TileId = 'ground'): string {
  return tiles.split('.').join(charFromTile(tile));
}

/** ジャンプモード用に、いちばん下の行を床で埋める */
export function fillFloor(tiles: string, width: number, height: number): string {
  let out = tiles.slice(0, width * (height - 1));
  for (let x = 0; x < width; x++) {
    const ch = tiles.charAt(width * (height - 1) + x);
    out += tileFromChar(ch) === 'empty' ? charFromTile('ground') : ch;
  }
  return out;
}

/** おまかせ生成（こども向け） */
export function randomLevel(width: number, height: number, mode: GameRules['mode'], rng: () => number = Math.random): string {
  let tiles = emptyTiles(width, height);
  const put = (x: number, y: number, t: TileId) => {
    tiles = setTile(tiles, width, x, y, t);
  };
  const at = (x: number, y: number) => getTile({ width, height, tiles }, x, y);
  const pick = (n: number) => Math.floor(rng() * n);

  if (mode === '3d') {
    // 全面床から始めて、穴・壁・浮き足場を配置するオビー風
    tiles = fillAll(tiles, 'ground');
    const isCorner = (x: number, y: number) => (x <= 2 && y <= 2) || (x >= width - 3 && y >= height - 3);
    const holes = Math.floor(width * height * 0.12);
    for (let i = 0; i < holes; i++) {
      const x = pick(width);
      const y = pick(height);
      if (isCorner(x, y)) continue;
      put(x, y, 'empty');
    }
    const walls = Math.floor(width * height * 0.06);
    for (let i = 0; i < walls; i++) {
      const x = pick(width);
      const y = pick(height);
      if (isCorner(x, y)) continue;
      put(x, y, 'wall');
    }
    for (let i = 0; i < 3; i++) {
      const x = 2 + pick(Math.max(1, width - 4));
      const y = 1 + pick(Math.max(1, height - 2));
      if (!isCorner(x, y)) put(x, y, 'cloud');
    }
    for (let i = 0; i < 7; i++) {
      const x = pick(width);
      const y = pick(height);
      if (at(x, y) === 'ground') put(x, y, 'coin');
    }
    for (let i = 0; i < 2; i++) {
      const x = 3 + pick(Math.max(1, width - 6));
      const y = 1 + pick(Math.max(1, height - 2));
      if (at(x, y) === 'ground') put(x, y, 'enemy');
    }
    for (let i = 0; i < 3; i++) {
      const x = pick(width);
      const y = pick(height);
      if (at(x, y) === 'ground') put(x, y, 'flower');
    }
    put(1, 1, 'start');
    put(width - 2, height - 2, 'goal');
  } else if (mode === 'platformer') {
    tiles = fillFloor(tiles, width, height);
    // 浮いている足場をいくつか
    const platforms = 2 + pick(3);
    for (let i = 0; i < platforms; i++) {
      const len = 2 + pick(3);
      const x0 = 1 + pick(Math.max(1, width - len - 2));
      const y = 2 + pick(Math.max(1, height - 5));
      for (let x = x0; x < x0 + len; x++) put(x, y, 'ground');
      if (rng() < 0.7) put(x0 + pick(len), y - 1, 'coin');
    }
    // 穴を 1〜2 個
    const holes = 1 + pick(2);
    for (let i = 0; i < holes; i++) {
      const x = 3 + pick(Math.max(1, width - 6));
      put(x, height - 1, 'water');
    }
    put(1, height - 2, 'start');
    put(width - 2, height - 2, 'goal');
    const enemies = 1 + pick(2);
    for (let i = 0; i < enemies; i++) {
      const x = 4 + pick(Math.max(1, width - 8));
      if (at(x, height - 2) === 'empty' && at(x, height - 1) === 'ground') put(x, height - 2, 'enemy');
    }
    for (let i = 0; i < 4; i++) {
      const x = pick(width);
      const y = pick(height - 1);
      if (at(x, y) === 'empty') put(x, y, 'coin');
    }
  } else {
    // 外周をかべに
    for (let x = 0; x < width; x++) {
      put(x, 0, 'wall');
      put(x, height - 1, 'wall');
    }
    for (let y = 0; y < height; y++) {
      put(0, y, 'wall');
      put(width - 1, y, 'wall');
    }
    // 中にかべをばらまく
    const walls = Math.floor(width * height * 0.12);
    for (let i = 0; i < walls; i++) {
      const x = 1 + pick(width - 2);
      const y = 1 + pick(height - 2);
      if ((x <= 2 && y <= 2) || (x >= width - 3 && y >= height - 3)) continue;
      put(x, y, 'wall');
    }
    put(1, 1, 'start');
    put(width - 2, height - 2, 'goal');
    for (let i = 0; i < 6; i++) {
      const x = 1 + pick(width - 2);
      const y = 1 + pick(height - 2);
      if (at(x, y) === 'empty') put(x, y, 'coin');
    }
    for (let i = 0; i < 2; i++) {
      const x = 3 + pick(Math.max(1, width - 6));
      const y = 2 + pick(Math.max(1, height - 4));
      if (at(x, y) === 'empty') put(x, y, 'enemy');
    }
    for (let i = 0; i < 3; i++) {
      const x = 1 + pick(width - 2);
      const y = 1 + pick(height - 2);
      if (at(x, y) === 'empty') put(x, y, 'flower');
    }
  }
  return tiles;
}
