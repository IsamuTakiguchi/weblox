import { describe, expect, it } from 'vitest';
import { createGame, defaultRules } from '../engine/level';
import type { GameData } from '../engine/types';
import { CLOUD_TOP, CRUMBLE_DELAY, CRUMBLE_RESTORE, railChains, railHeight, Sim3D } from './sim';

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

  it('survive rule wins when the time runs out', () => {
    const sim = new Sim3D(world(['P###'], { timeLimit: 1, win: 'survive' }));
    run(sim, still, 2);
    expect(sim.finished?.outcome).toBe('win');
  });
});

describe('Sim3D hunters (おに)', () => {
  it('a hunter chases the player and catches them, sending them back to the start', () => {
    const sim = new Sim3D(world(['P#####H'], { lives: 3, enemySpeed: 3 }));
    expect(sim.hunters).toHaveLength(1);
    expect(sim.tileAt(6, 0)).toBe('ground');
    // 右へ少し歩いてから止まる
    run(sim, right, 0.4);
    const before = sim.player.x;
    expect(before).toBeGreaterThan(1.5);
    let caughtAt = -1;
    for (let i = 0; i < 600 && caughtAt < 0; i++) {
      sim.step(1 / 60, still, false);
      if (sim.drainEvents().some((e) => e.type === 'caught')) caughtAt = i;
    }
    expect(caughtAt).toBeGreaterThan(0);
    expect(sim.lives).toBe(2);
    // スタートに戻され、おにも持ち場に戻る
    expect(sim.player.x).toBeCloseTo(0.5, 1);
    expect(sim.hunters[0].x).toBeCloseTo(6.5, 1);
    expect(sim.hunters[0].chasing).toBe(false);
  });

  it('hunters go around walls but cannot pass through them', () => {
    const blocked = new Sim3D(world(['P#W#H'], { lives: 1, enemySpeed: 5 }));
    run(blocked, still, 3);
    expect(blocked.finished).toBeNull();
    expect(blocked.hunters[0].x).toBeGreaterThan(3);

    const around = new Sim3D(
      world(
        [
          'P#W#H', //
          '#####',
        ],
        { lives: 1, enemySpeed: 5 },
      ),
    );
    run(around, still, 4);
    expect(around.finished?.outcome).toBe('lose');
  });

  it('hunters do not chase when the player is out of sight and return home', () => {
    const rows = ['P' + '#'.repeat(30) + 'H'];
    const sim = new Sim3D(world(rows, { lives: 1, enemySpeed: 5 }));
    run(sim, still, 2);
    expect(sim.hunters[0].chasing).toBe(false);
    expect(sim.hunters[0].x).toBeCloseTo(31.5, 1);
    expect(sim.finished).toBeNull();
  });
});

describe('Sim3D rails (のりもの)', () => {
  it('rail heights start and end at floor level and rise in the middle', () => {
    const n = 14;
    expect(railHeight(0, n)).toBe(1);
    expect(railHeight(n - 1, n)).toBe(1);
    const hs = Array.from({ length: n }, (_, i) => railHeight(i, n));
    expect(Math.max(...hs)).toBeGreaterThan(2);
    // となり同士の差はジャンプで越えられない急さにならない
    for (let i = 1; i < n; i++) expect(Math.abs(hs[i] - hs[i - 1])).toBeLessThan(1.2);
  });

  it('follows connected rail tiles as one chain, starting at an end', () => {
    const chains = railChains({ width: 5, height: 3, tiles: ['.====', '....=', '..==='].join('') });
    expect(chains).toHaveLength(1);
    expect(chains[0].cells).toHaveLength(8);
    expect(chains[0].cells[0]).toEqual({ x: 1, z: 0 });
    expect(chains[0].cells[7]).toEqual({ x: 2, z: 2 });
  });

  it('boards the ride, is carried to the end over the gap and can walk on to the goal', () => {
    const sim = new Sim3D(world(['P=====...==#G'], { lives: 1 }));
    // レールは 1 本につながっていないので 2 本になる（間の奈落は乗り物で越えられない）
    expect(sim.rails).toHaveLength(2);
    let rode = false;
    let maxX = 0;
    for (let i = 0; i < 60 * 8 && !sim.finished; i++) {
      sim.step(1 / 60, right, false);
      if (sim.ride) rode = true;
      maxX = Math.max(maxX, sim.player.x);
    }
    expect(rode).toBe(true);
    // 1 本目のレールの終点（x=5）までは運ばれる。その先は奈落なのでミス
    expect(maxX).toBeGreaterThan(5);
    expect(sim.finished?.outcome).toBe('lose');
  });

  it('carries the player across water on a long rail and drops them at the end', () => {
    const row = 'P' + '='.repeat(12) + '#G';
    const sim = new Sim3D(world([row, 'w'.repeat(row.length)], { lives: 1 }));
    let peak = 0;
    for (let i = 0; i < 60 * 12 && !sim.finished; i++) {
      sim.step(1 / 60, right, false);
      peak = Math.max(peak, sim.player.y);
    }
    expect(peak).toBeGreaterThan(2); // 丘をのぼる
    expect(sim.finished?.outcome).toBe('win');
  });
});

describe('Sim3D crumble floors and checkpoints', () => {
  it('a crumble tile collapses after standing on it and comes back later', () => {
    const sim = new Sim3D(world(['Pc..'], { lives: 2 }));
    run(sim, right, 0.22);
    expect(Math.floor(sim.player.x)).toBe(1);
    expect(sim.tileAt(1, 0)).toBe('crumble');
    run(sim, still, CRUMBLE_DELAY + 0.1);
    expect(sim.tileAt(1, 0)).toBe('empty');
    // 落ちてミス → スタートへ
    run(sim, still, 1.5);
    expect(sim.lives).toBe(1);
    expect(sim.player.x).toBeCloseTo(0.5, 1);
    run(sim, still, CRUMBLE_RESTORE);
    expect(sim.tileAt(1, 0)).toBe('crumble');
  });

  it('a checkpoint becomes the respawn point', () => {
    const sim = new Sim3D(world(['PC#..#'], { lives: 3 }));
    let touched = false;
    for (let i = 0; i < 600 && sim.lives === 3; i++) {
      sim.step(1 / 60, right, false);
      if (sim.drainEvents().some((e) => e.type === 'checkpoint')) touched = true;
    }
    expect(touched).toBe(true);
    expect(sim.lives).toBe(2);
    expect(sim.player.x).toBeCloseTo(1.5, 1);
  });
});

describe('Sim3D flood (上がってくるみず)', () => {
  it('drowns a player who stays low', () => {
    const sim = new Sim3D(world(['P##'], { lives: 1, flood: 10 }));
    expect(sim.floodLevel).toBe(0);
    run(sim, still, 6);
    expect(sim.finished?.outcome).toBe('lose');
  });

  it('is safe on a high step and wins with the survive rule', () => {
    const sim = new Sim3D(world(['P5'], { lives: 1, flood: 4, timeLimit: 5, win: 'survive' }));
    // だん5 の上に置く（ジャンプでは届かないのでテストでは直接）
    sim.player.x = 1.5;
    sim.player.y = 5;
    run(sim, still, 6);
    expect(sim.finished?.outcome).toBe('win');
  });

  it('respawns on the nearest safe tile when the start is under water', () => {
    const sim = new Sim3D(world(['P###5'], { lives: 3, flood: 4 }));
    run(sim, still, 2.5);
    expect(sim.lives).toBe(2);
    expect(sim.player.x).toBeCloseTo(4.5, 1);
    expect(sim.player.y).toBe(5);
  });
});
