/**
 * 3D モード（オビー風）のシミュレーション。
 * three.js に依存しない純粋なロジックなので、そのままユニットテストできる。
 *
 * 座標系: x = マップの列（右が +）, z = マップの行（手前が +）, y = 高さ（上が +）。
 * 1 マス = 1 ブロック。マップの文字はそのまま「柱」の高さになる。
 *   empty  → 奈落（床なし）        ground / アイテム類 → 高さ 1 の床
 *   wall   → 高さ 3 の壁            door → 高さ 3（かぎで開く）
 *   cloud  → 高さ 2〜2.5 の浮き足場  water → 高さ 0.6 の水（落ちるとミス）
 *
 * 「落ちないで進む」以外のルール：
 *   hunter     → おに。こちらを見つけると追いかけてくる。つかまるとスタート（チェックポイント）へ
 *   rail       → のりもの。乗ると自動で終点まで運ばれる（丘をのぼりおりするコースター）
 *   crumble    → きえる ゆか。乗るとくずれて、しばらくして戻る
 *   checkpoint → 復活地点
 *   rules.flood → みず（ようがん）が時間とともに上がってくる。高い足場へ逃げる
 *   rules.win = 'survive' → 制限時間まで生きのこればクリア
 */
import { findTiles } from '../engine/level';
import type { RuntimeEvent } from '../engine/runtime';
import { stepHeight, tileDef, tileFromChar } from '../engine/tiles';
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
  /** のりものを降りた直後は乗り直さない */
  railCooldown: number;
}

export interface Enemy3D {
  x: number;
  z: number;
  y: number;
  dir: 1 | -1;
  alive: boolean;
  phase: number;
}

/** おに（追いかけてくる敵） */
export interface Hunter3D {
  x: number;
  z: number;
  y: number;
  spawnX: number;
  spawnZ: number;
  yaw: number;
  phase: number;
  /** こちらに気づいて追いかけている */
  chasing: boolean;
}

/** つながったレール 1 本 */
export interface RailChain {
  cells: { x: number; z: number }[];
  /** 各マスでのレールの高さ（丘） */
  heights: number[];
}

export interface Ride {
  chain: RailChain;
  /** 何マス目か（小数） */
  pos: number;
  dir: 1 | -1;
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
/** 上がってくるみずの最高水位（だん5 の上だけが安全） */
export const FLOOD_MAX = 4.6;
/** きえる ゆか：乗ってからくずれるまで／戻るまでの秒数 */
export const CRUMBLE_DELAY = 0.6;
export const CRUMBLE_RESTORE = 3.0;
/** おにが こちらに気づく距離（マス数、道のり） */
export const HUNTER_SIGHT = 14;

const VOID: Column = { top: null, solid: false, cloud: false, tile: 'empty' };
const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * つながったレールをたどって 1 本ずつにまとめる。
 * 端（となりのレールが 1 つだけ）から始め、できるだけまっすぐ進む。
 */
export function railChains(game: Pick<GameData, 'width' | 'height' | 'tiles'>): RailChain[] {
  const railChar = tileDef('rail').char;
  const isRail = (x: number, z: number) => x >= 0 && z >= 0 && x < game.width && z < game.height && game.tiles.charAt(z * game.width + x) === railChar;
  const key = (x: number, z: number) => z * game.width + x;
  const seen = new Set<number>();
  const chains: RailChain[] = [];
  for (let z = 0; z < game.height; z++) {
    for (let x = 0; x < game.width; x++) {
      if (!isRail(x, z) || seen.has(key(x, z))) continue;
      // つながっている部分をぜんぶ集める
      const comp: { x: number; z: number }[] = [];
      const stack = [{ x, z }];
      seen.add(key(x, z));
      while (stack.length) {
        const c = stack.pop()!;
        comp.push(c);
        for (const [dx, dz] of DIRS) {
          const nx = c.x + dx;
          const nz = c.z + dz;
          if (isRail(nx, nz) && !seen.has(key(nx, nz))) {
            seen.add(key(nx, nz));
            stack.push({ x: nx, z: nz });
          }
        }
      }
      const degree = (c: { x: number; z: number }) => DIRS.filter(([dx, dz]) => isRail(c.x + dx, c.z + dz)).length;
      const ends = comp.filter((c) => degree(c) <= 1).sort((a, b) => a.z - b.z || a.x - b.x);
      const start = ends[0] ?? comp[0];
      const path = [start];
      const onPath = new Set<number>([key(start.x, start.z)]);
      let prevDir: readonly [number, number] | null = null;
      for (;;) {
        const cur = path[path.length - 1];
        const options = DIRS.filter(([ox, oz]) => isRail(cur.x + ox, cur.z + oz) && !onPath.has(key(cur.x + ox, cur.z + oz)));
        if (options.length === 0) break;
        const pd: readonly [number, number] | null = prevDir;
        const straight: readonly [number, number] | undefined = pd ? options.find(([ox, oz]) => ox === pd[0] && oz === pd[1]) : undefined;
        const pick: readonly [number, number] = straight ?? options[0];
        const next = { x: cur.x + pick[0], z: cur.z + pick[1] };
        path.push(next);
        onPath.add(key(next.x, next.z));
        prevDir = pick;
      }
      chains.push({ cells: path, heights: path.map((_, i) => railHeight(i, path.length)) });
    }
  }
  return chains;
}

/** レールの i 番目の高さ。両端は 1 で、途中は丘のように上下する */
export function railHeight(i: number, n: number): number {
  const amp = Math.max(0, Math.min(1, (i - 1) / 3, (n - 2 - i) / 3));
  return 1 + amp * 2.5 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (i - 2)) / 10));
}

export class Sim3D {
  readonly game: GameData;
  tiles: string[];
  player: Player3D;
  enemies: Enemy3D[];
  hunters: Hunter3D[];
  readonly rails: RailChain[];
  ride: Ride | null = null;
  score = 0;
  coins = 0;
  totalCoins = 0;
  keys = 0;
  lives: number;
  elapsed = 0;
  time = 0;
  finished: GameResult | null = null;
  events: RuntimeEvent[] = [];
  /** 有効なチェックポイントのマス番号（なければ -1） */
  checkpointIdx = -1;

  private respawnX: number;
  private respawnZ: number;
  private jumpHeld = false;
  /** きえる ゆか：くずれるまでのカウントダウン（マス番号 → 秒） */
  private crumbling = new Map<number, number>();
  /** きえる ゆか：戻るまでのカウントダウン */
  private gone = new Map<number, number>();
  /** プレイヤーへの道のり（おに用）。-1 は届かない */
  private flow: Int32Array;
  private flowTimer = 0;
  private hunterAlarm = false;

  constructor(game: GameData) {
    this.game = game;
    this.tiles = game.tiles.split('');
    this.lives = game.rules.lives;
    const starts = findTiles(game, 'start');
    const s = starts[0] ?? { x: 0, y: 0 };
    this.respawnX = s.x + 0.5;
    this.respawnZ = s.y + 0.5;
    // スタートと敵のマスは床にする
    for (const p of starts) this.setTile(p.x, p.y, 'ground');
    this.enemies = findTiles(game, 'enemy').map((p, i) => ({ x: p.x + 0.5, z: p.y + 0.5, y: 1, dir: i % 2 === 0 ? 1 : -1, alive: true, phase: i }));
    for (const e of this.enemies) this.setTile(Math.floor(e.x), Math.floor(e.z), 'ground');
    this.hunters = findTiles(game, 'hunter').map((p, i) => ({ x: p.x + 0.5, z: p.y + 0.5, y: 1, spawnX: p.x + 0.5, spawnZ: p.y + 0.5, yaw: 0, phase: i * 1.7, chasing: false }));
    for (const h of this.hunters) this.setTile(Math.floor(h.x), Math.floor(h.z), 'ground');
    this.rails = railChains(game);
    this.totalCoins = this.tiles.filter((c) => c === tileDef('coin').char).length;
    this.flow = new Int32Array(game.width * game.height).fill(-1);
    this.player = {
      x: this.respawnX,
      z: this.respawnZ,
      y: 1,
      vx: 0,
      vz: 0,
      vy: 0,
      onGround: true,
      yaw: 0,
      walkPhase: 0,
      invincible: 0,
      portalCooldown: 0,
      railCooldown: 0,
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
      default: {
        const h = stepHeight(tile);
        return { top: h ?? 1, solid: false, cloud: false, tile };
      }
    }
  }

  /** いまの水位（flood がなければ 0） */
  get floodLevel(): number {
    const f = this.game.rules.flood ?? 0;
    if (f <= 0) return 0;
    return Math.min(FLOOD_MAX, (this.elapsed / f) * FLOOD_MAX);
  }

  /** きえる ゆか のゆれ具合（0〜1）。くずれかけていないなら 0 */
  crumbleShake(idx: number): number {
    const t = this.crumbling.get(idx);
    return t === undefined ? 0 : 1 - t / CRUMBLE_DELAY;
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
    dt = Math.max(0, Math.min(dt, 1 / 30));
    this.time += dt;
    this.elapsed += dt;
    const { rules } = this.game;
    if (rules.timeLimit > 0 && this.elapsed >= rules.timeLimit) {
      // 生きのこるルールなら時間切れ＝クリア
      this.end(rules.win === 'survive' ? 'win' : 'lose');
      return;
    }
    const p = this.player;
    p.invincible = Math.max(0, p.invincible - dt);
    p.portalCooldown = Math.max(0, p.portalCooldown - dt);
    p.railCooldown = Math.max(0, p.railCooldown - dt);

    if (this.ride) {
      this.stepRide(dt, jump);
    } else {
      this.stepWalk(dt, move, jump);
      if (this.finished) return;
    }

    this.updateCrumble(dt);
    this.updateEnemies(dt);
    this.updateHunters(dt);
    this.checkTiles();
    if (this.finished) return;
    if (!this.ride) {
      this.checkFlood();
      if (this.finished) return;
      this.checkEnemies();
      if (this.finished) return;
      this.checkHunters();
    }
  }

  private stepWalk(dt: number, move: { x: number; z: number }, jump: boolean): void {
    const { rules } = this.game;
    const p = this.player;
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

    if (p.onGround) {
      // きえる ゆか に乗った
      for (const [tx, tz] of this.footprint(p.x, p.z)) {
        if (this.tileAt(tx, tz) !== 'crumble') continue;
        const idx = tz * this.width + tx;
        if (!this.crumbling.has(idx)) this.crumbling.set(idx, CRUMBLE_DELAY);
      }
      // のりものに乗る
      if (p.railCooldown <= 0 && this.tileAt(Math.floor(p.x), Math.floor(p.z)) === 'rail') this.board(Math.floor(p.x), Math.floor(p.z));
    }
  }

  private board(tx: number, tz: number): void {
    for (const chain of this.rails) {
      const i = chain.cells.findIndex((c) => c.x === tx && c.z === tz);
      if (i < 0 || chain.cells.length < 2) continue;
      const n = chain.cells.length;
      this.ride = { chain, pos: i, dir: i < n / 2 ? 1 : -1 };
      const p = this.player;
      p.vx = 0;
      p.vz = 0;
      p.vy = 0;
      p.onGround = false;
      this.events.push({ type: 'ride' });
      return;
    }
  }

  private stepRide(dt: number, jump: boolean): void {
    const r = this.ride!;
    const p = this.player;
    const n = r.chain.cells.length;
    const i0 = Math.max(0, Math.min(n - 1, Math.floor(r.pos)));
    const i1 = Math.max(0, Math.min(n - 1, i0 + r.dir));
    const hCur = r.chain.heights[i0];
    const hNext = r.chain.heights[i1];
    // くだりは速く、のぼりはゆっくり
    const v = Math.max(3, Math.min(9, 4.5 + 3 * (hCur - hNext)));
    r.pos += r.dir * v * dt;
    const done = r.dir > 0 ? r.pos >= n - 1 : r.pos <= 0;
    if (done) {
      const end = r.chain.cells[r.dir > 0 ? n - 1 : 0];
      p.x = end.x + 0.5;
      p.z = end.z + 0.5;
      p.y = 1;
      p.vy = 0;
      p.onGround = true;
      p.railCooldown = 1.2;
      this.ride = null;
      return;
    }
    const a = Math.floor(r.pos);
    const b = Math.min(n - 1, a + 1);
    const t = r.pos - a;
    const ca = r.chain.cells[a];
    const cb = r.chain.cells[b];
    const nx = ca.x + 0.5 + (cb.x - ca.x) * t;
    const nz = ca.z + 0.5 + (cb.z - ca.z) * t;
    const dx = nx - p.x;
    const dz = nz - p.z;
    if (Math.hypot(dx, dz) > 1e-4) p.yaw = Math.atan2(dx, dz);
    p.vx = dx / Math.max(dt, 1e-4);
    p.vz = dz / Math.max(dt, 1e-4);
    p.x = nx;
    p.z = nz;
    p.y = r.chain.heights[a] + (r.chain.heights[b] - r.chain.heights[a]) * t;
    // ジャンプで とびおりる
    if (jump && !this.jumpHeld) {
      this.ride = null;
      p.vy = 7.5 + this.game.rules.jump * 0.55;
      p.onGround = false;
      p.railCooldown = 1.2;
      this.events.push({ type: 'jump' });
    }
    this.jumpHeld = jump;
  }

  private updateCrumble(dt: number): void {
    for (const [idx, t] of [...this.crumbling]) {
      const left = t - dt;
      if (left > 0) {
        this.crumbling.set(idx, left);
        continue;
      }
      this.crumbling.delete(idx);
      this.tiles[idx] = tileDef('empty').char;
      this.gone.set(idx, CRUMBLE_RESTORE);
    }
    for (const [idx, t] of [...this.gone]) {
      const left = t - dt;
      if (left > 0) {
        this.gone.set(idx, left);
        continue;
      }
      this.gone.delete(idx);
      this.tiles[idx] = tileDef('crumble').char;
    }
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

  /** おにが歩けるマスか */
  private walkable(tx: number, tz: number): boolean {
    const c = this.column(tx, tz);
    return c.top !== null && !c.solid && !c.cloud && c.tile !== 'water';
  }

  /** プレイヤーの位置からの道のり（マス数）を全マスについて求める */
  private computeFlow(): void {
    const w = this.width;
    const flow = this.flow;
    flow.fill(-1);
    const p = this.player;
    const sx = Math.floor(p.x);
    const sz = Math.floor(p.z);
    if (sx < 0 || sz < 0 || sx >= w || sz >= this.height) return;
    const queue: number[] = [sz * w + sx];
    flow[sz * w + sx] = 0;
    const topOf = (tx: number, tz: number, isSource: boolean) => (isSource ? p.y : (this.column(tx, tz).top ?? 0));
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const cx = cur % w;
      const cz = Math.floor(cur / w);
      const d = flow[cur];
      if (d >= HUNTER_SIGHT) continue;
      const hc = topOf(cx, cz, d === 0);
      for (const [dx, dz] of DIRS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= this.height) continue;
        const ni = nz * w + nx;
        if (flow[ni] !== -1 || !this.walkable(nx, nz)) continue;
        if (Math.abs((this.column(nx, nz).top ?? 0) - hc) > 1.05) continue;
        flow[ni] = d + 1;
        queue.push(ni);
      }
    }
  }

  private updateHunters(dt: number): void {
    if (this.hunters.length === 0) return;
    this.flowTimer -= dt;
    if (this.flowTimer <= 0) {
      this.computeFlow();
      this.flowTimer = 0.2;
    }
    const es = this.game.rules.enemySpeed;
    const v = es === 0 ? 0 : 2.0 + es * 0.6;
    const w = this.width;
    const p = this.player;
    let anyChasing = false;
    for (const h of this.hunters) {
      h.phase += dt;
      const cx = Math.floor(h.x);
      const cz = Math.floor(h.z);
      const d = cx >= 0 && cz >= 0 && cx < w && cz < this.height ? this.flow[cz * w + cx] : -1;
      let tx: number;
      let tz: number;
      if (d >= 0 && d <= HUNTER_SIGHT && !this.ride) {
        h.chasing = true;
        anyChasing = true;
        if (d === 0) {
          tx = p.x;
          tz = p.z;
        } else {
          // いちばんプレイヤーに近いとなりのマスへ
          let best = d;
          tx = cx + 0.5;
          tz = cz + 0.5;
          for (const [dx, dz] of DIRS) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (nx < 0 || nz < 0 || nx >= w || nz >= this.height) continue;
            const nd = this.flow[nz * w + nx];
            if (nd >= 0 && nd < best) {
              best = nd;
              tx = nx + 0.5;
              tz = nz + 0.5;
            }
          }
        }
      } else {
        h.chasing = false;
        tx = h.spawnX;
        tz = h.spawnZ;
      }
      const dx = tx - h.x;
      const dz = tz - h.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05 && v > 0) {
        const stepLen = Math.min(dist, v * dt);
        const nx = h.x + (dx / dist) * stepLen;
        const nz = h.z + (dz / dist) * stepLen;
        // 歩けないマスには入らない
        const ntx = Math.floor(nx);
        const ntz = Math.floor(nz);
        const ok = this.walkable(ntx, ntz) && Math.abs((this.column(ntx, ntz).top ?? 0) - (this.column(cx, cz).top ?? h.y)) <= 1.05;
        if (ok) {
          h.x = nx;
          h.z = nz;
          h.yaw = Math.atan2(dx, dz);
        }
      }
      const top = this.column(Math.floor(h.x), Math.floor(h.z)).top ?? h.y;
      h.y += (top - h.y) * Math.min(1, dt * 12);
    }
    if (anyChasing && !this.hunterAlarm) this.events.push({ type: 'alarm' });
    this.hunterAlarm = anyChasing;
  }

  private dist(tx: number, tz: number): number {
    return Math.hypot(this.player.x - (tx + 0.5), this.player.z - (tz + 0.5));
  }

  private checkTiles(): void {
    const p = this.player;
    const cx = Math.floor(p.x);
    const cz = Math.floor(p.z);
    const under = this.tileAt(cx, cz);

    if (!this.ride) {
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
    }

    for (let tz = cz - 1; tz <= cz + 1; tz++) {
      for (let tx = cx - 1; tx <= cx + 1; tx++) {
        const t = this.tileAt(tx, tz);
        const def = tileDef(t);
        if (!def.pickup && t !== 'goal' && t !== 'portal' && t !== 'checkpoint') continue;
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
        } else if (t === 'portal' && d < 0.45 && p.portalCooldown <= 0 && !this.ride) {
          this.teleport(tx, tz);
        } else if (t === 'checkpoint' && d < 0.7) {
          const idx = tz * this.width + tx;
          if (this.checkpointIdx !== idx) {
            this.checkpointIdx = idx;
            this.respawnX = tx + 0.5;
            this.respawnZ = tz + 0.5;
            this.score += 1;
            this.events.push({ type: 'checkpoint' });
          }
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

  private checkFlood(): void {
    const level = this.floodLevel;
    if (level <= 0) return;
    const p = this.player;
    if (p.invincible > 0) return;
    if (p.y + 0.4 < level) this.hurt();
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

  private checkHunters(): void {
    const p = this.player;
    if (p.invincible > 0) return;
    for (const h of this.hunters) {
      const d = Math.hypot(p.x - h.x, p.z - h.z);
      if (d > 0.75) continue;
      if (Math.abs(p.y - h.y) > 1.2) continue;
      this.caught();
      return;
    }
  }

  /** おにに つかまった：ライフを 1 へらして復活地点へ。おにも持ち場に戻る */
  private caught(): void {
    this.lives--;
    this.events.push({ type: 'caught' });
    if (this.lives <= 0) {
      this.end('lose');
      return;
    }
    this.respawn(2.0);
    for (const h of this.hunters) {
      h.x = h.spawnX;
      h.z = h.spawnZ;
      h.chasing = false;
    }
    this.hunterAlarm = false;
  }

  private hurt(): void {
    this.lives--;
    this.events.push({ type: 'hurt' });
    if (this.lives <= 0) {
      this.end('lose');
      return;
    }
    this.respawn(1.5);
  }

  /** 復活地点（チェックポイント／スタート）へ。水没していれば近くの高い足場へ */
  private respawn(invincible: number): void {
    const p = this.player;
    let rx = this.respawnX;
    let rz = this.respawnZ;
    const level = this.floodLevel;
    if (level > 0 && (this.column(Math.floor(rx), Math.floor(rz)).top ?? 0) + 0.4 < level + 0.2) {
      const safe = this.nearestSafeTile(p.x, p.z, level);
      if (safe) {
        rx = safe.x + 0.5;
        rz = safe.y + 0.5;
      }
    }
    p.x = rx;
    p.z = rz;
    p.y = this.column(Math.floor(rx), Math.floor(rz)).top ?? 1;
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.onGround = true;
    p.invincible = invincible;
    this.ride = null;
    p.railCooldown = 1.0;
  }

  private nearestSafeTile(x: number, z: number, level: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let tz = 0; tz < this.height; tz++) {
      for (let tx = 0; tx < this.width; tx++) {
        const c = this.column(tx, tz);
        if (c.top === null || c.solid || c.cloud || c.tile === 'water' || c.tile === 'spike' || c.tile === 'rail' || c.tile === 'crumble') continue;
        if (c.top < level + 0.6) continue;
        const d = Math.hypot(tx + 0.5 - x, tz + 0.5 - z);
        if (d < bestD) {
          bestD = d;
          best = { x: tx, y: tz };
        }
      }
    }
    return best;
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
