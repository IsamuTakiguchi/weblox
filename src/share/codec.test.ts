import { describe, expect, it } from 'vitest';
import { createGame, defaultRules } from '../engine/level';
import { decodeGame, encodeGame, exportJson, importJson, shareUrl } from './codec';

describe('share codec', () => {
  const game = createGame({
    id: 'g_test',
    title: 'テスト ゲーム',
    description: 'せつめい',
    author: 'たろう',
    authorAvatar: '😺',
    theme: 'space',
    hero: '🤖',
    width: 5,
    height: 2,
    tiles: 'P.o.G#####',
    rules: { ...defaultRules('platformer'), speed: 4, timeLimit: 30, win: 'both' },
    kidMode: true,
  });

  it('round-trips through a URL-safe string', () => {
    const code = encodeGame(game);
    expect(code).toMatch(/^[A-Za-z0-9+\-$]+$/);
    const back = decodeGame(code);
    expect(back).not.toBeNull();
    expect(back!.id).toBe('g_test');
    expect(back!.title).toBe('テスト ゲーム');
    expect(back!.tiles).toBe('P.o.G#####');
    expect(back!.rules).toEqual(game.rules);
    expect(back!.theme).toBe('space');
    expect(back!.hero).toBe('🤖');
    expect(back!.kidMode).toBe(true);
  });

  it('rejects garbage', () => {
    expect(decodeGame('not-a-real-code')).toBeNull();
    expect(decodeGame('')).toBeNull();
  });

  it('rejects tiles that do not match the size', () => {
    const code = encodeGame({ ...game, tiles: 'PG' });
    expect(decodeGame(code)).toBeNull();
  });

  it('clamps out-of-range rules', () => {
    const code = encodeGame({ ...game, rules: { ...game.rules, speed: 99, lives: -5 } });
    const back = decodeGame(code)!;
    expect(back.rules.speed).toBe(5);
    expect(back.rules.lives).toBe(1);
  });

  it('keeps the survive rule, flood setting and new tiles', () => {
    const g = createGame({
      width: 6,
      height: 1,
      tiles: 'PH=cC5',
      rules: { ...defaultRules('3d'), win: 'survive', timeLimit: 45, flood: 30 },
    });
    const back = decodeGame(encodeGame(g))!;
    expect(back.tiles).toBe('PH=cC5');
    expect(back.rules.win).toBe('survive');
    expect(back.rules.flood).toBe(30);
    expect(back.rules.mode).toBe('3d');
  });

  it('treats a link without the flood field as no flood', () => {
    const code = encodeGame(game);
    const back = decodeGame(code)!;
    expect(back.rules.flood).toBe(0);
  });

  it('builds a hash-routed share url', () => {
    const url = shareUrl(game, 'https://example.com/weblox/');
    expect(url.startsWith('https://example.com/weblox/#/play/s/')).toBe(true);
    const code = url.split('#/play/s/')[1];
    expect(decodeGame(code)?.id).toBe('g_test');
  });

  it('exports and imports JSON', () => {
    const json = exportJson(game);
    const back = importJson(json);
    expect(back?.tiles).toBe(game.tiles);
    expect(back?.rules.win).toBe('both');
    expect(importJson('{"nope":true}')).toBeNull();
    expect(importJson('not json')).toBeNull();
  });
});
