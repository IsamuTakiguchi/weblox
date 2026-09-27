/**
 * 「はたけを そだてよう」（Grow a Garden 風）の純粋ロジック。
 * タネを買って畑に植え、育ったら収穫して売る。目標のお金に届いたらクリア。
 */
export interface SeedDef {
  id: string;
  name: string;
  emoji: string;
  /** 買値 */
  cost: number;
  /** 売値 */
  sell: number;
  /** 育つまでの秒数 */
  grow: number;
}

export const SEEDS: readonly SeedDef[] = [
  { id: 'carrot', name: 'にんじん', emoji: '🥕', cost: 2, sell: 5, grow: 6 },
  { id: 'strawberry', name: 'いちご', emoji: '🍓', cost: 5, sell: 14, grow: 10 },
  { id: 'corn', name: 'とうもろこし', emoji: '🌽', cost: 12, sell: 36, grow: 16 },
  { id: 'pumpkin', name: 'かぼちゃ', emoji: '🎃', cost: 30, sell: 100, grow: 26 },
  { id: 'rainbow', name: 'にじいろの花', emoji: '🌻', cost: 80, sell: 300, grow: 40 },
];

export interface Plot {
  seed: SeedDef | null;
  /** 植えてからの経過秒 */
  age: number;
  /** みずやり済み（成長 1.5 倍） */
  watered: boolean;
}

export interface GardenState {
  money: number;
  plots: Plot[];
  selected: string;
  harvested: number;
  elapsed: number;
  finished: 'win' | 'lose' | null;
  /** 直近の出来事（効果音やメッセージ用） */
  lastEvent: 'plant' | 'water' | 'harvest' | 'nomoney' | 'win' | 'lose' | null;
}

export const GARDEN_PLOTS = 12;
export const GARDEN_START_MONEY = 10;
export const GARDEN_TARGET = 500;

export function createGarden(): GardenState {
  return {
    money: GARDEN_START_MONEY,
    plots: Array.from({ length: GARDEN_PLOTS }, () => ({ seed: null, age: 0, watered: false })),
    selected: 'carrot',
    harvested: 0,
    elapsed: 0,
    finished: null,
    lastEvent: null,
  };
}

/** 成長度 0〜1 */
export function progress(p: Plot): number {
  if (!p.seed) return 0;
  const speed = p.watered ? 1.5 : 1;
  return Math.min(1, (p.age * speed) / p.seed.grow);
}

/** 見た目の段階 */
export function stageEmoji(p: Plot): string {
  if (!p.seed) return '';
  const pr = progress(p);
  if (pr >= 1) return p.seed.emoji;
  if (pr >= 0.5) return '🌿';
  return '🌱';
}

export function tick(s: GardenState, dt: number, timeLimit: number): GardenState {
  if (s.finished) return s;
  const elapsed = s.elapsed + dt;
  const plots = s.plots.map((p) => (p.seed && progress(p) < 1 ? { ...p, age: p.age + dt } : p));
  let finished: GardenState['finished'] = null;
  let lastEvent: GardenState['lastEvent'] = s.lastEvent;
  if (timeLimit > 0 && elapsed >= timeLimit) {
    finished = s.money >= GARDEN_TARGET ? 'win' : 'lose';
    lastEvent = finished;
  }
  return { ...s, elapsed, plots, finished, lastEvent };
}

export function selectSeed(s: GardenState, id: string): GardenState {
  return { ...s, selected: id };
}

/** 畑をタップしたときの動作：空なら植える、育っていれば収穫、育ち中ならみずやり */
export function tapPlot(s: GardenState, index: number): GardenState {
  if (s.finished) return s;
  const p = s.plots[index];
  if (!p) return s;
  if (!p.seed) {
    const seed = SEEDS.find((x) => x.id === s.selected) ?? SEEDS[0];
    if (s.money < seed.cost) return { ...s, lastEvent: 'nomoney' };
    const plots = s.plots.slice();
    plots[index] = { seed, age: 0, watered: false };
    return { ...s, money: s.money - seed.cost, plots, lastEvent: 'plant' };
  }
  if (progress(p) >= 1) {
    const plots = s.plots.slice();
    plots[index] = { seed: null, age: 0, watered: false };
    const money = s.money + p.seed.sell;
    const win = money >= GARDEN_TARGET;
    return { ...s, money, plots, harvested: s.harvested + 1, finished: win ? 'win' : s.finished, lastEvent: win ? 'win' : 'harvest' };
  }
  if (!p.watered) {
    const plots = s.plots.slice();
    plots[index] = { ...p, watered: true };
    return { ...s, plots, lastEvent: 'water' };
  }
  return { ...s, lastEvent: null };
}
