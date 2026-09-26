import { describe, expect, it } from 'vitest';
import { createGame, defaultRules } from '../engine/level';
import type { GameData } from '../engine/types';
import { CLOUD_TOP, Sim3D } from './sim';

const still = { x: 0, z: 0 };
const right = { x: 1, z: 0 };

function world(rows: string[], rules: Partial<GameData['rules']> = {}): GameData {
  return createGame({ width: rows[0].length, height: rows.length, tiles: rows.join(''), rules: { ...defaultRules('3d'), ...rules } });
}

function run(sim: Sim3D, move: { x: number; z: number }, seconds: number, jump = false): void {
  const dt = 1 / 60;
  for (let t = 0; t < seconds && !sim.finished; t += dt) sim.step(dt, move, jump);
}

describe('Sim3D', () => {
  it('starts on the start tile standing on the floor', () => {
    const sim = new Sim3D(world(['P###G']));
    expect(sim.player.x).toBeCloseTo(0.5);
    expect(sim.player.y).toBe(1);
    expect(sim.player.onGround).toBe(true);
    expect(sim.tileAt(0, 0)).toBe('ground');
  });

  it('walks to the goal and wins', () => {
    const sim = new Sim3D(world(['P###G']));
    run(sim, right, 4);
    expect(sim.finished?.outcome).toBe('win');
  });

  it('is blocked by walls', () => {
    const sim = new Sim3D(world(['P#W#G']));
    run(sim, right, 3);
    expect(sim.finished).toBeNull();
    expect(sim.player.x).toBeLessThan(2);
  });

  it('falls into the void and loses a life', () => {
    const sim = new Sim3D(world(['P#..#G'], { lives: 2 }));
    // 穴に落ちるまで進む
    for (let i = 0; i < 600 && sim.lives === 2; i++) sim.step(1 / 60, right, false);
    expect(sim.lives).toBe(1);
    // スタートに戻る
    expect(sim.player.x).toBeCloseTo(0.5, 0);
    expect(sim.player.y).toBe(1);
  });

  it('jumps over a one-tile gap', () => {
    const sim = new Sim3D(world(['P##.##G'], { lives: 1, jump: 3 }));
    run(sim, right, 0.35);
    run(sim, right, 3, true);
    expect(sim.finished?.outcome).toBe('win');
  });

  it('collects coins and counts them', () => {
    const sim = new Sim3D(world(['Poo#G'], { win: 'coins' }));
    run(sim, right, 3);
    expect(sim.coins).toBe(2);
    expect(sim.finished?.outcome).toBe('win');
  });

  it('can jump onto a cloud platform', () => {
    const sim = new Sim3D(world(['P~#'], { jump: 3 }));
    run(sim, still, 0.1, true);
    let peak = 0;
    for (let i = 0; i < 90; i++) {
      sim.step(1 / 60, { x: 0.6, z: 0 }, false);
      peak = Math.max(peak, sim.player.y);
    }
    expect(peak).toBeGreaterThan(CLOUD_TOP - 0.4);
  });

  it('spring launches higher than a jump', () => {
    const a = new Sim3D(world(['P###'], { jump: 1 }));
    run(a, still, 0.05, true);
    let peakA = 0;
    for (let i = 0; i < 120; i++) {
      a.step(1 / 60, still, false);
      peakA = Math.max(peakA, a.player.y);
    }
    const b = new Sim3D(world(['PS##'], { jump: 1 }));
    run(b, right, 0.3);
    let peakB = 0;
    for (let i = 0; i < 120; i++) {
      b.step(1 / 60, still, false);
      peakB = Math.max(peakB, b.player.y);
    }
    expect(peakB).toBeGreaterThan(peakA);
  });

  it('keys open doors', () => {
    const sim = new Sim3D(world(['PkDG']));
    run(sim, right, 4);
    expect(sim.finished?.outcome).toBe('win');
  });

  it('water hurts', () => {
    const sim = new Sim3D(world(['Pw##'], { lives: 1 }));
    run(sim, right, 2);
    expect(sim.finished?.outcome).toBe('lose');
  });

  it('enemies hurt on contact and can be stomped', () => {
    const hit = new Sim3D(world(['P#E#'], { lives: 1, enemySpeed: 0 }));
    run(hit, right, 2);
    expect(hit.finished?.outcome).toBe('lose');

    const stomp = new Sim3D(world(['P#E#'], { lives: 3, enemySpeed: 0, jump: 3 }));
    run(stomp, right, 0.15);
    // ゆっくり前に進みながらジャンプして、敵の上に着地する
    run(stomp, { x: 0.3, z: 0 }, 1.2, true);
    expect(stomp.enemies[0].alive).toBe(false);
    expect(stomp.lives).toBe(3);
  });

  it('ignores a negative time step', () => {
    const sim = new Sim3D(world(['P###G']));
    sim.step(-0.2, still, false);
    expect(sim.player.y).toBe(1);
    expect(sim.player.vy).toBe(0);
    expect(sim.time).toBe(0);
  });

  it('time limit ends the game', () => {
    const sim = new Sim3D(world(['P###G'], { timeLimit: 1 }));
    run(sim, still, 2);
    expect(sim.finished?.outcome).toBe('lose');
  });
});
