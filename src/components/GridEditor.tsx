import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { sfx } from '../audio';
import { getTile, replaceAll, setTile } from '../engine/level';
import { themeDef } from '../engine/themes';
import { hunterEmoji, stepHeight, tileDef } from '../engine/tiles';
import type { GameData, TileId } from '../engine/types';

/**
 * マスの見た目（エディタとパレットで共通）。
 * じめん・かべ・だん は「ブロック」として立体的に描き、何もないマス（床／奈落／空）とはっきり区別する。
 */
export function tileLook(t: TileId, game: Pick<GameData, 'theme' | 'rules'>, x = 0, y = 0): { className: string; style: CSSProperties } {
  const th = themeDef(game.theme);
  const mode = game.rules.mode;
  const alt = (x + y) % 2 === 0;
  if (t === 'ground') {
    // 上が草（テーマのふち色）、下が土のブロック
    return { className: 'tile-block tile-ground', style: { '--top': th.groundEdge, '--body': th.ground } as CSSProperties };
  }
  if (t === 'wall') return { className: 'tile-block tile-wall', style: { '--body': th.wall, '--line': th.wallEdge } as CSSProperties };
  const sh = stepHeight(t);
  if (sh !== null) return { className: 'tile-block tile-ground tile-step', style: { '--top': th.groundEdge, '--body': th.ground } as CSSProperties };
  if (t === 'rail') return { className: 'tile-block tile-rail', style: {} };
  if (t === 'crumble') return { className: 'tile-block tile-crumble', style: { '--body': th.ground } as CSSProperties };
  if (t === 'door') return { className: 'tile-block tile-door', style: {} };
  // ブロックでないマスの背景
  if (mode === '3d' && t === 'empty') return { className: 'tile-void', style: {} }; // 3D の空マス＝奈落
  const bg = mode === 'platformer' ? (alt ? th.skyBottom : th.skyTop) : alt ? th.floor : th.floorAlt;
  return { className: 'tile-open', style: { background: bg } };
}

/** パレットのボタンに出す小さな見本（じめん・かべなどはマスと同じ見た目） */
export function TileSwatch({ tile, game }: { tile: TileId; game: Pick<GameData, 'theme' | 'rules' | 'hero' | 'enemyEmoji'> }) {
  const look = tileLook(tile, game);
  const block = look.className.includes('tile-block') || look.className === 'tile-void';
  if (!block) return null;
  const sh = stepHeight(tile);
  return (
    <span className={`tile-swatch ${look.className}`} style={look.style} aria-hidden>
      {sh !== null && <span className="tile-step-num">{sh}</span>}
    </span>
  );
}

interface Props {
  game: GameData;
  tool: TileId;
  onChange: (tiles: string) => void;
  /** マスの大きさ(px) */
  cell: number;
}

/**
 * タップ／ドラッグでマスを塗るエディタ。
 * DOM のグリッドで作っているので、指でも正確に操作できる。
 */
export function GridEditor({ game, tool, onChange, cell }: Props) {
  const painting = useRef(false);
  const lastIdx = useRef(-1);
  const tilesRef = useRef(game.tiles);
  tilesRef.current = game.tiles;
  // 置いたばかりのマス（ぽんっと はねるアニメ）
  const [popped, setPopped] = useState<Map<number, number>>(() => new Map());
  // 置こうとしたが、すでに同じものがあったマス（ゆらして知らせる）
  const [same, setSame] = useState<{ idx: number; n: number } | null>(null);
  useEffect(() => {
    if (popped.size === 0) return;
    const id = setTimeout(() => setPopped(new Map()), 450);
    return () => clearTimeout(id);
  }, [popped]);

  const paint = useCallback(
    (idx: number) => {
      if (idx === lastIdx.current) return;
      lastIdx.current = idx;
      const x = idx % game.width;
      const y = Math.floor(idx / game.width);
      const cur = getTile({ width: game.width, height: game.height, tiles: tilesRef.current }, x, y);
      if (cur === tool) {
        // すでに同じものがある（例：3D の じめん は はじめから しいてある）ことを ゆらして知らせる
        setSame((s) => ({ idx, n: (s?.n ?? 0) + 1 }));
        return;
      }
      let next = tilesRef.current;
      if (tool === 'start') next = replaceAll(next, 'start', 'empty');
      next = setTile(next, game.width, x, y, tool);
      tilesRef.current = next;
      onChange(next);
      setPopped((m) => new Map(m).set(idx, Date.now()));
      if (tool === 'empty') sfx.erase();
      else sfx.place();
    },
    [game.width, game.height, tool, onChange],
  );

  const idxFromEvent = (e: React.PointerEvent): number => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const v = el?.dataset?.idx;
    return v === undefined ? -1 : Number(v);
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    painting.current = true;
    lastIdx.current = -1;
    const i = idxFromEvent(e);
    if (i >= 0) paint(i);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!painting.current) return;
    const i = idxFromEvent(e);
    if (i >= 0) paint(i);
  };
  const onUp = () => {
    painting.current = false;
    lastIdx.current = -1;
  };

  const cells = [];
  for (let i = 0; i < game.width * game.height; i++) {
    const x = i % game.width;
    const y = Math.floor(i / game.width);
    const t = getTile(game, x, y);
    const def = tileDef(t);
    const is3d = game.rules.mode === '3d';
    // アイテムなどは、その下が床であることがわかるように 3D では床ブロックの上に描く
    const underIsGround = is3d && t !== 'empty' && t !== 'wall' && t !== 'water' && t !== 'cloud' && t !== 'door' && stepHeight(t) === null && t !== 'rail' && t !== 'crumble';
    const look = tileLook(underIsGround ? 'ground' : t, game, x, y);
    let content = '';
    if (t === 'start') content = game.hero;
    else if (t === 'enemy') content = game.enemyEmoji ?? def.emoji;
    else if (t === 'hunter') content = hunterEmoji(game);
    else if (t !== 'empty' && t !== 'ground' && t !== 'wall' && t !== 'door' && t !== 'rail' && t !== 'crumble' && stepHeight(t) === null) content = def.emoji;
    const sh = stepHeight(t);
    const pop = popped.has(i);
    const shake = same?.idx === i;
    cells.push(
      <div
        key={shake ? `${i}-same-${same!.n}` : i}
        className={`cell ${look.className} ${pop ? 'cell-pop' : ''} ${shake ? 'cell-same' : ''}`}
        data-idx={i}
        style={{ width: cell, height: cell, fontSize: cell * 0.7, ...look.style }}
        role="gridcell"
        aria-label={`${x + 1},${y + 1} ${def.label}`}
      >
        {sh !== null && <span className="tile-step-num">{sh}</span>}
        {t === 'door' && '🚪'}
        {content}
      </div>,
    );
  }

  return (
    <div className="grid-editor-wrap" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onPointerCancel={onUp}>
      <div
        className="grid-editor"
        role="grid"
        style={{ gridTemplateColumns: `repeat(${game.width}, ${cell}px)`, width: game.width * cell + (game.width - 1) }}
      >
        {cells}
      </div>
    </div>
  );
}
