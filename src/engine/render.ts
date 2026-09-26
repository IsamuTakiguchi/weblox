import type { GameRuntime } from './runtime';
import { themeDef } from './themes';
import { tileDef, tileFromChar } from './tiles';
import type { GameData, TileId } from './types';

export interface Camera {
  x: number;
  y: number;
  tile: number;
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, game: GameData, time: number): void {
  const th = themeDef(game.theme);
  if (game.rules.mode === 'platformer') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // ゆっくり流れる飾り
    ctx.globalAlpha = 0.35;
    ctx.font = `${Math.round(h / 9)}px serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.23 + time * 0.012) % 1.2) * w - w * 0.1;
      const y = h * (0.12 + ((i * 0.37) % 0.5));
      ctx.fillText(th.decor[i % th.decor.length], x, y);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = th.floor;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawTile(ctx: CanvasRenderingContext2D, t: TileId, px: number, py: number, s: number, game: GameData, time: number, gx: number, gy: number): void {
  const th = themeDef(game.theme);
  const topdown = game.rules.mode === 'topdown';
  if (topdown && t !== 'wall' && t !== 'ground' && t !== 'door') {
    // 市松模様の床
    ctx.fillStyle = (gx + gy) % 2 === 0 ? th.floor : th.floorAlt;
    ctx.fillRect(px, py, s + 0.5, s + 0.5);
  }
  switch (t) {
    case 'ground':
      ctx.fillStyle = th.ground;
      ctx.fillRect(px, py, s + 0.5, s + 0.5);
      ctx.fillStyle = th.groundEdge;
      ctx.fillRect(px, py, s + 0.5, Math.max(2, s * 0.18));
      return;
    case 'wall':
      ctx.fillStyle = th.wall;
      ctx.fillRect(px, py, s + 0.5, s + 0.5);
      ctx.strokeStyle = th.wallEdge;
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.strokeRect(px + s * 0.08, py + s * 0.08, s * 0.84, s * 0.84);
      ctx.beginPath();
      ctx.moveTo(px, py + s / 2);
      ctx.lineTo(px + s, py + s / 2);
      ctx.moveTo(px + s / 2, py);
      ctx.lineTo(px + s / 2, py + s / 2);
      ctx.moveTo(px + s * 0.25, py + s / 2);
      ctx.lineTo(px + s * 0.25, py + s);
      ctx.moveTo(px + s * 0.75, py + s / 2);
      ctx.lineTo(px + s * 0.75, py + s);
      ctx.stroke();
      return;
    case 'door':
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(px + s * 0.1, py + s * 0.05, s * 0.8, s * 0.95);
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(px + s * 0.68, py + s * 0.55, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'water': {
      ctx.fillStyle = '#2196f3';
      ctx.fillRect(px, py + s * 0.25, s + 0.5, s * 0.75 + 0.5);
      ctx.fillStyle = '#90caf9';
      const wave = Math.sin(time * 4 + gx) * s * 0.05;
      ctx.fillRect(px, py + s * 0.25 + wave, s + 0.5, s * 0.1);
      return;
    }
    case 'cloud':
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.roundRect(px + s * 0.02, py + s * 0.3, s * 0.96, s * 0.5, s * 0.25);
      ctx.fill();
      return;
    case 'empty':
    case 'start':
      return;
    default: {
      const def = tileDef(t);
      let dy = 0;
      if (def.pickup) dy = Math.sin(time * 5 + gx * 0.7 + gy * 0.3) * s * 0.06;
      if (t === 'goal') dy = Math.sin(time * 3) * s * 0.04;
      if (t === 'portal') {
        ctx.save();
        ctx.translate(px + s / 2, py + s / 2);
        ctx.rotate(time * 3);
        ctx.font = `${Math.round(s * 0.8)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.emoji, 0, 0);
        ctx.restore();
        return;
      }
      ctx.font = `${Math.round(s * 0.78)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.emoji, px + s / 2, py + s / 2 + dy + s * 0.02);
    }
  }
}

/** ゲーム画面を描く */
export function renderRuntime(ctx: CanvasRenderingContext2D, rt: GameRuntime, w: number, h: number): Camera {
  const game = rt.game;
  const tile = Math.min(w / game.width, h / game.height);
  // マップがキャンバスより大きければカメラ追従
  const viewW = w / tile;
  const viewH = h / tile;
  const camX = Math.max(0, Math.min(game.width - viewW, rt.player.x + rt.player.w / 2 - viewW / 2));
  const camY = Math.max(0, Math.min(game.height - viewH, rt.player.y + rt.player.h / 2 - viewH / 2));
  const offX = game.width < viewW ? (w - game.width * tile) / 2 : 0;
  const offY = game.height < viewH ? (h - game.height * tile) / 2 : 0;
  const s = tile;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0f1420';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(offX, offY, Math.min(w, game.width * tile), Math.min(h, game.height * tile));
  ctx.clip();
  drawBackground(ctx, w, h, game, rt.time);

  const toPx = (x: number) => offX + (x - camX) * s;
  const toPy = (y: number) => offY + (y - camY) * s;

  const x0 = Math.max(0, Math.floor(camX));
  const y0 = Math.max(0, Math.floor(camY));
  const x1 = Math.min(game.width - 1, Math.ceil(camX + viewW));
  const y1 = Math.min(game.height - 1, Math.ceil(camY + viewH));
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const t = tileFromChar(rt.tiles[gy * game.width + gx] ?? '.');
      drawTile(ctx, t, toPx(gx), toPy(gy), s, game, rt.time, gx, gy);
    }
  }

  // 敵
  ctx.font = `${Math.round(s * 0.8)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const e of rt.enemies) {
    if (!e.alive) continue;
    const bob = Math.sin(e.phase * 6) * s * 0.05;
    ctx.save();
    ctx.translate(toPx(e.x + 0.5), toPy(e.y + 0.5) + bob);
    if (e.dir < 0) ctx.scale(-1, 1);
    ctx.fillText(tileDef('enemy').emoji, 0, 0);
    ctx.restore();
  }

  // 主人公
  const p = rt.player;
  const blink = p.invincible > 0 && Math.floor(rt.time * 12) % 2 === 0;
  if (!blink) {
    ctx.save();
    ctx.translate(toPx(p.x + p.w / 2), toPy(p.y + p.h / 2));
    if (p.facing < 0) ctx.scale(-1, 1);
    const squash = game.rules.mode === 'platformer' && !p.onGround ? 1.08 : 1;
    ctx.scale(1 / squash, squash);
    ctx.font = `${Math.round(s * 0.85)}px serif`;
    ctx.fillText(game.hero, 0, s * 0.02);
    ctx.restore();
  }

  // パーティクル
  ctx.font = `${Math.round(s * 0.45)}px serif`;
  for (const q of rt.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 1.6));
    ctx.fillText(q.text, toPx(q.x), toPy(q.y));
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  return { x: camX, y: camY, tile };
}

function shade(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

/** 3D モードのマップを等角投影（ななめ上から見た図）で描く */
export function renderIsometric(ctx: CanvasRenderingContext2D, game: GameData, w: number, h: number, showStart = true): void {
  const th = themeDef(game.theme);
  const W = game.width;
  const H = game.height;
  // タイル幅 tw、奥行き th = tw/2、高さ 1 ブロック = hz
  const maxH = 3;
  const unitW = w / ((W + H) * 0.5 + 1);
  const unitH = h / ((W + H) * 0.25 + maxH * 0.5 + 1.5);
  const tw = Math.min(unitW, unitH * 2);
  const td = tw / 2;
  const hz = tw * 0.5;
  const originX = w / 2 + ((H - W) * tw) / 4;
  const originY = (h - ((W + H) * td) / 2) / 2 + maxH * hz * 0.4;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, th.skyTop);
  g.addColorStop(1, th.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const px = (x: number, y: number, z: number) => ({ sx: originX + ((x - y) * tw) / 2, sy: originY + ((x + y) * td) / 2 - z * hz });

  const heightOf = (t: TileId): number => {
    if (t === 'empty') return 0;
    if (t === 'wall' || t === 'door') return 3;
    if (t === 'water') return 0.6;
    if (t === 'cloud') return 2.5;
    return 1;
  };

  const drawBlock = (x: number, y: number, bottom: number, top: number, topColor: string, sideColor: string) => {
    const a = px(x, y, top);
    const b = px(x + 1, y, top);
    const c = px(x + 1, y + 1, top);
    const d = px(x, y + 1, top);
    // 左側面（y+1 側）
    const d0 = px(x, y + 1, bottom);
    const c0 = px(x + 1, y + 1, bottom);
    ctx.fillStyle = shade(sideColor, 0.85);
    ctx.beginPath();
    ctx.moveTo(d.sx, d.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(c0.sx, c0.sy);
    ctx.lineTo(d0.sx, d0.sy);
    ctx.closePath();
    ctx.fill();
    // 右側面（x+1 側）
    const b0 = px(x + 1, y, bottom);
    ctx.fillStyle = shade(sideColor, 0.65);
    ctx.beginPath();
    ctx.moveTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(c0.sx, c0.sy);
    ctx.lineTo(b0.sx, b0.sy);
    ctx.closePath();
    ctx.fill();
    // 上面
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(d.sx, d.sy);
    ctx.closePath();
    ctx.fill();
  };

  // 奥から手前へ
  for (let s = 0; s <= W + H - 2; s++) {
    for (let x = 0; x < W; x++) {
      const y = s - x;
      if (y < 0 || y >= H) continue;
      const t = tileFromChar(game.tiles.charAt(y * W + x));
      const top = heightOf(t);
      if (top === 0) continue;
      if (t === 'wall' || t === 'door') drawBlock(x, y, 0, top, t === 'door' ? '#a86c3a' : th.wallEdge, t === 'door' ? '#8b5a2b' : th.wall);
      else if (t === 'water') drawBlock(x, y, 0, top, '#64b5f6', '#1e88e5');
      else if (t === 'cloud') drawBlock(x, y, 2, top, '#ffffff', '#e3f2fd');
      else drawBlock(x, y, 0, 1, (x + y) % 2 === 0 ? th.floor : th.floorAlt, th.ground);
      // 上に載る物
      const def = tileDef(t);
      let emoji = '';
      if (t === 'start') emoji = showStart ? game.hero : '';
      else if (t !== 'ground' && t !== 'wall' && t !== 'door' && t !== 'water' && t !== 'cloud' && t !== 'empty') emoji = def.emoji;
      if (emoji) {
        const c = px(x + 0.5, y + 0.5, top);
        ctx.font = `${Math.round(tw * 0.55)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, c.sx, c.sy - tw * 0.3);
      }
    }
  }
}

/** エディタ用：静止したマップを描く（サムネイルにも使う） */
export function renderStatic(ctx: CanvasRenderingContext2D, game: GameData, w: number, h: number, showStart = true): void {
  if (game.rules.mode === '3d') {
    renderIsometric(ctx, game, w, h, showStart);
    return;
  }
  const tile = Math.min(w / game.width, h / game.height);
  const offX = (w - game.width * tile) / 2;
  const offY = (h - game.height * tile) / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0f1420';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(offX, offY, game.width * tile, game.height * tile);
  ctx.clip();
  ctx.translate(offX, offY);
  drawBackground(ctx, game.width * tile, game.height * tile, game, 0);
  for (let gy = 0; gy < game.height; gy++) {
    for (let gx = 0; gx < game.width; gx++) {
      const t = tileFromChar(game.tiles.charAt(gy * game.width + gx));
      drawTile(ctx, t, gx * tile, gy * tile, tile, game, 0, gx, gy);
      if (t === 'start' && showStart) {
        ctx.font = `${Math.round(tile * 0.85)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(game.hero, gx * tile + tile / 2, gy * tile + tile / 2 + tile * 0.02);
      }
    }
  }
  ctx.restore();
}

/** サムネイル画像（data URL）。Canvas が使えない環境では null */
export function thumbnailDataUrl(game: GameData, width = 320, height = 200): string | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  renderStatic(ctx, game, width, height);
  try {
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}
