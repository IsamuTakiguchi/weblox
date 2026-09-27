/**
 * 「つりの たび」（Fisch 風）の純粋ロジック。
 * さおを投げる → 待つ → 「！」が出たら、動くマーカーが緑のゾーンに入った瞬間にタップ。
 * レアな魚ほどゾーンが狭い。目標ポイントに届いたらクリア。
 */
export interface FishDef {
  id: string;
  name: string;
  emoji: string;
  points: number;
  /** 出やすさ（重み） */
  weight: number;
  /** 緑ゾーンの幅（0〜1） */
  zone: number;
}

export const FISHES: readonly FishDef[] = [
  { id: 'fish', name: 'さかな', emoji: '🐟', points: 1, weight: 40, zone: 0.34 },
  { id: 'tropical', name: 'ねったいぎょ', emoji: '🐠', points: 3, weight: 25, zone: 0.26 },
  { id: 'puffer', name: 'ふぐ', emoji: '🐡', points: 5, weight: 15, zone: 0.22 },
  { id: 'squid', name: 'いか', emoji: '🦑', points: 8, weight: 10, zone: 0.18 },
  { id: 'shark', name: 'サメ', emoji: '🦈', points: 15, weight: 6, zone: 0.14 },
  { id: 'whale', name: 'クジラ', emoji: '🐋', points: 30, weight: 3, zone: 0.1 },
  { id: 'boot', name: 'ながぐつ', emoji: '🥾', points: 0, weight: 8, zone: 0.4 },
];

export type FishingPhase = 'idle' | 'waiting' | 'bite' | 'caught' | 'missed';

export interface FishingState {
  phase: FishingPhase;
  /** 今のフェーズに入ってからの秒数 */
  phaseTime: number;
  /** waiting 中：アタリまでの秒数 */
  biteAt: number;
  fish: FishDef | null;
  /** bite 中：マーカー位置 0〜1 */
  marker: number;
  /** bite 中：緑ゾーンの中心 */
  zoneCenter: number;
  score: number;
  caught: number;
  elapsed: number;
  finished: 'win' | 'lose' | null;
  lastEvent: 'cast' | 'bite' | 'catch' | 'miss' | 'win' | 'lose' | null;
}

export const FISHING_TARGET = 40;
const BITE_WINDOW = 3.5;
const MARKER_SPEED = 1.6;

export function createFishing(): FishingState {
  return { phase: 'idle', phaseTime: 0, biteAt: 0, fish: null, marker: 0, zoneCenter: 0.5, score: 0, caught: 0, elapsed: 0, finished: null, lastEvent: null };
}

export function pickFish(rng: () => number = Math.random): FishDef {
  const total = FISHES.reduce((a, f) => a + f.weight, 0);
  let r = rng() * total;
  for (const f of FISHES) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return FISHES[0];
}

/** ボタン（画面）をタップ */
export function tap(s: FishingState, rng: () => number = Math.random): FishingState {
  if (s.finished) return s;
  switch (s.phase) {
    case 'idle':
    case 'caught':
    case 'missed':
      return { ...s, phase: 'waiting', phaseTime: 0, biteAt: 1 + rng() * 2.5, fish: null, lastEvent: 'cast' };
    case 'waiting':
      // 早すぎ：もう一度投げ直し
      return { ...s, phase: 'idle', phaseTime: 0, lastEvent: null };
    case 'bite': {
      const f = s.fish!;
      const inZone = Math.abs(s.marker - s.zoneCenter) <= f.zone / 2;
      if (inZone) {
        const score = s.score + f.points;
        const win = score >= FISHING_TARGET;
        return { ...s, phase: 'caught', phaseTime: 0, score, caught: s.caught + 1, finished: win ? 'win' : null, lastEvent: win ? 'win' : 'catch' };
      }
      return { ...s, phase: 'missed', phaseTime: 0, lastEvent: 'miss' };
    }
  }
}

export function tick(s: FishingState, dt: number, timeLimit: number, rng: () => number = Math.random): FishingState {
  if (s.finished) return s;
  const elapsed = s.elapsed + dt;
  let next: FishingState = { ...s, elapsed, phaseTime: s.phaseTime + dt, lastEvent: null };
  if (timeLimit > 0 && elapsed >= timeLimit) {
    const finished = s.score >= FISHING_TARGET ? 'win' : 'lose';
    return { ...next, finished, lastEvent: finished };
  }
  if (next.phase === 'waiting' && next.phaseTime >= next.biteAt) {
    next = { ...next, phase: 'bite', phaseTime: 0, fish: pickFish(rng), marker: 0, zoneCenter: 0.3 + rng() * 0.4, lastEvent: 'bite' };
  } else if (next.phase === 'bite') {
    // マーカーは 0→1→0 を往復
    const t = next.phaseTime * MARKER_SPEED;
    const tri = t % 2;
    next.marker = tri <= 1 ? tri : 2 - tri;
    if (next.phaseTime >= BITE_WINDOW) next = { ...next, phase: 'missed', phaseTime: 0, lastEvent: 'miss' };
  } else if ((next.phase === 'caught' || next.phase === 'missed') && next.phaseTime >= 1.4) {
    next = { ...next, phase: 'idle', phaseTime: 0 };
  }
  return next;
}
