import type { ThemeId } from './types';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  emoji: string;
  /** 背景グラデーション（上→下） */
  skyTop: string;
  skyBottom: string;
  /** 上から見るモードの床 */
  floor: string;
  floorAlt: string;
  ground: string;
  groundEdge: string;
  wall: string;
  wallEdge: string;
  /** 背景に散らす飾り */
  decor: string[];
  /** 「みず」タイルの色（かざんでは溶岩になる） */
  liquid?: string;
  liquidLight?: string;
  liquidName?: string;
}

export const THEMES: readonly ThemeDef[] = [
  {
    id: 'meadow',
    name: 'そうげん',
    emoji: '🌳',
    skyTop: '#6ec6ff',
    skyBottom: '#c8f2ff',
    floor: '#8fd97a',
    floorAlt: '#7fcf6b',
    ground: '#7a4b2a',
    groundEdge: '#5dbb46',
    wall: '#9a9a9a',
    wallEdge: '#6d6d6d',
    decor: ['☁️', '🌳', '🌼'],
  },
  {
    id: 'space',
    name: 'うちゅう',
    emoji: '🚀',
    skyTop: '#0b1035',
    skyBottom: '#2a2a72',
    floor: '#3a3a6e',
    floorAlt: '#33335f',
    ground: '#6c6c9c',
    groundEdge: '#a7a7ff',
    wall: '#3f3f7a',
    wallEdge: '#8181e0',
    decor: ['⭐', '🪐', '✨'],
  },
  {
    id: 'ocean',
    name: 'うみ',
    emoji: '🐠',
    skyTop: '#0288d1',
    skyBottom: '#4fc3f7',
    floor: '#f5e6b3',
    floorAlt: '#eddca6',
    ground: '#c9a86a',
    groundEdge: '#f7e8b9',
    wall: '#3d8f8f',
    wallEdge: '#2a6666',
    decor: ['🐠', '🫧', '🐚'],
  },
  {
    id: 'candy',
    name: 'おかし',
    emoji: '🍭',
    skyTop: '#ffb3d9',
    skyBottom: '#fff0f7',
    floor: '#ffe0f0',
    floorAlt: '#ffd6ea',
    ground: '#c26a8a',
    groundEdge: '#ff8fc2',
    wall: '#b18cff',
    wallEdge: '#7f5ad9',
    decor: ['🍬', '🧁', '🍭'],
  },
  {
    id: 'volcano',
    name: 'かざん',
    emoji: '🌋',
    skyTop: '#3a0d0d',
    skyBottom: '#8a2c1a',
    floor: '#7a4a44',
    floorAlt: '#6c3f3a',
    ground: '#4a2c2c',
    groundEdge: '#ff7a3d',
    wall: '#5a3a3a',
    wallEdge: '#a06a55',
    decor: ['🔥', '🌋', '💥'],
    liquid: '#ff5a1f',
    liquidLight: '#ffb347',
    liquidName: 'ようがん',
  },
  {
    id: 'snow',
    name: 'ゆき',
    emoji: '⛄',
    skyTop: '#b3d9ff',
    skyBottom: '#ffffff',
    floor: '#eaf6ff',
    floorAlt: '#dcefff',
    ground: '#9ec9e8',
    groundEdge: '#ffffff',
    wall: '#6fa7cc',
    wallEdge: '#4d7fa3',
    decor: ['❄️', '⛄', '🎄'],
  },
];

export function themeDef(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** 「みず」タイルの色（テーマごと） */
export function liquidColors(id: ThemeId): { main: string; light: string } {
  const th = themeDef(id);
  return { main: th.liquid ?? '#2196f3', light: th.liquidLight ?? '#90caf9' };
}

export const HEROES: readonly string[] = ['🙂', '😺', '🐶', '🐰', '🐸', '🦊', '🐼', '🦄', '🤖', '👻', '🐧', '🦖'];
