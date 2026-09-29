/**
 * マルチプレイの部屋。
 *
 *  - つくった人（ホスト）がゲームデータを持ち、入ってきた人に送る
 *  - 全員が自分のキャラクターの位置を 1 秒に 12 回ほど送り合い、おたがいの画面に表示する
 *  - きょうそう（race）: だれが先にクリアするか。結果画面にランキングが出る
 *  - おにごっこ（tag）: ホストが最初の おに。タッチすると おにが うつる。時間切れのとき おに だった人の負け
 *
 * サーバーは使わない（端末同士が直接つながる）。
 */
import { useSyncExternalStore } from 'react';
import { createGame } from '../engine/level';
import type { GameData, GameResult } from '../engine/types';
import type { AvatarConfig } from '../store/store';
import { openTransport, randomRoomCode, type Transport } from './transport';

export type RoomMode = 'race' | 'tag';
export type RoomPhase = 'connecting' | 'lobby' | 'playing';

/** ネットワークで送る自分のキャラクターの状態 */
export interface NetState {
  /** 2D: マス座標（左上）。3D: x, z がマス座標、y が高さ */
  x: number;
  y: number;
  z: number;
  /** 3D の向き */
  yaw: number;
  /** 2D の向き */
  f: 1 | -1;
  /** 歩行アニメ */
  w: number;
  g: boolean;
  /** のりものに乗っている */
  r: boolean;
  /** 送った時刻（送り手の時計） */
  t: number;
}

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: AvatarConfig;
  state: NetState | null;
  /** 表示用に補間した位置 */
  shown: { x: number; y: number; z: number; yaw: number } | null;
  finished: { outcome: GameResult['outcome']; timeMs: number; score: number } | null;
  it: boolean;
  isHost: boolean;
  isSelf: boolean;
}

export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  mode: RoomMode;
  isHost: boolean;
  transport: 'p2p' | 'local' | null;
  game: GameData | null;
  players: RoomPlayer[];
  /** おにごっこ の残り秒 */
  round: number;
  error: string | null;
}

export const TAG_SECONDS = 90;
export const TAG_IMMUNE_MS = 2500;
const STATE_INTERVAL_MS = 80;

type Msg =
  | { type: 'hello'; data: { name: string; avatar: AvatarConfig } }
  | { type: 'game'; data: { game: GameData; mode: RoomMode; host: string; phase: RoomPhase; round: number; it: string | null } }
  | { type: 'state'; data: NetState }
  | { type: 'start'; data: { mode: RoomMode; round: number; it: string | null } }
  | { type: 'lobby'; data: null }
  | { type: 'finish'; data: { outcome: GameResult['outcome']; timeMs: number; score: number } }
  | { type: 'tag'; data: { it: string; at: number } }
  | { type: 'mode'; data: { mode: RoomMode } };

export class RoomSession {
  readonly code: string;
  readonly isHost: boolean;
  private transport: Transport | null = null;
  private players = new Map<string, RoomPlayer>();
  private self: RoomPlayer;
  private game: GameData | null;
  private mode: RoomMode = 'race';
  private phase: RoomPhase = 'connecting';
  private round = 0;
  private hostId: string | null = null;
  private itId: string | null = null;
  private lastTagAt = 0;
  private lastSent = 0;
  private error: string | null = null;
  private version = 0;
  private snapshot: RoomSnapshot | null = null;
  private listeners = new Set<() => void>();
  private closed = false;

  private constructor(code: string, isHost: boolean, game: GameData | null, me: { name: string; avatar: AvatarConfig }) {
    this.code = code;
    this.isHost = isHost;
    this.game = game;
    this.self = { id: '', name: me.name, avatar: me.avatar, state: null, shown: null, finished: null, it: false, isHost, isSelf: true };
  }

  /** 部屋をつくる（ホスト） */
  static create(game: GameData, me: { name: string; avatar: AvatarConfig }, mode: RoomMode = 'race', connect: (code: string) => Promise<Transport> = openTransport, code = randomRoomCode()): RoomSession {
    const s = new RoomSession(code, true, game, me);
    s.mode = mode;
    s.phase = 'lobby';
    void s.open(connect);
    return s;
  }

  /** コードで入る（ゲスト） */
  static join(code: string, me: { name: string; avatar: AvatarConfig }, connect: (code: string) => Promise<Transport> = openTransport): RoomSession {
    const s = new RoomSession(code, false, null, me);
    void s.open(connect);
    return s;
  }

  private async open(connect: (code: string) => Promise<Transport>): Promise<void> {
    try {
      const t = await connect(this.code);
      if (this.closed) {
        t.close();
        return;
      }
      this.transport = t;
      this.self.id = t.selfId;
      if (this.isHost) this.hostId = t.selfId;
      this.players.set(t.selfId, this.self);
      t.onPeerJoin((id) => {
        this.send('hello', { name: this.self.name, avatar: this.self.avatar }, id);
        this.bump();
      });
      t.onPeerLeave((id) => {
        this.players.delete(id);
        if (this.itId === id && this.phase === 'playing' && this.isHost) this.setIt(t.selfId, true);
        this.bump();
      });
      t.onMessage((type, data, from) => this.handle({ type, data } as Msg, from));
      // すでにいる人にあいさつ
      for (const id of t.peers()) this.send('hello', { name: this.self.name, avatar: this.self.avatar }, id);
      this.bump();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'つなげませんでした';
      this.bump();
    }
  }

  private send(type: Msg['type'], data: unknown, to?: string): void {
    this.transport?.send(type, data, to);
  }

  private handle(m: Msg, from: string): void {
    switch (m.type) {
      case 'hello': {
        const existing = this.players.get(from);
        const p: RoomPlayer = existing ?? { id: from, name: '', avatar: m.data.avatar, state: null, shown: null, finished: null, it: this.itId === from, isHost: false, isSelf: false };
        p.name = m.data.name || 'ゲスト';
        p.avatar = m.data.avatar;
        this.players.set(from, p);
        if (!existing) this.send('hello', { name: this.self.name, avatar: this.self.avatar }, from);
        // ゲームを持っていれば送る（ホスト、またはすでに受け取ったゲスト）
        if (this.game) this.send('game', { game: this.game, mode: this.mode, host: this.hostId ?? this.self.id, phase: this.phase, round: this.round, it: this.itId }, from);
        this.bump();
        break;
      }
      case 'game': {
        if (this.isHost) break;
        if (!this.game) this.game = createGame(m.data.game);
        this.mode = m.data.mode;
        this.hostId = m.data.host;
        for (const p of this.players.values()) p.isHost = p.id === this.hostId;
        if (this.phase === 'connecting') this.phase = m.data.phase === 'playing' ? 'playing' : 'lobby';
        if (m.data.phase === 'playing') this.round = m.data.round;
        this.applyIt(m.data.it);
        this.bump();
        break;
      }
      case 'state': {
        const p = this.players.get(from);
        if (p) p.state = m.data;
        break;
      }
      case 'start':
        if (from !== this.hostId && this.hostId) break;
        this.mode = m.data.mode;
        this.round = m.data.round;
        this.phase = 'playing';
        for (const p of this.players.values()) p.finished = null;
        this.applyIt(m.data.it);
        this.lastTagAt = Date.now();
        this.bump();
        break;
      case 'lobby':
        this.phase = 'lobby';
        this.bump();
        break;
      case 'finish': {
        const p = this.players.get(from);
        if (p) p.finished = m.data;
        this.bump();
        break;
      }
      case 'tag':
        this.applyIt(m.data.it);
        this.lastTagAt = Date.now();
        this.bump();
        break;
      case 'mode':
        if (!this.isHost) {
          this.mode = m.data.mode;
          this.bump();
        }
        break;
    }
  }

  private applyIt(id: string | null): void {
    this.itId = id;
    for (const p of this.players.values()) p.it = p.id === id;
  }

  /* ---------- ホストの操作 ---------- */

  setMode(mode: RoomMode): void {
    if (!this.isHost) return;
    this.mode = mode;
    this.send('mode', { mode });
    this.bump();
  }

  /** みんなでスタート（ホスト） */
  start(): void {
    if (!this.isHost) return;
    this.round += 1;
    this.phase = 'playing';
    for (const p of this.players.values()) p.finished = null;
    const it = this.mode === 'tag' ? this.self.id : null;
    this.applyIt(it);
    this.lastTagAt = Date.now();
    this.send('start', { mode: this.mode, round: this.round, it });
    this.bump();
  }

  /** ロビーに戻す（ホスト） */
  backToLobby(): void {
    this.phase = 'lobby';
    if (this.isHost) this.send('lobby', null);
    this.bump();
  }

  private setIt(id: string, broadcast: boolean): void {
    this.applyIt(id);
    this.lastTagAt = Date.now();
    if (broadcast) this.send('tag', { it: id, at: this.lastTagAt });
    this.bump();
  }

  /* ---------- プレイ中の操作 ---------- */

  /** 自分の状態を送る（呼び出し頻度は高くてよい。内部で間引く） */
  sendState(s: Omit<NetState, 't'>): void {
    const now = Date.now();
    this.self.state = { ...s, t: now };
    if (now - this.lastSent < STATE_INTERVAL_MS) return;
    this.lastSent = now;
    this.send('state', this.self.state);
  }

  /** 自分がクリア／ゲームオーバーした */
  finish(result: GameResult): void {
    const f = { outcome: result.outcome, timeMs: result.timeMs, score: result.score };
    this.self.finished = f;
    this.send('finish', f);
    this.bump();
  }

  /** おにごっこ：自分が おに で相手にタッチしたら おに を うつす */
  tag(targetId: string): void {
    if (this.mode !== 'tag' || !this.self.it || targetId === this.self.id) return;
    if (Date.now() - this.lastTagAt < TAG_IMMUNE_MS) return;
    this.setIt(targetId, true);
  }

  /** 自分が おに か */
  get amIt(): boolean {
    return this.self.it;
  }

  /** ほかの人（表示用）。位置は補間して返す */
  others(dt: number): RoomPlayer[] {
    const out: RoomPlayer[] = [];
    for (const p of this.players.values()) {
      if (p.isSelf || !p.state) continue;
      const s = p.state;
      if (!p.shown) p.shown = { x: s.x, y: s.y, z: s.z, yaw: s.yaw };
      else {
        const k = Math.min(1, dt * 14);
        p.shown.x += (s.x - p.shown.x) * k;
        p.shown.y += (s.y - p.shown.y) * k;
        p.shown.z += (s.z - p.shown.z) * k;
        let d = s.yaw - p.shown.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        p.shown.yaw += d * k;
      }
      out.push(p);
    }
    return out;
  }

  get currentGame(): GameData | null {
    return this.game;
  }
  get currentMode(): RoomMode {
    return this.mode;
  }
  get currentPhase(): RoomPhase {
    return this.phase;
  }
  get selfId(): string {
    return this.self.id;
  }

  leave(): void {
    this.closed = true;
    this.transport?.close();
    this.transport = null;
    this.bump();
  }

  /* ---------- React 用 ---------- */

  private bump(): void {
    this.version++;
    this.snapshot = null;
    for (const l of this.listeners) l();
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = (): RoomSnapshot => {
    if (!this.snapshot) {
      this.snapshot = {
        code: this.code,
        phase: this.phase,
        mode: this.mode,
        isHost: this.isHost,
        transport: this.transport?.kind ?? null,
        game: this.game,
        players: [...this.players.values()].map((p) => ({ ...p })),
        round: this.round,
        error: this.error,
      };
    }
    return this.snapshot;
  };
}

/* ---------- いま入っている部屋（アプリ全体で 1 つ） ---------- */

let current: RoomSession | null = null;
const roomListeners = new Set<() => void>();

export function currentRoom(): RoomSession | null {
  return current;
}

export function setCurrentRoom(r: RoomSession | null): void {
  if (current && current !== r) current.leave();
  current = r;
  // デバッグ用（開発者ツールから状態を見られるようにする）
  (window as unknown as { __weblox_room?: RoomSession | null }).__weblox_room = r;
  for (const l of roomListeners) l();
}

export function useCurrentRoom(): RoomSession | null {
  return useSyncExternalStore(
    (l) => {
      roomListeners.add(l);
      return () => roomListeners.delete(l);
    },
    () => current,
    () => current,
  );
}

export function useRoomSnapshot(room: RoomSession | null): RoomSnapshot | null {
  return useSyncExternalStore(
    (l) => (room ? room.subscribe(l) : () => {}),
    () => (room ? room.getSnapshot() : null),
    () => (room ? room.getSnapshot() : null),
  );
}

/** ロビー・参加リンク */
export function roomUrl(code: string): string {
  const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';
  return `${base}#/room/${code}`;
}
