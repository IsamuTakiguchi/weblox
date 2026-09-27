import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { createGame, defaultRules } from '../engine/level';
import { THEMES } from '../engine/themes';
import type { GameData, GameMode, GameRules, ThemeId, WinCondition } from '../engine/types';

/** URL に埋め込む最小形式 */
interface Packed {
  v: 1;
  i: string;
  t: string;
  d: string;
  a: string;
  av: string;
  th: ThemeId;
  h: string;
  w: number;
  hh: number;
  m: string;
  /** [mode, speed, jump, lives, timeLimit, win, enemySpeed, flood?] */
  r: [GameMode, number, number, number, number, WinCondition, number, number?];
  k: 0 | 1;
  c: number;
  /** てきの絵文字（省略可） */
  ee?: string;
}

function pack(g: GameData): Packed {
  const r = g.rules;
  return {
    v: 1,
    i: g.id,
    t: g.title,
    d: g.description,
    a: g.author,
    av: g.authorAvatar,
    th: g.theme,
    h: g.hero,
    w: g.width,
    hh: g.height,
    m: g.tiles,
    r: [r.mode, r.speed, r.jump, r.lives, r.timeLimit, r.win, r.enemySpeed, r.flood ?? 0],
    k: g.kidMode ? 1 : 0,
    c: g.createdAt,
    ...(g.enemyEmoji ? { ee: g.enemyEmoji } : {}),
  };
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(lo, Math.min(hi, n));
};

function unpack(p: unknown): GameData | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Partial<Packed>;
  if (o.v !== 1 || typeof o.m !== 'string' || typeof o.w !== 'number' || typeof o.hh !== 'number') return null;
  const width = clampInt(o.w, 1, 64, 12);
  const height = clampInt(o.hh, 1, 40, 8);
  if (o.m.length !== width * height) return null;
  const theme: ThemeId = THEMES.some((t) => t.id === o.th) ? (o.th as ThemeId) : 'meadow';
  const rr = Array.isArray(o.r) ? o.r : [];
  const base = defaultRules();
  const mode: GameMode = rr[0] === 'platformer' || rr[0] === '3d' || rr[0] === 'garden' || rr[0] === 'fishing' ? rr[0] : 'topdown';
  const win: WinCondition = rr[5] === 'coins' || rr[5] === 'both' || rr[5] === 'survive' ? rr[5] : 'goal';
  const rules: GameRules = {
    mode,
    speed: clampInt(rr[1], 1, 5, base.speed),
    jump: clampInt(rr[2], 1, 5, base.jump),
    lives: clampInt(rr[3], 1, 9, base.lives),
    timeLimit: clampInt(rr[4], 0, 3600, base.timeLimit),
    win,
    enemySpeed: clampInt(rr[6], 0, 5, base.enemySpeed),
    flood: clampInt(rr[7], 0, 600, 0),
  };
  const str = (v: unknown, max: number, fb = ''): string => (typeof v === 'string' ? v.slice(0, max) : fb);
  return createGame({
    id: str(o.i, 64, undefined) || undefined,
    title: str(o.t, 60),
    description: str(o.d, 300),
    author: str(o.a, 30),
    authorAvatar: str(o.av, 8, '🙂'),
    theme,
    hero: str(o.h, 8, '🙂'),
    enemyEmoji: typeof o.ee === 'string' ? o.ee.slice(0, 8) : undefined,
    width,
    height,
    tiles: o.m,
    rules,
    kidMode: o.k === 1,
    createdAt: typeof o.c === 'number' ? o.c : Date.now(),
    updatedAt: Date.now(),
  });
}

export function encodeGame(game: GameData): string {
  return compressToEncodedURIComponent(JSON.stringify(pack(game)));
}

export function decodeGame(code: string): GameData | null {
  try {
    const json = decompressFromEncodedURIComponent(code);
    if (!json) return null;
    return unpack(JSON.parse(json));
  } catch {
    return null;
  }
}

/** 共有用 URL を作る。ハッシュルーティングなので GitHub Pages でもそのまま動く */
export function shareUrl(game: GameData, origin?: string): string {
  const base =
    origin ?? (typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '');
  return `${base}#/play/s/${encodeGame(game)}`;
}

/** JSON でのエクスポート／インポート */
export function exportJson(game: GameData): string {
  return JSON.stringify(game, null, 2);
}

export function importJson(text: string): GameData | null {
  try {
    const raw = JSON.parse(text) as Partial<GameData>;
    if (typeof raw.tiles !== 'string' || typeof raw.width !== 'number' || typeof raw.height !== 'number') return null;
    // 一度 pack/unpack を通してバリデーションする
    const g = createGame({ ...raw, rules: { ...defaultRules(), ...(raw.rules ?? {}) } });
    return unpack(pack(g));
  } catch {
    return null;
  }
}
