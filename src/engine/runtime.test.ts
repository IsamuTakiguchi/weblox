import { describe, expect, it } from 'vitest';
import { createGame, defaultRules } from './level';
import { GameRuntime, type InputState } from './runtime';
import type { GameData } from './types';

const idle: InputState = { left: false, right: false, up: false, down: false, jump: false };
const right: InputState = { ...idle, right: true };

function run(rt: GameRuntime, input: InputState, seconds: number): void {
  const dt = 1 / 60;
  for (let t = 0; t < seconds && !rt.finished; t += dt) rt.step(dt, input);
}

function topdown(rows: string[], rules: Partial<GameData['rules']> = {}): GameData {
  return createGame({ width: rows[0].length, height: rows.length, tiles: rows.join(''), rules: { ...defaultRules('topdown'), ...rules } });
}

function platformer(rows: string[], rules: Partial<GameData['rules']> = {}): GameData {
  return createGame({ width: rows[0].length, height: rows.length, tiles: rows.join(''), rules: { ...defaultRules('platformer'), ...rules } });
}

describe('GameRuntime (topdown)', () => {
  it('walks right and reaches the goal', () => {
    const rt = new GameRuntime(topdown(['P...G']));
    run(rt, right, 5);
    expect(rt.finished?.outcome).toBe('win');
  });

  it('is blocked by walls', () => {
    const rt = new GameRuntime(topdown(['P.W.G']));
    run(rt, right, 3);
    expect(rt.finished).toBeNull();
    expect(rt.player.x).toBeLessThan(2);
  });

  it('collects coins and counts score', () => {
    const rt = new GameRuntime(topdown(['PooWG']));
    run(rt, right, 3);
    expect(rt.coins).toBe(2);
    expect(rt.score).toBe(2);
    expect(rt.totalCoins).toBe(2);
  });

  it('wins when all coins are collected under the coins rule', () => {
    const rt = new GameRuntime(topdown(['Poo..'], { win: 'coins' }));
    run(rt, right, 3);
    expect(rt.finished?.outcome).toBe('win');
  });

  it('goal does not count under the both rule until coins are collected', () => {
    const rt = new GameRuntime(topdown(['P..G.o'], { win: 'both' }));
    run(rt, right, 1);
    expect(rt.finished).toBeNull();
    run(rt, right, 4);
    expect(rt.coins).toBe(1);
  });

  it('loses a life on spikes and respawns at start', () => {
    const rt = new GameRuntime(topdown(['P.^..'], { lives: 2 }));
    // トゲに当たるまで進む
    for (let i = 0; i < 600 && rt.lives === 2; i++) rt.step(1 / 60, right);
    expect(rt.lives).toBe(1);
    expect(rt.player.x).toBeLessThan(1);
    expect(rt.player.invincible).toBeGreaterThan(0);
    // 無敵中はトゲでもう一度ダメージを受けない
    run(rt, right, 0.5);
    expect(rt.lives).toBe(1);
  });

  it('game over when lives run out', () => {
    const rt = new GameRuntime(topdown(['P^...'], { lives: 1 }));
    run(rt, right, 2);
    expect(rt.finished?.outcome).toBe('lose');
  });

  it('time limit ends the game', () => {
    const rt = new GameRuntime(topdown(['P....G'], { timeLimit: 1 }));
    run(rt, idle, 2);
    expect(rt.finished?.outcome).toBe('lose');
  });

  it('keys open doors', () => {
    const rt = new GameRuntime(topdown(['PkDG']));
    run(rt, right, 4);
    expect(rt.finished?.outcome).toBe('win');
    expect(rt.keys).toBe(0);
  });

  it('doors stay closed without a key', () => {
    const rt = new GameRuntime(topdown(['P.DG']));
    run(rt, right, 3);
    expect(rt.finished).toBeNull();
  });

  it('portals teleport the player', () => {
    const rt = new GameRuntime(topdown(['P@WWW@G']));
    run(rt, right, 4);
    expect(rt.finished?.outcome).toBe('win');
  });

  it('enemies hurt the player', () => {
    const rt = new GameRuntime(topdown(['P.E..'], { lives: 1, enemySpeed: 0 }));
    run(rt, right, 2);
    expect(rt.finished?.outcome).toBe('lose');
  });

  it('cannot leave the map', () => {
    const rt = new GameRuntime(topdown(['..P..']));
    run(rt, { ...idle, left: true }, 3);
    expect(rt.player.x).toBeGreaterThanOrEqual(0);
    run(rt, { ...idle, up: true }, 3);
    expect(rt.player.y).toBeGreaterThanOrEqual(0);
  });
});

describe('GameRuntime (platformer)', () => {
  it('falls onto the ground and stands', () => {
    const rt = new GameRuntime(platformer(['P....', '.....', '#####']));
    run(rt, idle, 2);
    expect(rt.player.onGround).toBe(true);
    expect(rt.player.y + rt.player.h).toBeLessThanOrEqual(2.01);
  });

  it('falls off the map and loses a life', () => {
    const rt = new GameRuntime(platformer(['P....', '.....', '#..##'], { lives: 2 }));
    run(rt, right, 4);
    expect(rt.lives).toBeLessThan(2);
  });

  it('jumps over a gap to the goal', () => {
    const rt = new GameRuntime(platformer(['P.....G', '#####.#', '#####.#'], { jump: 3 }));
    // 少し進んでからジャンプしっぱなしで右へ
    run(rt, right, 0.3);
    run(rt, { ...right, jump: true }, 4);
    expect(rt.finished?.outcome).toBe('win');
  });

  it('stomping an enemy from above defeats it', () => {
    const rt = new GameRuntime(platformer(['P....', '.....', '.....', '.E...', '#####'], { enemySpeed: 0 }));
    run(rt, right, 0.15);
    run(rt, idle, 3);
    expect(rt.enemies[0].alive).toBe(false);
    expect(rt.lives).toBe(3);
  });

  it('springs launch the player higher than a normal jump', () => {
    const a = new GameRuntime(platformer(['.....', '.....', '.....', '.....', 'P....', '#####'], { jump: 1 }));
    run(a, { ...idle, jump: true }, 0.05);
    let peakA = 10;
    for (let i = 0; i < 120; i++) {
      a.step(1 / 60, idle);
      peakA = Math.min(peakA, a.player.y);
    }
    const b = new GameRuntime(platformer(['.....', '.....', '.....', '.....', 'PS...', '#####'], { jump: 1 }));
    run(b, right, 0.4);
    let peakB = 10;
    for (let i = 0; i < 120; i++) {
      b.step(1 / 60, idle);
      peakB = Math.min(peakB, b.player.y);
    }
    expect(peakB).toBeLessThan(peakA);
  });

  it('drains events', () => {
    const rt = new GameRuntime(topdown(['Po..']));
    run(rt, right, 1);
    const events = rt.drainEvents();
    expect(events.some((e) => e.type === 'coin')).toBe(true);
    expect(rt.drainEvents()).toHaveLength(0);
  });
});

describe('GameRuntime hunters, checkpoints and survive', () => {
  it('a hunter chases and catches the player in topdown mode', () => {
    const rt = new GameRuntime(topdown(['P....H'], { lives: 2, enemySpeed: 3 }));
    expect(rt.hunters).toHaveLength(1);
    let caught = false;
    for (let i = 0; i < 300 && !caught; i++) {
      rt.step(1 / 60, idle);
      if (rt.drainEvents().some((e) => e.type === 'caught')) caught = true;
    }
    expect(caught).toBe(true);
    expect(rt.lives).toBe(1);
    expect(rt.hunters[0].x).toBe(5);
  });

  it('a hunter walks around a wall in topdown mode', () => {
    const rt = new GameRuntime(topdown(['P.W.H', '.....'], { lives: 1, enemySpeed: 5 }));
    run(rt, idle, 4);
    expect(rt.finished?.outcome).toBe('lose');
  });

  it('a hunter far away stays home', () => {
    const rt = new GameRuntime(topdown(['P' + '.'.repeat(12) + 'H'], { lives: 1, enemySpeed: 5 }));
    run(rt, idle, 2);
    expect(rt.hunters[0].chasing).toBe(false);
    expect(rt.finished).toBeNull();
  });

  it('a checkpoint becomes the respawn point', () => {
    const rt = new GameRuntime(topdown(['PC.^G'], { lives: 3 }));
    for (let i = 0; i < 600 && rt.lives === 3; i++) rt.step(1 / 60, right);
    expect(rt.lives).toBe(2);
    expect(rt.checkpointIdx).toBe(1);
    expect(Math.floor(rt.player.x + rt.player.w / 2)).toBe(1);
  });

  it('survive rule wins when time runs out', () => {
    const rt = new GameRuntime(topdown(['P....'], { timeLimit: 1, win: 'survive' }));
    run(rt, idle, 2);
    expect(rt.finished?.outcome).toBe('win');
  });

  it('rail and crumble tiles are solid blocks in 2D', () => {
    const rt = new GameRuntime(topdown(['P.=cG']));
    run(rt, right, 3);
    expect(rt.finished).toBeNull();
    expect(rt.player.x).toBeLessThan(2);
  });
});
