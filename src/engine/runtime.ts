import { findTiles } from './level';
import { tileDef, tileFromChar } from './tiles';
import type { GameData, GameResult, TileId } from './types';

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  facing: 1 | -1;
  /** 無敵時間（秒） */
  invincible: number;
  /** ワープ直後のクールダウン（秒） */
  portalCooldown: number;
}

export interface Enemy {
  x: number;
  y: number;
  dir: 1 | -1;
  alive: boolean;
  /** アニメ用 */
  phase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  text: string;
}

export type RuntimeEvent =
  | { type: 'coin' }
  | { type: 'gem' }
  | { type: 'heart' }
  | { type: 'key' }
  | { type: 'door' }
  | { type: 'portal' }
  | { type: 'spring' }
  | { type: 'stomp' }
  | { type: 'hurt' }
  | { type: 'win' }
  | { type: 'lose' };

const PLAYER_W = 0.7;
const PLAYER_H = 0.8;
const GRAVITY = 28;
const MAX_FALL = 18;

export class GameRuntime {
  readonly game: GameData;
  /** 実行中に変化するタイル（取ったコイン等は消える） */
  tiles: string[];
  player: Player;
  enemies: Enemy[];
  particles: Particle[] = [];
  score = 0;
  coins = 0;
  totalCoins = 0;
  keys = 0;
  lives: number;
  elapsed = 0;
  finished: GameResult | null = null;
  events: RuntimeEvent[] = [];
  time = 0;

  private jumpHeld = false;
  private startX = 0;
  private startY = 0;

  constructor(game: GameData) {
    this.game = game;
    this.tiles = game.tiles.split('');
    this.lives = game.rules.lives;
    const starts = findTiles(game, 'start');
    const s = starts[0] ?? { x: 0, y: 0 };
    this.startX = s.x;
    this.startY = s.y;
    // スタートマス自体は通れる空マスとして扱う
    for (const p of starts) this.setTile(p.x, p.y, 'empty');
    this.player = {
      x: s.x + (1 - PLAYER_W) / 2,
      y: s.y + (1 - PLAYER_H),
      vx: 0,
      vy: 0,
      w: PLAYER_W,
      h: PLAYER_H,
      onGround: false,
      facing: 1,
      invincible: 0,
      portalCooldown: 0,
    };
    this.enemies = findTiles(game, 'enemy').map((p, i) => ({ x: p.x, y: p.y, dir: i % 2 === 0 ? 1 : -1, alive: true, phase: i }));
    for (const e of this.enemies) this.setTile(e.x, e.y, 'empty');
    this.totalCoins = this.tiles.filter((c) => c === tileDef('coin').char).length;
  }

  get width(): number {
    return this.game.width;
  }
  get height(): number {
    return this.game.height;
  }

  tileAt(x: number, y: number): TileId {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 'empty';
    return tileFromChar(this.tiles[y * this.width + x] ?? '.');
  }

  private setTile(x: number, y: number, t: TileId): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.tiles[y * this.width + x] = tileDef(t).char;
  }

  private isSolidFor(x: number, y: number, fromAbove: boolean): boolean {
    const t = this.tileAt(x, y);
    if (t === 'cloud') return fromAbove;
    return tileDef(t).solid;
  }

  /** 1 フレーム進める。dt は秒 */
  step(dt: number, input: InputState): void {
    if (this.finished) return;
    dt = Math.min(dt, 1 / 30);
    this.time += dt;
    this.elapsed += dt;
    const { rules } = this.game;

    if (rules.timeLimit > 0 && this.elapsed >= rules.timeLimit) {
      this.end('lose');
      return;
    }

    const p = this.player;
    p.invincible = Math.max(0, p.invincible - dt);
    p.portalCooldown = Math.max(0, p.portalCooldown - dt);

    const speed = 3 + rules.speed * 1.2; // 4.2〜9 マス/秒

    if (rules.mode === 'topdown') {
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx && dy) {
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
      }
      p.vx = dx * speed;
      p.vy = dy * speed;
      if (dx) p.facing = dx > 0 ? 1 : -1;
      this.moveX(p.vx * dt);
      this.moveY(p.vy * dt);
    } else {
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      p.vx = dx * speed;
      if (dx) p.facing = dx > 0 ? 1 : -1;
      const wantJump = input.jump || input.up;
      if (wantJump && !this.jumpHeld && p.onGround) {
        p.vy = -(9 + rules.jump * 1.4);
        p.onGround = false;
      }
      this.jumpHeld = wantJump;
      p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
      this.moveX(p.vx * dt);
      this.moveY(p.vy * dt);
      if (p.y > this.height + 1) {
        this.hurt(true);
        return;
      }
    }

    this.updateEnemies(dt);
    this.checkTiles();
    this.checkEnemies();
    this.updateParticles(dt);
  }

  private moveX(amount: number): void {
    const p = this.player;
    if (amount === 0) return;
    const nx = p.x + amount;
    const top = Math.floor(p.y + 0.02);
    const bottom = Math.floor(p.y + p.h - 0.02);
    if (amount > 0) {
      const edge = Math.floor(nx + p.w);
      for (let ty = top; ty <= bottom; ty++) {
        if (this.isSolidFor(edge, ty, false) || edge >= this.width) {
          p.x = edge - p.w - 0.001;
          p.vx = 0;
          return;
        }
      }
    } else {
      const edge = Math.floor(nx);
      for (let ty = top; ty <= bottom; ty++) {
        if (this.isSolidFor(edge, ty, false) || edge < 0) {
          p.x = edge + 1 + 0.001;
          p.vx = 0;
          return;
        }
      }
    }
    p.x = nx;
  }

  private moveY(amount: number): void {
    const p = this.player;
    const platformer = this.game.rules.mode === 'platformer';
    if (amount === 0) {
      if (platformer) p.onGround = this.standing();
      return;
    }
    const ny = p.y + amount;
    const left = Math.floor(p.x + 0.02);
    const right = Math.floor(p.x + p.w - 0.02);
    if (amount > 0) {
      const edge = Math.floor(ny + p.h);
      for (let tx = left; tx <= right; tx++) {
        const solidBelow = this.isSolidFor(tx, edge, true) && (this.tileAt(tx, edge) !== 'cloud' || p.y + p.h <= edge + 0.2);
        if (solidBelow || (!platformer && edge >= this.height)) {
          p.y = edge - p.h - 0.001;
          p.vy = 0;
          p.onGround = true;
          return;
        }
      }
      p.onGround = false;
    } else {
      const edge = Math.floor(ny);
      for (let tx = left; tx <= right; tx++) {
        if (this.isSolidFor(tx, edge, false) || (!platformer && edge < 0)) {
          p.y = edge + 1 + 0.001;
          p.vy = 0;
          return;
        }
      }
      if (platformer && ny < -2) {
        p.y = -2;
        p.vy = 0;
        return;
      }
    }
    p.y = ny;
  }

  private standing(): boolean {
    const p = this.player;
    const edge = Math.floor(p.y + p.h + 0.05);
    const left = Math.floor(p.x + 0.02);
    const right = Math.floor(p.x + p.w - 0.02);
    for (let tx = left; tx <= right; tx++) if (this.isSolidFor(tx, edge, true)) return true;
    return false;
  }

  private updateEnemies(dt: number): void {
    const es = this.game.rules.enemySpeed;
    if (es === 0) return;
    const v = 0.8 + es * 0.6;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.phase += dt;
      const nx = e.x + e.dir * v * dt;
      const ahead = e.dir > 0 ? Math.floor(nx + 0.95) : Math.floor(nx + 0.05);
      const blocked = ahead < 0 || ahead >= this.width || tileDef(this.tileAt(ahead, Math.floor(e.y + 0.5))).solid;
      // ジャンプモードでは足場の端で引き返す
      const noFloor = this.game.rules.mode === 'platformer' && !this.isSolidFor(ahead, Math.floor(e.y + 0.5) + 1, true);
      if (blocked || noFloor) {
        e.dir = e.dir > 0 ? -1 : 1;
      } else {
        e.x = nx;
      }
    }
  }

  private overlapsTile(tx: number, ty: number, shrink = 0.15): boolean {
    const p = this.player;
    return p.x + shrink < tx + 1 && p.x + p.w - shrink > tx && p.y + shrink < ty + 1 && p.y + p.h - shrink > ty;
  }

  private checkTiles(): void {
    const p = this.player;
    const x0 = Math.floor(p.x);
    const x1 = Math.floor(p.x + p.w);
    const y0 = Math.floor(p.y);
    const y1 = Math.floor(p.y + p.h);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tileAt(tx, ty);
        if (t === 'empty' || t === 'ground' || t === 'wall' || t === 'cloud' || t === 'flower') continue;
        if (!this.overlapsTile(tx, ty)) continue;
        switch (t) {
          case 'coin':
            this.setTile(tx, ty, 'empty');
            this.coins++;
            this.score += 1;
            this.burst(tx + 0.5, ty + 0.5, '✨');
            this.events.push({ type: 'coin' });
            if (this.game.rules.win === 'coins' && this.coins >= this.totalCoins) this.end('win');
            break;
          case 'gem':
            this.setTile(tx, ty, 'empty');
            this.score += 5;
            this.burst(tx + 0.5, ty + 0.5, '💎');
            this.events.push({ type: 'gem' });
            break;
          case 'heart':
            this.setTile(tx, ty, 'empty');
            this.lives = Math.min(9, this.lives + 1);
            this.burst(tx + 0.5, ty + 0.5, '❤️');
            this.events.push({ type: 'heart' });
            break;
          case 'key':
            this.setTile(tx, ty, 'empty');
            this.keys++;
            this.burst(tx + 0.5, ty + 0.5, '🔑');
            this.events.push({ type: 'key' });
            break;
          case 'spike':
          case 'water':
            if (p.invincible > 0) break;
            this.hurt(false);
            return;
          case 'spring':
            if (this.game.rules.mode === 'platformer' && p.vy >= 0) {
              p.vy = -(15 + this.game.rules.jump);
              p.onGround = false;
              this.events.push({ type: 'spring' });
            }
            break;
          case 'portal':
            if (p.portalCooldown <= 0) this.teleport(tx, ty);
            break;
          case 'goal': {
            const win = this.game.rules.win;
            if (win === 'goal' || (win === 'both' && this.coins >= this.totalCoins)) this.end('win');
            break;
          }
          default:
            break;
        }
      }
    }
    // ドアはぶつかった時に開く（solid なので overlaps ではなく隣接判定）
    if (this.keys > 0) {
      const around = [
        [Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h + 0.1)],
        [Math.floor(p.x + p.w / 2), Math.floor(p.y - 0.1)],
        [Math.floor(p.x + p.w + 0.1), Math.floor(p.y + p.h / 2)],
        [Math.floor(p.x - 0.1), Math.floor(p.y + p.h / 2)],
      ];
      for (const [tx, ty] of around) {
        if (this.tileAt(tx, ty) === 'door') {
          this.setTile(tx, ty, 'empty');
          this.keys--;
          this.burst(tx + 0.5, ty + 0.5, '🚪');
          this.events.push({ type: 'door' });
          break;
        }
      }
    }
  }

  private teleport(fromX: number, fromY: number): void {
    const portals = findTiles({ width: this.width, height: this.height, tiles: this.tiles.join('') }, 'portal');
    if (portals.length < 2) return;
    const idx = portals.findIndex((q) => q.x === fromX && q.y === fromY);
    const dest = portals[(idx + 1) % portals.length];
    const p = this.player;
    p.x = dest.x + (1 - p.w) / 2;
    p.y = dest.y + (1 - p.h);
    p.vy = 0;
    p.portalCooldown = 0.8;
    this.burst(dest.x + 0.5, dest.y + 0.5, '🌀');
    this.events.push({ type: 'portal' });
  }

  private checkEnemies(): void {
    const p = this.player;
    if (p.invincible > 0) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const overlap = p.x + 0.1 < e.x + 0.9 && p.x + p.w - 0.1 > e.x + 0.1 && p.y + 0.1 < e.y + 0.9 && p.y + p.h - 0.1 > e.y + 0.1;
      if (!overlap) continue;
      const stomp = this.game.rules.mode === 'platformer' && p.vy > 0 && p.y + p.h < e.y + 0.55;
      if (stomp) {
        e.alive = false;
        p.vy = -7;
        this.score += 2;
        this.burst(e.x + 0.5, e.y + 0.5, '💥');
        this.events.push({ type: 'stomp' });
      } else {
        this.hurt(false);
        return;
      }
    }
  }

  private hurt(fell: boolean): void {
    this.lives--;
    this.events.push({ type: 'hurt' });
    if (this.lives <= 0) {
      this.end('lose');
      return;
    }
    const p = this.player;
    if (!fell) this.burst(p.x + p.w / 2, p.y + p.h / 2, '💫');
    p.x = this.startX + (1 - p.w) / 2;
    p.y = this.startY + (1 - p.h);
    p.vx = 0;
    p.vy = 0;
    p.invincible = 1.5;
  }

  private end(outcome: 'win' | 'lose'): void {
    if (this.finished) return;
    this.finished = {
      outcome,
      score: this.score,
      coins: this.coins,
      totalCoins: this.totalCoins,
      timeMs: Math.round(this.elapsed * 1000),
      livesLeft: this.lives,
    };
    this.events.push({ type: outcome });
    if (outcome === 'win') {
      const p = this.player;
      for (let i = 0; i < 12; i++) this.burst(p.x + p.w / 2, p.y + p.h / 2, ['🎉', '⭐', '✨'][i % 3]);
    }
  }

  private burst(x: number, y: number, text: string): void {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      this.particles.push({ x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 2, life: 0.7, text });
    }
  }

  private updateParticles(dt: number): void {
    for (const q of this.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 8 * dt;
      q.life -= dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  /** 蓄積したイベントを取り出してクリア（効果音などに使う） */
  drainEvents(): RuntimeEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  get remainingTime(): number | null {
    const t = this.game.rules.timeLimit;
    if (t <= 0) return null;
    return Math.max(0, t - this.elapsed);
  }
}
