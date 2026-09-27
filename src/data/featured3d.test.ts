import { describe, expect, it } from 'vitest';
import { findTiles, getTile } from '../engine/level';
import { stepHeight } from '../engine/tiles';
import type { GameData, TileId } from '../engine/types';
import { FLOOD_MAX, railChains } from '../engine3d/sim';
import { FEATURED_GAMES } from './featured';

/**
 * 3D マップが「ジャンプで届く範囲」でクリアできるかの簡易チェック。
 * 立てるマス（床・アイテム・段・くも）を頂点に、
 *  - となり、または立てないマスを最大 2 つとびこえて着地できる
 *  - 高さの差：のぼりは 1 まで（くもは 2.5 だが 1 の床から届く）、くだりは自由
 *  - のぼりながらのジャンプは、とびこえられる空白が 1 つまで
 * という条件で辺を張り、スタートからの到達可能性を見る。
 */
const STANDABLE: readonly TileId[] = ['ground', 'coin', 'gem', 'heart', 'key', 'goal', 'start', 'flower', 'spring', 'portal', 'cloud', 'enemy', 'hunter', 'rail', 'crumble', 'checkpoint', 'step2', 'step3', 'step4', 'step5'];

function heightOf(t: TileId): number {
  if (t === 'cloud') return 2.15; // 着地に必要な足の高さ
  return stepHeight(t) ?? 1;
}

function reachable(game: GameData): Set<string> {
  const hasKey = findTiles(game, 'key').length > 0;
  const standable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= game.width || y >= game.height) return false;
    const t = getTile(game, x, y);
    if (t === 'door') return hasKey;
    return STANDABLE.includes(t);
  };
  const blocks = (x: number, y: number): boolean => {
    const t = getTile(game, x, y);
    return t === 'wall' || (t === 'door' && !hasKey);
  };
  const h = (x: number, y: number): number => {
    const t = getTile(game, x, y);
    return t === 'door' ? 1 : heightOf(t);
  };
  const portals = findTiles(game, 'portal');
  const start = findTiles(game, 'start')[0];
  const seen = new Set<string>();
  const queue = [start];
  seen.add(`${start.x},${start.y}`);
  while (queue.length) {
    const cur = queue.shift()!;
    const hc = h(cur.x, cur.y);
    const push = (x: number, y: number, gap: number) => {
      const k = `${x},${y}`;
      if (seen.has(k) || !standable(x, y)) return;
      const rise = h(x, y) - hc;
      if (rise > 1.6) return; // ジャンプの高さを超える
      if (rise > 0.5 && gap > 1) return; // のぼりながら遠くへはとべない
      seen.add(k);
      queue.push({ x, y });
    };
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      for (let d = 1; d <= 3; d++) {
        const x = cur.x + dx * d;
        const y = cur.y + dy * d;
        if (blocks(x, y)) break;
        // 途中に自分より高い床があれば通れない
        if (d > 1 && standable(x, y) === false && h(x, y) > hc + 1.6) break;
        if (standable(x, y)) {
          push(x, y, d - 1);
          break;
        }
      }
    }
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) push(cur.x + dx, cur.y + dy, 0);
    if (getTile(game, cur.x, cur.y) === 'portal') for (const p of portals) push(p.x, p.y, 0);
  }
  return seen;
}

describe('featured 3D levels', () => {
  const levels = FEATURED_GAMES.filter((g) => g.rules.mode === '3d');

  it('there are many 3D samples with a variety of rules', () => {
    expect(levels.length).toBeGreaterThanOrEqual(20);
    expect(levels.some((g) => g.rules.win === 'survive')).toBe(true);
    expect(levels.some((g) => (g.rules.flood ?? 0) > 0)).toBe(true);
    expect(levels.filter((g) => findTiles(g, 'hunter').length > 0).length).toBeGreaterThanOrEqual(5);
    expect(levels.filter((g) => findTiles(g, 'rail').length > 0).length).toBeGreaterThanOrEqual(3);
    expect(levels.some((g) => findTiles(g, 'crumble').length > 0)).toBe(true);
    expect(levels.some((g) => findTiles(g, 'checkpoint').length > 0)).toBe(true);
  });

  it.each(levels.map((g) => [g.title, g] as const))('%s can be cleared', (_t, g) => {
    const seen = reachable(g);
    if (g.rules.win === 'coins' || g.rules.win === 'both') {
      for (const c of findTiles(g, 'coin')) expect(seen.has(`${c.x},${c.y}`), `coin at ${c.x},${c.y} unreachable`).toBe(true);
    }
    if (g.rules.win === 'goal' || g.rules.win === 'both') {
      const goal = findTiles(g, 'goal')[0];
      expect(seen.has(`${goal.x},${goal.y}`), 'goal unreachable').toBe(true);
    }
    // かぎが必要なら、かぎにも届くこと
    for (const k of findTiles(g, 'key')) expect(seen.has(`${k.x},${k.y}`), `key at ${k.x},${k.y} unreachable`).toBe(true);
    // みずが上がってくるなら、最後まで安全な高さの足場に届くこと
    if ((g.rules.flood ?? 0) > 0) {
      const safe = [...seen].some((k) => {
        const [x, y] = k.split(',').map(Number);
        return heightOf(getTile(g, x, y)) >= FLOOD_MAX + 0.4;
      });
      expect(safe, 'no reachable tile above the final water level').toBe(true);
    }
  });

  it.each(levels.filter((g) => findTiles(g, 'rail').length > 0).map((g) => [g.title, g] as const))('%s has rails that form rides of 2+ tiles', (_t, g) => {
    const chains = railChains(g);
    expect(chains.length).toBeGreaterThan(0);
    for (const c of chains) expect(c.cells.length).toBeGreaterThanOrEqual(2);
    // すべてのレールがどれかの乗り物に含まれる（枝分かれで取り残されていない）
    const total = chains.reduce((n, c) => n + c.cells.length, 0);
    expect(total).toBe(findTiles(g, 'rail').length);
  });
});
