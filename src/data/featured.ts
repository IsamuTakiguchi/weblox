import { createGame } from '../engine/level';
import type { GameRules, PublishedGame } from '../engine/types';

const T0 = Date.UTC(2026, 0, 1);

function rows(...r: string[]): { width: number; height: number; tiles: string } {
  const width = r[0].length;
  for (const line of r) {
    if (line.length !== width) throw new Error(`row length mismatch: "${line}"`);
  }
  return { width, height: r.length, tiles: r.join('') };
}

function make(
  id: string,
  title: string,
  description: string,
  theme: PublishedGame['theme'],
  hero: string,
  rules: GameRules,
  grid: { width: number; height: number; tiles: string },
  stats: { plays: number; likes: number },
): PublishedGame {
  return {
    ...createGame({
      id,
      title,
      description,
      author: 'Weblox',
      authorAvatar: '🧊',
      theme,
      hero,
      rules,
      kidMode: false,
      createdAt: T0,
      updatedAt: T0,
      ...grid,
    }),
    publishedAt: T0,
    plays: stats.plays,
    likes: stats.likes,
    featured: true,
  };
}

export const FEATURED_GAMES: readonly PublishedGame[] = [
  make(
    'featured_maze',
    'はじめてのめいろ',
    'かべにぶつからないように、ゴールの旗をめざそう。コインもひろってね！',
    'meadow',
    '🐰',
    { mode: 'topdown', speed: 3, jump: 3, lives: 3, timeLimit: 0, win: 'goal', enemySpeed: 1 },
    rows(
      'WWWWWWWWWWWW',
      'WP..W...o..W',
      'W.W.W.WWW..W',
      'W.W...W.o..W',
      'W.WWW.W.WW.W',
      'W...W...W..W',
      'Wo..W.E.WfGW',
      'WWWWWWWWWWWW',
    ),
    { plays: 1280, likes: 342 },
  ),
  make(
    'featured_island',
    'ぴょんぴょんアイランド',
    'ジャンプで足場をわたって、右のゴールへ。みずに落ちないように！てきは上からふむとたおせるよ。',
    'ocean',
    '🐸',
    { mode: 'platformer', speed: 3, jump: 3, lives: 3, timeLimit: 0, win: 'goal', enemySpeed: 2 },
    rows(
      '................',
      '................',
      '.......o........',
      '......###...o...',
      '..o.........###.',
      '..##....o.......',
      '.......###....~~',
      'P...........o..G',
      '####..####..E###',
      '####ww####ww####',
    ),
    { plays: 980, likes: 275 },
  ),
  make(
    'featured_coins',
    'コインだいさくせん',
    'コインをぜんぶ集めるとクリア！てきにさわらないように気をつけて。ハートでライフがふえるよ。',
    'candy',
    '😺',
    { mode: 'topdown', speed: 4, jump: 3, lives: 3, timeLimit: 60, win: 'coins', enemySpeed: 3 },
    rows(
      'WWWWWWWWWWWWWWWW',
      'Wo....W....o...W',
      'W.WW..W.WW...W.W',
      'W..W.oW..W.E.W.W',
      'W..W..W..W...WoW',
      'WP.WWWW.E....W.W',
      'W......WWWW.WW.W',
      'W.E..o....+....W',
      'Wo...WWW..W.*.oW',
      'WWWWWWWWWWWWWWWW',
    ),
    { plays: 760, likes: 198 },
  ),
  make(
    'featured_castle',
    'かぎとドアのぼうけん',
    'かぎをひろってドアを開けよう。ばねで大ジャンプ、ワープで遠くへひとっとび！',
    'space',
    '🤖',
    { mode: 'platformer', speed: 3, jump: 3, lives: 4, timeLimit: 0, win: 'goal', enemySpeed: 2 },
    rows(
      '........................',
      '....................o...',
      '.............*.....###..',
      '..........~~~~..........',
      '...o..........o.....@...',
      '..###......###....####..',
      '................k.......',
      '@..............###.....W',
      '..........o............W',
      'P.S.......##...E....D..G',
      '####^^####^^############',
      '########################',
    ),
    { plays: 640, likes: 210 },
  ),
  make(
    'featured_obby3d',
    '3D オビー・スカイタワー',
    '空にうかぶ足場をわたる立体コース！おちないように気をつけて。ドラッグでカメラをまわして、スペースでジャンプ。',
    'space',
    '🤖',
    { mode: '3d', speed: 3, jump: 3, lives: 3, timeLimit: 0, win: 'goal', enemySpeed: 2 },
    rows(
      '#P####.......###',
      '####o#.......#o#',
      '..####...~...###',
      '..#o.#.......W..',
      '..####..E###.#..',
      '.....#..####W#..',
      '..~..#...o.###..',
      '.....####.#.....',
      '.f.......####S..',
      '.........###o#G#',
    ),
    { plays: 420, likes: 160 },
  ),
];
