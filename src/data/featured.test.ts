import { describe, expect, it } from 'vitest';
import { validateGame } from '../engine/level';
import { FEATURED_GAMES } from './featured';

describe('featured games', () => {
  it('has at least 4 sample games with unique ids', () => {
    expect(FEATURED_GAMES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(FEATURED_GAMES.map((g) => g.id)).size).toBe(FEATURED_GAMES.length);
  });

  it.each(FEATURED_GAMES.map((g) => [g.title, g] as const))('%s is valid', (_title, g) => {
    expect(g.tiles).toHaveLength(g.width * g.height);
    expect(g.featured).toBe(true);
    expect(validateGame(g).filter((i) => i.level === 'error')).toEqual([]);
  });
});
