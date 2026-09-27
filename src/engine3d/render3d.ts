/**
 * three.js による 3D モードの描画。ロジックは sim.ts に分離してある。
 * このモジュールは動的 import され、2D ゲームだけを遊ぶ人には読み込まれない。
 */
import * as THREE from 'three';
import type { RuntimeEvent } from '../engine/runtime';
import { liquidColors, themeDef } from '../engine/themes';
import { stepHeight, tileDef, tileFromChar } from '../engine/tiles';
import type { GameData, TileId } from '../engine/types';
import type { AvatarConfig } from '../store/store';
import { buildAvatar, type AvatarRig } from './avatar3d';
import { CLOUD_BOTTOM, CLOUD_TOP, PLAYER_HEIGHT, type Sim3D, WALL_HEIGHT, WATER_TOP } from './sim';

export interface CameraState {
  yaw: number;
  pitch: number;
  distance: number;
}

const textureCache = new Map<string, THREE.Texture>();

function emojiTexture(emoji: string, size = 128): THREE.Texture {
  const cached = textureCache.get(emoji);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.font = `${Math.round(size * 0.8)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(emoji, tex);
  return tex;
}

function makeSprite(emoji: string, scale = 0.9): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({ map: emojiTexture(emoji), transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

interface Particle {
  sprite: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export class Renderer3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private game: GameData;
  private items = new Map<number, THREE.Object3D>();
  private doors = new Map<number, THREE.Mesh>();
  private enemySprites: THREE.Sprite[] = [];
  private avatar: AvatarRig;
  private particles: Particle[] = [];
  private decor: THREE.Sprite[] = [];
  private sun: THREE.DirectionalLight;

  constructor(canvas: HTMLCanvasElement, game: GameData, avatarConfig: AvatarConfig) {
    this.game = game;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(60, 16 / 10, 0.1, 200);

    const th = themeDef(game.theme);
    // 背景と霧は空の色。床の色と混ざらないよう、奈落の底は暗くする（buildWorld 参照）
    this.scene.background = new THREE.Color(th.skyTop);
    this.scene.fog = new THREE.Fog(th.skyTop, 30, 90);

    // 暗いテーマ（うちゅう・かざん）でもブロックが見えるように、環境光は白ベースにする
    const hemi = new THREE.HemisphereLight('#ffffff', th.ground, 0.75);
    this.scene.add(hemi);
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.35));
    const sun = new THREE.DirectionalLight('#ffffff', 1.5);
    sun.position.set(game.width * 0.6, 18, game.height * 0.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const extent = Math.max(game.width, game.height) * 0.75;
    sun.shadow.camera.left = -extent;
    sun.shadow.camera.right = extent;
    sun.shadow.camera.top = extent;
    sun.shadow.camera.bottom = -extent;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.target.position.set(game.width / 2, 0, game.height / 2);
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this.buildWorld();

    // 遠景の飾り
    for (let i = 0; i < 14; i++) {
      const s = makeSprite(th.decor[i % th.decor.length], 2.5 + Math.random() * 2);
      const a = (i / 14) * Math.PI * 2;
      const r = Math.max(game.width, game.height) * 1.2 + Math.random() * 10;
      s.position.set(game.width / 2 + Math.cos(a) * r, 2 + Math.random() * 10, game.height / 2 + Math.sin(a) * r);
      this.scene.add(s);
      this.decor.push(s);
    }

    // 主人公＝自分のアバター（シャツの胸にはゲームの主人公絵文字をプリント）
    this.avatar = buildAvatar(avatarConfig, game.hero);
    this.scene.add(this.avatar.group);
  }

  private buildWorld(): void {
    const g = this.game;
    const th = themeDef(g.theme);
    const groundMat = new THREE.MeshLambertMaterial({ color: th.ground });
    const groundTopMat = new THREE.MeshLambertMaterial({ color: th.floor });
    const groundAltTopMat = new THREE.MeshLambertMaterial({ color: th.floorAlt });
    const wallMat = new THREE.MeshLambertMaterial({ color: th.wall });
    const wallTopMat = new THREE.MeshLambertMaterial({ color: th.wallEdge });
    const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
    const lc = liquidColors(g.theme);
    const waterMat = new THREE.MeshLambertMaterial({ color: lc.main, transparent: true, opacity: 0.85, emissive: th.liquid ? lc.main : '#000000', emissiveIntensity: th.liquid ? 0.5 : 0 });
    const doorMat = new THREE.MeshLambertMaterial({ color: '#8b5a2b' });
    const spikeMat = new THREE.MeshLambertMaterial({ color: '#c0c0c0' });
    const springMat = new THREE.MeshLambertMaterial({ color: '#ffb300' });

    const box = new THREE.BoxGeometry(1, 1, 1);
    const groundCount = g.tiles.split('').filter((c) => {
      const t = tileFromChar(c);
      return t !== 'empty' && t !== 'wall' && t !== 'door' && t !== 'cloud' && t !== 'water';
    }).length;
    const wallCount = g.tiles.split('').filter((c) => tileFromChar(c) === 'wall').length;
    const stepCount = g.tiles.split('').filter((c) => stepHeight(tileFromChar(c)) !== null).length;

    // 床ブロック：側面はテーマの土色、上面は市松の床色（マテリアル配列）
    const groundMats = [groundMat, groundMat, groundTopMat, groundMat, groundMat, groundMat];
    const groundAltMats = [groundMat, groundMat, groundAltTopMat, groundMat, groundMat, groundMat];
    const groundA = new THREE.InstancedMesh(box, groundMats, Math.max(1, groundCount));
    const groundB = new THREE.InstancedMesh(box, groundAltMats, Math.max(1, groundCount));
    const walls = new THREE.InstancedMesh(box, [wallMat, wallMat, wallTopMat, wallMat, wallMat, wallMat], Math.max(1, wallCount));
    // 高い床（段）：高いほど明るい色にして、段差が見分けやすいようにする
    const stepMeshes = new Map<number, { mesh: THREE.InstancedMesh; i: number }>();
    for (const h of [2, 3, 4, 5]) {
      const top = new THREE.Color(th.floor).lerp(new THREE.Color('#ffffff'), (h - 1) * 0.16);
      const side = new THREE.Color(th.ground).lerp(new THREE.Color('#ffffff'), (h - 1) * 0.1);
      const topMat = new THREE.MeshLambertMaterial({ color: top });
      const sideMat = new THREE.MeshLambertMaterial({ color: side });
      const mesh = new THREE.InstancedMesh(box, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat], Math.max(1, stepCount));
      stepMeshes.set(h, { mesh, i: 0 });
    }
    for (const m of [groundA, groundB, walls, ...[...stepMeshes.values()].map((s) => s.mesh)]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    let ia = 0;
    let ib = 0;
    let iw = 0;
    const mat4 = new THREE.Matrix4();

    for (let tz = 0; tz < g.height; tz++) {
      for (let tx = 0; tx < g.width; tx++) {
        const idx = tz * g.width + tx;
        const t = tileFromChar(g.tiles.charAt(idx));
        const cx = tx + 0.5;
        const cz = tz + 0.5;
        if (t === 'empty') continue;
        if (t === 'wall') {
          mat4.makeScale(1, WALL_HEIGHT, 1).setPosition(cx, WALL_HEIGHT / 2, cz);
          walls.setMatrixAt(iw++, mat4);
          continue;
        }
        const sh = stepHeight(t);
        if (sh !== null) {
          const entry = stepMeshes.get(sh)!;
          mat4.makeScale(1, sh, 1).setPosition(cx, sh / 2, cz);
          entry.mesh.setMatrixAt(entry.i++, mat4);
          continue;
        }
        if (t === 'door') {
          const d = new THREE.Mesh(new THREE.BoxGeometry(1, WALL_HEIGHT, 1), doorMat);
          d.position.set(cx, WALL_HEIGHT / 2, cz);
          d.castShadow = true;
          d.receiveShadow = true;
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07), new THREE.MeshLambertMaterial({ color: '#ffd54f' }));
          knob.position.set(0.3, -0.2, 0.52);
          d.add(knob);
          this.scene.add(d);
          this.doors.set(idx, d);
          continue;
        }
        if (t === 'cloud') {
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.96, CLOUD_TOP - CLOUD_BOTTOM, 0.96), cloudMat);
          c.position.set(cx, (CLOUD_TOP + CLOUD_BOTTOM) / 2, cz);
          c.receiveShadow = true;
          this.scene.add(c);
          continue;
        }
        if (t === 'water') {
          const w = new THREE.Mesh(new THREE.BoxGeometry(1, WATER_TOP, 1), waterMat);
          w.position.set(cx, WATER_TOP / 2, cz);
          this.scene.add(w);
          continue;
        }
        // 床
        mat4.makeScale(1, 1, 1).setPosition(cx, 0.5, cz);
        if ((tx + tz) % 2 === 0) groundA.setMatrixAt(ia++, mat4);
        else groundB.setMatrixAt(ib++, mat4);

        // 床の上の物
        if (t === 'spike') {
          const s = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 4), spikeMat);
          s.position.set(cx, 1.25, cz);
          s.castShadow = true;
          this.scene.add(s);
          this.items.set(idx, s);
        } else if (t === 'spring') {
          const s = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.15, 16), springMat);
          s.position.set(cx, 1.075, cz);
          this.scene.add(s);
          this.items.set(idx, s);
        } else if (t !== 'ground' && t !== 'start' && t !== 'enemy') {
          const def = tileDef(t);
          const sp = makeSprite(def.emoji, t === 'goal' ? 1.2 : 0.8);
          sp.position.set(cx, 1.55, cz);
          this.scene.add(sp);
          this.items.set(idx, sp);
        }
      }
    }
    groundA.count = ia;
    groundB.count = ib;
    walls.count = iw;
    groundA.instanceMatrix.needsUpdate = true;
    groundB.instanceMatrix.needsUpdate = true;
    walls.instanceMatrix.needsUpdate = true;
    this.scene.add(groundA, groundB, walls);
    for (const { mesh, i } of stepMeshes.values()) {
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    }

    // 奈落の底
    const abyssColor = new THREE.Color(th.skyTop).multiplyScalar(0.55);
    const abyss = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: abyssColor }));
    abyss.rotation.x = -Math.PI / 2;
    abyss.position.set(g.width / 2, -30, g.height / 2);
    this.scene.add(abyss);
  }

  attachEnemies(count: number): void {
    for (const s of this.enemySprites) this.scene.remove(s);
    this.enemySprites = [];
    for (let i = 0; i < count; i++) {
      const s = makeSprite(this.game.enemyEmoji ?? tileDef('enemy').emoji, 0.95);
      this.scene.add(s);
      this.enemySprites.push(s);
    }
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** ゲームイベントに応じてエフェクトを出す */
  handleEvents(events: RuntimeEvent[], sim: Sim3D): void {
    const p = sim.player;
    const emit = (emoji: string, n: number) => {
      for (let i = 0; i < n; i++) {
        const s = makeSprite(emoji, 0.45);
        s.position.set(p.x, p.y + 1, p.z);
        const a = Math.random() * Math.PI * 2;
        this.scene.add(s);
        this.particles.push({ sprite: s, vx: Math.cos(a) * 2, vy: 3 + Math.random() * 2, vz: Math.sin(a) * 2, life: 0.8 });
      }
    };
    for (const e of events) {
      switch (e.type) {
        case 'coin':
          emit('✨', 4);
          break;
        case 'gem':
          emit('💎', 5);
          break;
        case 'heart':
          emit('❤️', 4);
          break;
        case 'key':
          emit('🔑', 3);
          break;
        case 'stomp':
          emit('💥', 5);
          break;
        case 'hurt':
          emit('💫', 5);
          break;
        case 'win':
          emit('🎉', 14);
          emit('⭐', 8);
          break;
        default:
          break;
      }
    }
  }

  render(sim: Sim3D, cam: CameraState, dt: number): void {
    const g = this.game;
    const p = sim.player;
    const t = sim.time;

    // アイテムの表示同期・アニメ
    for (const [idx, obj] of this.items) {
      const cur = tileFromChar(sim.tiles[idx] ?? '.');
      const orig = tileFromChar(g.tiles.charAt(idx));
      obj.visible = cur === orig;
      if (obj instanceof THREE.Sprite && obj.visible) {
        const def = tileDef(orig as TileId);
        if (def.pickup) obj.position.y = 1.55 + Math.sin(t * 4 + idx) * 0.08;
        if (orig === 'portal') obj.material.rotation = t * 3;
      }
    }
    for (const [idx, door] of this.doors) door.visible = tileFromChar(sim.tiles[idx] ?? '.') === 'door';

    // 敵
    if (this.enemySprites.length !== sim.enemies.length) this.attachEnemies(sim.enemies.length);
    sim.enemies.forEach((e, i) => {
      const s = this.enemySprites[i];
      s.visible = e.alive;
      s.position.set(e.x, e.y + 0.55 + Math.sin(e.phase * 6) * 0.05, e.z);
    });

    // アバター
    const av = this.avatar;
    av.group.position.set(p.x, p.y, p.z);
    av.group.rotation.y = p.yaw;
    av.pose(p.walkPhase, Math.hypot(p.vx, p.vz) > 0.1, p.onGround);
    av.group.visible = !(p.invincible > 0 && Math.floor(t * 12) % 2 === 0);

    // パーティクル
    for (const q of this.particles) {
      q.life -= dt;
      q.vy -= 8 * dt;
      q.sprite.position.x += q.vx * dt;
      q.sprite.position.y += q.vy * dt;
      q.sprite.position.z += q.vz * dt;
      (q.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, q.life / 0.8);
      if (q.life <= 0) this.scene.remove(q.sprite);
    }
    this.particles = this.particles.filter((q) => q.life > 0);

    // 遠景をゆっくり回す
    for (let i = 0; i < this.decor.length; i++) this.decor[i].position.y += Math.sin(t * 0.5 + i) * 0.002;

    // カメラ（三人称・追従）
    const target = new THREE.Vector3(p.x, Math.max(p.y, -2) + PLAYER_HEIGHT * 0.7, p.z);
    const cp = Math.cos(cam.pitch);
    const desired = new THREE.Vector3(
      target.x + Math.sin(cam.yaw) * cp * cam.distance,
      target.y + Math.sin(cam.pitch) * cam.distance,
      target.z + Math.cos(cam.yaw) * cp * cam.distance,
    );
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(target);

    // 影の中心をプレイヤーに
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.position.set(p.x + 8, 18, p.z + 10);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}
