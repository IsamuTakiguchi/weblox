import { useSyncExternalStore } from 'react';
import { FEATURED_GAMES } from '../data/featured';
import type { GameData, PublishedGame } from '../engine/types';

export interface AvatarConfig {
  face: string;
  hat: string;
  color: string;
  /** 買ったぼうしなど */
  unlocked: string[];
}

export interface Profile {
  name: string;
  avatar: AvatarConfig;
  /** アプリ内通貨「ウェブックス」 */
  wbx: number;
  wins: number;
  plays: number;
}

export interface State {
  drafts: GameData[];
  published: PublishedGame[];
  profile: Profile;
  likes: string[];
  /** ゲームごとのベストスコア */
  best: Record<string, number>;
}

export const FACES: readonly string[] = ['😀', '😎', '🥳', '🤩', '😺', '🐶', '🐼', '🦊', '🐸', '🤖', '👻', '🦄'];
export const HATS: readonly { id: string; emoji: string; name: string; price: number }[] = [
  { id: 'none', emoji: '', name: 'なし', price: 0 },
  { id: 'cap', emoji: '🧢', name: 'キャップ', price: 0 },
  { id: 'party', emoji: '🎉', name: 'パーティ', price: 20 },
  { id: 'crown', emoji: '👑', name: 'おうかん', price: 50 },
  { id: 'tophat', emoji: '🎩', name: 'シルクハット', price: 40 },
  { id: 'wizard', emoji: '🧙', name: 'まほう', price: 60 },
  { id: 'star', emoji: '⭐', name: 'スター', price: 30 },
  { id: 'rainbow', emoji: '🌈', name: 'レインボー', price: 80 },
  { id: 'rocket', emoji: '🚀', name: 'ロケット', price: 100 },
];
export const COLORS: readonly string[] = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#64748b'];

export const REWARD_WIN = 10;
export const REWARD_PUBLISH = 50;
export const REWARD_FIRST_CREATE = 20;

const KEY = 'weblox.state.v1';

function defaultProfile(): Profile {
  return {
    name: 'ゲスト',
    avatar: { face: '😀', hat: 'cap', color: '#3b82f6', unlocked: ['none', 'cap'] },
    wbx: 100,
    wins: 0,
    plays: 0,
  };
}

function seedPublished(existing: PublishedGame[]): PublishedGame[] {
  const map = new Map(existing.map((g) => [g.id, g]));
  for (const f of FEATURED_GAMES) {
    const cur = map.get(f.id);
    // 同梱ゲームは本体を最新にしつつ、遊んだ回数などのローカル統計は引き継ぐ
    map.set(f.id, cur ? { ...f, plays: Math.max(cur.plays, f.plays), likes: Math.max(cur.likes, f.likes) } : f);
  }
  // 同梱ゲームを先頭に
  const featured = FEATURED_GAMES.map((f) => map.get(f.id)!);
  const others = [...map.values()].filter((g) => !g.featured);
  return [...featured, ...others];
}

function load(): State {
  let parsed: Partial<State> | null = null;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) parsed = JSON.parse(raw) as Partial<State>;
  } catch {
    parsed = null;
  }
  const profile = { ...defaultProfile(), ...(parsed?.profile ?? {}) };
  profile.avatar = { ...defaultProfile().avatar, ...(parsed?.profile?.avatar ?? {}) };
  return {
    drafts: Array.isArray(parsed?.drafts) ? parsed!.drafts! : [],
    published: seedPublished(Array.isArray(parsed?.published) ? parsed!.published! : []),
    profile,
    likes: Array.isArray(parsed?.likes) ? parsed!.likes! : [],
    best: parsed?.best && typeof parsed.best === 'object' ? parsed.best : {},
  };
}

let state: State = load();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 容量超過などは無視 */
  }
}

function set(next: State): void {
  state = next;
  persist();
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getState(): State {
  return state;
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

/* ---------- ゲーム ---------- */

export function saveDraft(game: GameData): void {
  const g = { ...game, updatedAt: Date.now() };
  const idx = state.drafts.findIndex((d) => d.id === g.id);
  const drafts = idx >= 0 ? state.drafts.map((d) => (d.id === g.id ? g : d)) : [g, ...state.drafts];
  let profile = state.profile;
  if (idx < 0 && state.drafts.length === 0) profile = { ...profile, wbx: profile.wbx + REWARD_FIRST_CREATE };
  set({ ...state, drafts, profile });
}

export function deleteDraft(id: string): void {
  set({ ...state, drafts: state.drafts.filter((d) => d.id !== id) });
}

export function getDraft(id: string): GameData | undefined {
  return state.drafts.find((d) => d.id === id);
}

export function getPublished(id: string): PublishedGame | undefined {
  return state.published.find((g) => g.id === id);
}

export function findGame(id: string): GameData | undefined {
  return getPublished(id) ?? getDraft(id);
}

/** 公開する。既に公開済みなら内容を更新（統計は保持） */
export function publishGame(game: GameData): PublishedGame {
  const prev = getPublished(game.id);
  const author = game.author || state.profile.name;
  const pub: PublishedGame = {
    ...game,
    author,
    authorAvatar: game.authorAvatar || state.profile.avatar.face,
    title: game.title.trim() || 'なまえのないゲーム',
    updatedAt: Date.now(),
    publishedAt: prev?.publishedAt ?? Date.now(),
    plays: prev?.plays ?? 0,
    likes: prev?.likes ?? 0,
  };
  const published = prev ? state.published.map((g) => (g.id === pub.id ? pub : g)) : [...state.published, pub];
  const profile = prev ? state.profile : { ...state.profile, wbx: state.profile.wbx + REWARD_PUBLISH };
  set({ ...state, published, profile });
  return pub;
}

export function unpublishGame(id: string): void {
  const g = getPublished(id);
  if (!g || g.featured) return;
  set({ ...state, published: state.published.filter((p) => p.id !== id) });
}

export function recordPlay(id: string): void {
  const published = state.published.map((g) => (g.id === id ? { ...g, plays: g.plays + 1 } : g));
  set({ ...state, published, profile: { ...state.profile, plays: state.profile.plays + 1 } });
}

export function recordWin(id: string, score: number): { reward: number; newBest: boolean } {
  const prevBest = state.best[id] ?? -1;
  const newBest = score > prevBest;
  const best = newBest ? { ...state.best, [id]: score } : state.best;
  set({ ...state, best, profile: { ...state.profile, wins: state.profile.wins + 1, wbx: state.profile.wbx + REWARD_WIN } });
  return { reward: REWARD_WIN, newBest };
}

export function toggleLike(id: string): void {
  const liked = state.likes.includes(id);
  const likes = liked ? state.likes.filter((l) => l !== id) : [...state.likes, id];
  const published = state.published.map((g) => (g.id === id ? { ...g, likes: Math.max(0, g.likes + (liked ? -1 : 1)) } : g));
  set({ ...state, likes, published });
}

/** 共有リンクから開いたゲームを自分のライブラリに保存 */
export function importToLibrary(game: GameData): GameData {
  const copy = { ...game, id: game.id, updatedAt: Date.now() };
  saveDraft(copy);
  return copy;
}

/* ---------- プロフィール ---------- */

export function updateProfile(patch: Partial<Profile>): void {
  set({ ...state, profile: { ...state.profile, ...patch } });
}

export function updateAvatar(patch: Partial<AvatarConfig>): void {
  set({ ...state, profile: { ...state.profile, avatar: { ...state.profile.avatar, ...patch } } });
}

export function buyHat(id: string): boolean {
  const hat = HATS.find((h) => h.id === id);
  if (!hat) return false;
  const av = state.profile.avatar;
  if (av.unlocked.includes(id)) {
    updateAvatar({ hat: id });
    return true;
  }
  if (state.profile.wbx < hat.price) return false;
  set({
    ...state,
    profile: { ...state.profile, wbx: state.profile.wbx - hat.price, avatar: { ...av, hat: id, unlocked: [...av.unlocked, id] } },
  });
  return true;
}

/** テスト用 */
export function resetStore(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  set(load());
}
