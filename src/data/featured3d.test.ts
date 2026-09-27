import { describe, expect, it } from 'vitest';
import { findTiles, getTile } from '../engine/level';
import type { GameData, TileId } from '../engine/types';
import { FEATURED_GAMES } from './featured';

/**
 * 3D マップが「ジャンプで届く範囲」でクリアできるかの簡易チェック。
 * 立てるマス（床・アイテム）を頂点に、隣接か、立てないマスを最大 2 つ
 * とびこえて着地できる場合に辺を張り、スタートからの到達可能性を見る。
 */
const STANDABLE: readonly TileId[] = ['ground', 'coin', 'gem', 'heart', 'key', 'goal', 'start', 'flower', 'spring', 'portal', 'cloud', 'enemy', 'step2', 'step3', 'step4', 'step5'];

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
  const portals = findTiles(game, 'portal');
  const start = findTiles(game, 'start')[0];
  const seen = new Set<string>();
  const queue = [start];
  seen.add(`${start.x},${start.y}`);
  while (queue.length) {
    const cur = queue.shift()!;
    const push = (x: number, y: number) => {
      const k = `${x},${y}`;
      if (!seen.has(k) && standable(x, y)) {
        seen.add(k);
        queue.push({ x, y });
      }
    };
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      // 隣接、または最大 2 マスの空白をとびこえる（間に壁があれば不可）
      for (let d = 1; d <= 3; d++) {
        const x = cur.x + dx * d;
        const y = cur.y + dy * d;
        if (blocks(x, y)) break;
        if (standable(x, y)) {
          push(x, y);
          break;
        }
      }
    }
    // ななめ隣も歩いて行ける
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) push(cur.x + dx, cur.y + dy);
    if (getTile(game, cur.x, cur.y) === 'portal') for (const p of portals) push(p.x, p.y);
  }
  return seen;
}

describe('featured 3D levels', () => {
  const levels = FEATURED_GAMES.filter((g) => g.rules.mode === '3d');

  it('there are several 3D samples', () => {
    expect(levels.length).toBeGreaterThanOrEqual(4);
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
  });
});
