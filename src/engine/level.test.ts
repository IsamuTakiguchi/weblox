import { describe, expect, it } from 'vitest';
import { autoFix, countTile, createGame, fillFloor, findTiles, getTile, randomLevel, replaceAll, resizeTiles, setTile, validateGame } from './level';

describe('level helpers', () => {
  it('creates an empty game with the right tile count', () => {
    const g = createGame({ width: 6, height: 4 });
    expect(g.tiles).toHaveLength(24);
    expect(countTile(g, 'empty')).toBe(24);
  });

  it('sets and reads tiles', () => {
    const g = createGame({ width: 4, height: 3 });
    const tiles = setTile(g.tiles, 4, 2, 1, 'coin');
    expect(getTile({ ...g, tiles }, 2, 1)).toBe('coin');
    expect(getTile({ ...g, tiles }, 99, 99)).toBe('empty');
    expect(findTiles({ ...g, tiles }, 'coin')).toEqual([{ x: 2, y: 1 }]);
  });

  it('replaces all tiles of a kind', () => {
    const tiles = replaceAll('P..P', 'start', 'empty');
    expect(tiles).toBe('....');
  });

  it('resizes while keeping the top-left corner', () => {
    const tiles = 'abcdefgh'; // 4x2
    expect(resizeTiles(tiles, 4, 2, 2, 2)).toBe('abef');
    expect(resizeTiles(tiles, 4, 2, 5, 3)).toBe('abcd.efgh......');
  });

  it('fills empty cells of the bottom row with ground, keeping other tiles', () => {
    const t = fillFloor('....o...', 4, 2);
    expect(t).toBe('....o###');
  });

  it('validates missing start and goal', () => {
    const g = createGame({ width: 3, height: 3 });
    const issues = validateGame(g);
    expect(issues.map((i) => i.message)).toContain('スタート位置がありません');
    expect(issues.map((i) => i.message)).toContain('ゴールがありません');
  });

  it('autoFix adds a start and goal so the game becomes valid', () => {
    const g = createGame({ width: 5, height: 3 });
    const fixed = autoFix(g);
    expect(countTile(fixed, 'start')).toBe(1);
    expect(countTile(fixed, 'goal')).toBe(1);
    expect(validateGame(fixed).filter((i) => i.level === 'error')).toHaveLength(0);
  });

  it('autoFix switches to coin rule when there are coins but no goal', () => {
    const g = createGame({ width: 4, height: 2, tiles: 'P.o.o...' });
    const fixed = autoFix(g);
    expect(fixed.rules.win).toBe('coins');
    expect(countTile(fixed, 'goal')).toBe(0);
  });

  it('autoFix keeps only one start', () => {
    const g = createGame({ width: 4, height: 1, tiles: 'PP.G' });
    expect(countTile(autoFix(g), 'start')).toBe(1);
  });

  it('random levels are playable in both modes', () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (const mode of ['topdown', 'platformer'] as const) {
      const tiles = randomLevel(12, 8, mode, rng);
      const g = createGame({ width: 12, height: 8, tiles, rules: { ...createGame().rules, mode } });
      expect(tiles).toHaveLength(96);
      expect(validateGame(g).filter((i) => i.level === 'error')).toHaveLength(0);
    }
  });
});
