import { useCallback, useRef } from 'react';
import { sfx } from '../audio';
import { getTile, replaceAll, setTile } from '../engine/level';
import { themeDef } from '../engine/themes';
import { tileDef } from '../engine/tiles';
import type { GameData, TileId } from '../engine/types';

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
  const th = themeDef(game.theme);
  const painting = useRef(false);
  const lastIdx = useRef(-1);
  const tilesRef = useRef(game.tiles);
  tilesRef.current = game.tiles;

  const paint = useCallback(
    (idx: number) => {
      if (idx === lastIdx.current) return;
      lastIdx.current = idx;
      const x = idx % game.width;
      const y = Math.floor(idx / game.width);
      const cur = getTile({ width: game.width, height: game.height, tiles: tilesRef.current }, x, y);
      if (cur === tool) return;
      let next = tilesRef.current;
      if (tool === 'start') next = replaceAll(next, 'start', 'empty');
      next = setTile(next, game.width, x, y, tool);
      tilesRef.current = next;
      onChange(next);
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
    let bg = (x + y) % 2 === 0 ? th.floor : th.floorAlt;
    if (game.rules.mode === 'platformer') bg = (x + y) % 2 === 0 ? th.skyBottom : th.skyTop;
    if (game.rules.mode === '3d' && t === 'empty') bg = (x + y) % 2 === 0 ? '#0b0f18' : '#111827'; // 奈落
    if (t === 'ground') bg = game.rules.mode === '3d' ? ((x + y) % 2 === 0 ? th.floor : th.floorAlt) : th.ground;
    if (t === 'wall') bg = th.wall;
    let content = '';
    if (t === 'start') content = game.hero;
    else if (t !== 'empty' && t !== 'ground' && t !== 'wall') content = def.emoji;
    cells.push(
      <div
        key={i}
        className="cell"
        data-idx={i}
        style={{ width: cell, height: cell, background: bg, fontSize: cell * 0.7 }}
        role="gridcell"
        aria-label={`${x + 1},${y + 1} ${def.label}`}
      >
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
