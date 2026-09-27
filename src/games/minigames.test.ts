import { describe, expect, it } from 'vitest';
import { createFishing, FISHES, FISHING_TARGET, pickFish, tap as fishTap, tick as fishTick } from './fishing';
import { createGarden, GARDEN_START_MONEY, GARDEN_TARGET, progress, SEEDS, selectSeed, tapPlot, tick as gardenTick } from './garden';

describe('garden', () => {
  it('plants, grows, waters and harvests', () => {
    let s = createGarden();
    expect(s.money).toBe(GARDEN_START_MONEY);
    s = tapPlot(s, 0);
    expect(s.plots[0].seed?.id).toBe('carrot');
    expect(s.money).toBe(GARDEN_START_MONEY - 2);
    expect(s.lastEvent).toBe('plant');
    s = gardenTick(s, 3, 0);
    expect(progress(s.plots[0])).toBeCloseTo(0.5);
    s = tapPlot(s, 0); // みずやり
    expect(s.plots[0].watered).toBe(true);
    s = gardenTick(s, 1.5, 0); // 4.5 秒 × 1.5 = 6.75 ≥ 6
    expect(progress(s.plots[0])).toBe(1);
    s = tapPlot(s, 0); // 収穫
    expect(s.plots[0].seed).toBeNull();
    expect(s.money).toBe(GARDEN_START_MONEY - 2 + 5);
    expect(s.harvested).toBe(1);
  });

  it('refuses planting without money', () => {
    let s = selectSeed(createGarden(), 'rainbow');
    s = tapPlot(s, 3);
    expect(s.plots[3].seed).toBeNull();
    expect(s.lastEvent).toBe('nomoney');
  });

  it('wins when reaching the target', () => {
    let s = { ...createGarden(), money: GARDEN_TARGET - 1 };
    s = tapPlot(s, 0);
    s = gardenTick(s, 100, 0);
    s = tapPlot(s, 0);
    expect(s.finished).toBe('win');
  });

  it('loses when time runs out below target', () => {
    const s = gardenTick(createGarden(), 61, 60);
    expect(s.finished).toBe('lose');
  });

  it('seeds get more valuable', () => {
    for (let i = 1; i < SEEDS.length; i++) expect(SEEDS[i].sell - SEEDS[i].cost).toBeGreaterThan(SEEDS[i - 1].sell - SEEDS[i - 1].cost);
  });
});

describe('fishing', () => {
  const always = (v: number) => () => v;

  it('casts, waits, bites and catches in the zone', () => {
    let s = fishTap(createFishing(), always(0)); // biteAt = 1
    expect(s.phase).toBe('waiting');
    s = fishTick(s, 1.1, 0, always(0.5));
    expect(s.phase).toBe('bite');
    expect(s.fish).not.toBeNull();
    // マーカーをゾーン中心まで進める
    for (let i = 0; i < 200 && Math.abs(s.marker - s.zoneCenter) > 0.02; i++) s = fishTick(s, 1 / 60, 0, always(0.5));
    s = fishTap(s);
    expect(s.phase).toBe('caught');
    expect(s.score).toBe(s.fish!.points);
  });

  it('misses outside the zone', () => {
    let s = fishTap(createFishing(), always(0));
    s = fishTick(s, 1.01, 0, always(0.5)); // marker ≈ 0, zone center 0.5
    s = fishTap(s);
    expect(s.phase).toBe('missed');
    expect(s.score).toBe(0);
  });

  it('pickFish respects weights and never returns nothing', () => {
    expect(pickFish(always(0)).id).toBe(FISHES[0].id);
    expect(pickFish(always(0.999)).id).toBe(FISHES[FISHES.length - 1].id);
  });

  it('wins at target and loses on timeout', () => {
    const win = fishTap({ ...createFishing(), phase: 'bite', fish: FISHES[5], marker: 0.5, zoneCenter: 0.5, score: FISHING_TARGET - 1 });
    expect(win.finished).toBe('win');
    const lose = fishTick(createFishing(), 91, 90);
    expect(lose.finished).toBe('lose');
  });
});
