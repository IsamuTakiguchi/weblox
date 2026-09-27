/**
 * Roblox 風のブロックアバター（クラシックな R6 体型）を three.js で組み立てる。
 * 1 スタッド = 0.32 ユニット：頭 1×1×1、胴 2×2×1、腕・脚 1×2×1 → 全高 1.6（= PLAYER_HEIGHT）
 */
import * as THREE from 'three';
import type { AvatarConfig } from '../store/store';

export const STUD = 0.32;

export interface AvatarRig {
  group: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  /** 歩行・ジャンプのポーズを更新する */
  pose(walkPhase: number, moving: boolean, onGround: boolean): void;
}

const faceCache = new Map<string, THREE.CanvasTexture>();
const emojiCache = new Map<string, THREE.CanvasTexture>();

/** 顔の種類。絵文字から Roblox 風の描き顔に対応づける（対応がなければ絵文字を貼る） */
type FaceStyle = 'classic' | 'happy' | 'cool' | 'party' | 'star' | 'cat' | 'wink' | 'robot' | 'emoji';

function faceStyleOf(emoji: string): FaceStyle {
  switch (emoji) {
    case '😀':
      return 'classic';
    case '🥳':
      return 'party';
    case '😎':
      return 'cool';
    case '🤩':
      return 'star';
    case '😺':
      return 'cat';
    case '🤖':
      return 'robot';
    case '😉':
      return 'wink';
    case '😄':
      return 'happy';
    default:
      return 'emoji';
  }
}

/** 顔テクスチャ（肌色の上に目と口を描く） */
export function faceTexture(emoji: string, skin: string): THREE.CanvasTexture {
  const key = `${emoji}|${skin}`;
  const cached = faceCache.get(key);
  if (cached) return cached;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, size, size);
  const style = faceStyleOf(emoji);
  ctx.fillStyle = '#111';
  ctx.strokeStyle = '#111';
  ctx.lineCap = 'round';
  const eye = (x: number, y: number, w = 22, h = 34) => {
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, w / 2);
    ctx.fill();
  };
  const smile = (y: number, r: number, from = 0.15, to = 0.85) => {
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(size / 2, y, r, Math.PI * from, Math.PI * to);
    ctx.stroke();
  };
  switch (style) {
    case 'classic':
      eye(size * 0.36, size * 0.42);
      eye(size * 0.64, size * 0.42);
      smile(size * 0.5, size * 0.22);
      break;
    case 'happy':
      ctx.lineWidth = 9;
      for (const x of [0.36, 0.64]) {
        ctx.beginPath();
        ctx.arc(size * x, size * 0.46, 16, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(size * 0.3, size * 0.6);
      ctx.quadraticCurveTo(size * 0.5, size * 0.85, size * 0.7, size * 0.6);
      ctx.closePath();
      ctx.fill();
      break;
    case 'cool':
      ctx.fillRect(size * 0.2, size * 0.36, size * 0.6, 12);
      ctx.beginPath();
      ctx.roundRect(size * 0.22, size * 0.38, size * 0.24, size * 0.16, 8);
      ctx.roundRect(size * 0.54, size * 0.38, size * 0.24, size * 0.16, 8);
      ctx.fill();
      smile(size * 0.56, size * 0.16, 0.2, 0.8);
      break;
    case 'party':
      eye(size * 0.36, size * 0.42);
      eye(size * 0.64, size * 0.42);
      ctx.beginPath();
      ctx.ellipse(size * 0.5, size * 0.66, size * 0.16, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.ellipse(size * 0.5, size * 0.72, size * 0.1, size * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'star':
      ctx.font = `${size * 0.22}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', size * 0.36, size * 0.42);
      ctx.fillText('⭐', size * 0.64, size * 0.42);
      ctx.fillStyle = '#111';
      smile(size * 0.52, size * 0.2);
      break;
    case 'cat':
      eye(size * 0.36, size * 0.42, 18, 34);
      eye(size * 0.64, size * 0.42, 18, 34);
      ctx.fillStyle = '#e57373';
      ctx.beginPath();
      ctx.moveTo(size * 0.46, size * 0.58);
      ctx.lineTo(size * 0.54, size * 0.58);
      ctx.lineTo(size * 0.5, size * 0.64);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(size * 0.44, size * 0.66, 14, Math.PI * 0.1, Math.PI * 0.9);
      ctx.arc(size * 0.56, size * 0.66, 14, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      break;
    case 'wink':
      eye(size * 0.36, size * 0.42);
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(size * 0.64, size * 0.46, 16, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      smile(size * 0.5, size * 0.22);
      break;
    case 'robot':
      ctx.fillStyle = '#263238';
      ctx.fillRect(size * 0.2, size * 0.32, size * 0.6, size * 0.2);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(size * 0.26, size * 0.37, size * 0.16, size * 0.1);
      ctx.fillRect(size * 0.58, size * 0.37, size * 0.16, size * 0.1);
      ctx.fillStyle = '#263238';
      for (let i = 0; i < 5; i++) ctx.fillRect(size * (0.3 + i * 0.09), size * 0.62, size * 0.06, size * 0.08);
      break;
    default:
      ctx.font = `${size * 0.8}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  faceCache.set(key, tex);
  return tex;
}

/** シャツの胸に描く絵文字（透過） */
function printTexture(emoji: string): THREE.CanvasTexture {
  const cached = emojiCache.get(emoji);
  if (cached) return cached;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.font = `${size * 0.7}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  emojiCache.set(emoji, tex);
  return tex;
}

function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

/** ぼうし・アクセサリー */
function buildHat(id: string, skin: string): THREE.Object3D | null {
  const S = STUD;
  const g = new THREE.Group();
  const lam = (color: string) => new THREE.MeshLambertMaterial({ color });
  switch (id) {
    case 'cap': {
      const top = new THREE.Mesh(new THREE.SphereGeometry(S * 0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), lam('#e53935'));
      top.position.y = S * 0.5;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(S * 0.9, S * 0.08, S * 0.7), lam('#c62828'));
      brim.position.set(0, S * 0.52, S * 0.7);
      g.add(top, brim);
      break;
    }
    case 'hardhat': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(S * 0.66, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), lam('#fdd835'));
      dome.position.y = S * 0.5;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.8, S * 0.8, S * 0.08, 20), lam('#f9a825'));
      brim.position.y = S * 0.5;
      g.add(dome, brim);
      break;
    }
    case 'party': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(S * 0.4, S * 1.1, 16), lam('#ff4081'));
      cone.position.y = S * 1.05;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(S * 0.12, 10, 8), lam('#ffeb3b'));
      ball.position.y = S * 1.62;
      g.add(cone, ball);
      break;
    }
    case 'tophat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.85, S * 0.85, S * 0.08, 20), lam('#212121'));
      brim.position.y = S * 0.52;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.55, S * 0.55, S * 0.9, 20), lam('#212121'));
      top.position.y = S * 0.97;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.56, S * 0.56, S * 0.16, 20), lam('#e53935'));
      band.position.y = S * 0.62;
      g.add(brim, top, band);
      break;
    }
    case 'pirate': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(S * 0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), lam('#3e2723'));
      dome.position.y = S * 0.5;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(S * 1.5, S * 0.1, S * 0.9), lam('#3e2723'));
      brim.position.y = S * 0.62;
      brim.rotation.x = -0.15;
      const skull = new THREE.Sprite(new THREE.SpriteMaterial({ map: printTexture('☠️'), transparent: true }));
      skull.scale.set(S * 0.5, S * 0.5, 1);
      skull.position.set(0, S * 0.85, S * 0.55);
      g.add(dome, brim, skull);
      break;
    }
    case 'crown': {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.55, S * 0.5, S * 0.35, 8), lam('#ffd600'));
      ring.position.y = S * 0.66;
      g.add(ring);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(S * 0.1, S * 0.3, 6), lam('#ffd600'));
        spike.position.set(Math.cos(a) * S * 0.5, S * 0.95, Math.sin(a) * S * 0.5);
        g.add(spike);
      }
      const gem = new THREE.Mesh(new THREE.SphereGeometry(S * 0.1, 10, 8), lam('#e53935'));
      gem.position.set(0, S * 0.7, S * 0.55);
      g.add(gem);
      break;
    }
    case 'wizard': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.95, S * 0.95, S * 0.08, 20), lam('#5e35b1'));
      brim.position.y = S * 0.52;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(S * 0.5, S * 1.5, 16), lam('#5e35b1'));
      cone.position.y = S * 1.25;
      cone.rotation.z = 0.15;
      const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: printTexture('⭐'), transparent: true }));
      star.scale.set(S * 0.5, S * 0.5, 1);
      star.position.set(S * 0.15, S * 1.2, S * 0.45);
      g.add(brim, cone, star);
      break;
    }
    case 'robot': {
      // 段ボール箱のロボット頭（写真の 2 番目のキャラ風）
      const cardboard = lam('#c49a6c');
      const bx = box(S * 1.4, S * 1.3, S * 1.3, cardboard);
      bx.position.y = S * 0.15;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(S * 1.2, S * 1.1), new THREE.MeshBasicMaterial({ map: faceTexture('🤖', '#c49a6c'), transparent: true }));
      face.position.set(0, S * 0.15, S * 0.66);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.04, S * 0.04, S * 0.6, 8), lam('#9e9e9e'));
      antenna.position.y = S * 1.05;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(S * 0.12, 10, 8), lam('#ff5252'));
      bulb.position.y = S * 1.35;
      g.add(bx, face, antenna, bulb);
      break;
    }
    case 'knight': {
      // 兜（写真の 1 番目のキャラ風）
      const helm = box(S * 1.15, S * 1.15, S * 1.15, lam('#c62828'));
      helm.position.y = S * 0.08;
      const visor = new THREE.Mesh(new THREE.BoxGeometry(S * 0.9, S * 0.16, S * 0.05), lam('#111'));
      visor.position.set(0, S * 0.1, S * 0.6);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(S * 0.12, S * 0.5, S * 0.9), lam('#ffd600'));
      crest.position.y = S * 0.85;
      g.add(helm, visor, crest);
      break;
    }
    case 'star':
    case 'rainbow':
    case 'rocket': {
      const emoji = id === 'star' ? '⭐' : id === 'rainbow' ? '🌈' : '🚀';
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: printTexture(emoji), transparent: true, depthWrite: false }));
      sp.scale.set(S * 1.3, S * 1.3, 1);
      sp.position.y = S * 1.2;
      g.add(sp);
      break;
    }
    default:
      return null;
  }
  void skin;
  return g;
}

export function buildAvatar(cfg: AvatarConfig, shirtPrint?: string): AvatarRig {
  const S = STUD;
  const group = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: cfg.skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: cfg.color });
  const pantsMat = new THREE.MeshLambertMaterial({ color: cfg.pants });
  const shoeMat = new THREE.MeshLambertMaterial({ color: '#222' });

  // 脚（下 0.25 スタッドは靴）
  const mkLeg = () => {
    const leg = box(S, S * 2, S, pantsMat);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(S * 1.02, S * 0.35, S * 1.1), shoeMat);
    shoe.position.set(0, -S * 0.83, S * 0.04);
    leg.add(shoe);
    return leg;
  };
  const legL = mkLeg();
  const legR = mkLeg();
  legL.position.set(-S * 0.5, S, 0);
  legR.position.set(S * 0.5, S, 0);
  // 回転の支点を脚の付け根にするため、ジオメトリを下にずらす
  for (const l of [legL, legR]) {
    l.geometry.translate(0, -S, 0);
    l.position.y = S * 2;
    (l.children[0] as THREE.Mesh).position.y -= S;
  }

  // 胴（前面にプリント）
  const torsoMats: THREE.Material[] = [shirtMat, shirtMat, shirtMat, shirtMat, shirtMat, shirtMat];
  const torso = box(S * 2, S * 2, S, torsoMats);
  torso.position.set(0, S * 3, 0);
  if (shirtPrint) {
    const print = new THREE.Mesh(new THREE.PlaneGeometry(S * 1.1, S * 1.1), new THREE.MeshBasicMaterial({ map: printTexture(shirtPrint), transparent: true, depthWrite: false }));
    print.position.set(0, S * 0.1, S * 0.51);
    torso.add(print);
  }

  // 腕（肩を支点に回す）
  const mkArm = () => {
    const arm = box(S, S * 2, S, [skinMat, skinMat, shirtMat, skinMat, skinMat, skinMat]);
    arm.geometry.translate(0, -S * 0.8, 0);
    // 袖：上 40% はシャツ色
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(S * 1.04, S * 0.8, S * 1.04), shirtMat);
    sleeve.position.y = -S * 0.2;
    arm.add(sleeve);
    return arm;
  };
  const armL = mkArm();
  const armR = mkArm();
  armL.position.set(-S * 1.5, S * 3.8, 0);
  armR.position.set(S * 1.5, S * 3.8, 0);

  // 頭（少し丸みのある箱）＋顔
  const head = box(S * 1.2, S, S, skinMat);
  head.position.set(0, S * 4.5, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(S * 1.1, S * 0.9), new THREE.MeshBasicMaterial({ map: faceTexture(cfg.face, cfg.skin), transparent: false }));
  face.position.set(0, 0, S * 0.505);
  head.add(face);
  const hat = buildHat(cfg.hat, cfg.skin);
  if (hat) head.add(hat);

  group.add(legL, legR, torso, armL, armR, head);

  const rig: AvatarRig = {
    group,
    head,
    torso,
    armL,
    armR,
    legL,
    legR,
    pose(walkPhase, moving, onGround) {
      const swing = moving && onGround ? Math.sin(walkPhase) * 0.8 : 0;
      armL.rotation.x = onGround ? swing : -2.6;
      armR.rotation.x = onGround ? -swing : -2.6;
      armL.rotation.z = onGround ? 0 : 0.25;
      armR.rotation.z = onGround ? 0 : -0.25;
      legL.rotation.x = onGround ? -swing : 0.35;
      legR.rotation.x = onGround ? swing : -0.35;
    },
  };
  return rig;
}
