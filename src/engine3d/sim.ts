/**
 * 3D モード（オビー風）のシミュレーション。
 * three.js に依存しない純粋なロジックなので、そのままユニットテストできる。
 *
 * 座標系: x = マップの列（右が +）, z = マップの行（手前が +）, y = 高さ（上が +）。
 * 1 マス = 1 ブロック。マップの文字はそのまま「柱」の高さになる。
 *   empty  → 奈落（床なし）        ground / アイテム類 → 高さ 1 の床
 *   wall   → 高さ 3 の壁            door → 高さ 3（かぎで開く）
 *   cloud  → 高さ 2〜2.5 の浮き足場  water → 高さ 0.6 の水（落ちるとミス）
 */
import { findTiles } from '../engine/level';
import type { RuntimeEvent } from '../engine/runtime';
import { tileDef, tileFromChar } from '../engine/tiles';
import type { GameData, GameResult, TileId } from '../engine/types';

export interface Player3D {
  x: number;
  z: number;
  /** 足元の高さ */
  y: number;
  vx: number;
  vz: number;
  vy: number;
  onGround: boolean;
  /** 向き（ラジアン、+z を 0 として y 軸まわり） */
  yaw: number;
  /** 歩行アニメ用 */
  walkPhase: number;
  invincible: number;
  portalCooldown: number;
}

export interface Enemy3D {
  x: number;
  z: number;
  y: number;
  dir: 1 | -1;
  alive: boolean;
  phase: number;
}

export interface Column {
  /** 床の高さ。null は奈落 */
  top: number | null;
  /** 横から進めない（壁・ドア） */
  solid: boolean;
  /** 浮き足場（横からは通り抜けられ、上に乗れる） */
  cloud: boolean;
  tile: TileId;
}

export const PLAYER_RADIUS = 0.3;
export const PLAYER_HEIGHT = 1.6;
export const STEP_HEIGHT = 0.45;
export const GRAVITY = 26;
export const WALL_HEIGHT = 3;
export const CLOUD_TOP = 2.5;
export const CLOUD_BOTTOM = 2.0;
export const WATER_TOP = 0.6;
export const FALL_LIMIT = -8;

const VOID: Column = { top: null, solid: false, cloud: false, tile: 'empty' };

export class Sim3D {
  readonly game: GameData;
  tiles: string[];
  player: Player3D;
  enemies: Enemy3D[];
  score = 0;
  coins = 0;
  totalCoins = 0;
  keys = 0;
  lives: number;
  elapsed = 0;
  time = 0;
  finished: GameResult | null = null;
  events: RuntimeEvent[] = [];

  private startX: number;
  private startZ: number;
  private jumpHeld = false;

  constructor(game: GameData) {
    this.game = game;
    this.tiles = game.tiles.split('');
    this.lives = game.rules.lives;
    const starts = findTiles(game, 'start');
    const s = starts[0] ?? { x: 0, y: 0 };
    this.startX = s.x + 0.5;
    this.startZ = s.y + 0.5;
    // スタートと敵のマスは床にする
    for (const p of starts) this.setTile(p.x, p.y, 'ground');
    this.enemies = findTiles(game, 'enemy').map((p, i) => ({ x: p.x + 0.5, z: p.y + 0.5, y: 1, dir: i % 2 === 0 ? 1 : -1, alive: true, phase: i }));
    for (const e of this.enemies) this.setTile(Math.floor(e.x), Math.floor(e.z), 'ground');
    this.totalCoins = this.tiles.filter((c) => c === tileDef('coin').char).length;
    this.player = {
      x: this.startX,
      z: this.startZ,
      y: 1,
      vx: 0,
      vz: 0,
      vy: 0,
      onGround: true,
      yaw: 0,
      walkPhase: 0,
      invincible: 0,
      portalCooldown: 0,
    };
  }

  get width(): number {
    return this.game.width;
  }
  get height(): number {
    return this.game.height;
  }

  tileAt(tx: number, tz: number): TileId {
    if (tx < 0 || tz < 0 || tx >= this.width || tz >= this.height) return 'empty';
    return tileFromChar(this.tiles[tz * this.width + tx] ?? '.');
  }

  private setTile(tx: number, tz: number, t: TileId): void {
    if (tx < 0 || tz < 0 || tx >= this.width || tz >= this.height) return;
    this.tiles[tz * this.width + tx] = tileDef(t).char;
  }

  /** マス (tx, tz) の柱の情報 */
  column(tx: number, tz: number): Column {
    const tile = this.tileAt(tx, tz);
    switch (tile) {
      case 'empty':
        return VOID;
      case 'wall':
      case 'door':
        return { top: WALL_HEIGHT, solid: true, cloud: false, tile };
      case 'cloud':
        return { top: CLOUD_TOP, solid: false, cloud: true, tile };
      case 'water':
        return { top: WATER_TOP, solid: false, cloud: false, tile };
      default:
        return { top: 1, solid: false, cloud: false, tile };
    }
  }

  /** プレイヤーの足元が重なるマス（最大 4 つ） */
  private footprint(x: number, z: number): [number, number][] {
    const r = PLAYER_RADIUS * 0.85;
    const xs = [Math.floor(x - r), Math.floor(x + r)];
    const zs = [Math.floor(z - r), Math.floor(z + r)];
    const out: [number, number][] = [];
    for (const tx of xs) for (const tz of zs) if (!out.some(([a, b]) => a === tx && b === tz)) out.push([tx, tz]);
    return out;
  }

  private blockedAt(x: number, z: number, feet: number): boolean {
    for (const [tx, tz] of this.footprint(x, z)) {
      const c = this.column(tx, tz);
      if (c.top === null || c.cloud) continue;
      if (c.top > feet + STEP_HEIGHT) return true;
    }
    return false;
  }

  /** 足元の床の高さ（なければ -Infinity） */
  floorAt(x: number, z: number, feet: number): number {
    let floor = -Infinity;
    for (const [tx, tz] of this.footprint(x, z)) {
      const c = this.column(tx, tz);
      if (c.top === null) continue;
      if (c.cloud && feet < c.top - 0.35) continue;
      if (!c.cloud && c.top > feet + STEP_HEIGHT) continue; // 壁の上には乗れない
      floor = Math.max(floor, c.top);
    }
    return floor;
  }

  /**
   * 1 フレーム進める。
   * @param move ワールド座標での移動方向（長さ 0〜1）。カメラ相対の変換は呼び出し側で行う
   */
  step(dt: number, move: { x: number; z: number }, jump: boolean): void {
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

    // 水平移動
    const speed = 3 + rules.speed * 0.9;
    let mx = move.x;
    let mz = move.z;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    p.vx = mx * speed;
    p.vz = mz * speed;
    if (len > 0.05) {
      p.yaw = Math.atan2(mx, mz);
      p.walkPhase += dt * 10;
    }
    const nx = p.x + p.vx * dt;
    if (!this.blockedAt(nx, p.z, p.y)) p.x = nx;
    else p.vx = 0;
    const nz = p.z + p.vz * dt;
    if (!this.blockedAt(p.x, nz, p.y)) p.z = nz;
    else p.vz = 0;

    // ジャンプ・重力
    if (jump && !this.jumpHeld && p.onGround) {
      p.vy = 7.5 + rules.jump * 0.55;
      p.onGround = false;
      this.events.push({ type: 'jump' });
    }
    this.jumpHeld = jump;
    p.vy -= GRAVITY * dt;
    p.vy = Math.max(p.vy, -20);
    p.y += p.vy * dt;
    const floor = this.floorAt(p.x, p.z, p.y);
    if (p.vy <= 0 && p.y <= floor) {
      p.y = floor;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }
    if (p.y < FALL_LIMIT) {
      this.hurt();
      return;
    }

    this.updateEnemies(dt);
    this.checkTiles();
    this.checkEnemies();
  }

  private updateEnemies(dt: number): void {
    const es = this.game.rules.enemySpeed;
    if (es === 0) return;
    const v = 0.8 + es * 0.5;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.phase += dt;
      const nx = e.x + e.dir * v * dt;
      const aheadX = Math.floor(nx + e.dir * 0.45);
      const tz = Math.floor(e.z);
      const ahead = this.column(aheadX, tz);
      const here = this.column(Math.floor(e.x), tz);
      const blocked = ahead.top === null || ahead.cloud || ahead.top !== here.top;
      if (blocked) e.dir = e.dir > 0 ? -1 : 1;
      else e.x = nx;
    }
  }

  private dist(tx: number, tz: number): number {
    return Math.hypot(this.player.x - (tx + 0.5), this.player.z - (tz + 0.5));
  }

  private checkTiles(): void {
    const p = this.player;
    const cx = Math.floor(p.x);
    const cz = Math.floor(p.z);
    const under = this.tileAt(cx, cz);

    // 足元の危険
    if (p.invincible <= 0) {
      if (under === 'water' && p.y <= WATER_TOP + 0.05) {
        this.hurt();
        return;
      }
      if (under === 'spike' && p.onGround && p.y <= 1.05) {
        this.hurt();
        return;
      }
    }
    if (under === 'spring' && p.onGround) {
      p.vy = 13 + this.game.rules.jump * 0.6;
      p.onGround = false;
      this.events.push({ type: 'spring' });
    }

    for (let tz = cz - 1; tz <= cz + 1; tz++) {
      for (let tx = cx - 1; tx <= cx + 1; tx++) {
        const t = this.tileAt(tx, tz);
        const def = tileDef(t);
        if (!def.pickup && t !== 'goal' && t !== 'portal') continue;
        const d = this.dist(tx, tz);
        const vertical = p.y > -0.2 && p.y < 2.2;
        if (!vertical) continue;
        if (def.pickup && d < 0.7) {
          this.setTile(tx, tz, 'ground');
          switch (t) {
            case 'coin':
              this.coins++;
              this.score++;
              this.events.push({ type: 'coin' });
              if (this.game.rules.win === 'coins' && this.coins >= this.totalCoins) this.end('win');
              break;
            case 'gem':
              this.score += 5;
              this.events.push({ type: 'gem' });
              break;
            case 'heart':
              this.lives = Math.min(9, this.lives + 1);
              this.events.push({ type: 'heart' });
              break;
            case 'key':
              this.keys++;
              this.events.push({ type: 'key' });
              break;
            default:
              break;
          }
        } else if (t === 'goal' && d < 0.75) {
          const win = this.game.rules.win;
          if (win === 'goal' || (win === 'both' && this.coins >= this.totalCoins)) this.end('win');
        } else if (t === 'portal' && d < 0.45 && p.portalCooldown <= 0) {
          this.teleport(tx, tz);
        }
      }
    }

    // ドア
    if (this.keys > 0) {
      const around: [number, number][] = [
        [cx + 1, cz],
        [cx - 1, cz],
        [cx, cz + 1],
        [cx, cz - 1],
      ];
      for (const [tx, tz] of around) {
        if (this.tileAt(tx, tz) === 'door' && this.dist(tx, tz) < 1.0) {
          this.setTile(tx, tz, 'ground');
          this.keys--;
          this.events.push({ type: 'door' });
          break;
        }
      }
    }
  }

  private teleport(fromX: number, fromZ: number): void {
    const portals = findTiles({ width: this.width, height: this.height, tiles: this.tiles.join('') }, 'portal');
    if (portals.length < 2) return;
    const idx = portals.findIndex((q) => q.x === fromX && q.y === fromZ);
    const dest = portals[(idx + 1) % portals.length];
    const p = this.player;
    p.x = dest.x + 0.5;
    p.z = dest.y + 0.5;
    p.y = 1;
    p.vy = 0;
    p.portalCooldown = 1.0;
    this.events.push({ type: 'portal' });
  }

  private checkEnemies(): void {
    const p = this.player;
    if (p.invincible > 0) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      if (d > 0.65) continue;
      const overlap = p.y < e.y + 0.9 && p.y + PLAYER_HEIGHT > e.y;
      if (!overlap) continue;
      const stomp = p.vy < 0 && p.y > e.y + 0.35;
      if (stomp) {
        e.alive = false;
        p.vy = 6;
        this.score += 2;
        this.events.push({ type: 'stomp' });
      } else {
        this.hurt();
        return;
      }
    }
  }

  private hurt(): void {
    this.lives--;
    this.events.push({ type: 'hurt' });
    if (this.lives <= 0) {
      this.end('lose');
      return;
    }
    const p = this.player;
    p.x = this.startX;
    p.z = this.startZ;
    p.y = 1;
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.onGround = true;
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
  }

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
