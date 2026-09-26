import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from './router';

describe('router', () => {
  it('parses routes', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
    expect(parseHash('#/games')).toEqual({ name: 'discover' });
    expect(parseHash('#/play/abc')).toEqual({ name: 'play', id: 'abc' });
    expect(parseHash('#/game/abc')).toEqual({ name: 'game', id: 'abc' });
    expect(parseHash('#/play/s/XYZ')).toEqual({ name: 'shared', code: 'XYZ' });
    expect(parseHash('#/play/s/XYZ/go')).toEqual({ name: 'shared', code: 'XYZ', play: true });
    expect(parseHash('#/kid')).toEqual({ name: 'kid', id: undefined });
    expect(parseHash('#/kid/g1')).toEqual({ name: 'kid', id: 'g1' });
    expect(parseHash('#/studio/g2')).toEqual({ name: 'studio', id: 'g2' });
    expect(parseHash('#/avatar')).toEqual({ name: 'avatar' });
    expect(parseHash('#/me')).toEqual({ name: 'me' });
    expect(parseHash('#/help')).toEqual({ name: 'help' });
    expect(parseHash('#/unknown/thing')).toEqual({ name: 'home' });
  });

  it('round-trips hrefs', () => {
    const routes = [
      { name: 'home' },
      { name: 'discover' },
      { name: 'play', id: 'g_1' },
      { name: 'game', id: 'g_1' },
      { name: 'shared', code: 'abc', play: true },
      { name: 'kid', id: 'g_2' },
      { name: 'studio' },
      { name: 'avatar' },
      { name: 'me' },
      { name: 'help' },
    ] as const;
    for (const r of routes) expect(parseHash(hrefFor(r))).toEqual({ ...r });
  });
});
